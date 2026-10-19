import { describe, expect, it } from 'vitest';
import { isNewerSnapshot, isNewerFootballSnapshot } from './events';
import type { MatchSnapshot } from '../types/scoring';
import type { FootballSnapshot } from '../types/football';
const snapshot = (inningsNumber: number, lastEventSeq: number, revision?: number) =>
  ({
    matchId: 'm',
    inningsNumber,
    lastEventSeq,
    revision,
    updatedAt: '2026-10-19T00:00:00Z',
  }) as MatchSnapshot;
describe('snapshot ordering', () => {
  it('accepts the first ball of a chase', () =>
    expect(isNewerSnapshot(snapshot(1, 120), snapshot(2, 1))).toBe(true));
  it('rejects an older match revision even when its sequence is higher', () =>
    expect(isNewerSnapshot(snapshot(2, 1, 12), snapshot(1, 120, 11))).toBe(false));
  it('accepts a status change with no new ball', () =>
    expect(isNewerSnapshot(snapshot(1, 20, 10), snapshot(1, 20, 11))).toBe(true));
  it('orders football clock changes by revision', () =>
    expect(
      isNewerFootballSnapshot(
        snapshot(0, 3, 4) as unknown as FootballSnapshot,
        snapshot(0, 3, 5) as unknown as FootballSnapshot,
      ),
    ).toBe(true));
});
