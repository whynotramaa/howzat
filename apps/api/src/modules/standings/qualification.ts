import { qualificationScenarios, type QualificationResult } from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { getStandings } from './service';

export interface QualificationResponse extends QualificationResult {
  fixtures: Array<{
    fixtureId: string;
    label: string;
    homeTeamId: string;
    awayTeamId: string;
  }>;
}

export async function getQualificationScenarios(
  tournamentId: string,
  targetTeamId: string,
  qualificationSpots: number,
  maxRelevantFixtures?: number,
): Promise<QualificationResponse> {
  const standings = await getStandings(tournamentId);
  const target = standings.find((row) => row.team.id === targetTeamId);
  if (!target) throw notFound('Team in standings');

  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: { notIn: ['COMPLETED', 'ABANDONED'] },
      team1Id: { not: null },
      team2Id: { not: null },
    },
    select: {
      id: true,
      team1Id: true,
      team2Id: true,
      team1: { select: { name: true, shortName: true } },
      team2: { select: { name: true, shortName: true } },
    },
    orderBy: [{ round: 'asc' }, { createdAt: 'asc' }],
  });

  const remainingByTeam = new Map<string, number>();
  for (const row of standings) remainingByTeam.set(row.team.id, 0);
  for (const match of matches) {
    if (match.team1Id) remainingByTeam.set(match.team1Id, (remainingByTeam.get(match.team1Id) ?? 0) + 1);
    if (match.team2Id) remainingByTeam.set(match.team2Id, (remainingByTeam.get(match.team2Id) ?? 0) + 1);
  }

  const result = qualificationScenarios({
    teams: standings.map((row) => ({
      teamId: row.team.id,
      points: row.points,
      nrr: row.nrr,
      remainingMatches: remainingByTeam.get(row.team.id) ?? 0,
    })),
    remainingFixtures: matches.map((match) => ({
      fixtureId: match.id,
      homeTeamId: match.team1Id!,
      awayTeamId: match.team2Id!,
    })),
    targetTeamId,
    qualificationSpots,
    maxRelevantFixtures,
  });

  return {
    ...result,
    fixtures: matches.map((match) => ({
      fixtureId: match.id,
      homeTeamId: match.team1Id!,
      awayTeamId: match.team2Id!,
      label: `${match.team1?.shortName ?? match.team1?.name ?? 'TBD'} v ${match.team2?.shortName ?? match.team2?.name ?? 'TBD'}`,
    })),
  };
}
