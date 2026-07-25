import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Response } from 'express';
import { env, isProduction } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { unauthorized } from '../../lib/errors';

export const REFRESH_COOKIE = 'howzat_rt';

/**
 * Identity only. Nothing here says what the holder may do — permissions are
 * read from the database per request, so revoking an assignment takes effect
 * without waiting for a token to expire.
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: 'howzat',
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'howzat' });
    if (typeof decoded === 'string') throw new Error('Unexpected token payload');
    return { sub: String(decoded.sub), email: String(decoded.email) };
  } catch {
    throw unauthorized('Your session has expired — sign in again');
  }
}

/**
 * Refresh tokens are opaque random strings, not JWTs: they must be revocable,
 * and a stateless token cannot be revoked. Only the SHA-256 hash is stored, so
 * a database leak yields nothing replayable.
 */
function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const { token, tokenHash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + parseDuration(env.JWT_REFRESH_TTL)),
    },
  });

  return token;
}

/**
 * Rotation: the presented token is revoked and a fresh one issued in the same
 * transaction. Presenting an already-revoked token is treated as theft and
 * burns every session for that user.
 */
export async function rotateRefreshToken(
  presented: string,
): Promise<{ userId: string; token: string }> {
  const tokenHash = hashToken(presented);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) throw unauthorized('Session not recognized — sign in again');

  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Session reuse detected — all sessions were signed out');
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Your session has expired — sign in again');
  }

  const { token, tokenHash: nextHash } = generateRefreshToken();

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: nextHash,
        expiresAt: new Date(Date.now() + parseDuration(env.JWT_REFRESH_TTL)),
      },
    }),
  ]);

  return { userId: existing.userId, token };
}

export async function revokeRefreshToken(presented: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(presented), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    // 'lax' keeps the cookie on same-site XHR in dev (localhost:5173 →
    // localhost:4000 counts as same-site); production behind one domain is fine.
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/auth',
    maxAge: parseDuration(env.JWT_REFRESH_TTL),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
}

/** "15m" | "30d" | "3600" → milliseconds. */
function parseDuration(input: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(input.trim());
  if (!match) throw new Error(`Unparseable duration: ${input}`);

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * (multipliers[unit] ?? 1_000);
}

export const accessTokenTtlSeconds = Math.floor(parseDuration(env.JWT_ACCESS_TTL) / 1000);
