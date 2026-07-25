import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { OtpPurpose } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { incrementWindow } from '../../lib/redis';
import { badRequest, tooManyRequests, unauthorized } from '../../lib/errors';

const OTP_COST = 10;

/**
 * Codes are scoped to what they were issued for. A code emailed to confirm an
 * address must not also be redeemable as a password reset, even though both
 * are six digits sent to the same inbox.
 */
export type { OtpPurpose };

/** Uniform over 000000–999999, generated from a CSPRNG rather than Math.random. */
export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function assertOtpRequestAllowed(email: string, ip: string): Promise<void> {
  const windowSeconds = 3600;

  const perEmail = await incrementWindow(`rl:otp:email:${email}`, windowSeconds);
  if (perEmail.count > env.OTP_REQUESTS_PER_HOUR) {
    throw tooManyRequests(
      `Too many codes requested for this email. Try again in ${Math.ceil(perEmail.ttl / 60)} minutes.`,
      perEmail.ttl,
    );
  }

  // The per-IP ceiling is deliberately looser — a shared ground wifi should
  // not lock out a whole team, but a scripted enumeration should still stall.
  const perIp = await incrementWindow(`rl:otp:ip:${ip}`, windowSeconds);
  if (perIp.count > env.OTP_REQUESTS_PER_HOUR * 6) {
    throw tooManyRequests('Too many sign-in attempts from this network.', perIp.ttl);
  }
}

/**
 * Any previously issued, unconsumed code for the email is invalidated first —
 * only the newest code can ever work, so a leaked older code is dead.
 */
export async function issueOtp(
  email: string,
  purpose: OtpPurpose = 'EMAIL_VERIFICATION',
): Promise<string> {
  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, OTP_COST);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);

  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { email, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.otpCode.create({ data: { email, purpose, codeHash, expiresAt } }),
  ]);

  return code;
}

/**
 * Consumes the newest live code for the email. Every failure path returns the
 * same message: telling a caller *why* verification failed hands them an
 * account-enumeration oracle.
 */
export async function verifyOtp(
  email: string,
  code: string,
  purpose: OtpPurpose = 'EMAIL_VERIFICATION',
): Promise<void> {
  const record = await prisma.otpCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const rejection = badRequest('That code is incorrect or has expired');

  if (!record) throw rejection;

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    throw rejection;
  }

  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    throw unauthorized('Too many incorrect attempts — request a new code');
  }

  const matches = await bcrypt.compare(code, record.codeHash);

  if (!matches) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw rejection;
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
}

/** Housekeeping for expired rows; safe to call from anywhere, including never. */
export async function purgeExpiredOtps(): Promise<number> {
  const { count } = await prisma.otpCode.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } },
  });
  return count;
}
