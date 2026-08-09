import {
  formatOvers,
  materializeFootballEvents,
  type Sport,
  type TournamentMatchDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';

const NO_SCORE = null;

export async function loadTournamentMatches(
  tournamentId: string,
  sport: Sport,
): Promise<TournamentMatchDto[]> {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    orderBy: [{ round: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      team1: { select: { id: true, name: true, shortName: true, primaryColor: true } },
      team2: { select: { id: true, name: true, shortName: true, primaryColor: true } },
    },
  });

  const scores =
    sport === 'FOOTBALL'
      ? await footballScores(matches)
      : await cricketScores(matches.map((match) => match.id));

  return matches.map((match) => ({
    id: match.id,
    publicSlug: match.publicSlug,
    round: match.round,
    stage: match.stage,
    status: match.status,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    venue: match.venue,
    resultText: match.resultText,
    winnerTeamId: match.winnerTeamId,
    team1: match.team1,
    team2: match.team2,
    score: resolveScore(scores.get(match.id), match.team1Id, match.team2Id),
  }));
}

type MatchScore = Map<string, string>;

function resolveScore(
  score: MatchScore | undefined,
  team1Id: string | null,
  team2Id: string | null,
): TournamentMatchDto['score'] {
  if (!score || score.size === 0) return NO_SCORE;

  const team1 = team1Id ? (score.get(team1Id) ?? null) : null;
  const team2 = team2Id ? (score.get(team2Id) ?? null) : null;

  return team1 === null && team2 === null ? NO_SCORE : { team1, team2 };
}

async function cricketScores(matchIds: string[]): Promise<Map<string, MatchScore>> {
  const byMatch = new Map<string, MatchScore>();
  if (matchIds.length === 0) return byMatch;

  const innings = await prisma.innings.findMany({
    where: { matchId: { in: matchIds } },
    orderBy: { number: 'asc' },
    select: { id: true, matchId: true, battingTeamId: true },
  });

  if (innings.length === 0) return byMatch;

  const events = await prisma.ballEvent.findMany({
    where: { inningsId: { in: innings.map((entry) => entry.id) } },
    select: {
      id: true,
      inningsId: true,
      eventType: true,
      supersedesEventId: true,
      runsOffBat: true,
      extraRuns: true,
      isLegalDelivery: true,
      isWicket: true,
    },
  });

  const byInnings = new Map<string, typeof events>();
  for (const event of events) {
    const bucket = byInnings.get(event.inningsId);
    if (bucket) bucket.push(event);
    else byInnings.set(event.inningsId, [event]);
  }

  for (const entry of innings) {
    const log = byInnings.get(entry.id) ?? [];

    const replaced = new Map<string, (typeof log)[number]>();
    const removed = new Set<string>();

    for (const event of log) {
      if (!event.supersedesEventId) continue;
      if (event.eventType === 'CORRECTION') replaced.set(event.supersedesEventId, event);
      if (event.eventType === 'UNDO') removed.add(event.supersedesEventId);
    }

    let runs = 0;
    let wickets = 0;
    let legalBalls = 0;

    for (const event of log) {
      if (event.eventType !== 'BALL' || removed.has(event.id)) continue;

      const effective = replaced.get(event.id) ?? event;
      runs += effective.runsOffBat + effective.extraRuns;
      if (effective.isLegalDelivery) legalBalls += 1;
      if (effective.isWicket) wickets += 1;
    }

    if (log.length === 0) continue;

    const score = byMatch.get(entry.matchId) ?? new Map<string, string>();
    score.set(entry.battingTeamId, `${runs}/${wickets} (${formatOvers(legalBalls)})`);
    byMatch.set(entry.matchId, score);
  }

  return byMatch;
}

interface ScorableMatch {
  id: string;
  status: string;
  team1Id: string | null;
  team2Id: string | null;
}

async function footballScores(matches: ScorableMatch[]): Promise<Map<string, MatchScore>> {
  const byMatch = new Map<string, MatchScore>();

  const played = matches.filter(
    (match) =>
      match.team1Id !== null &&
      match.team2Id !== null &&
      ['LIVE', 'INNINGS_BREAK', 'COMPLETED'].includes(match.status),
  );

  if (played.length === 0) return byMatch;

  const events = await prisma.footballEvent.findMany({
    where: { matchId: { in: played.map((match) => match.id) } },
    orderBy: { seq: 'asc' },
  });

  const byMatchId = new Map<string, typeof events>();
  for (const event of events) {
    const bucket = byMatchId.get(event.matchId);
    if (bucket) bucket.push(event);
    else byMatchId.set(event.matchId, [event]);
  }

  for (const match of played) {
    const goals = new Map<string, number>([
      [match.team1Id!, 0],
      [match.team2Id!, 0],
    ]);

    const log = byMatchId.get(match.id) ?? [];

    for (const event of materializeFootballEvents(
      log.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    )) {
      if (event.kind !== 'GOAL' && event.kind !== 'OWN_GOAL') continue;
      goals.set(event.teamId, (goals.get(event.teamId) ?? 0) + 1);
    }

    byMatch.set(match.id, new Map([...goals].map(([teamId, count]) => [teamId, String(count)])));
  }

  return byMatch;
}
