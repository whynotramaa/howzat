import { PrismaClient } from '@prisma/client';
import { isDevelopment } from '../config/env';
import { logger } from './logger';

/**
 * A single client for the process. Cached on globalThis so `tsx watch`
 * reloads don't leak a new connection pool on every file save — and so a
 * serverless instance that is reused across invocations reuses its pool
 * instead of opening a fresh one per request and exhausting Postgres.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDevelopment ? ['warn', 'error'] : ['error'],
  });

globalForPrisma.prisma = prisma;

export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, 'Postgres health check failed');
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
