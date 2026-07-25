import Redis, { type RedisOptions } from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Upstash (and most hosted Redis) terminate TLS, hence the rediss:// scheme.
 * ioredis infers TLS from the scheme; the explicit options below are the ones
 * that matter for a serverless-ish provider with aggressive idle timeouts.
 */
const baseOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  // Railway's private network resolves *.railway.internal over AAAA only, and
  // ioredis otherwise asks for A records and fails with ENOTFOUND on a host
  // that plainly exists. 0 means "whatever DNS returns", which is correct
  // everywhere else too.
  family: 0,
  retryStrategy(times) {
    // Back off to a 5s ceiling, then keep trying — a Redis blip should
    // degrade the service, not kill the process.
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

/** The general-purpose client: OTP rate limits, auth caches, snapshots. */
export const redis = globalForRedis.redis ?? createRedisClient('main');

if (env.NODE_ENV === 'development') globalForRedis.redis = redis;

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

// ───────────────────────────────────────────────── small helpers ──

/**
 * Fixed-window counter. Returns the current count and the seconds remaining
 * in the window, so callers can send a truthful Retry-After.
 */
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

export async function cacheJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function readJson<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A corrupt cache entry is not worth an exception — drop it and miss.
    await redis.del(key);
    return null;
  }
}
