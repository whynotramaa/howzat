import { loadScorerState } from './state';
import { matchLockKey, withLock } from '../../lib/lock';
import { rebuildSnapshot } from '../snapshot';
import { Router } from 'express';
import {
  completeMatchSchema,
  playingXiSchema,
  tossSchema,
  type MatchWithInningsDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseBody, requireParam } from '../../lib/http';
import { notFound, unprocessable } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { requireScorerForMatch } from '../../middleware/requireScorerForMatch';
import { getSnapshot } from '../snapshot';
import { toInningsDto, toMatchDto } from './serialize';
import { abandonMatch, openFirstInnings, recordToss, setPlayingXi } from './lifecycle';

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

matchesRouter.get(
  '/:matchId',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        team1: true,
        team2: true,
        scorerAssignments: {
          select: { scorer: { select: { id: true, username: true, name: true } } },
        },
        innings: { orderBy: { number: 'asc' } },
        tournament: { select: { sport: true } },
      },
    });

    if (!match) throw notFound('Match');

    const dto: MatchWithInningsDto = {
      ...toMatchDto(match),
      innings: match.innings.map(toInningsDto),
    };

    res.json(dto);
  }),
);

matchesRouter.get(
  '/:matchId/squads',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        team1: { include: { players: { orderBy: { createdAt: 'asc' } } } },
        team2: { include: { players: { orderBy: { createdAt: 'asc' } } } },
        matchPlayers: {
          select: { playerId: true, battingOrder: true, isCaptain: true, isKeeper: true },
        },
      },
    });

    if (!match) throw notFound('Match');

    const selected = new Map(match.matchPlayers.map((entry) => [entry.playerId, entry]));

    const serialize = (team: typeof match.team1) =>
      team
        ? {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            primaryColor: team.primaryColor,
            players: team.players.map((player) => ({
              id: player.id,
              name: player.name,
              role: player.role,
              selected: selected.has(player.id),
              battingOrder: selected.get(player.id)?.battingOrder ?? null,
              isCaptain: selected.get(player.id)?.isCaptain ?? false,
              isKeeper: selected.get(player.id)?.isKeeper ?? false,
            })),
          }
        : null;

    res.json({ team1: serialize(match.team1), team2: serialize(match.team2) });
  }),
);

matchesRouter.post(
  '/:matchId/toss',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(tossSchema, req.body);

    const match = await recordToss(matchId, input);
    res.json(toMatchDto(match));
  }),
);

matchesRouter.put(
  '/:matchId/playing-xi',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(playingXiSchema, req.body);

    const players = await setPlayingXi(matchId, input);

    res.json({
      total: players.length,
      items: players.map((entry) => ({
        playerId: entry.playerId,
        teamId: entry.teamId,
        name: entry.player.name,
        role: entry.player.role,
        battingOrder: entry.battingOrder,
        isCaptain: entry.isCaptain,
        isKeeper: entry.isKeeper,
      })),
    });
  }),
);

matchesRouter.post(
  '/:matchId/start',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const innings = await openFirstInnings(matchId);

    res.status(201).json(toInningsDto(innings));
  }),
);

matchesRouter.post(
  '/:matchId/innings/:number/resume',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const number = Number(requireParam(req, 'number'));

    if (!Number.isInteger(number) || number !== 2)
      throw unprocessable('INVALID_INNINGS', 'Only the chase can be resumed');
    const innings = await withLock(matchLockKey(matchId), async () => {
      const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
      const innings = await prisma.innings.findUnique({
        where: { matchId_number: { matchId, number } },
      });
      if (!innings) throw notFound('Innings');
      if (match.status === 'LIVE' && innings.status === 'IN_PROGRESS') return innings;
      if (match.status !== 'INNINGS_BREAK' || innings.status !== 'IN_PROGRESS')
        throw unprocessable('MATCH_CLOSED', 'This innings cannot be resumed');
      await prisma.match.update({ where: { id: matchId }, data: { status: 'LIVE' } });
      await rebuildSnapshot(matchId);
      return innings;
    });

    res.json(toInningsDto(innings));
  }),
);

matchesRouter.get(
  '/:matchId/state',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    res.json(await loadScorerState(requireParam(req, 'matchId')));
  }),
);

matchesRouter.get(
  '/:matchId/snapshot',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const snapshot = await getSnapshot(matchId);

    if (!snapshot) {
      res.json({ snapshot: null, message: 'This match has not started yet' });
      return;
    }

    res.json(snapshot);
  }),
);

matchesRouter.get(
  '/:matchId/events',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');

    const events = await prisma.ballEvent.findMany({
      where: { matchId },
      orderBy: { seq: 'asc' },
      include: {
        striker: { select: { name: true } },
        bowler: { select: { name: true } },
        author: { select: { name: true } },
      },
    });

    res.json({
      items: events.map((event) => ({
        id: event.id,
        inningsId: event.inningsId,
        seq: event.seq,
        overNumber: event.overNumber,
        ballNumber: event.ballNumber,
        eventType: event.eventType,
        supersedesEventId: event.supersedesEventId,
        runsOffBat: event.runsOffBat,
        extraRuns: event.extraRuns,
        extraType: event.extraType,
        isWicket: event.isWicket,
        wicketType: event.wicketType,
        striker: event.striker.name,
        bowler: event.bowler.name,
        recordedBy: event.author.name,
        createdAt: event.createdAt.toISOString(),
      })),
      total: events.length,
    });
  }),
);

matchesRouter.post(
  '/:matchId/abandon',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(completeMatchSchema, req.body ?? {});

    const match = await abandonMatch(matchId, input.resultText);
    res.json(toMatchDto({ ...match, team1: null, team2: null }));
  }),
);
