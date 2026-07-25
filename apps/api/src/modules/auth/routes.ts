import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updateProfileSchema,
  usernameAvailabilitySchema,
  verifyEmailSchema,
  type AuthSession,
  type AuthUser,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseBody, parseQuery } from '../../lib/http';
import { badRequest, conflict, forbidden, unauthorized, unprocessable } from '../../lib/errors';
import { emailEnabled, isDevelopment } from '../../config/env';
import { requireAuth } from '../../middleware/auth';
import { assertOtpRequestAllowed, issueOtp, verifyOtp } from './otp';
import { sendPasswordResetEmail, sendVerificationEmail } from './mailer';
import { burnPasswordComparison, hashPassword, verifyPassword } from './passwords';
import {
  REFRESH_COOKIE,
  accessTokenTtlSeconds,
  clearRefreshCookie,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  setRefreshCookie,
  signAccessToken,
} from './tokens';

/**
 * Sign up once with a username and password, confirm the email with a code,
 * then log in with the username and password forever after.
 *
 * The previous design mailed a code on every single sign-in. It reads as
 * frictionless and is the opposite in the one place this app is used: a ground
 * with bad signal, where the scorer's email is on a different device and the
 * match is waiting on them.
 */
export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, username, name, password } = parseBody(registerSchema, req.body);

    await assertOtpRequestAllowed(email, clientIp(req.ip));

    const [byEmail, byUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username }, select: { id: true } }),
    ]);

    if (byEmail?.emailVerifiedAt) {
      throw conflict('An account already exists for this email — sign in instead');
    }

    if (byUsername && byUsername.id !== byEmail?.id) {
      throw conflict('That username is already taken');
    }

    const passwordHash = await hashPassword(password);

    // An unverified signup is not an account yet, so re-registering the same
    // address simply replaces it. Otherwise a typo in the email — or a code
    // that never arrived — would permanently squat on both the address and
    // whatever username was chosen with it.
    if (byEmail) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { username, name, passwordHash },
      });
    } else {
      await prisma.user.create({ data: { email, username, name, passwordHash } });
    }

    const code = await issueOtp(email);
    await sendVerificationEmail(email, code);

    res.status(202).json({
      status: 'verification_sent',
      email,
      /** Dev convenience only — never returned once emails actually send. */
      devCode: !emailEnabled && isDevelopment ? code : undefined,
    });
  }),
);

/** Confirms the address and signs the new account straight in. */
authRouter.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { email, code } = parseBody(verifyEmailSchema, req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw unauthorized('That code is incorrect or has expired');

    await verifyOtp(email, code);

    const verified = user.emailVerifiedAt
      ? user
      : await prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });

    const refreshToken = await issueRefreshToken(verified.id);
    setRefreshCookie(res, refreshToken);

    res.json(sessionFor(verified));
  }),
);

authRouter.post(
  '/resend-verification',
  asyncHandler(async (req, res) => {
    const { email } = parseBody(resendVerificationSchema, req.body);

    await assertOtpRequestAllowed(email, clientIp(req.ip));

    const user = await prisma.user.findUnique({ where: { email } });

    // Always the same response. Whether an address has a pending signup is
    // not something an unauthenticated caller gets to find out.
    if (user && !user.emailVerifiedAt) {
      const code = await issueOtp(email);
      await sendVerificationEmail(email, code);

      res.status(202).json({
        status: 'verification_sent',
        devCode: !emailEnabled && isDevelopment ? code : undefined,
      });
      return;
    }

    res.status(202).json({ status: 'verification_sent' });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { identifier, password } = parseBody(loginSchema, req.body);

    const user = identifier.includes('@')
      ? await prisma.user.findUnique({ where: { email: identifier } })
      : await prisma.user.findUnique({ where: { username: identifier } });

    if (!user) {
      // Spend the time a real comparison would have, then fail identically.
      await burnPasswordComparison();
      throw unauthorized('Incorrect username or password');
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw unauthorized('Incorrect username or password');

    // Distinct from a wrong password on purpose: the caller already proved
    // they hold this account's password, so there is nothing left to leak,
    // and "your code is waiting in your inbox" is the only useful thing to say.
    if (!user.emailVerifiedAt) {
      throw unprocessable(
        'EMAIL_UNVERIFIED',
        'Confirm your email address to finish setting up this account',
        { email: user.email },
      );
    }

    const refreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    res.json(sessionFor(user));
  }),
);

authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = parseBody(forgotPasswordSchema, req.body);

    await assertOtpRequestAllowed(email, clientIp(req.ip));

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    let code: string | null = null;

    if (user) {
      code = await issueOtp(email, 'PASSWORD_RESET');
      await sendPasswordResetEmail(email, code);
    }

    // Identical response either way. "No account for that address" is exactly
    // the answer someone probing for registered emails is looking for, and the
    // person who genuinely mistyped theirs is no worse off — they get no code
    // and try again.
    res.status(202).json({
      status: 'reset_sent',
      devCode: code && !emailEnabled && isDevelopment ? code : undefined,
    });
  }),
);

/**
 * Completing a reset proves control of the inbox, which is strictly more than
 * email verification asks for — so it confirms the address too. That is what
 * lets an account created before passwords existed recover on its own instead
 * of needing someone to run a script against the database.
 */
authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { email, code, newPassword } = parseBody(resetPasswordSchema, req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw badRequest('That code is incorrect or has expired');

    await verifyOtp(email, code, 'PASSWORD_RESET');

    const passwordHash = await hashPassword(newPassword);

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      }),
      // Whoever knew the old password loses every session. If the reset was
      // prompted by someone else having got in, this is the part that matters.
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    const refreshToken = await issueRefreshToken(updated.id);
    setRefreshCookie(res, refreshToken);

    res.json(sessionFor(updated));
  }),
);

/** Rotates the refresh cookie and mints a new access token. */
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (typeof presented !== 'string' || !presented) {
      throw unauthorized('No active session');
    }

    const { userId, token } = await rotateRefreshToken(presented);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized('No active session');

    setRefreshCookie(res, token);
    res.json(sessionFor(user));
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (typeof presented === 'string' && presented) {
      await revokeRefreshToken(presented);
    }
    clearRefreshCookie(res);
    res.status(204).end();
  }),
);

/** Signup-form check, so a taken handle is caught before the form is submitted. */
authRouter.get(
  '/username-available',
  asyncHandler(async (req, res) => {
    const { username } = parseQuery(usernameAvailabilitySchema, req.query);

    const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });

    res.json({ username, available: !taken });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw unauthorized();
    res.json(toAuthUser(user));
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = parseBody(updateProfileSchema, req.body);

    if (input.username) {
      const taken = await prisma.user.findFirst({
        where: { username: input.username, id: { not: req.user!.id } },
        select: { id: true },
      });
      if (taken) throw conflict('That username is already taken');
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.username ? { username: input.username } : {}),
      },
    });

    // Squad slots carry a denormalized copy of the handle so the scoring UI
    // never needs the join; a rename has to reach them or a squad list will
    // show a handle that no longer resolves.
    if (input.username) {
      await prisma.player.updateMany({
        where: { userId: user.id },
        data: { username: user.username },
      });
    }

    res.json(toAuthUser(user));
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parseBody(changePasswordSchema, req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw unauthorized();

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw forbidden('That is not your current password');

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(newPassword) },
      }),
      // Changing a password is how someone responds to losing a device. It
      // would be worth very little if the old sessions kept working.
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    clearRefreshCookie(res);
    res.status(204).end();
  }),
);

// ───────────────────────────────────────────────────── serializers ──

type UserRecord = {
  id: string;
  email: string;
  username: string;
  name: string;
  createdAt: Date;
};

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

function sessionFor(user: UserRecord): AuthSession {
  return {
    user: toAuthUser(user),
    accessToken: signAccessToken({ sub: user.id, email: user.email }),
    expiresIn: accessTokenTtlSeconds,
  };
}

/** Normalizes IPv6-mapped IPv4 so rate-limit keys are stable. */
function clientIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
