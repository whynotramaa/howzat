import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { BallRequestInput } from '@howzat/shared';

const input = (id: string): BallRequestInput => ({
  clientEventId: id,
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
});
const owner = { userId: 'u', inningsId: 'i' };
async function queue() {
  return import('../src/lib/offlineBallQueue');
}
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('BroadcastChannel', undefined);
  vi.stubGlobal('navigator', {
    locks: { request: async (_key: string, fn: () => unknown) => fn() },
  });
});
describe('durable scoring queue', () => {
  it('keeps insertion order when timestamps are equal and IDs sort differently', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
    const q = await queue();
    await q.enqueueBall('m', input('z'), owner);
    await q.enqueueBall('m', input('a'), owner);
    expect((await q.listQueuedBalls('m', 'u')).map((i) => i.id)).toEqual(['z', 'a']);
    vi.restoreAllMocks();
  });
  it('isolates accounts and retains innings ownership', async () => {
    const q = await queue();
    await q.enqueueBall('m', input('one'), owner);
    expect(await q.listQueuedBalls('m', 'other')).toEqual([]);
    expect((await q.listQueuedBalls('m', 'u'))[0]?.inningsId).toBe('i');
  });
  it('stops at a rejected ball until the scorer explicitly retries', async () => {
    const q = await queue();
    await q.enqueueBall('m', input('one'), owner);
    await q.enqueueBall('m', input('two'), owner);
    const submit = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('invalid player'), { status: 422 }));
    expect(await q.drainBallQueue('m', 'u', submit)).toBe(0);
    await q.drainBallQueue('m', 'u', submit);
    expect(submit).toHaveBeenCalledTimes(1);
    await q.resetFailedBalls('m', 'u');
    submit.mockResolvedValue({});
    expect(await q.drainBallQueue('m', 'u', submit)).toBe(2);
    expect(await q.listQueuedBalls('m', 'u')).toEqual([]);
  });
  it('retains temporary failures for later retry', async () => {
    const q = await queue();
    await q.enqueueBall('m', input('one'), owner);
    await expect(
      q.drainBallQueue('m', 'u', async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
    expect((await q.listQueuedBalls('m', 'u'))[0]?.status).toBe('pending');
  });
  it('fails visibly instead of falling back to volatile memory', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const q = await queue();
    await expect(q.enqueueBall('m', input('one'), owner)).rejects.toThrow('storage is unavailable');
  });
  it('notifies listeners only after committed rows can be read', async () => {
    const q = await queue();
    let seen: Promise<unknown> | undefined;
    q.subscribeToBallQueue(() => {
      seen = q.listQueuedBalls('m', 'u');
    });
    await q.enqueueBall('m', input('one'), owner);
    expect(await seen).toHaveLength(1);
  });
});
