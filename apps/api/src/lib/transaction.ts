import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

export interface TransactionScope {
  client: Prisma.TransactionClient;
  locks: Set<string>;
  committed: Array<() => Promise<unknown>>;
}

export const transactions = new AsyncLocalStorage<TransactionScope>();

export function afterCommit(work: () => Promise<unknown>): Promise<unknown> {
  const scope = transactions.getStore();
  if (!scope) return work();
  scope.committed.push(work);
  return Promise.resolve();
}
