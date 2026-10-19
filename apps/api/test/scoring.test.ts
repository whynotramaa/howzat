import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BallRequestInput } from '@howzat/shared';
const mocks = vi.hoisted(() => ({
  prisma: {
    match: { findUnique: vi.fn() },
    innings: { findFirst: vi.fn() },
    ballEvent: { findUnique: vi.fn(), create: vi.fn() },
  },
  context: vi.fn(),
  events: vi.fn(),
  write: vi.fn(),
}));
vi.mock('../src/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('../src/lib/lock', () => ({
  matchLockKey: (id: string) => id,
  withLock: async (_key: string, fn: () => unknown) => fn(),
}));
vi.mock('../src/lib/logger', () => ({ logger: { debug: vi.fn() } }));
vi.mock('../src/realtime/bus', () => ({ publishMatchEvent: vi.fn() }));
vi.mock('../src/modules/matches/lifecycle', () => ({ closeInnings: vi.fn() }));
vi.mock('../src/modules/dls/service', () => ({ dlsSnapshotFor: async () => null }));
vi.mock('../src/modules/snapshot', () => ({
  loadInningsContext: mocks.context,
  loadEvents: mocks.events,
  writeSnapshot: mocks.write,
  buildSnapshot: () => ({ lastEventSeq: 1 }),
  toBallEvent: (row: unknown) => row,
}));
import { recordBall, correctBall, undoLastBall } from '../src/modules/scoring/service';
const input: BallRequestInput = {
  clientEventId: 'request',
  strikerId: 'a',
  nonStrikerId: 'b',
  bowlerId: 'c',
  runsOffBat: 1,
  extraRuns: 0,
  extraType: null,
  isWicket: false,
  wicketType: null,
  dismissedPlayerId: null,
  fielderId: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.prisma.match.findUnique.mockResolvedValue({ id: 'm', status: 'COMPLETED', revision: 1 });
  mocks.context.mockResolvedValue({
    inningsId: 'i',
    matchId: 'm',
    number: 2,
    battingXI: [],
    bowlingXI: [],
    oversQuota: 20,
    targetRuns: 100,
  });
  mocks.events.mockResolvedValue([]);
});
describe('scoring write boundaries', () => {
  it('acknowledges a final-ball retry before requiring a live innings', async () => {
    mocks.prisma.ballEvent.findUnique.mockResolvedValue({
      ...input,
      id: 'saved',
      inningsId: 'i',
      matchId: 'm',
      eventType: 'BALL',
    });
    expect((await recordBall('m', input, 'u')).duplicate).toBe(true);
    expect(mocks.prisma.innings.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.ballEvent.create).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('rejects a reused ID with changed content', async () => {
    mocks.prisma.ballEvent.findUnique.mockResolvedValue({
      ...input,
      inningsId: 'i',
      matchId: 'm',
      eventType: 'BALL',
      runsOffBat: 6,
    });
    await expect(recordBall('m', input, 'u')).rejects.toMatchObject({ status: 409 });
  });
  it('rejects a reused ID from another match', async () => {
    mocks.prisma.ballEvent.findUnique.mockResolvedValue({
      ...input,
      inningsId: 'i',
      matchId: 'other',
      eventType: 'BALL',
    });
    await expect(recordBall('m', input, 'u')).rejects.toMatchObject({ status: 409 });
  });
  it('rejects a queued ball from another innings', async () => {
    mocks.prisma.match.findUnique.mockResolvedValue({ id: 'm', status: 'LIVE' });
    mocks.prisma.ballEvent.findUnique.mockResolvedValue(null);
    mocks.prisma.innings.findFirst.mockResolvedValue({ id: 'new' });
    await expect(recordBall('m', { ...input, inningsId: 'old' }, 'u')).rejects.toMatchObject({
      code: 'WRONG_INNINGS',
    });
    expect(mocks.prisma.ballEvent.create).not.toHaveBeenCalled();
  });
  it('does not permit a new correction to a completed match', async () => {
    mocks.prisma.ballEvent.findUnique.mockImplementation(async ({ where }) =>
      where.id ? { id: 'ball', matchId: 'm', inningsId: 'i', eventType: 'BALL' } : null,
    );
    mocks.prisma.innings.findFirst.mockResolvedValue({ id: 'i' });
    await expect(correctBall('m', 'ball', input, 'u')).rejects.toMatchObject({
      code: 'MATCH_CLOSED',
    });
    expect(mocks.prisma.ballEvent.create).not.toHaveBeenCalled();
  });
  it('acknowledges an undo retry even when the target has disappeared', async () => {
    mocks.prisma.ballEvent.findUnique.mockResolvedValue({
      id: 'undo',
      matchId: 'm',
      inningsId: 'i',
      eventType: 'UNDO',
      supersedesEventId: 'ball',
    });
    expect((await undoLastBall('m', 'request', 'ball', 'u')).duplicate).toBe(true);
    expect(mocks.prisma.ballEvent.create).not.toHaveBeenCalled();
  });
});
