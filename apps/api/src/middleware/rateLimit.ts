import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { incrementWindow } from '../lib/redis';
import { AppError, tooManyRequests } from '../lib/errors';
import { logger } from '../lib/logger';

export const rateLimitBallWrites: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) return next();

    const matchId = req.params.matchId ?? 'unknown';
    const key = `rl:balls:${matchId}:${req.user.id}`;

    const { count, ttl } = await incrementWindow(key, 60);

    if (count > env.BALL_WRITES_PER_MINUTE) {
      throw tooManyRequests('Too many balls submitted in the last minute — slow down.', ttl);
    }

    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    logger.warn({ err }, 'Ball rate limiter unavailable — allowing the write');
    next();
  }
};
