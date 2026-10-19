import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ steps: [] as string[], update: vi.fn(), tx: {} }));
vi.mock('../src/config/env', () => ({ isDevelopment: false }));
vi.mock('../src/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    match = { findUnique: async () => ({ tournamentId: 't' }), update: state.update };
    async $transaction(fn: (tx: unknown) => Promise<unknown>) {
      state.steps.push('begin');
      try {
        const value = await fn(state.tx);
        state.steps.push('commit');
        return value;
      } catch (error) {
        state.steps.push('rollback');
        throw error;
      }
    }
  },
}));
import { prisma } from '../src/lib/prisma';
import { matchLockKey, withLock } from '../src/lib/lock';
import { afterCommit, transactions } from '../src/lib/transaction';
beforeEach(() => {
  state.steps = [];
  state.update.mockResolvedValue({});
  state.tx = {
    match: { findUnique: async () => ({ tournamentId: 't' }), update: state.update },
    $queryRaw: async () => {
      state.steps.push('lock');
      return [];
    },
  };
});
it('shares the transaction through nested services and delays side effects until commit', async () => {
  await withLock(matchLockKey('m'), async () => {
    expect(transactions.getStore()?.client).toBe(state.tx);
    await prisma.$transaction([Promise.resolve(1)] as never);
    await withLock(matchLockKey('m'), async () => {
      state.steps.push('write');
      await afterCommit(async () => {
        state.steps.push('publish');
      });
    });
  });
  expect(state.steps).toEqual(['begin', 'lock', 'lock', 'write', 'commit', 'publish']);
  expect(state.update).toHaveBeenCalledTimes(1);
});
it('does not publish rolled-back writes', async () => {
  await expect(
    withLock('test', async () => {
      await afterCommit(async () => {
        state.steps.push('publish');
      });
      throw new Error('failed write');
    }),
  ).rejects.toThrow('failed write');
  expect(state.steps).toEqual(['begin', 'lock', 'rollback']);
  expect(transactions.getStore()).toBeUndefined();
});
