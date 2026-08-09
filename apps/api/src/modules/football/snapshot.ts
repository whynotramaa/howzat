import {
  buildFootballState,
  defaultFormation,
  formationSpots,
  lastChangeFor,
  resolveOnPitch,
  type FootballContext,
  type FootballEvent,
  type FootballMatchState,
  type FootballSnapshot,
  type FootballSnapshotSide,
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

const SNAPSHOT_TTL_SECONDS = 60 * 60 * 6;

export const footballSnapshotKey = (matchId: string) => `football:${matchId}`;

export async function loadFootballMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team1: true,
      team2: true,
      clock: true,
      tournament: {
        select: {
          id: true,
          name: true,
          sport: true,
          playersPerTeam: true,
          periods: true,
          periodMinutes: true,
        },
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
  playerOffId: string | null;
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
    playerOffId: row.playerOffId,
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
    serverNow: new Date().toISOString(),
  };
}

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

  const onPitch = resolveOnPitch(
    entries
      .filter((entry) => entry.lineupSlot !== null)
      .map((entry) => ({ playerId: entry.playerId, slot: entry.lineupSlot! })),
    side,
  );

  const slotOf = new Map<string, number>();
  for (const [slot, playerId] of onPitch) slotOf.set(playerId, slot);

  const toLineupPlayer = (entry: (typeof entries)[number]): LineupPlayer => {
    const slot = slotOf.get(entry.playerId) ?? null;
    const spot =
      slot === null ? null : (spots.find((candidate) => candidate.slot === slot) ?? null);
    const cards = side.cards[entry.player.id] ?? { yellow: 0, red: 0 };
    const change = lastChangeFor(side, entry.playerId);

    return {
      id: entry.player.id,
      name: entry.player.name,
      slot,
      shirtNumber: entry.shirtNumber,
      isCaptain: entry.isCaptain,
      x: spot?.x ?? 0,
      y: spot?.y ?? 0,
      goals: side.scorers[entry.player.id] ?? 0,
      saves: side.savesBy[entry.player.id] ?? 0,
      yellowCards: cards.yellow,
      redCards: cards.red,
      isSentOff: side.sentOff.includes(entry.player.id),
      isOnPitch: slot !== null,
      cameOnAt: change.on,
      wentOffAt: change.off,
    };
  };

  const all = entries.map(toLineupPlayer);

  return {
    team: toTeamRefFrom(team),
    formation,
    players: all.filter((player) => player.isOnPitch).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)),
    substitutes: all.filter((player) => !player.isOnPitch),
  };
}

function toSnapshotSide(
  team: { id: string; name: string; shortName: string; primaryColor: string },
  side: FootballMatchState['home'],
): FootballSnapshotSide {
  return {
    teamId: team.id,
    name: team.name,
    short: team.shortName,
    color: team.primaryColor,
    goals: side.goals,
    saves: side.saves,
    yellowCards: side.yellowCards,
    redCards: side.redCards,
    substitutionsUsed: side.substitutions.length,
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

    home: toSnapshotSide(home, state.home),
    away: toSnapshotSide(away, state.away),

    substitutionLimit: match.subLimit,
    clock: toClockDto(match.clock),
    lineups: {
      home: buildLineup(match, home.id, state),
      away: buildLineup(match, away.id, state),
    },
    incidents: [...state.incidents].reverse(),
    resultText: match.resultText,
    lastEventSeq: state.lastEventSeq,
    updatedAt: new Date().toISOString(),
  };
}

export async function rebuildFootballSnapshot(matchId: string): Promise<FootballSnapshot> {
  const match = await loadFootballMatch(matchId);
  const events = await loadFootballEvents(matchId);
  const state = buildFootballState(footballContextFor(match), events);

  const snapshot = buildFootballSnapshot(match, state);
  await writeFootballSnapshot(snapshot);

  return snapshot;
}

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

export async function getFootballSnapshot(matchId: string): Promise<FootballSnapshot | null> {
  const cached = await readCachedFootballSnapshot(matchId);

  if (cached) {
    return cached.clock
      ? { ...cached, clock: { ...cached.clock, serverNow: new Date().toISOString() } }
      : cached;
  }

  return rebuildFootballSnapshot(matchId);
}
