import crypto from 'node:crypto';
import { redis } from './redis';
import { conflict } from './errors';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

interface Lock {
  key: string;
  token: string;
}

async function acquireLock(key: string, ttlMs = 5_000, attempts = 20): Promise<Lock> {
  const token = crypto.randomBytes(16).toString('hex');

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
    if (result === 'OK') return { key, token };

    await sleep(25 + attempt * 5);
  }

  throw conflict('That match is busy — another ball is being recorded. Try again.');
}

async function releaseLock(lock: Lock): Promise<void> {
  await redis.eval(RELEASE_SCRIPT, 1, lock.key, lock.token).catch(() => {});
}

export async function withLock<T>(key: string, fn: () => Promise<T>, ttlMs = 5_000): Promise<T> {
  const lock = await acquireLock(key, ttlMs);
  try {
    return await fn();
  } finally {
    await releaseLock(lock);
  }
}

export const matchLockKey = (matchId: string) => `lock:match:${matchId}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
