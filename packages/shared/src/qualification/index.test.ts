import { expect, it } from 'vitest';
import { qualificationScenarios } from './index';
it.each([NaN, Infinity, 1000, -1, 2.5])('keeps a hard computation limit for %s', (limit) => {
  const result = qualificationScenarios({
    teams: [
      { teamId: 'a', points: 0, nrr: 0, remainingMatches: 9 },
      { teamId: 'b', points: 0, nrr: 0, remainingMatches: 9 },
    ],
    remainingFixtures: Array.from({ length: 9 }, (_, i) => ({
      fixtureId: String(i),
      homeTeamId: 'a',
      awayTeamId: 'b',
    })),
    targetTeamId: 'a',
    qualificationSpots: 1,
    maxRelevantFixtures: limit,
  });
  expect(result.tooComplex).toBe(true);
  expect(result.scenarios).toEqual([]);
});
