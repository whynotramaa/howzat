import { createServer } from 'node:http';
import { createApp } from './app';
import { env, emailEnabled } from './config/env';
import { logger } from './lib/logger';
import { disconnectDatabase, pingDatabase } from './lib/prisma';
import { disconnectRedis, pingRedis } from './lib/redis';
import { attachRealtime, closeRealtime } from './realtime/io';
import { registerStandingsSubscriber } from './modules/standings/service';
import { registerPlayerStatsSubscriber } from './modules/stats/service';

const app = createApp();
const server = createServer(app);

attachRealtime(server);

registerStandingsSubscriber();

registerPlayerStatsSubscriber();

server.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, email: emailEnabled ? 'resend' : 'console' },
    `Howzat API listening on http://localhost:${env.PORT}`,
  );

  void Promise.all([pingDatabase(), pingRedis()]).then(([db, redisOk]) => {
    if (!db) logger.error('Postgres is unreachable — check DATABASE_URL');
    if (!redisOk) logger.error('Redis is unreachable — check REDIS_URL');
    if (db && redisOk) logger.info('Postgres and Redis both reachable');
  });
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Shutting down');

  const timer = setTimeout(() => {
    logger.warn('Forcing exit after 10s');
    process.exit(1);
  }, 10_000);
  timer.unref();

  await closeRealtime().catch(() => undefined);

  server.close(async () => {
    await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
