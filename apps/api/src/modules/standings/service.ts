import {
  aggregateStandings,
  ballsAsOversText,
  formatNrr,
  sortStandings,
  type MatchResult,
  type StandingsRowDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { redis } from '../../lib/redis';
import { notFound } from '../../lib/errors';
import { toTeamRef } from '../fixtures/service';
import { onMatchEvent } from '../../realtime/bus';

/**
 * Phase 6. Triggered by the match:completed domain event only — no cron, no
 * polling — and recomputed for the whole tournament from Innings rows inside
 * one transaction. Recomputing rather than incrementing is what makes it
 * idempotent: replaying the event, or repairing a bad row, converges on the
 * same answer instead of double-counting.
 */

const CACHE_TTL_SECONDS = 300;
const cacheKey = (tournamentId: string) => `standings:${tournamentId}`;

/** Reads finished matches in the shape the pure aggregator expects. */
async function loadResults(tournamentId: string): Promise<MatchResult[]> {
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: { in: ['COMPLETED', 'ABANDONED'] },
      team1Id: { not: null },
      team2Id: { not: null },
    },
    include: { innings: true },
  });

  return matches.map((match) => ({
    matchId: match.id,
    teamIds: [match.team1Id!, match.team2Id!] as [string, string],
    winnerTeamId: match.winnerTeamId,
    noResult: match.status === 'ABANDONED',
    innings: match.innings.map((innings) => ({
      battingTeamId: innings.battingTeamId,
      bowlingTeamId: innings.bowlingTeamId,
      runs: 0, // filled in below from the event log
      legalBalls: 0,
      oversQuota: innings.oversQuota,
      endReason: innings.endReason,
    })),
  }));
}

/**
 * Runs and legal balls come from the event log, not from a stored total —
 * the log is the source of truth, and a correction must be reflected in the
 * points table without anyone remembering to update a second place.
 */
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

    // Same supersede semantics as the reducer: a corrected ball is replaced,
    // an undone ball is dropped.
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

export async function recomputeStandings(tournamentId: string): Promise<void> {
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    select: { id: true },
  });

  if (teams.length === 0) return;

  const results = await loadResults(tournamentId);
  await fillInningsTotals(results);

  const totals = aggregateStandings(
    teams.map((team) => team.id),
    results,
  );

  // One transaction, so a reader never sees a half-updated table.
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

/** The rendered table, sorted and with the NRR inputs exposed. */
export async function getStandings(tournamentId: string): Promise<StandingsRowDto[]> {
  const cached = await redis.get(cacheKey(tournamentId)).catch(() => null);
  if (cached) return JSON.parse(cached) as StandingsRowDto[];

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });

  if (!tournament) throw notFound('Tournament');

  const [rows, teams, results] = await Promise.all([
    prisma.pointsTable.findMany({ where: { tournamentId } }),
    prisma.team.findMany({ where: { tournamentId } }),
    loadResults(tournamentId),
  ]);

  const teamsById = new Map(teams.map((team) => [team.id, team]));

  // A team with no points row yet still belongs in the table on zero.
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
  }));

  await redis
    .set(cacheKey(tournamentId), JSON.stringify(table), 'EX', CACHE_TTL_SECONDS)
    .catch(() => undefined);

  return table;
}

/**
 * Subscribes once, at import time. Every completed or abandoned match rebuilds
 * the whole table for its tournament.
 */
export function registerStandingsSubscriber(): void {
  onMatchEvent('match:completed', async ({ tournamentId }) => {
    await recomputeStandings(tournamentId);
  });
}
