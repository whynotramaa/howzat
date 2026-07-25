import type { RequestHandler } from 'express';
import { forbidden, notFound, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { requireParam } from '../lib/http';

/**
 * Match-level authorization — the check the brief singles out. It runs on
 * every ball, so the answer is cached in Redis for 60s. Authorization is
 * granted two ways:
 *
 *   1. an explicit ScorerAssignment row for (match, user), or
 *   2. ownership — the organizer of the tournament may always score it.
 *
 * The cache is deliberately short and stores a definite yes/no. Revoking an
 * assignment therefore takes effect within a minute; the alternative
 * (invalidating on write) is more code for a window nobody can exploit —
 * the worst case is one minute of scoring by someone who just lost access.
 */
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

    const allowed =
      match.tournament.organizerId === userId || match.scorerAssignments.length > 0;

    await redis.set(cacheKey, allowed ? '1' : '0', 'EX', CACHE_TTL_SECONDS).catch(() => {
      // A Redis outage must not block scoring — we just pay the query cost.
    });

    if (!allowed) throw forbidden('You are not assigned to score this match');

    next();
  } catch (err) {
    next(err);
  }
};

/** Call after changing assignments so the next request re-reads the truth. */
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
