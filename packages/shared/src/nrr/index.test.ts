import { describe, expect, it } from 'vitest';
import { aggregateStandings, chargeableBalls, netRunRate, sortStandings } from './index';
import type { MatchResult } from './index';

function match(partial: Partial<MatchResult> & Pick<MatchResult, 'teamIds'>): MatchResult {
  return {
    matchId: 'm',
    innings: [],
    winnerTeamId: null,
    noResult: false,
    ...partial,
  };
}

describe('chargeableBalls — the bowled-out rule', () => {
  it('charges the FULL quota when a side is all out early', () => {
    const balls = chargeableBalls({
      battingTeamId: 'a',
      bowlingTeamId: 'b',
      runs: 120,
      legalBalls: 86,
      oversQuota: 20,
      endReason: 'ALL_OUT',
    });

    expect(balls).toBe(120);
  });

  it('charges only the balls faced when a chase succeeds', () => {
    const balls = chargeableBalls({
      battingTeamId: 'a',
      bowlingTeamId: 'b',
      runs: 121,
      legalBalls: 86,
      oversQuota: 20,
      endReason: 'TARGET_CHASED',
    });

    expect(balls).toBe(86);
  });

  it('charges the balls faced when the overs simply run out', () => {
    const balls = chargeableBalls({
      battingTeamId: 'a',
      bowlingTeamId: 'b',
      runs: 180,
      legalBalls: 120,
      oversQuota: 20,
      endReason: 'OVERS_COMPLETE',
    });

    expect(balls).toBe(120);
  });
});

describe('netRunRate', () => {
  it('treats six balls as one over, not 1.5', () => {
    expect(
      netRunRate({ runsScored: 180, ballsFaced: 120, runsConceded: 120, ballsBowled: 120 }),
    ).toBe(3);
  });

  it('uses the true fraction for a part over', () => {
    const nrr = netRunRate({ runsScored: 100, ballsFaced: 98, runsConceded: 0, ballsBowled: 0 });
    expect(nrr).toBeCloseTo(6.122, 3);
  });

  it('is zero when nothing has been played', () => {
    expect(netRunRate({ runsScored: 0, ballsFaced: 0, runsConceded: 0, ballsBowled: 0 })).toBe(0);
  });
});

describe('aggregateStandings', () => {
  it('applies the quota rule end to end — the scenario from the plan', () => {
    const rows = aggregateStandings(
      ['a', 'b'],
      [
        match({
          teamIds: ['a', 'b'],
          winnerTeamId: 'a',
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 180,
              legalBalls: 120,
              oversQuota: 20,
              endReason: 'OVERS_COMPLETE',
            },
            {
              battingTeamId: 'b',
              bowlingTeamId: 'a',
              runs: 150,
              legalBalls: 86,
              oversQuota: 20,
              endReason: 'ALL_OUT',
            },
          ],
        }),
      ],
    );

    const a = rows.find((row) => row.teamId === 'a')!;
    const b = rows.find((row) => row.teamId === 'b')!;

    expect(b.ballsFaced).toBe(120);
    expect(a.ballsBowled).toBe(120);

    expect(a.nrr).toBe(1.5);
    expect(b.nrr).toBe(-1.5);

    expect(a.points).toBe(2);
    expect(b.points).toBe(0);
  });

  it('would produce a different (wrong) NRR without the rule — regression guard', () => {
    const withRule = netRunRate({
      runsScored: 150,
      ballsFaced: 120,
      runsConceded: 180,
      ballsBowled: 120,
    });
    const withoutRule = netRunRate({
      runsScored: 150,
      ballsFaced: 86,
      runsConceded: 180,
      ballsBowled: 120,
    });

    expect(withRule).toBe(-1.5);
    expect(withoutRule).toBeGreaterThan(withRule);
  });

  it('gives a tie one point each and no winner', () => {
    const rows = aggregateStandings(
      ['a', 'b'],
      [match({ teamIds: ['a', 'b'], winnerTeamId: null })],
    );

    expect(rows.every((row) => row.points === 1 && row.tied === 1)).toBe(true);
  });

  it('gives a no-result one point each and excludes it from NRR', () => {
    const rows = aggregateStandings(
      ['a', 'b'],
      [
        match({
          teamIds: ['a', 'b'],
          noResult: true,
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 60,
              legalBalls: 30,
              oversQuota: 20,
              endReason: null,
            },
          ],
        }),
      ],
    );

    const a = rows.find((row) => row.teamId === 'a')!;
    expect(a.points).toBe(1);
    expect(a.noResult).toBe(1);
    expect(a.runsScored).toBe(0);
    expect(a.ballsFaced).toBe(0);
    expect(a.nrr).toBe(0);
  });

  it('aggregates across matches rather than averaging per match', () => {
    const rows = aggregateStandings(
      ['a', 'b'],
      [
        match({
          teamIds: ['a', 'b'],
          winnerTeamId: 'a',
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 200,
              legalBalls: 120,
              oversQuota: 20,
              endReason: 'OVERS_COMPLETE',
            },
            {
              battingTeamId: 'b',
              bowlingTeamId: 'a',
              runs: 100,
              legalBalls: 120,
              oversQuota: 20,
              endReason: 'OVERS_COMPLETE',
            },
          ],
        }),
        match({
          teamIds: ['a', 'b'],
          winnerTeamId: 'b',
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 100,
              legalBalls: 120,
              oversQuota: 20,
              endReason: 'OVERS_COMPLETE',
            },
            {
              battingTeamId: 'b',
              bowlingTeamId: 'a',
              runs: 101,
              legalBalls: 60,
              oversQuota: 20,
              endReason: 'TARGET_CHASED',
            },
          ],
        }),
      ],
    );

    const a = rows.find((row) => row.teamId === 'a')!;

    expect(a.played).toBe(2);
    expect(a.won).toBe(1);
    expect(a.lost).toBe(1);
    expect(a.points).toBe(2);
    expect(a.runsScored).toBe(300);
    expect(a.ballsFaced).toBe(240);
    expect(a.runsConceded).toBe(201);
    expect(a.ballsBowled).toBe(180);
    expect(a.nrr).toBeCloseTo(0.8, 3);
  });
});

describe('sortStandings', () => {
  it('orders by points, then NRR', () => {
    const rows = aggregateStandings(
      ['a', 'b', 'c'],
      [
        match({
          teamIds: ['a', 'b'],
          winnerTeamId: 'a',
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 200,
              legalBalls: 120,
              oversQuota: 20,
              endReason: 'OVERS_COMPLETE',
            },
            {
              battingTeamId: 'b',
              bowlingTeamId: 'a',
              runs: 100,
              legalBalls: 120,
              oversQuota: 20,
              endReason: 'OVERS_COMPLETE',
            },
          ],
        }),
        match({
          teamIds: ['c', 'b'],
          winnerTeamId: 'c',
          innings: [
            {
              battingTeamId: 'c',
              bowlingTeamId: 'b',
              runs: 150,
              legalBalls: 120,
              oversQuota: 20,
              endReason: 'OVERS_COMPLETE',
            },
            {
              battingTeamId: 'b',
              bowlingTeamId: 'c',
              runs: 140,
              legalBalls: 120,
              oversQuota: 20,
              endReason: 'OVERS_COMPLETE',
            },
          ],
        }),
      ],
    );

    const order = sortStandings(rows, []).map((row) => row.teamId);

    expect(order).toEqual(['a', 'c', 'b']);
  });

  it('breaks a two-way tie on head-to-head', () => {
    const matches = [match({ teamIds: ['a', 'b'], winnerTeamId: 'b' })];

    const rows = [
      {
        teamId: 'a',
        played: 1,
        won: 1,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 2,
        runsScored: 0,
        ballsFaced: 0,
        runsConceded: 0,
        ballsBowled: 0,
        nrr: 0,
      },
      {
        teamId: 'b',
        played: 1,
        won: 1,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 2,
        runsScored: 0,
        ballsFaced: 0,
        runsConceded: 0,
        ballsBowled: 0,
        nrr: 0,
      },
    ];

    expect(sortStandings(rows, matches).map((row) => row.teamId)).toEqual(['b', 'a']);
  });
});
