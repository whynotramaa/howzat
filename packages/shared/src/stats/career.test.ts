import { describe, expect, it } from 'vitest';
import { aggregateCareer, type CareerInput } from './career';

function row(partial: Partial<CareerInput> = {}): CareerInput {
  return {
    batted: false,
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
    bowled: false,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    catches: 0,
    runOuts: 0,
    stumpings: 0,
    ...partial,
  };
}

describe('aggregateCareer — batting', () => {
  it('divides runs by dismissals, not by innings', () => {
    const career = aggregateCareer([
      row({ batted: true, runs: 50, ballsFaced: 40, isOut: true }),
      row({ batted: true, runs: 30, ballsFaced: 20, isOut: false }),
    ]);

    expect(career.batting.average).toBe(80);
    expect(career.batting.notOuts).toBe(1);
  });

  it('reports no average at all when never dismissed', () => {
    const career = aggregateCareer([row({ batted: true, runs: 12, isOut: false })]);

    expect(career.batting.average).toBeNull();
  });

  it('does not count a hundred as a fifty as well', () => {
    const career = aggregateCareer([
      row({ batted: true, runs: 104, isOut: true }),
      row({ batted: true, runs: 61, isOut: true }),
    ]);

    expect(career.batting.hundreds).toBe(1);
    expect(career.batting.fifties).toBe(1);
  });

  it('counts 0 out as a duck but 0 not out as neither', () => {
    const career = aggregateCareer([
      row({ batted: true, runs: 0, isOut: true }),
      row({ batted: true, runs: 0, isOut: false }),
    ]);

    expect(career.batting.ducks).toBe(1);
  });

  it('prefers the unbeaten innings when the high score ties', () => {
    const career = aggregateCareer([
      row({ batted: true, runs: 84, isOut: true }),
      row({ batted: true, runs: 84, isOut: false }),
    ]);

    expect(career.batting.highScore).toBe(84);
    expect(career.batting.highScoreNotOut).toBe(true);
  });

  it('ignores matches where the player never batted', () => {
    const career = aggregateCareer([
      row({ batted: true, runs: 20, ballsFaced: 15, isOut: true }),
      row({ bowled: true, ballsBowled: 24, runsConceded: 30, wickets: 2 }),
    ]);

    expect(career.matches).toBe(2);
    expect(career.batting.innings).toBe(1);
  });
});

describe('aggregateCareer — bowling', () => {
  it('picks best figures by wickets, breaking ties on runs conceded', () => {
    const career = aggregateCareer([
      row({ bowled: true, ballsBowled: 24, runsConceded: 41, wickets: 4 }),
      row({ bowled: true, ballsBowled: 24, runsConceded: 23, wickets: 4 }),
      row({ bowled: true, ballsBowled: 24, runsConceded: 12, wickets: 3 }),
    ]);

    expect(career.bowling.bestFigures).toBe('4/23');
    expect(career.bowling.wickets).toBe(11);
  });

  it('computes economy over true overs, not the base-6 display form', () => {
    const career = aggregateCareer([
      row({ bowled: true, ballsBowled: 27, runsConceded: 36, wickets: 1 }),
    ]);

    expect(career.bowling.oversBowled).toBe('4.3');
    expect(career.bowling.economy).toBe(8);
  });

  it('leaves bowling averages null until a wicket falls', () => {
    const career = aggregateCareer([
      row({ bowled: true, ballsBowled: 24, runsConceded: 30, wickets: 0 }),
    ]);

    expect(career.bowling.average).toBeNull();
    expect(career.bowling.strikeRate).toBeNull();
    expect(career.bowling.economy).toBe(7.5);
  });

  it('counts a five-for', () => {
    const career = aggregateCareer([
      row({ bowled: true, ballsBowled: 24, runsConceded: 19, wickets: 5 }),
    ]);

    expect(career.bowling.fiveWicketHauls).toBe(1);
  });
});

describe('aggregateCareer — fielding and empty input', () => {
  it('sums dismissals across all three kinds', () => {
    const career = aggregateCareer([
      row({ catches: 2, runOuts: 1 }),
      row({ catches: 1, stumpings: 2 }),
    ]);

    expect(career.fielding.dismissals).toBe(6);
  });

  it('returns a zeroed career for a user who has never played', () => {
    const career = aggregateCareer([]);

    expect(career.matches).toBe(0);
    expect(career.batting.average).toBeNull();
    expect(career.bowling.bestFigures).toBeNull();
    expect(career.bowling.oversBowled).toBe('0.0');
  });
});
