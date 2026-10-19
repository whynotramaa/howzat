import { prisma } from './prisma';
import { transactions } from './transaction';
import { logger } from './logger';

export const matchLockKey = (matchId: string) => `lock:match:${matchId}`;
export const tournamentLockKey = (id: string) => `lock:tournament:${id}`;

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = transactions.getStore();
  if (existing) {
    if (!existing.locks.has(key)) {
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      existing.locks.add(key);
    }
    return fn();
  }

  const committed: Array<() => Promise<unknown>> = [];
  const result = await prisma.$transaction(
    async (client) => {
      return transactions.run({ client, locks: new Set(), committed }, async () => {
        if (key.startsWith('lock:match:')) {
          const id = key.slice('lock:match:'.length);
          const match = await prisma.match.findUnique({
            where: { id },
            select: { tournamentId: true },
          });
          if (match) {
            return withLock(tournamentLockKey(match.tournamentId), () =>
              withLock(key, async () => {
                await prisma.match.update({ where: { id }, data: { revision: { increment: 1 } } });
                return fn();
              }),
            );
          }
        }
        return withLock(key, fn);
      });
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  for (const work of committed) {
    try {
      await work();
    } catch (err) {
      logger.error({ err, key }, 'Post-commit work failed; persisted work remains retryable');
    }
  }
  return result;
}
