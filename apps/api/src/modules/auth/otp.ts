import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { OtpPurpose } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { incrementWindow } from '../../lib/redis';
import { badRequest, tooManyRequests, unauthorized } from '../../lib/errors';

const OTP_COST = 10;

export type { OtpPurpose };

function generateOtpCode(): string {
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

  const perIp = await incrementWindow(`rl:otp:ip:${ip}`, windowSeconds);
  if (perIp.count > env.OTP_REQUESTS_PER_HOUR * 6) {
    throw tooManyRequests('Too many sign-in attempts from this network.', perIp.ttl);
  }
}

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
