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

// Must attach before listen so the upgrade handler is in place for the first
// connection, and so the write path has a real publisher from the start.
attachRealtime(server);

// The points table rebuilds on match:completed. Subscribing here rather than
// at import time keeps the dependency explicit and testable.
registerStandingsSubscriber();

// The same event also closes out every player's card for that match, which is
// what makes a career profile grow one match at a time.
registerPlayerStatsSubscriber();

server.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, email: emailEnabled ? 'resend' : 'console' },
    // The actual bound port, not API_BASE_URL — those diverge whenever PORT
    // is overridden, and a log line that lies about where it is listening is
    // worse than no log line.
    `Howzat API listening on http://localhost:${env.PORT}`,
  );

  // Reported, not enforced: a Redis blip at boot should not stop the API from
  // starting and recovering on its own a few seconds later.
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

  // Stop accepting connections, then release the pools. A hard 10s ceiling
  // keeps a stuck socket from wedging a deploy.
  const timer = setTimeout(() => {
    logger.warn('Forcing exit after 10s');
    process.exit(1);
  }, 10_000);
  timer.unref();

  // Close sockets first so clients get a clean disconnect and reconnect to a
  // healthy instance, rather than hanging until the process dies.
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
