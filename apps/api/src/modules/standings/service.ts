import {
  aggregateFootballStandings,
  aggregateStandings,
  ballsAsOversText,
  formatGoalDifference,
  formatNrr,
  materializeFootballEvents,
  sortFootballStandings,
  sortStandings,
  type FootballMatchResult,
  type MatchResult,
  type StandingsRowDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { redis } from '../../lib/redis';
import { notFound } from '../../lib/errors';
import { toTeamRef } from '../fixtures/service';
import { onMatchEvent } from '../../realtime/bus';

const CACHE_TTL_SECONDS = 300;
const cacheKey = (tournamentId: string) => `standings:${tournamentId}`;

async function loadResults(tournamentId: string): Promise<MatchResult[]> {
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: { in: ['COMPLETED', 'ABANDONED'] },
      team1Id: { not: null },
      team2Id: { not: null },
    },
    // Ordered, because the DLS substitution in `nrrInnings` is positional —
    // it replaces the first innings with the par score.
    include: { innings: { orderBy: { number: 'asc' } } },
  });

  return matches.map((match) => ({
    matchId: match.id,
    teamIds: [match.team1Id!, match.team2Id!] as [string, string],
    winnerTeamId: match.winnerTeamId,
    noResult: match.status === 'ABANDONED',
    dls: match.decidedByDls && match.dlsParScore !== null ? { parScore: match.dlsParScore } : null,
    innings: match.innings.map((innings) => ({
      battingTeamId: innings.battingTeamId,
      bowlingTeamId: innings.bowlingTeamId,
      runs: 0,
      legalBalls: 0,
      oversQuota: innings.oversQuota,
      ballsQuota: innings.ballsQuota,
      endReason: innings.endReason,
    })),
  }));
}

async function fillInningsTotals(results: MatchResult[]): Promise<void> {
  const inningsIds = await prisma.innings.findMany({
    where: { matchId: { in: results.map((result) => result.matchId) } },
    select: { id: true, matchId: true, battingTeamId: true },
  });

  for (const innings of inningsIds) {
    const events = await prisma.ballEvent.findMany({
      where: { inningsId: innings.id },
      select: {
        id: true,
        eventType: true,
        supersedesEventId: true,
        runsOffBat: true,
        extraRuns: true,
        isLegalDelivery: true,
      },
    });

    const replaced = new Map<string, (typeof events)[number]>();
    const removed = new Set<string>();

    for (const event of events) {
      if (!event.supersedesEventId) continue;
      if (event.eventType === 'CORRECTION') replaced.set(event.supersedesEventId, event);
      if (event.eventType === 'UNDO') removed.add(event.supersedesEventId);
    }

    let runs = 0;
    let legalBalls = 0;

    for (const event of events) {
      if (event.eventType !== 'BALL' || removed.has(event.id)) continue;

      const effective = replaced.get(event.id) ?? event;
      runs += effective.runsOffBat + effective.extraRuns;
      if (effective.isLegalDelivery) legalBalls += 1;
    }

    const match = results.find((result) => result.matchId === innings.matchId);
    const row = match?.innings.find((entry) => entry.battingTeamId === innings.battingTeamId);

    if (row) {
      row.runs = runs;
      row.legalBalls = legalBalls;
    }
  }
}

async function loadFootballResults(tournamentId: string): Promise<FootballMatchResult[]> {
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: { in: ['COMPLETED', 'ABANDONED'] },
      team1Id: { not: null },
      team2Id: { not: null },
    },
    include: { footballEvents: { orderBy: { seq: 'asc' } } },
  });

  return matches.map((match) => {
    let homeGoals = 0;
    let awayGoals = 0;

    for (const event of materializeFootballEvents(
      match.footballEvents.map((event) => ({
        ...event,
        matchId: match.id,
        createdAt: event.createdAt.toISOString(),
      })),
    )) {
      if (event.kind !== 'GOAL' && event.kind !== 'OWN_GOAL') continue;
      if (event.teamId === match.team1Id) homeGoals += 1;
      else if (event.teamId === match.team2Id) awayGoals += 1;
    }

    return {
      matchId: match.id,
      teamIds: [match.team1Id!, match.team2Id!] as [string, string],
      goals: [homeGoals, awayGoals] as [number, number],
      winnerTeamId: match.winnerTeamId,
      noResult: match.status === 'ABANDONED',
    };
  });
}

async function recomputeFootballStandings(tournamentId: string, teamIds: string[]): Promise<void> {
  const results = await loadFootballResults(tournamentId);
  const totals = aggregateFootballStandings(teamIds, results);

  await prisma.$transaction(
    totals.map((row) => {
      const values = {
        played: row.played,
        won: row.won,
        lost: row.lost,
        tied: row.drawn,
        noResult: 0,
        points: row.points,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
      };

      return prisma.pointsTable.upsert({
        where: { tournamentId_teamId: { tournamentId, teamId: row.teamId } },
        update: values,
        create: { tournamentId, teamId: row.teamId, ...values },
      });
    }),
  );

  await redis.del(cacheKey(tournamentId)).catch(() => undefined);

  logger.info({ tournamentId, teams: totals.length }, 'Football standings recomputed');
}

async function getFootballStandings(tournamentId: string): Promise<StandingsRowDto[]> {
  const [rows, teams, results] = await Promise.all([
    prisma.pointsTable.findMany({ where: { tournamentId } }),
    prisma.team.findMany({ where: { tournamentId } }),
    loadFootballResults(tournamentId),
  ]);

  const teamsById = new Map(teams.map((team) => [team.id, team]));

  const totals = teams.map((team) => {
    const row = rows.find((entry) => entry.teamId === team.id);
    const goalsFor = row?.goalsFor ?? 0;
    const goalsAgainst = row?.goalsAgainst ?? 0;

    return {
      teamId: team.id,
      played: row?.played ?? 0,
      won: row?.won ?? 0,
      drawn: row?.tied ?? 0,
      lost: row?.lost ?? 0,
      points: row?.points ?? 0,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
    };
  });

  const sorted = sortFootballStandings(totals, results, (id) => teamsById.get(id)?.name ?? id);

  return sorted.map((row, index) => ({
    position: index + 1,
    team: toTeamRef(teamsById.get(row.teamId)!),
    played: row.played,
    won: row.won,
    lost: row.lost,
    tied: row.drawn,
    noResult: 0,
    points: row.points,
    runsScored: 0,
    oversFaced: '0.0',
    runsConceded: 0,
    oversBowled: '0.0',
    nrr: 0,
    nrrText: '+0.000',
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    goalDifferenceText: formatGoalDifference(row.goalDifference),
  }));
}

export async function recomputeStandings(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { sport: true },
  });

  const teams = await prisma.team.findMany({
    where: { tournamentId },
    select: { id: true },
  });

  if (teams.length === 0) return;

  if (tournament?.sport === 'FOOTBALL') {
    await recomputeFootballStandings(
      tournamentId,
      teams.map((team) => team.id),
    );
    return;
  }

  const results = await loadResults(tournamentId);
  await fillInningsTotals(results);

  const totals = aggregateStandings(
    teams.map((team) => team.id),
    results,
  );

  await prisma.$transaction(
    totals.map((row) =>
      prisma.pointsTable.upsert({
        where: { tournamentId_teamId: { tournamentId, teamId: row.teamId } },
        update: {
          played: row.played,
          won: row.won,
          lost: row.lost,
          tied: row.tied,
          noResult: row.noResult,
          points: row.points,
          runsScored: row.runsScored,
          ballsFaced: row.ballsFaced,
          runsConceded: row.runsConceded,
          ballsBowled: row.ballsBowled,
          nrr: row.nrr,
        },
        create: {
          tournamentId,
          teamId: row.teamId,
          played: row.played,
          won: row.won,
          lost: row.lost,
          tied: row.tied,
          noResult: row.noResult,
          points: row.points,
          runsScored: row.runsScored,
          ballsFaced: row.ballsFaced,
          runsConceded: row.runsConceded,
          ballsBowled: row.ballsBowled,
          nrr: row.nrr,
        },
      }),
    ),
  );

  await redis.del(cacheKey(tournamentId)).catch(() => undefined);

  logger.info({ tournamentId, teams: totals.length }, 'Standings recomputed');
}

export async function getStandings(tournamentId: string): Promise<StandingsRowDto[]> {
  const cached = await redis.get(cacheKey(tournamentId)).catch(() => null);
  if (cached) return JSON.parse(cached) as StandingsRowDto[];

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, sport: true },
  });

  if (!tournament) throw notFound('Tournament');

  if (tournament.sport === 'FOOTBALL') {
    const footballTable = await getFootballStandings(tournamentId);

    await redis
      .set(cacheKey(tournamentId), JSON.stringify(footballTable), 'EX', CACHE_TTL_SECONDS)
      .catch(() => undefined);

    return footballTable;
  }

  const [rows, teams, results] = await Promise.all([
    prisma.pointsTable.findMany({ where: { tournamentId } }),
    prisma.team.findMany({ where: { tournamentId } }),
    loadResults(tournamentId),
  ]);

  const teamsById = new Map(teams.map((team) => [team.id, team]));

  const totals = teams.map((team) => {
    const row = rows.find((entry) => entry.teamId === team.id);
    return {
      teamId: team.id,
      played: row?.played ?? 0,
      won: row?.won ?? 0,
      lost: row?.lost ?? 0,
      tied: row?.tied ?? 0,
      noResult: row?.noResult ?? 0,
      points: row?.points ?? 0,
      runsScored: row?.runsScored ?? 0,
      ballsFaced: row?.ballsFaced ?? 0,
      runsConceded: row?.runsConceded ?? 0,
      ballsBowled: row?.ballsBowled ?? 0,
      nrr: row?.nrr ?? 0,
    };
  });

  const sorted = sortStandings(totals, results, (id) => teamsById.get(id)?.name ?? id);

  const table: StandingsRowDto[] = sorted.map((row, index) => ({
    position: index + 1,
    team: toTeamRef(teamsById.get(row.teamId)!),
    played: row.played,
    won: row.won,
    lost: row.lost,
    tied: row.tied,
    noResult: row.noResult,
    points: row.points,
    runsScored: row.runsScored,
    oversFaced: ballsAsOversText(row.ballsFaced),
    runsConceded: row.runsConceded,
    oversBowled: ballsAsOversText(row.ballsBowled),
    nrr: row.nrr,
    nrrText: formatNrr(row.nrr),
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    goalDifferenceText: '0',
  }));

  await redis
    .set(cacheKey(tournamentId), JSON.stringify(table), 'EX', CACHE_TTL_SECONDS)
    .catch(() => undefined);

  return table;
}

export function registerStandingsSubscriber(): void {
  onMatchEvent('match:completed', async ({ tournamentId }) => {
    await recomputeStandings(tournamentId);
  });
}
