import { describe, expect, it } from 'vitest';
import { aggregateStandings, chargeableBalls, nrrInnings } from './index';
import type { InningsResult, MatchResult } from './index';

function innings(partial: Partial<InningsResult>): InningsResult {
  return {
    battingTeamId: 'a',
    bowlingTeamId: 'b',
    runs: 0,
    legalBalls: 0,
    oversQuota: 50,
    endReason: null,
    ...partial,
  };
}

describe('chargeableBalls with a DLS-revised allotment', () => {
  it('charges the revised allotment, not the whole-over rounding of it', () => {
    // 40.3 overs — 243 balls — which oversQuota can only say as 41.
    const balls = chargeableBalls(
      innings({ oversQuota: 41, ballsQuota: 243, legalBalls: 180, endReason: 'ALL_OUT' }),
    );

    expect(balls).toBe(243);
  });

  it('falls back to the overs where no stoppage touched the innings', () => {
    expect(chargeableBalls(innings({ oversQuota: 20, legalBalls: 86, endReason: 'ALL_OUT' }))).toBe(
      120,
    );
  });
});

describe('nrrInnings — the DLS substitution', () => {
  const decided: MatchResult = {
    matchId: 'm',
    teamIds: ['a', 'b'],
    winnerTeamId: 'b',
    noResult: false,
    dls: { parScore: 166 },
    innings: [
      innings({
        battingTeamId: 'a',
        bowlingTeamId: 'b',
        runs: 250,
        legalBalls: 300,
        oversQuota: 50,
        endReason: 'OVERS_COMPLETE',
      }),
      innings({
        battingTeamId: 'b',
        bowlingTeamId: 'a',
        runs: 170,
        legalBalls: 150,
        oversQuota: 25,
        ballsQuota: 150,
        endReason: 'TARGET_CHASED',
      }),
    ],
  };

  it('deems the side batting first to have scored par off the chase’s overs', () => {
    const [first, second] = nrrInnings(decided);

    expect(first?.runs).toBe(166);
    expect(first?.legalBalls).toBe(150);
    expect(second?.runs).toBe(170);
    expect(second?.legalBalls).toBe(150);
  });

  it('leaves an ordinary match completely alone', () => {
    const ordinary: MatchResult = { ...decided, dls: null };
    expect(nrrInnings(ordinary)).toBe(ordinary.innings);
  });

  it('gives both sides a comparable rate rather than punishing the shorter chase', () => {
    const [rowA, rowB] = aggregateStandings(['a', 'b'], [decided]);

    // 250 off 50 overs against 170 off 25 would read as a thrashing that never
    // happened; par off the same 25 overs is the honest comparison.
    expect(rowA?.runsScored).toBe(166);
    expect(rowA?.ballsFaced).toBe(150);
    expect(rowB?.runsScored).toBe(170);
    expect(rowB?.ballsBowled).toBe(150);
    expect(rowA?.nrr).toBe(-0.16);
    expect(rowB?.nrr).toBe(0.16);
  });
});
