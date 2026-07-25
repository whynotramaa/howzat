import crypto from 'node:crypto';
import { redis } from './redis';
import { conflict } from './errors';

/**
 * A per-match write lock. Two scorers on the same match — or one scorer whose
 * phone retried while the first request was still in flight — would otherwise
 * race on the sequence number.
 *
 * SET NX PX gives mutual exclusion; the random token makes release safe. A
 * plain DEL would let a slow holder whose lock had already expired delete
 * somebody else's lock, which is worse than no lock at all.
 */

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export interface Lock {
  key: string;
  token: string;
}

export async function acquireLock(
  key: string,
  ttlMs = 5_000,
  attempts = 20,
): Promise<Lock> {
  const token = crypto.randomBytes(16).toString('hex');

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
    if (result === 'OK') return { key, token };

    // Short backoff: a ball write holds the lock for single-digit
    // milliseconds, so the contended case resolves almost immediately.
    await sleep(25 + attempt * 5);
  }

  throw conflict('That match is busy — another ball is being recorded. Try again.');
}

export async function releaseLock(lock: Lock): Promise<void> {
  await redis.eval(RELEASE_SCRIPT, 1, lock.key, lock.token).catch(() => {
    // A failed release is harmless: the TTL reclaims the lock shortly.
  });
}

/** Runs `fn` under the lock and always releases it, success or failure. */
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
