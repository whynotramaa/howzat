export interface QualificationTeam {
  teamId: string;
  points: number;
  nrr: number;
  remainingMatches: number;
}

export interface QualificationFixture {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
}

export interface QualificationScenario {
  outcomes: Record<string, string>;
  qualified: boolean;
  rank: number;
  requiresNrr: boolean;
}

export interface QualificationResult {
  targetTeamId: string;
  qualificationSpots: number;
  relevantFixtureCount: number;
  tooComplex: boolean;
  scenarios: QualificationScenario[];
}

export interface QualificationInput {
  teams: QualificationTeam[];
  remainingFixtures: QualificationFixture[];
  targetTeamId: string;
  qualificationSpots: number;
  maxRelevantFixtures?: number;
}

const DEFAULT_MAX_RELEVANT_FIXTURES = 8;

export function qualificationScenarios(input: QualificationInput): QualificationResult {
  const maxRelevantFixtures = input.maxRelevantFixtures ?? DEFAULT_MAX_RELEVANT_FIXTURES;
  const target = input.teams.find((team) => team.teamId === input.targetTeamId);

  if (!target) {
    return {
      targetTeamId: input.targetTeamId,
      qualificationSpots: input.qualificationSpots,
      relevantFixtureCount: 0,
      tooComplex: false,
      scenarios: [],
    };
  }

  const contenders = new Set(
    input.teams
      .filter(
        (team) =>
          team.teamId === target.teamId || team.points + team.remainingMatches * 2 >= target.points,
      )
      .map((team) => team.teamId),
  );

  const relevant = input.remainingFixtures.filter(
    (fixture) => contenders.has(fixture.homeTeamId) && contenders.has(fixture.awayTeamId),
  );

  if (relevant.length > maxRelevantFixtures) {
    return {
      targetTeamId: input.targetTeamId,
      qualificationSpots: input.qualificationSpots,
      relevantFixtureCount: relevant.length,
      tooComplex: true,
      scenarios: [],
    };
  }

  const scenarios: QualificationScenario[] = [];
  const combinations = 2 ** relevant.length;

  for (let mask = 0; mask < combinations; mask += 1) {
    const points = new Map(input.teams.map((team) => [team.teamId, team.points]));
    const outcomes: Record<string, string> = {};

    relevant.forEach((fixture, index) => {
      const winnerId = (mask & (1 << index)) === 0 ? fixture.homeTeamId : fixture.awayTeamId;
      outcomes[fixture.fixtureId] = winnerId;
      points.set(winnerId, (points.get(winnerId) ?? 0) + 2);
    });

    const ordered = input.teams
      .map((team) => ({ ...team, points: points.get(team.teamId) ?? team.points }))
      .sort((a, b) => b.points - a.points || b.nrr - a.nrr || a.teamId.localeCompare(b.teamId));
    const rank = ordered.findIndex((team) => team.teamId === input.targetTeamId) + 1;
    const targetPoints = points.get(input.targetTeamId) ?? target.points;
    const tiedOnPoints = ordered.some(
      (team) => team.teamId !== input.targetTeamId && team.points === targetPoints,
    );

    scenarios.push({
      outcomes,
      qualified: rank > 0 && rank <= input.qualificationSpots,
      rank,
      requiresNrr: tiedOnPoints,
    });
  }

  return {
    targetTeamId: input.targetTeamId,
    qualificationSpots: input.qualificationSpots,
    relevantFixtureCount: relevant.length,
    tooComplex: false,
    scenarios,
  };
}
