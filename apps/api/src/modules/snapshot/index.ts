import {
  buildState,
  economy,
  formatOvers,
  requiredRunRate,
  runRate,
  strikeRate,
  type BallEvent,
  type InningsContext,
  type MatchState,
  type MatchSnapshot,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { notFound } from '../../lib/errors';

const SNAPSHOT_TTL_SECONDS = 60 * 60 * 6;

export const snapshotKey = (matchId: string) => `match:${matchId}`;

export async function loadInningsContext(inningsId: string): Promise<InningsContext> {
  const innings = await prisma.innings.findUnique({
    where: { id: inningsId },
    include: {
      battingTeam: true,
      bowlingTeam: true,
      match: {
        include: {
          matchPlayers: {
            include: { player: { select: { id: true, name: true } } },
            orderBy: { battingOrder: 'asc' },
          },
        },
      },
    },
  });

  if (!innings) throw notFound('Innings');

  const squadFor = (teamId: string) =>
    innings.match.matchPlayers
      .filter((entry) => entry.teamId === teamId)
      .map((entry) => ({ id: entry.player.id, name: entry.player.name }));

  return {
    inningsId: innings.id,
    matchId: innings.matchId,
    number: innings.number,
    battingTeam: {
      id: innings.battingTeam.id,
      name: innings.battingTeam.name,
      shortName: innings.battingTeam.shortName,
      primaryColor: innings.battingTeam.primaryColor,
    },
    bowlingTeam: {
      id: innings.bowlingTeam.id,
      name: innings.bowlingTeam.name,
      shortName: innings.bowlingTeam.shortName,
      primaryColor: innings.bowlingTeam.primaryColor,
    },
    oversQuota: innings.oversQuota,
    targetRuns: innings.targetRuns,
    battingXI: squadFor(innings.battingTeamId),
    bowlingXI: squadFor(innings.bowlingTeamId),
  };
}

export async function loadEvents(inningsId: string): Promise<BallEvent[]> {
  const rows = await prisma.ballEvent.findMany({
    where: { inningsId },
    orderBy: { seq: 'asc' },
  });

  return rows.map(toBallEvent);
}

export function toBallEvent(row: {
  id: string;
  inningsId: string;
  clientEventId: string;
  seq: number;
  overNumber: number;
  ballNumber: number;
  eventType: BallEvent['eventType'];
  supersedesEventId: string | null;
  isLegalDelivery: boolean;
  runsOffBat: number;
  extraRuns: number;
  extraType: BallEvent['extraType'];
  isWicket: boolean;
  wicketType: BallEvent['wicketType'];
  dismissedPlayerId: string | null;
  fielderId: string | null;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  createdBy: string;
  createdAt: Date;
}): BallEvent {
  return {
    id: row.id,
    inningsId: row.inningsId,
    clientEventId: row.clientEventId,
    seq: row.seq,
    overNumber: row.overNumber,
    ballNumber: row.ballNumber,
    eventType: row.eventType,
    supersedesEventId: row.supersedesEventId,
    isLegalDelivery: row.isLegalDelivery,
    runsOffBat: row.runsOffBat,
    extraRuns: row.extraRuns,
    extraType: row.extraType,
    isWicket: row.isWicket,
    wicketType: row.wicketType,
    dismissedPlayerId: row.dismissedPlayerId,
    fielderId: row.fielderId,
    strikerId: row.strikerId,
    nonStrikerId: row.nonStrikerId,
    bowlerId: row.bowlerId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function rebuildState(
  inningsId: string,
): Promise<{ state: MatchState; context: InningsContext }> {
  const context = await loadInningsContext(inningsId);
  const events = await loadEvents(inningsId);
  return { state: buildState(context, events), context };
}

export function buildSnapshot(
  match: {
    id: string;
    publicSlug: string;
    status: string;
    resultText: string | null;
  },
  state: MatchState,
  context: InningsContext,
): MatchSnapshot {
  const ballsRemaining = context.oversQuota * 6 - state.legalBalls;
  const runsNeeded = context.targetRuns !== null ? context.targetRuns - state.runs : null;

  const atCrease = [state.strikerId, state.nonStrikerId]
    .filter((id): id is string => Boolean(id))
    .map((id) => state.batsmen[id])
    .filter((batsman): batsman is NonNullable<typeof batsman> => Boolean(batsman));

  const bowler = state.bowlerId ? state.bowlers[state.bowlerId] : null;

  return {
    matchId: match.id,
    publicSlug: match.publicSlug,
    status: match.status,
    inningsNumber: state.inningsNumber,

    batting: {
      teamId: context.battingTeam.id,
      name: context.battingTeam.name,
      short: context.battingTeam.shortName,
      color: context.battingTeam.primaryColor,
      runs: state.runs,
      wickets: state.wickets,
      overs: formatOvers(state.legalBalls),
      balls: state.legalBalls,
      runRate: runRate(state.runs, state.legalBalls),
      oversQuota: context.oversQuota,
    },

    bowling: {
      teamId: context.bowlingTeam.id,
      name: context.bowlingTeam.name,
      short: context.bowlingTeam.shortName,
      color: context.bowlingTeam.primaryColor,
    },

    target: context.targetRuns,
    required:
      runsNeeded !== null && runsNeeded > 0 && !state.isComplete
        ? {
            runs: runsNeeded,
            balls: ballsRemaining,
            rrr: requiredRunRate(runsNeeded, ballsRemaining) ?? 0,
          }
        : null,

    batsmen: atCrease.map((batsman) => ({
      playerId: batsman.playerId,
      name: batsman.name,
      runs: batsman.runs,
      balls: batsman.balls,
      fours: batsman.fours,
      sixes: batsman.sixes,
      sr: strikeRate(batsman.runs, batsman.balls),
      onStrike: batsman.playerId === state.strikerId,
    })),

    bowler: bowler
      ? {
          playerId: bowler.playerId,
          name: bowler.name,
          overs: formatOvers(bowler.balls),
          maidens: bowler.maidens,
          runs: bowler.runs,
          wickets: bowler.wickets,
          econ: economy(bowler.runs, bowler.balls),
        }
      : null,

    thisOver: state.thisOver.map((ball) => ball.display),
    recentBalls: state.recentBalls,
    extras: state.extras,
    fallOfWickets: state.fallOfWickets,
    resultText: match.resultText,
    lastEventSeq: state.lastEventSeq,
    updatedAt: new Date().toISOString(),
  };
}

export async function writeSnapshot(snapshot: MatchSnapshot): Promise<void> {
  const key = snapshotKey(snapshot.matchId);

  try {
    const existing = await readCachedSnapshot(snapshot.matchId);

    if (existing && existing.lastEventSeq > snapshot.lastEventSeq) {
      logger.debug(
        {
          matchId: snapshot.matchId,
          cached: existing.lastEventSeq,
          incoming: snapshot.lastEventSeq,
        },
        'Skipped stale snapshot write',
      );
      return;
    }

    await redis.set(key, JSON.stringify(snapshot), 'EX', SNAPSHOT_TTL_SECONDS);
  } catch (err) {
    logger.error({ err, matchId: snapshot.matchId }, 'Snapshot write failed');
  }
}

export async function readCachedSnapshot(matchId: string): Promise<MatchSnapshot | null> {
  try {
    const raw = await redis.get(snapshotKey(matchId));
    if (!raw) return null;
    return JSON.parse(raw) as MatchSnapshot;
  } catch (err) {
    logger.warn({ err, matchId }, 'Snapshot read failed — falling back to a rebuild');
    return null;
  }
}

export async function getSnapshot(matchId: string): Promise<MatchSnapshot | null> {
  const cached = await readCachedSnapshot(matchId);
  if (cached) return cached;

  return rebuildSnapshot(matchId);
}

export async function rebuildSnapshot(matchId: string): Promise<MatchSnapshot | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { innings: { orderBy: { number: 'desc' } } },
  });

  if (!match) throw notFound('Match');

  const live = match.innings.find((entry) => entry.status === 'IN_PROGRESS');

  const liveHasEvents =
    live !== undefined && (await prisma.ballEvent.count({ where: { inningsId: live.id } })) > 0;

  const innings = liveHasEvents
    ? live
    : (match.innings.find((entry) => entry.status === 'COMPLETED') ?? live);

  if (!innings) return null;

  const { state, context } = await rebuildState(innings.id);
  const snapshot = buildSnapshot(match, state, context);

  await writeSnapshot(snapshot);

  return snapshot;
}
