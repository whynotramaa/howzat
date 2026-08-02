import { Router } from 'express';
import {
  buildState,
  completeMatchSchema,
  materializeEvents,
  playingXiSchema,
  tossSchema,
  type MatchWithInningsDto,
  type ScorerStateDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseBody, requireParam } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { requireScorerForMatch } from '../../middleware/requireScorerForMatch';
import { getSnapshot, loadEvents, loadInningsContext } from '../snapshot';
import { toInningsDto, toMatchDto } from './serialize';
import { abandonMatch, openFirstInnings, recordToss, setPlayingXi } from './lifecycle';

/**
 * Match setup and the innings lifecycle. Everything here is gated by
 * requireScorerForMatch — the match-level check, not merely a role check —
 * because an organizer of one tournament has no business touching another's
 * match, and an assigned scorer must be able to run the pre-match wizard
 * without organizer rights.
 */
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

/** The squads available for selection, with each player's role. */
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
        matchPlayers: { select: { playerId: true, battingOrder: true, isCaptain: true, isKeeper: true } },
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

/** Opens innings one and takes the match LIVE. */
matchesRouter.post(
  '/:matchId/start',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const innings = await openFirstInnings(matchId);

    res.status(201).json(toInningsDto(innings));
  }),
);

/**
 * Resumes after the innings break. The second innings row already exists —
 * it was created when the first one closed — so this only flips the match
 * back to LIVE.
 */
matchesRouter.post(
  '/:matchId/innings/:number/resume',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const number = Number(requireParam(req, 'number'));

    const innings = await prisma.innings.findUnique({
      where: { matchId_number: { matchId, number } },
    });

    if (!innings) throw notFound('Innings');

    await prisma.match.update({ where: { id: matchId }, data: { status: 'LIVE' } });

    res.json(toInningsDto(innings));
  }),
);

/**
 * Everything the scoring console needs in one read: the match, the innings in
 * progress, and the folded state of its event log.
 *
 * Distinct from /snapshot, which is the spectator projection — it carries only
 * the two batsmen at the crease and the current bowler, and a console cannot
 * be driven from that. The log is folded here rather than cached because the
 * console refetches once per ball, not once per viewer.
 */
matchesRouter.get(
  '/:matchId/state',
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
        innings: { orderBy: { number: 'desc' } },
        tournament: { select: { sport: true } },
      },
    });

    if (!match) throw notFound('Match');

    const live = match.innings.find((entry) => entry.status === 'IN_PROGRESS') ?? null;

    if (!live) {
      const empty: ScorerStateDto = {
        match: toMatchDto(match),
        innings: null,
        state: null,
        context: null,
        previousOverBowlerId: null,
      };

      res.json(empty);
      return;
    }

    const context = await loadInningsContext(live.id);
    const events = await loadEvents(live.id);
    const state = buildState(context, events);

    // Only meaningful at an over boundary; mid-over the bowler is already
    // fixed by the deliveries in `state.thisOver`.
    const deliveries = materializeEvents(events);
    const previousOverBowlerId =
      state.thisOver.length === 0 && state.legalBalls > 0
        ? (deliveries[deliveries.length - 1]?.bowlerId ?? null)
        : null;

    const dto: ScorerStateDto = {
      match: toMatchDto(match),
      innings: toInningsDto(live),
      state,
      context,
      previousOverBowlerId,
    };

    res.json(dto);
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

/** The full ball-by-ball log, for the correction history and any audit. */
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
