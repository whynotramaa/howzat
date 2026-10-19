import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { asyncHandler } from './http';
import { prisma } from './prisma';
import { matchLockKey, tournamentLockKey, withLock } from './lock';

export function writeHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    if (req.method === 'GET') return fn(req, res, next);
    let key = req.params.matchId ? matchLockKey(String(req.params.matchId)) : null;
    let tournamentId = req.params.tournamentId;
    if (!key && !tournamentId && req.params.teamId) {
      tournamentId = (
        await prisma.team.findUnique({
          where: { id: String(req.params.teamId) },
          select: { tournamentId: true },
        })
      )?.tournamentId;
    }
    if (!key && !tournamentId && req.params.playerId) {
      tournamentId = (
        await prisma.player.findUnique({
          where: { id: String(req.params.playerId) },
          select: { team: { select: { tournamentId: true } } },
        })
      )?.team.tournamentId;
    }
    key ??= tournamentId
      ? tournamentLockKey(String(tournamentId))
      : `write:user:${req.user?.id ?? 'anonymous'}`;
    const json = res.json;
    const end = res.end;
    let flush: (() => void) | undefined;
    res.json = ((body: unknown) => {
      flush = () => {
        json.call(res, body);
      };
      return res;
    }) as typeof res.json;
    res.end = (() => {
      flush = () => {
        end.call(res, undefined, 'utf8');
      };
      return res;
    }) as typeof res.end;
    try {
      await withLock(key, () => fn(req, res, next));
    } finally {
      res.json = json;
      res.end = end;
    }
    flush?.();
  });
}
