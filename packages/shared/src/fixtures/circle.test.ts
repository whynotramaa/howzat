import { describe, expect, it } from 'vitest';
import { generateRoundRobin, roundRobinMatchCount } from './circle';

function pairKey(home: string, away: string): string {
  return [home, away].sort().join('-');
}

describe('generateRoundRobin', () => {
  it('gives n-1 rounds of n/2 matches for an even field', () => {
    const rounds = generateRoundRobin(['a', 'b', 'c', 'd']);

    expect(rounds).toHaveLength(3);
    for (const round of rounds) expect(round.matches).toHaveLength(2);
  });

  it('pairs every team with every other exactly once', () => {
    const teams = ['a', 'b', 'c', 'd', 'e', 'f'];
    const rounds = generateRoundRobin(teams);

    const seen = rounds.flatMap((round) =>
      round.matches.map((match) => pairKey(match.homeTeamId, match.awayTeamId)),
    );

    expect(seen).toHaveLength(roundRobinMatchCount(teams.length, false));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('gives an odd field a bye each round rather than a phantom fixture', () => {
    const teams = ['a', 'b', 'c', 'd', 'e'];
    const rounds = generateRoundRobin(teams);

    expect(rounds).toHaveLength(5);
    for (const round of rounds) expect(round.matches).toHaveLength(2);

    const seen = rounds.flatMap((round) =>
      round.matches.map((match) => pairKey(match.homeTeamId, match.awayTeamId)),
    );
    expect(new Set(seen).size).toBe(10);

    const ids = rounds.flatMap((round) =>
      round.matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]),
    );
    expect(ids.every((id) => teams.includes(id))).toBe(true);
  });

  it('no team appears twice in the same round', () => {
    const rounds = generateRoundRobin(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

    for (const round of rounds) {
      const ids = round.matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('doubles the schedule with home and away flipped', () => {
    const teams = ['a', 'b', 'c', 'd'];
    const single = generateRoundRobin(teams);
    const double = generateRoundRobin(teams, { double: true });

    expect(double).toHaveLength(single.length * 2);
    expect(double.map((round) => round.round)).toEqual([1, 2, 3, 4, 5, 6]);

    const counts = new Map<string, number>();
    for (const round of double) {
      for (const match of round.matches) {
        const key = pairKey(match.homeTeamId, match.awayTeamId);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    expect([...counts.values()].every((count) => count === 2)).toBe(true);

    const reverse = double[single.length]!;
    expect(reverse.matches[0]!.homeTeamId).toBe(single[0]!.matches[0]!.awayTeamId);
  });

  it('is deterministic — the same input always yields the same schedule', () => {
    const teams = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(generateRoundRobin(teams)).toEqual(generateRoundRobin(teams));
  });

  it('refuses duplicate ids and handles a field too small to play', () => {
    expect(() => generateRoundRobin(['a', 'a', 'b'])).toThrow(/duplicate/i);
    expect(generateRoundRobin(['a'])).toEqual([]);
    expect(generateRoundRobin([])).toEqual([]);
  });
});
