import {
  BALLS_PER_OVER,
  BOWLER_CREDITED,
  ballsAsOversText,
  round2,
  type TournamentStatsDto,
  type TournamentPlayerStatsDto,
} from '@howzat/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { onMatchEvent } from '../../realtime/bus';

const STATS_CACHE_TTL_SECONDS = 60;
const statsCacheKey = (tournamentId: string) => `stats:tournament:${tournamentId}`;

/**
 * Career stats, built the same way the points table is: recomputed from the
 * ball log when a match finishes, never incremented in place.
 *
 * The reason is the same too. A correction to a ball in a finished match has
 * to move the batsman's average, and the only way that happens reliably is if
 * the average is a function of the log rather than a running total somebody
 * has to remember to adjust. Replaying `match:completed` twice produces the
 * same rows; so does repairing a bad one and replaying.
 *
 * One row is written per player in the XI, including players who neither
 * batted nor bowled — appearing in a match is itself a fact worth recording,
 * and it is what makes "matches played" correct for a specialist who wasn't
 * needed that day.
 */

/** The event fields this projection needs; deliberately narrower than the row. */
const EVENT_FIELDS = {
  id: true,
  inningsId: true,
  eventType: true,
  supersedesEventId: true,
  overNumber: true,
  runsOffBat: true,
  extraRuns: true,
  extraType: true,
  isWicket: true,
  wicketType: true,
  dismissedPlayerId: true,
  fielderId: true,
  strikerId: true,
  nonStrikerId: true,
  bowlerId: true,
} satisfies Prisma.BallEventSelect;

type ScoredEvent = Prisma.BallEventGetPayload<{ select: typeof EVENT_FIELDS }>;

interface Accumulator {
  batted: boolean;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  bowled: boolean;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  catches: number;
  runOuts: number;
  stumpings: number;
}

function emptyAccumulator(): Accumulator {
  return {
    batted: false,
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
    bowled: false,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    catches: 0,
    runOuts: 0,
    stumpings: 0,
  };
}

/**
 * Applies the same supersede semantics as the reducer: a corrected ball is
 * replaced in place, an undone ball disappears, and neither the CORRECTION nor
 * the UNDO is itself a delivery.
 */
function materialize(events: ScoredEvent[]): ScoredEvent[] {
  const replacements = new Map<string, ScoredEvent>();
  const removed = new Set<string>();

  for (const event of events) {
    if (!event.supersedesEventId) continue;
    if (event.eventType === 'CORRECTION') replacements.set(event.supersedesEventId, event);
    if (event.eventType === 'UNDO') removed.add(event.supersedesEventId);
  }

  return events
    .filter((event) => event.eventType === 'BALL' && !removed.has(event.id))
    .map((event) => {
      const replacement = replacements.get(event.id);
      // The correction supplies the outcome; the original supplies its place
      // in the over, which is what keeps maiden detection correct.
      return replacement ? { ...replacement, overNumber: event.overNumber } : event;
    });
}

export async function recomputePlayerStatsForMatch(matchId: string): Promise<number> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, tournamentId: true },
  });

  if (!match) return 0;

  const [xi, rawEvents] = await Promise.all([
    prisma.matchPlayer.findMany({
      where: { matchId },
      select: { playerId: true, teamId: true },
    }),
    prisma.ballEvent.findMany({
      where: { matchId },
      orderBy: { seq: 'asc' },
      select: EVENT_FIELDS,
    }),
  ]);

  if (xi.length === 0) return 0;

  const totals = new Map<string, Accumulator>();
  const of = (playerId: string): Accumulator => {
    const existing = totals.get(playerId);
    if (existing) return existing;
    const created = emptyAccumulator();
    totals.set(playerId, created);
    return created;
  };

  for (const entry of xi) of(entry.playerId);

  // Keyed by innings + over + bowler, so a maiden is judged over by over.
  const overs = new Map<string, { bowlerId: string; runs: number; legalBalls: number }>();

  for (const event of materialize(rawEvents)) {
    const isWide = event.extraType === 'WIDE';
    const isNoBall = event.extraType === 'NO_BALL';
    const isLegal = !isWide && !isNoBall;

    // Byes and leg-byes go to the batting side but are not the bowler's fault.
    const bowlerRuns = event.runsOffBat + (isWide || isNoBall ? event.extraRuns : 0);

    const striker = of(event.strikerId);
    striker.batted = true;
    striker.runs += event.runsOffBat;
    // A batsman is credited with facing a no-ball, but never a wide.
    if (!isWide) striker.ballsFaced += 1;
    if (event.runsOffBat === 4) striker.fours += 1;
    if (event.runsOffBat === 6) striker.sixes += 1;

    // Being at the other end still counts as having batted, even off zero balls.
    of(event.nonStrikerId).batted = true;

    const bowler = of(event.bowlerId);
    bowler.bowled = true;
    bowler.runsConceded += bowlerRuns;
    if (isLegal) bowler.ballsBowled += 1;

    const overKey = `${event.inningsId}:${event.overNumber}:${event.bowlerId}`;
    const over = overs.get(overKey) ?? { bowlerId: event.bowlerId, runs: 0, legalBalls: 0 };
    over.runs += bowlerRuns;
    if (isLegal) over.legalBalls += 1;
    overs.set(overKey, over);

    if (!event.isWicket) continue;

    const dismissedId = event.dismissedPlayerId ?? event.strikerId;
    of(dismissedId).isOut = true;

    if (event.wicketType && BOWLER_CREDITED.has(event.wicketType)) {
      bowler.wickets += 1;
    }

    if (event.fielderId) {
      const fielder = of(event.fielderId);
      if (event.wicketType === 'CAUGHT') fielder.catches += 1;
      else if (event.wicketType === 'RUN_OUT') fielder.runOuts += 1;
      else if (event.wicketType === 'STUMPED') fielder.stumpings += 1;
    }
  }

  // A maiden is a *completed* over off which nothing was scored. An over cut
  // short by the end of an innings is not one, however tidy it looked.
  for (const over of overs.values()) {
    if (over.runs === 0 && over.legalBalls >= BALLS_PER_OVER) {
      of(over.bowlerId).maidens += 1;
    }
  }

  const teamByPlayer = new Map(xi.map((entry) => [entry.playerId, entry.teamId]));

  const rows = [...totals.entries()]
    // A player can appear in the log without being in the stored XI only if
    // the XI was edited after the fact; their team is unknown, so skip rather
    // than invent one.
    .filter(([playerId]) => teamByPlayer.has(playerId))
    .map(([playerId, stats]) => ({
      matchId,
      playerId,
      teamId: teamByPlayer.get(playerId)!,
      tournamentId: match.tournamentId,
      ...stats,
    }));

  await prisma.$transaction(
    rows.map((row) =>
      prisma.playerMatchStats.upsert({
        where: { matchId_playerId: { matchId, playerId: row.playerId } },
        update: row,
        create: row,
      }),
    ),
  );

  logger.info({ matchId, players: rows.length }, 'Player match stats recomputed');

  await redis.del(statsCacheKey(match.tournamentId)).catch(() => undefined);

  return rows.length;
}

/**
 * Tournament leaderboards are a read projection over PlayerMatchStats. They
 * are deliberately cached separately from career profiles: an organizer can
 * open this page repeatedly while a tournament is being run, and the cache is
 * invalidated when a completed match rebuilds its player rows.
 */
export async function getTournamentStats(tournamentId: string): Promise<TournamentStatsDto> {
  const cached = await redis.get(statsCacheKey(tournamentId)).catch(() => null);
  if (cached) return JSON.parse(cached) as TournamentStatsDto;

  const rows = await prisma.playerMatchStats.findMany({
    where: { tournamentId },
    include: {
      player: { select: { id: true, name: true, username: true } },
      match: { select: { id: true } },
      // team is reached through the player relation below in the second query;
      // the denormalized teamId keeps aggregation cheap and stable.
    },
  });

  const teamIds = [...new Set(rows.map((row) => row.teamId))];
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true, shortName: true, primaryColor: true },
  });
  const teamsById = new Map(teams.map((team) => [team.id, team]));

  const grouped = new Map<
    string,
    {
      playerId: string;
      playerName: string;
      username: string;
      teamId: string;
      matches: number;
      innings: number;
      runs: number;
      ballsFaced: number;
      fours: number;
      sixes: number;
      dismissals: number;
      wickets: number;
      ballsBowled: number;
      runsConceded: number;
      maidens: number;
      catches: number;
      runOuts: number;
      stumpings: number;
    }
  >();

  for (const row of rows) {
    const current = grouped.get(row.playerId) ?? {
      playerId: row.playerId,
      playerName: row.player.name,
      username: row.player.username,
      teamId: row.teamId,
      matches: 0,
      innings: 0,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      dismissals: 0,
      wickets: 0,
      ballsBowled: 0,
      runsConceded: 0,
      maidens: 0,
      catches: 0,
      runOuts: 0,
      stumpings: 0,
    };

    current.matches += 1;
    if (row.batted) current.innings += 1;
    current.runs += row.runs;
    current.ballsFaced += row.ballsFaced;
    current.fours += row.fours;
    current.sixes += row.sixes;
    if (row.batted && row.isOut) current.dismissals += 1;
    current.wickets += row.wickets;
    current.ballsBowled += row.ballsBowled;
    current.runsConceded += row.runsConceded;
    current.maidens += row.maidens;
    current.catches += row.catches;
    current.runOuts += row.runOuts;
    current.stumpings += row.stumpings;
    grouped.set(row.playerId, current);
  }

  const players: TournamentPlayerStatsDto[] = [...grouped.values()]
    .map((row) => {
      const team = teamsById.get(row.teamId);
      return {
        playerId: row.playerId,
        playerName: row.playerName,
        username: row.username,
        team: {
          id: row.teamId,
          name: team?.name ?? 'Unknown side',
          shortName: team?.shortName ?? '—',
          primaryColor: team?.primaryColor ?? '#64748b',
        },
        matches: row.matches,
        innings: row.innings,
        runs: row.runs,
        ballsFaced: row.ballsFaced,
        fours: row.fours,
        sixes: row.sixes,
        average: row.dismissals > 0 ? round2(row.runs / row.dismissals) : null,
        strikeRate: row.ballsFaced > 0 ? round2((row.runs / row.ballsFaced) * 100) : null,
        wickets: row.wickets,
        oversBowled: ballsAsOversText(row.ballsBowled),
        ballsBowled: row.ballsBowled,
        runsConceded: row.runsConceded,
        economy: row.ballsBowled > 0 ? round2(row.runsConceded / (row.ballsBowled / 6)) : null,
        maidens: row.maidens,
        catches: row.catches,
        runOuts: row.runOuts,
        stumpings: row.stumpings,
      } satisfies TournamentPlayerStatsDto;
    })
    .sort((a, b) => b.runs - a.runs || b.wickets - a.wickets || a.playerName.localeCompare(b.playerName));

  const result: TournamentStatsDto = {
    tournamentId,
    players,
    orangeCap: players.reduce<TournamentPlayerStatsDto | null>(
      (best, player) => (!best || player.runs > best.runs ? player : best),
      null,
    ),
    purpleCap: players.reduce<TournamentPlayerStatsDto | null>(
      (best, player) => (!best || player.wickets > best.wickets ? player : best),
      null,
    ),
  };

  await redis
    .set(statsCacheKey(tournamentId), JSON.stringify(result), 'EX', STATS_CACHE_TTL_SECONDS)
    .catch(() => undefined);

  return result;
}

/**
 * Subscribes once, at import time — the same trigger the points table uses, so
 * a finished match updates the table and everyone's profile from one event.
 */
export function registerPlayerStatsSubscriber(): void {
  onMatchEvent('match:completed', async ({ matchId }) => {
    await recomputePlayerStatsForMatch(matchId);
  });
}
