import { describe, expect, it } from 'vitest';
import {
  computeDlsTarget,
  computeInningsResources,
  computeParPosition,
  defaultG50,
  minimumOversForResult,
  resourcePercentage,
  validateInterruptions,
} from './index';
import { DLS_RESOURCE_TABLE } from './table';
import type { DlsInterruption } from '../types/dls';

const overs = (value: number) => Math.round(value * 6);

function stoppage(partial: Partial<DlsInterruption> & { id: string }): DlsInterruption {
  return {
    inningsNumber: 1,
    ballsRemainingAtSuspension: 0,
    wicketsLost: 0,
    ballsRemainingOnResumption: 0,
    reason: null,
    createdAt: '2026-08-09T00:00:00.000Z',
    ...partial,
  };
}

describe('the published resource table', () => {
  it('holds 51 rows of 10 wicket columns', () => {
    expect(DLS_RESOURCE_TABLE).toHaveLength(51);
    for (const row of DLS_RESOURCE_TABLE) expect(row).toHaveLength(10);
  });

  it('never lets resource rise as overs run out or wickets fall', () => {
    for (let wickets = 0; wickets < 10; wickets += 1) {
      for (let over = 1; over <= 50; over += 1) {
        expect(DLS_RESOURCE_TABLE[over]![wickets]!).toBeGreaterThanOrEqual(
          DLS_RESOURCE_TABLE[over - 1]![wickets]!,
        );
      }
    }

    for (let over = 0; over <= 50; over += 1) {
      for (let wickets = 1; wickets < 10; wickets += 1) {
        expect(DLS_RESOURCE_TABLE[over]![wickets]!).toBeLessThanOrEqual(
          DLS_RESOURCE_TABLE[over]![wickets - 1]!,
        );
      }
    }
  });
});

describe('resourcePercentage', () => {
  it('reads whole overs straight off the table', () => {
    expect(resourcePercentage(overs(50), 0)).toBe(100);
    expect(resourcePercentage(overs(25), 0)).toBe(66.5);
    expect(resourcePercentage(overs(20), 0)).toBe(56.6);
    expect(resourcePercentage(overs(20), 2)).toBe(52.4);
    expect(resourcePercentage(overs(10), 5)).toBe(26.1);
  });

  it('interpolates between rows for a part-over', () => {
    // 30 overs left is 75.1, 31 is 76.7 — three balls in is halfway.
    expect(resourcePercentage(overs(30) + 3, 0)).toBe(75.9);
  });

  it('is spent once the overs or the wickets are gone', () => {
    expect(resourcePercentage(0, 0)).toBe(0);
    expect(resourcePercentage(overs(30), 10)).toBe(0);
    expect(resourcePercentage(-6, 0)).toBe(0);
  });

  it('caps at the 50-over row for a longer allotment', () => {
    expect(resourcePercentage(overs(60), 0)).toBe(100);
  });
});

describe('computeInningsResources', () => {
  it('gives an uninterrupted 50-over innings the full 100%', () => {
    const result = computeInningsResources({
      inningsNumber: 1,
      initialBalls: overs(50),
      interruptions: [],
    });

    expect(result.availableResource).toBe(100);
    expect(result.revisedBalls).toBe(overs(50));
  });

  it('prices a mid-innings stoppage at the resource it cost', () => {
    // 50 overs, rain after 20 overs with 2 down, 10 overs lost.
    const result = computeInningsResources({
      inningsNumber: 1,
      initialBalls: overs(50),
      interruptions: [
        stoppage({
          id: 'a',
          ballsRemainingAtSuspension: overs(30),
          wicketsLost: 2,
          ballsRemainingOnResumption: overs(20),
        }),
      ],
    });

    // R(30,2) = 67.3, R(20,2) = 52.4 — 14.9 lost.
    expect(result.lostResource).toBe(14.9);
    expect(result.availableResource).toBe(85.1);
    expect(result.revisedBalls).toBe(overs(40));
  });

  it('treats a delayed start as a stoppage before a ball is bowled', () => {
    const result = computeInningsResources({
      inningsNumber: 2,
      initialBalls: overs(50),
      interruptions: [
        stoppage({
          id: 'a',
          inningsNumber: 2,
          ballsRemainingAtSuspension: overs(50),
          wicketsLost: 0,
          ballsRemainingOnResumption: overs(25),
        }),
      ],
    });

    expect(result.availableResource).toBe(66.5);
    expect(result.revisedBalls).toBe(overs(25));
  });

  it('compounds several stoppages against the allotment left at the time', () => {
    const result = computeInningsResources({
      inningsNumber: 1,
      initialBalls: overs(50),
      interruptions: [
        stoppage({
          id: 'a',
          ballsRemainingAtSuspension: overs(40),
          wicketsLost: 1,
          ballsRemainingOnResumption: overs(30),
        }),
        stoppage({
          id: 'b',
          ballsRemainingAtSuspension: overs(15),
          wicketsLost: 4,
          ballsRemainingOnResumption: overs(10),
        }),
      ],
    });

    // First: R(40,1) 84.2 − R(30,1) 71.8 = 12.4, allotment now 40 overs.
    // Second: 25 bowled, R(15,4) 37.6 − R(10,4) 28.3 = 9.3, allotment now 35.
    expect(result.lostResource).toBe(21.7);
    expect(result.availableResource).toBe(78.3);
    expect(result.revisedBalls).toBe(overs(35));
  });

  it('charges the whole remainder when an innings is called off for good', () => {
    const result = computeInningsResources({
      inningsNumber: 2,
      initialBalls: overs(50),
      interruptions: [
        stoppage({
          id: 'a',
          inningsNumber: 2,
          ballsRemainingAtSuspension: overs(20),
          wicketsLost: 5,
          ballsRemainingOnResumption: 0,
        }),
      ],
    });

    // R(20,5) = 38.6 is simply lost.
    expect(result.availableResource).toBe(61.4);
    expect(result.revisedBalls).toBe(overs(30));
  });
});

describe('computeDlsTarget', () => {
  it('scales the target down when the chase has less resource', () => {
    // 250 off 50 overs; the chase is cut to 25 overs before it starts.
    const result = computeDlsTarget({
      team1Score: 250,
      team1Resource: 100,
      team2Resource: 66.5,
      g50: 245,
    });

    expect(result.method).toBe('RATIO');
    expect(result.rawPar).toBe(166.25);
    expect(result.parScore).toBe(166);
    expect(result.target).toBe(167);
  });

  it('adds runs at the G50 rate when the chase has more resource', () => {
    // Team 1 lost overs, team 2 did not: 100 − 80 = 20 points of extra resource.
    const result = computeDlsTarget({
      team1Score: 200,
      team1Resource: 80,
      team2Resource: 100,
      g50: 245,
    });

    expect(result.method).toBe('G50');
    expect(result.rawPar).toBe(249);
    expect(result.target).toBe(250);
  });

  it('asks for one more run than team 1 made when resources are equal', () => {
    const result = computeDlsTarget({
      team1Score: 187,
      team1Resource: 100,
      team2Resource: 100,
      g50: 245,
    });

    expect(result.parScore).toBe(187);
    expect(result.target).toBe(188);
  });

  it('floors the par score rather than rounding it', () => {
    const result = computeDlsTarget({
      team1Score: 300,
      team1Resource: 100,
      team2Resource: 66.6,
      g50: 245,
    });

    expect(result.rawPar).toBe(199.8);
    expect(result.parScore).toBe(199);
    expect(result.target).toBe(200);
  });
});

describe('computeParPosition', () => {
  const chase = {
    team1Score: 250,
    team1Resource: 100,
    team2Resource: 100,
    g50: 245,
  };

  it('prices par off the resource the chase has already spent', () => {
    // 25 overs gone, 3 down: used 100 − R(25,3) 56.0 = 44.0.
    const position = computeParPosition({
      ...chase,
      runsScored: 120,
      ballsRemaining: overs(25),
      wicketsLost: 3,
    });

    expect(position.resourceUsed).toBe(44);
    expect(position.parScore).toBe(110);
    expect(position.difference).toBe(10);
  });

  it('lands on the target minus one once the innings is over', () => {
    const target = computeDlsTarget({ ...chase, team2Resource: 66.5 });

    const position = computeParPosition({
      ...chase,
      team2Resource: 66.5,
      runsScored: 160,
      ballsRemaining: 0,
      wicketsLost: 4,
    });

    expect(position.parScore).toBe(target.parScore);
    expect(position.difference).toBe(160 - target.parScore);
  });

  it('spends every last point of resource when the side is bowled out', () => {
    const position = computeParPosition({
      ...chase,
      runsScored: 200,
      ballsRemaining: overs(12),
      wicketsLost: 10,
    });

    expect(position.resourceUsed).toBe(100);
    expect(position.parScore).toBe(250);
  });
});

describe('validateInterruptions', () => {
  const base = { inningsNumber: 1, initialBalls: overs(20) };

  it('accepts a plausible stoppage', () => {
    const verdict = validateInterruptions({
      ...base,
      interruptions: [
        stoppage({
          id: 'a',
          ballsRemainingAtSuspension: overs(12),
          wicketsLost: 2,
          ballsRemainingOnResumption: overs(8),
        }),
      ],
    });

    expect(verdict.ok).toBe(true);
  });

  it('rejects more overs left than the innings had', () => {
    const verdict = validateInterruptions({
      ...base,
      interruptions: [
        stoppage({ id: 'a', ballsRemainingAtSuspension: overs(38), wicketsLost: 0 }),
      ],
    });

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.issues[0]?.code).toBe('DLS_SUSPENSION_TOO_LONG');
  });

  it('rejects resuming with more overs than were left', () => {
    const verdict = validateInterruptions({
      ...base,
      interruptions: [
        stoppage({
          id: 'a',
          ballsRemainingAtSuspension: overs(8),
          ballsRemainingOnResumption: overs(12),
        }),
      ],
    });

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.issues[0]?.code).toBe('DLS_RESUMPTION_TOO_LONG');
  });

  it('rejects stoppages recorded out of order', () => {
    const verdict = validateInterruptions({
      ...base,
      interruptions: [
        stoppage({
          id: 'a',
          ballsRemainingAtSuspension: overs(8),
          ballsRemainingOnResumption: overs(6),
        }),
        stoppage({
          id: 'b',
          ballsRemainingAtSuspension: overs(10),
          ballsRemainingOnResumption: overs(9),
        }),
      ],
    });

    // The first stoppage put the innings 12 overs in; the second claims it was
    // only 8 overs in, which is time running backwards.
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.issues[0]?.code).toBe('DLS_OUT_OF_ORDER');
  });
});

describe('competition settings', () => {
  it('uses the published G50 at each end of the range', () => {
    expect(defaultG50(50)).toBe(245);
    expect(defaultG50(20)).toBe(200);
  });

  it('interpolates G50 for club-length innings', () => {
    expect(defaultG50(35)).toBe(223);
  });

  it('carries the ICC minimum overs for a result', () => {
    expect(minimumOversForResult(50)).toBe(20);
    expect(minimumOversForResult(20)).toBe(5);
    expect(minimumOversForResult(10)).toBe(5);
  });
});
