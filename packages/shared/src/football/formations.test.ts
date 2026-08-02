import { describe, expect, it } from 'vitest';
import {
  defaultFormation,
  formationSpots,
  formationsFor,
  isValidFormation,
  parseFormation,
} from './formations';

describe('parseFormation', () => {
  it('reads the outfield lines, keeper excluded', () => {
    expect(parseFormation('4-4-2')).toEqual([4, 4, 2]);
    expect(parseFormation('4-2-3-1')).toEqual([4, 2, 3, 1]);
  });

  it('ignores junk rather than producing a zero-width line', () => {
    expect(parseFormation('4-x-2')).toEqual([4, 2]);
  });
});

describe('isValidFormation', () => {
  it('accepts a shape that adds up with the goalkeeper', () => {
    expect(isValidFormation('4-4-2', 11)).toBe(true);
    expect(isValidFormation('4-2-3-1', 11)).toBe(true);
    expect(isValidFormation('2-3-1', 7)).toBe(true);
  });

  it('rejects a shape that does not', () => {
    expect(isValidFormation('4-4-2', 7)).toBe(false);
    expect(isValidFormation('4-4-4', 11)).toBe(false);
  });

  it('rejects a single line, which leaves nobody in defence or attack', () => {
    expect(isValidFormation('10', 11)).toBe(false);
  });
});

describe('formationSpots', () => {
  it('places exactly one shirt per squad place', () => {
    const spots = formationSpots('4-4-2', 11);
    expect(spots).toHaveLength(11);
    expect(new Set(spots.map((spot) => spot.slot)).size).toBe(11);
  });

  it('puts the goalkeeper in slot 0, alone and deepest', () => {
    const spots = formationSpots('4-3-3', 11);
    expect(spots[0]).toMatchObject({ slot: 0, line: 'GK', y: 0.5 });
    expect(spots.every((spot) => spot.slot === 0 || spot.x > spots[0]!.x)).toBe(true);
  });

  it('keeps every shirt inside the half it belongs to', () => {
    for (const spot of formationSpots('3-5-2', 11)) {
      expect(spot.x).toBeGreaterThan(0);
      expect(spot.x).toBeLessThan(1);
      expect(spot.y).toBeGreaterThan(0);
      expect(spot.y).toBeLessThan(1);
    }
  });

  it('runs the lines back to front', () => {
    const spots = formationSpots('4-4-2', 11);
    const depth = (line: string) =>
      Math.min(...spots.filter((spot) => spot.line === line).map((spot) => spot.x));

    expect(depth('DEF')).toBeLessThan(depth('MID'));
    expect(depth('MID')).toBeLessThan(depth('FWD'));
  });

  it('centres a line of one instead of pinning it to a touchline', () => {
    const lone = formationSpots('4-2-3-1', 11).filter((spot) => spot.line === 'FWD');
    expect(lone).toHaveLength(1);
    expect(lone[0]!.y).toBe(0.5);
  });
});

describe('defaultFormation', () => {
  it('offers a listed shape for a listed squad size', () => {
    for (const size of [5, 6, 7, 8, 9, 10, 11]) {
      const formation = defaultFormation(size);
      expect(formationsFor(size)).toContain(formation);
      expect(isValidFormation(formation, size)).toBe(true);
    }
  });
});
