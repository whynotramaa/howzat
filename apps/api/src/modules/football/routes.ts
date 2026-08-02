import { Router } from 'express';
import {
  buildFootballState,
  clockCommandSchema,
  footballEventSchema,
  kickOffSchema,
  footballLineupSchema,
  footballUndoSchema,
  type FootballScorerStateDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseBody, requireParam } from '../../lib/http';
import { requireAuth } from '../../middleware/auth';
import { requireScorerForMatch } from '../../middleware/requireScorerForMatch';
import { rateLimitBallWrites } from '../../middleware/rateLimit';
import {
  buildFootballSnapshot,
  footballContextFor,
  loadFootballEvents,
  loadFootballMatch,
  toClockDto,
  toTeamRefFrom,
} from './snapshot';
import { kickOff, moveClock, setFootballLineups } from './lifecycle';
import { recordFootballEvent, undoFootballEvent } from './service';

/**
 * The football console's whole surface.
 *
 * Mounted on /matches so the route carries :matchId, which is what
 * requireScorerForMatch keys on — the same match-level authorization the
 * cricket console goes through, not a role check. All writes are HTTP; the
 * socket layer stays a read-only fan-out.
 */
export const footballRouter = Router();

footballRouter.use(requireAuth);

/** The squads available for selection, with what each player already has. */
footballRouter.get(
  '/:matchId/football/squads',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const match = await loadFootballMatch(matchId);

    const selected = new Map(
      match.matchPlayers.map((entry) => [
        entry.playerId,
        {
          slot: entry.lineupSlot,
          shirtNumber: entry.shirtNumber,
          isCaptain: entry.isCaptain,
        },
      ]),
    );

    const serialize = async (team: NonNullable<typeof match.team1>, formation: string | null) => {
      const players = await prisma.player.findMany({
        where: { teamId: team.id },
        orderBy: { createdAt: 'asc' },
      });

      return {
        ...toTeamRefFrom(team),
        formation,
        // No role. Football does not have batsmen, and the one position it
        // does name — the goalkeeper — is chosen here, at the team sheet, by
        // whoever takes slot 0. Carrying a cricket role onto this screen was
        // how "Goaller" and "All rounder" ended up on a football team sheet.
        players: players.map((player) => ({
          id: player.id,
          name: player.name,
          selected: selected.has(player.id),
          slot: selected.get(player.id)?.slot ?? null,
          shirtNumber: selected.get(player.id)?.shirtNumber ?? null,
          isCaptain: selected.get(player.id)?.isCaptain ?? false,
        })),
      };
    };

    res.json({
      playersPerTeam: match.tournament.playersPerTeam,
      // The clock this fixture will actually run on: its own override if it has
      // one, otherwise the tournament's default. The console seeds its picker
      // from this, so what it offers is what kick-off would use.
      periods: match.periods ?? match.tournament.periods,
      periodMinutes: match.periodMinutes ?? match.tournament.periodMinutes,
      home: await serialize(match.team1!, match.team1Formation),
      away: await serialize(match.team2!, match.team2Formation),
    });
  }),
);

footballRouter.put(
  '/:matchId/football/lineups',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(footballLineupSchema, req.body);

    const players = await setFootballLineups(matchId, input);

    res.json({
      total: players.length,
      items: players.map((entry) => ({
        playerId: entry.playerId,
        teamId: entry.teamId,
        name: entry.player.name,
        slot: entry.lineupSlot,
        shirtNumber: entry.shirtNumber,
        isCaptain: entry.isCaptain,
      })),
    });
  }),
);

/** Kick-off: starts the clock and takes the match live. */
footballRouter.post(
  '/:matchId/football/kickoff',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(kickOffSchema, req.body ?? {});
    const clock = await kickOff(matchId, input);

    res.status(201).json(toClockDto(clock));
  }),
);

/** Pause, resume, end a period, start the next, blow full time. */
footballRouter.post(
  '/:matchId/football/clock',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const { command } = parseBody(clockCommandSchema, req.body);

    const clock = await moveClock(matchId, command);

    res.json(toClockDto(clock));
  }),
);

/**
 * Everything the console needs in one read: both squads, the folded log, and
 * the clock. Distinct from the public snapshot, which carries only what a
 * spectator sees and could not drive a console.
 */
footballRouter.get(
  '/:matchId/football/state',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const match = await loadFootballMatch(matchId);
    const events = await loadFootballEvents(matchId);
    const state = buildFootballState(footballContextFor(match), events);

    const squadFor = (teamId: string) =>
      match.matchPlayers
        .filter((entry) => entry.teamId === teamId)
        .map((entry) => ({ id: entry.player.id, name: entry.player.name }));

    const dto: FootballScorerStateDto = {
      matchId: match.id,
      status: match.status,
      home: {
        team: toTeamRefFrom(match.team1!),
        squad: squadFor(match.team1!.id),
        formation: match.team1Formation,
      },
      away: {
        team: toTeamRefFrom(match.team2!),
        squad: squadFor(match.team2!.id),
        formation: match.team2Formation,
      },
      state,
      clock: toClockDto(match.clock),
      snapshot: buildFootballSnapshot(match, state),
    };

    res.json(dto);
  }),
);

footballRouter.post(
  '/:matchId/football/events',
  requireScorerForMatch,
  rateLimitBallWrites,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(footballEventSchema, req.body);

    const result = await recordFootballEvent(matchId, input, req.user!.id);

    // 200 for a duplicate, 201 for a new incident. Both carry the same body,
    // so a client replaying a queued tap cannot tell the difference — which is
    // exactly what idempotency is for.
    res.status(result.duplicate ? 200 : 201).json({
      snapshot: result.snapshot,
      duplicate: result.duplicate,
      seq: result.seq,
    });
  }),
);

footballRouter.post(
  '/:matchId/football/events/undo',
  requireScorerForMatch,
  rateLimitBallWrites,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const { clientEventId, targetEventId } = parseBody(footballUndoSchema, req.body);

    const result = await undoFootballEvent(matchId, clientEventId, targetEventId, req.user!.id);

    res.json({
      snapshot: result.snapshot,
      duplicate: result.duplicate,
      seq: result.seq,
    });
  }),
);

/** The full log, for the incident history and any audit. */
footballRouter.get(
  '/:matchId/football/events',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');

    const events = await prisma.footballEvent.findMany({
      where: { matchId },
      orderBy: { seq: 'asc' },
      include: {
        player: { select: { name: true } },
        team: { select: { shortName: true } },
        author: { select: { name: true } },
      },
    });

    res.json({
      items: events.map((event) => ({
        id: event.id,
        seq: event.seq,
        eventType: event.eventType,
        supersedesEventId: event.supersedesEventId,
        kind: event.kind,
        team: event.team.shortName,
        player: event.player?.name ?? null,
        minute: event.minute,
        period: event.period,
        stoppage: event.stoppage,
        recordedBy: event.author.name,
        createdAt: event.createdAt.toISOString(),
      })),
      total: events.length,
    });
  }),
);
