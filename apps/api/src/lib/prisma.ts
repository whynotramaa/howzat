import { transactions } from './transaction';
import { PrismaClient } from '@prisma/client';
import { isDevelopment } from '../config/env';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const client =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDevelopment ? ['warn', 'error'] : ['error'],
  });

globalForPrisma.prisma = client;

export const prisma = new Proxy(client, {
  get(target, property) {
    const scoped = transactions.getStore()?.client;
    if (scoped && property === '$transaction') {
      return (work: unknown) =>
        typeof work === 'function' ? work(scoped) : Promise.all(work as Promise<unknown>[]);
    }
    const source = scoped ?? target;
    const value = Reflect.get(source, property);
    return typeof value === 'function' ? value.bind(source) : value;
  },
});

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
