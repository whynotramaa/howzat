import type { RequestHandler } from 'express';
import { forbidden, notFound, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { requireParam } from '../lib/http';

const CACHE_TTL_SECONDS = 60;

export const requireScorerForMatch: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) throw unauthorized();

    const matchId = requireParam(req, 'matchId');
    const userId = req.user.id;
    const cacheKey = `authz:match:${matchId}:user:${userId}`;

    const cached = await redis.get(cacheKey).catch(() => null);

    if (cached === '1') return next();
    if (cached === '0') return next(forbidden('You are not assigned to score this match'));

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        tournament: { select: { organizerId: true } },
        scorerAssignments: { where: { scorerId: userId }, select: { id: true } },
      },
    });

    if (!match) throw notFound('Match');

    const allowed = match.tournament.organizerId === userId || match.scorerAssignments.length > 0;

    await redis.set(cacheKey, allowed ? '1' : '0', 'EX', CACHE_TTL_SECONDS).catch(() => {});

    if (!allowed) throw forbidden('You are not assigned to score this match');

    next();
  } catch (err) {
    next(err);
  }
};

export async function invalidateMatchAuthz(matchId: string, userId?: string): Promise<void> {
  if (userId) {
    await redis.del(`authz:match:${matchId}:user:${userId}`).catch(() => undefined);
    return;
  }

  const pattern = `authz:match:${matchId}:user:*`;
  const stream = redis.scanStream({ match: pattern, count: 100 });

  for await (const keys of stream as AsyncIterable<string[]>) {
    if (keys.length > 0) await redis.del(...keys).catch(() => undefined);
  }
}
