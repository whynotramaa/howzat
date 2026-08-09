import Redis, { type RedisOptions } from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

const baseOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy(times) {
    return Math.min(times * 200, 5_000);
  },
};

export function createRedisClient(label: string): Redis {
  const client = new Redis(env.REDIS_URL, baseOptions);

  client.on('error', (err) => logger.error({ err, label }, 'Redis error'));
  client.on('connect', () => logger.debug({ label }, 'Redis connecting'));
  client.on('ready', () => logger.info({ label }, 'Redis ready'));

  return client;
}

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis = globalForRedis.redis ?? createRedisClient('main');

globalForRedis.redis = redis;

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit().catch(() => redis.disconnect());
}

export async function incrementWindow(
  key: string,
  windowSeconds: number,
): Promise<{ count: number; ttl: number }> {
  const results = await redis.multi().incr(key).ttl(key).exec();

  const count = Number(results?.[0]?.[1] ?? 0);
  let ttl = Number(results?.[1]?.[1] ?? -1);

  if (ttl < 0) {
    await redis.expire(key, windowSeconds);
    ttl = windowSeconds;
  }

  return { count, ttl };
}
