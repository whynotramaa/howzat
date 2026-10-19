import { prisma, disconnectDatabase } from './lib/prisma';
import { disconnectRedis } from './lib/redis';
import { reconcileTournament } from './modules/standings/reconcile';
import { logger } from './lib/logger';

async function main(): Promise<void> {
  const pending = await prisma.match.findMany({
    where: { projectionPending: true },
    distinct: ['tournamentId'],
    select: { tournamentId: true },
  });
  for (const { tournamentId } of pending) await reconcileTournament(tournamentId);
  const expired = new Date(Date.now() - 90 * 86_400_000);
  const [codes, tokens] = await prisma.$transaction([
    prisma.otpCode.deleteMany({ where: { expiresAt: { lt: expired } } }),
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: expired } } }),
  ]);
  logger.info(
    {
      tournamentsReconciled: pending.length,
      codesDeleted: codes.count,
      tokensDeleted: tokens.count,
    },
    'Maintenance completed',
  );
}
main()
  .catch((err: unknown) => {
    logger.error({ err }, 'Maintenance failed; pending work is retained');
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([disconnectDatabase(), disconnectRedis()]);
  });
