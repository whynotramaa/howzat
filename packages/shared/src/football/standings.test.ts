import { describe, expect, it } from 'vitest';
import {
  aggregateFootballStandings,
  formatGoalDifference,
  sortFootballStandings,
  type FootballMatchResult,
} from './standings';

const teams = ['a', 'b', 'c'];

function result(
  home: string,
  away: string,
  homeGoals: number,
  awayGoals: number,
  overrides: Partial<FootballMatchResult> = {},
): FootballMatchResult {
  return {
    matchId: `${home}-${away}`,
    teamIds: [home, away],
    goals: [homeGoals, awayGoals],
    winnerTeamId: homeGoals === awayGoals ? null : homeGoals > awayGoals ? home : away,
    noResult: false,
    ...overrides,
  };
}

describe('aggregateFootballStandings', () => {
  it('awards three for a win and one each for a draw', () => {
    const rows = aggregateFootballStandings(teams, [
      result('a', 'b', 2, 0),
      result('b', 'c', 1, 1),
    ]);

    const byId = Object.fromEntries(rows.map((row) => [row.teamId, row]));
    expect(byId.a!.points).toBe(3);
    expect(byId.b!.points).toBe(1);
    expect(byId.c!.points).toBe(1);
  });

  it('keeps goals for and against symmetric', () => {
    const rows = aggregateFootballStandings(teams, [result('a', 'b', 4, 1)]);
    const byId = Object.fromEntries(rows.map((row) => [row.teamId, row]));

    expect(byId.a!.goalsFor).toBe(4);
    expect(byId.a!.goalsAgainst).toBe(1);
    expect(byId.b!.goalsFor).toBe(1);
    expect(byId.b!.goalsAgainst).toBe(4);
    expect(byId.a!.goalDifference).toBe(3);
  });

  it('counts an abandoned match for nothing at all', () => {
    const rows = aggregateFootballStandings(teams, [
      result('a', 'b', 0, 0, { noResult: true, winnerTeamId: null }),
    ]);

    expect(rows.every((row) => row.played === 0 && row.points === 0)).toBe(true);
  });

  it('ignores a match involving a team outside the tournament', () => {
    const rows = aggregateFootballStandings(['a'], [result('a', 'stranger', 1, 0)]);
    expect(rows[0]!.played).toBe(0);
  });
});

describe('sortFootballStandings', () => {
  it('ranks on goal difference before goals scored', () => {
    const matches = [result('a', 'c', 1, 0), result('b', 'c', 4, 3)];
    const rows = aggregateFootballStandings(teams, matches);
    const sorted = sortFootballStandings(rows, matches);

    expect(sorted[0]!.teamId).toBe('b');
    expect(sorted[1]!.teamId).toBe('a');
  });

  it('breaks a two-way level pegging on head-to-head', () => {
    const matches = [result('a', 'b', 1, 0), result('b', 'a', 1, 0), result('a', 'b', 2, 1)];
    const rows = aggregateFootballStandings(['a', 'b'], matches);
    const sorted = sortFootballStandings(rows, matches);

    expect(sorted[0]!.teamId).toBe('a');
  });
});

describe('formatGoalDifference', () => {
  it('signs the number and uses a true minus', () => {
    expect(formatGoalDifference(3)).toBe('+3');
    expect(formatGoalDifference(0)).toBe('0');
    expect(formatGoalDifference(-2)).toBe('−2');
  });
});
