import {
  buildFootballState,
  defaultFormation,
  formationSpots,
  type FootballContext,
  type FootballEvent,
  type FootballMatchState,
  type FootballSnapshot,
  type LineupPlayer,
  type MatchClockDto,
  type PlayerRef,
  type TeamLineup,
  type TeamRef,
} from '@howzat/shared';
import type { MatchClock } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { notFound, unprocessable } from '../../lib/errors';

/**
 * Football's projection layer, and a deliberate mirror of the cricket one:
 * Redis holds a derived snapshot, Postgres holds the truth, and every read goes
 * through getFootballSnapshot so a cold or evicted cache is a latency problem
 * rather than a correctness one.
 */

const SNAPSHOT_TTL_SECONDS = 60 * 60 * 6;

export const footballSnapshotKey = (matchId: string) => `football:${matchId}`;

// ────────────────────────────────────────────── loading the context ──

/**
 * Everything about a football match that is not in its event log: who is
 * playing, in what shape, under what clock settings.
 */
export async function loadFootballMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team1: true,
      team2: true,
      clock: true,
      tournament: {
        select: { id: true, name: true, sport: true, playersPerTeam: true, periods: true, periodMinutes: true },
      },
      matchPlayers: {
        include: { player: { select: { id: true, name: true } } },
        orderBy: { lineupSlot: 'asc' },
      },
    },
  });

  if (!match) throw notFound('Match');

  if (match.tournament.sport !== 'FOOTBALL') {
    throw unprocessable('WRONG_SPORT', 'This is not a football match');
  }

  if (!match.team1 || !match.team2) {
    throw unprocessable(
      'TEAMS_NOT_SET',
      'This bracket slot has no teams yet — its feeder matches must finish first',
    );
  }

  return match;
}

export type FootballMatch = Awaited<ReturnType<typeof loadFootballMatch>>;

export async function loadFootballEvents(matchId: string): Promise<FootballEvent[]> {
  const rows = await prisma.footballEvent.findMany({
    where: { matchId },
    orderBy: { seq: 'asc' },
  });

  return rows.map(toFootballEvent);
}

export function toFootballEvent(row: {
  id: string;
  matchId: string;
  clientEventId: string;
  seq: number;
  eventType: FootballEvent['eventType'];
  supersedesEventId: string | null;
  kind: FootballEvent['kind'];
  teamId: string;
  playerId: string | null;
  assistPlayerId: string | null;
  minute: number;
  period: number;
  stoppage: number;
  createdBy: string;
  createdAt: Date;
}): FootballEvent {
  return {
    id: row.id,
    matchId: row.matchId,
    clientEventId: row.clientEventId,
    seq: row.seq,
    eventType: row.eventType,
    supersedesEventId: row.supersedesEventId,
    kind: row.kind,
    teamId: row.teamId,
    playerId: row.playerId,
    assistPlayerId: row.assistPlayerId,
    minute: row.minute,
    period: row.period,
    stoppage: row.stoppage,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toTeamRefFrom(team: {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
}): TeamRef {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    primaryColor: team.primaryColor,
  };
}

/** The reducer's context, assembled from a loaded match. */
export function footballContextFor(match: FootballMatch): FootballContext {
  const players: Record<string, PlayerRef> = {};

  for (const entry of match.matchPlayers) {
    players[entry.player.id] = { id: entry.player.id, name: entry.player.name };
  }

  return {
    matchId: match.id,
    homeTeamId: match.team1!.id,
    awayTeamId: match.team2!.id,
    players,
    periodMinutes: match.clock?.periodMinutes ?? match.tournament.periodMinutes,
  };
}

export function toClockDto(clock: MatchClock | null): MatchClockDto | null {
  if (!clock) return null;

  return {
    matchId: clock.matchId,
    periods: clock.periods,
    periodMinutes: clock.periodMinutes,
    currentPeriod: clock.currentPeriod,
    status: clock.status,
    elapsedMs: clock.elapsedMs,
    runningSince: clock.runningSince?.toISOString() ?? null,
    // Stamped on every read rather than stored: it is the reference point a
    // client uses to correct for the difference between its clock and ours.
    serverNow: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────── projecting a snapshot ──

/**
 * The team sheet as the pitch graphic needs it — a shirt, a position, and the
 * tally beside it. Coordinates come from the formation string rather than the
 * database, so a formation change moves everybody at once and nothing can be
 * left standing where an old shape put them.
 */
export function buildLineup(
  match: FootballMatch,
  teamId: string,
  state: FootballMatchState,
): TeamLineup | null {
  const team = match.team1!.id === teamId ? match.team1! : match.team2!;
  const isHome = teamId === match.team1!.id;
  const formation =
    (isHome ? match.team1Formation : match.team2Formation) ??
    defaultFormation(match.tournament.playersPerTeam);

  const entries = match.matchPlayers.filter((entry) => entry.teamId === teamId);
  if (entries.length === 0) return null;

  const side = isHome ? state.home : state.away;
  const spots = formationSpots(formation, match.tournament.playersPerTeam);

  const toLineupPlayer = (
    entry: (typeof entries)[number],
    slot: number | null,
  ): LineupPlayer => {
    const spot = slot === null ? null : (spots.find((candidate) => candidate.slot === slot) ?? null);
    const cards = side.cards[entry.player.id] ?? { yellow: 0, red: 0 };

    return {
      id: entry.player.id,
      name: entry.player.name,
      slot,
      shirtNumber: entry.shirtNumber,
      isCaptain: entry.isCaptain,
      // A substitute has no place on the grass. The coordinates are still
      // present rather than optional so nothing downstream has to branch;
      // they simply never get read, because subs are not rendered on the pitch.
      x: spot?.x ?? 0,
      y: spot?.y ?? 0,
      goals: side.scorers[entry.player.id] ?? 0,
      saves: side.savesBy[entry.player.id] ?? 0,
      yellowCards: cards.yellow,
      redCards: cards.red,
      isSentOff: side.sentOff.includes(entry.player.id),
    };
  };

  // Null lineupSlot is the bench — that is the whole distinction, and it is why
  // there is no isStarter column that could contradict it.
  const starters = entries
    .filter((entry) => entry.lineupSlot !== null)
    .map((entry) => toLineupPlayer(entry, entry.lineupSlot))
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));

  const substitutes = entries
    .filter((entry) => entry.lineupSlot === null)
    .map((entry) => toLineupPlayer(entry, null));

  return {
    team: toTeamRefFrom(team),
    formation,
    players: starters,
    substitutes,
  };
}

export function buildFootballSnapshot(
  match: FootballMatch,
  state: FootballMatchState,
): FootballSnapshot {
  const home = match.team1!;
  const away = match.team2!;

  return {
    sport: 'FOOTBALL',
    matchId: match.id,
    publicSlug: match.publicSlug,
    status: match.status,
    tournamentName: match.tournament.name,

    home: {
      teamId: home.id,
      name: home.name,
      short: home.shortName,
      color: home.primaryColor,
      goals: state.home.goals,
      saves: state.home.saves,
      yellowCards: state.home.yellowCards,
      redCards: state.home.redCards,
    },

    away: {
      teamId: away.id,
      name: away.name,
      short: away.shortName,
      color: away.primaryColor,
      goals: state.away.goals,
      saves: state.away.saves,
      yellowCards: state.away.yellowCards,
      redCards: state.away.redCards,
    },

    clock: toClockDto(match.clock),
    lineups: {
      home: buildLineup(match, home.id, state),
      away: buildLineup(match, away.id, state),
    },
    // Newest first: a scoreboard is read from the top, and the thing that just
    // happened is the thing a viewer opened the page for.
    incidents: [...state.incidents].reverse(),
    resultText: match.resultText,
    lastEventSeq: state.lastEventSeq,
    updatedAt: new Date().toISOString(),
  };
}

/** Fold the log and project it. The one recovery path for a cold cache. */
export async function rebuildFootballSnapshot(matchId: string): Promise<FootballSnapshot> {
  const match = await loadFootballMatch(matchId);
  const events = await loadFootballEvents(matchId);
  const state = buildFootballState(footballContextFor(match), events);

  const snapshot = buildFootballSnapshot(match, state);
  await writeFootballSnapshot(snapshot);

  return snapshot;
}

// ────────────────────────────────────────────────── cache read / write ──

/**
 * Guarded by lastEventSeq the same way the cricket snapshot is, with one
 * exception: a clock command carries the same seq as the last incident, so an
 * equal seq must be allowed to overwrite. Only a strictly *older* one is
 * dropped.
 */
export async function writeFootballSnapshot(snapshot: FootballSnapshot): Promise<void> {
  try {
    const existing = await readCachedFootballSnapshot(snapshot.matchId);

    if (existing && existing.lastEventSeq > snapshot.lastEventSeq) {
      logger.debug(
        {
          matchId: snapshot.matchId,
          cached: existing.lastEventSeq,
          incoming: snapshot.lastEventSeq,
        },
        'Skipped stale football snapshot write',
      );
      return;
    }

    await redis.set(
      footballSnapshotKey(snapshot.matchId),
      JSON.stringify(snapshot),
      'EX',
      SNAPSHOT_TTL_SECONDS,
    );
  } catch (err) {
    // Postgres already has the goal. A cache failure degrades reads to a
    // rebuild; it must never fail the write that succeeded.
    logger.error({ err, matchId: snapshot.matchId }, 'Football snapshot write failed');
  }
}

export async function readCachedFootballSnapshot(
  matchId: string,
): Promise<FootballSnapshot | null> {
  try {
    const raw = await redis.get(footballSnapshotKey(matchId));
    if (!raw) return null;
    return JSON.parse(raw) as FootballSnapshot;
  } catch (err) {
    logger.warn({ err, matchId }, 'Football snapshot read failed — falling back to a rebuild');
    return null;
  }
}

/**
 * The read path for every viewer.
 *
 * A cached snapshot is returned with its clock re-stamped rather than as it was
 * written: `serverNow` is what a client measures its own skew against, and a
 * six-hour-old value would put every viewer's clock six hours out.
 */
export async function getFootballSnapshot(matchId: string): Promise<FootballSnapshot | null> {
  const cached = await readCachedFootballSnapshot(matchId);

  if (cached) {
    return cached.clock
      ? { ...cached, clock: { ...cached.clock, serverNow: new Date().toISOString() } }
      : cached;
  }

  return rebuildFootballSnapshot(matchId);
}
