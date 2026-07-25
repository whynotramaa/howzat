import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { incrementWindow } from '../lib/redis';
import { AppError, tooManyRequests } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * A ceiling on ball writes per scorer per match. Generous by design — a fast
 * over is six balls in under a minute and a drained offline queue is bursty —
 * so this catches a runaway client, not a busy one.
 */
export const rateLimitBallWrites: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) return next();

    const matchId = req.params.matchId ?? 'unknown';
    const key = `rl:balls:${matchId}:${req.user.id}`;

    const { count, ttl } = await incrementWindow(key, 60);

    if (count > env.BALL_WRITES_PER_MINUTE) {
      throw tooManyRequests(
        'Too many balls submitted in the last minute — slow down.',
        ttl,
      );
    }

    next();
  } catch (err) {
    // A Redis outage must never stop a live match being scored. Failing open
    // here is the right trade: the limit is abuse protection, not correctness.
    if (err instanceof AppError) return next(err);
    logger.warn({ err }, 'Ball rate limiter unavailable — allowing the write');
    next();
  }
};
