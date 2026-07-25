import {
  MIN_TEAMS_FOR_PLAYOFFS,
  PLAYOFF_BRACKET,
  generateRoundRobin,
  type FixturePreviewDto,
  type MatchTeamRef,
} from '@howzat/shared';
import type { Prisma, Team, Tournament } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { unprocessable } from '../../lib/errors';
import { generateSlugs } from '../../lib/slug';
import { assertTournamentTeamsEligible } from '../teams/eligibility';

/**
 * Fixture generation, Phase 3. The scheduling itself is pure and lives in
 * @howzat/shared; this module is the part that talks to the database —
 * eligibility gating, the regeneration guard, and the write.
 */

export function toTeamRef(team: Team): MatchTeamRef {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    primaryColor: team.primaryColor,
  };
}

/**
 * Every team must be registered and hold exactly eleven players before any
 * fixture exists. Checked here so the failure names all the offending teams at
 * once rather than one per attempt.
 */
async function assertReadyForFixtures(tournament: Tournament): Promise<Team[]> {
  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: 'asc' },
  });

  if (teams.length !== tournament.teamsCount) {
    throw unprocessable(
      'TEAM_COUNT_MISMATCH',
      `This tournament is set up for ${tournament.teamsCount} teams but ${teams.length} are registered`,
      { registered: teams.length, expected: tournament.teamsCount },
    );
  }

  if (teams.length < 2) {
    throw unprocessable('TOO_FEW_TEAMS', 'At least two teams are needed to make a fixture');
  }

  if (tournament.format === 'LEAGUE_PLAYOFFS' && teams.length < MIN_TEAMS_FOR_PLAYOFFS) {
    throw unprocessable(
      'TOO_FEW_FOR_PLAYOFFS',
      `Playoffs need at least ${MIN_TEAMS_FOR_PLAYOFFS} teams`,
    );
  }

  await assertTournamentTeamsEligible(tournament.id);

  return teams;
}

/** What generation *would* produce — no writes, so the UI can show it first. */
export async function previewFixtures(tournament: Tournament): Promise<FixturePreviewDto> {
  const teams = await assertReadyForFixtures(tournament);
  const byId = new Map(teams.map((team) => [team.id, team]));

  const rounds = generateRoundRobin(
    teams.map((team) => team.id),
    { double: tournament.doubleRoundRobin },
  );

  const leagueRounds = rounds.map((round) => ({
    round: round.round,
    matches: round.matches.map((match) => ({
      home: toTeamRef(byId.get(match.homeTeamId)!),
      away: toTeamRef(byId.get(match.awayTeamId)!),
    })),
  }));

  const playoffs =
    tournament.format === 'LEAGUE_PLAYOFFS'
      ? PLAYOFF_BRACKET.map((slot) => ({
          stage: slot.stage,
          label: slot.label,
          description: describeSlot(slot),
        }))
      : [];

  return {
    rounds: leagueRounds,
    playoffs,
    totalMatches: leagueRounds.reduce((sum, round) => sum + round.matches.length, 0) +
      playoffs.length,
  };
}

function describeSlot(slot: (typeof PLAYOFF_BRACKET)[number]): string {
  const describe = (source: (typeof slot)['home']) => {
    switch (source.kind) {
      case 'SEED':
        return `#${source.position} in the league`;
      case 'WINNER':
        return `Winner of ${source.stage}`;
      case 'LOSER':
        return `Loser of ${source.stage}`;
    }
  };

  return `${describe(slot.home)} v ${describe(slot.away)}`;
}

/**
 * Writes the schedule. Destructive when regenerating, and therefore guarded:
 * if any match has moved past SCHEDULED there is scoring data hanging off it,
 * and silently deleting that would be indefensible.
 */
export async function generateFixtures(
  tournament: Tournament,
  options: { regenerate: boolean },
): Promise<number> {
  const teams = await assertReadyForFixtures(tournament);

  const existing = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    select: { id: true, status: true },
  });

  if (existing.length > 0) {
    if (!options.regenerate) {
      throw unprocessable(
        'FIXTURES_EXIST',
        'Fixtures already exist. Pass regenerate to replace them.',
        { existing: existing.length },
      );
    }

    const started = existing.filter((match) => match.status !== 'SCHEDULED');

    if (started.length > 0) {
      throw unprocessable(
        'MATCHES_STARTED',
        `${started.length} match(es) have already started — fixtures can no longer be regenerated`,
        { started: started.length },
      );
    }
  }

  const rounds = generateRoundRobin(
    teams.map((team) => team.id),
    { double: tournament.doubleRoundRobin },
  );

  const leagueMatches = rounds.flatMap((round) =>
    round.matches.map((match) => ({
      round: round.round,
      stage: 'LEAGUE' as const,
      team1Id: match.homeTeamId,
      team2Id: match.awayTeamId,
    })),
  );

  // Bracket slots are created with null teams and filled as feeders finish.
  const playoffRound = rounds.length + 1;
  const playoffMatches =
    tournament.format === 'LEAGUE_PLAYOFFS'
      ? PLAYOFF_BRACKET.map((slot) => ({
          round: playoffRound,
          stage: slot.stage,
          team1Id: null,
          team2Id: null,
        }))
      : [];

  const all = [...leagueMatches, ...playoffMatches];
  const slugs = generateSlugs(all.length);

  const data: Prisma.MatchCreateManyInput[] = all.map((match, index) => ({
    tournamentId: tournament.id,
    round: match.round,
    stage: match.stage,
    team1Id: match.team1Id,
    team2Id: match.team2Id,
    oversPerInnings: tournament.oversPerInnings,
    publicSlug: slugs[index]!,
  }));

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { tournamentId: tournament.id } }),
    prisma.match.createMany({ data }),
    prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: 'FIXTURES_GENERATED' },
    }),
  ]);

  return data.length;
}
