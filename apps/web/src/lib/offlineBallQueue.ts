import type { BallRequestInput } from '@howzat/shared';

export interface QueuedBall {
  id: string;
  matchId: string;
  userId: string;
  inningsId: string;
  sequence: number;
  input: BallRequestInput;
  status: 'pending' | 'failed';
  error: string | null;
  createdAt: number;
}
export interface QueueOwner {
  userId: string;
  inningsId: string;
}
const STORE = 'balls';
const subscribers = new Set<() => void>();
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('howzat-queue') : null;
let databasePromise: Promise<IDBDatabase> | null = null;
const drains = new Map<string, Promise<number>>();
channel?.addEventListener('message', () => subscribers.forEach((fn) => fn()));
function notify(): void {
  subscribers.forEach((fn) => fn());
  channel?.postMessage('changed');
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(
      new Error('Offline storage is unavailable. Enable browser storage before scoring.'),
    );
  databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('howzat-offline', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('matchId', 'matchId');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('contexts')) db.createObjectStore('contexts');
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = null;
      };
      db.onclose = () => {
        databasePromise = null;
      };
      resolve(db);
    };
    request.onerror = () =>
      reject(new Error('Could not open offline storage. Your ball has not been saved.'));
    request.onblocked = () =>
      reject(new Error('Close other Howzat tabs to update offline storage.'));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}
function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline storage failed'));
  });
}
function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Offline save was interrupted. Try again.'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Offline storage is full or unavailable.'));
  });
}
export function subscribeToBallQueue(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
export async function listQueuedBalls(matchId: string, userId: string): Promise<QueuedBall[]> {
  const db = await openDatabase();
  const rows: QueuedBall[] = await result(
    db.transaction(STORE).objectStore(STORE).index('matchId').getAll(matchId),
  );
  return rows.filter((item) => item.userId === userId).sort((a, b) => a.sequence - b.sequence);
}
export async function enqueueBall(
  matchId: string,
  input: BallRequestInput,
  owner: QueueOwner,
): Promise<QueuedBall> {
  if (!owner.userId || !owner.inningsId)
    throw new Error('Load the current innings before scoring.');
  const db = await openDatabase();
  const tx = db.transaction([STORE, 'meta'], 'readwrite', { durability: 'strict' });
  const done = completed(tx);
  const meta = tx.objectStore('meta');
  const sequence = Number((await result(meta.get('sequence'))) ?? 0) + 1;
  const item: QueuedBall = {
    id: input.clientEventId,
    matchId,
    ...owner,
    sequence,
    input,
    status: 'pending',
    error: null,
    createdAt: Date.now(),
  };
  tx.objectStore(STORE).add(item);
  meta.put(sequence, 'sequence');
  await done;
  notify();
  return item;
}
export async function removeQueuedBall(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, 'readwrite');
  const done = completed(tx);
  tx.objectStore(STORE).delete(id);
  await done;
  notify();
}
async function setStatus(
  id: string,
  status: QueuedBall['status'],
  error: string | null,
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, 'readwrite');
  const done = completed(tx),
    store = tx.objectStore(STORE);
  const item = await result(store.get(id));
  if (item) store.put({ ...item, status, error });
  await done;
  notify();
}
export async function markQueuedBallFailed(id: string, error: string): Promise<void> {
  await setStatus(id, 'failed', error);
}
export async function resetFailedBalls(matchId: string, userId: string): Promise<void> {
  for (const item of await listQueuedBalls(matchId, userId))
    if (item.status === 'failed') await setStatus(item.id, 'pending', null);
}
export async function drainBallQueue(
  matchId: string,
  userId: string,
  submit: (input: BallRequestInput, inningsId: string) => Promise<unknown>,
): Promise<number> {
  const key = `${userId}:${matchId}`;
  if (drains.has(key)) return drains.get(key)!;
  const work = async () => {
    let synced = 0;
    while (true) {
      const item = (await listQueuedBalls(matchId, userId))[0];
      if (!item || item.status === 'failed') return synced;
      try {
        await submit(item.input, item.inningsId);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500 && ![408, 409, 429].includes(status)) {
          await markQueuedBallFailed(
            item.id,
            error instanceof Error ? error.message : 'Review this ball before syncing.',
          );
          return synced;
        }
        throw error;
      }
      await removeQueuedBall(item.id);
      synced += 1;
    }
  };
  const promise = (async () => {
    if (typeof navigator !== 'undefined' && navigator.locks)
      return await navigator.locks.request(`howzat-sync:${key}`, work);
    throw new Error('Use a current browser with Web Locks support to sync safely.');
  })().finally(() => drains.delete(key));
  drains.set(key, promise);
  return promise;
}
export async function saveScorerContext(key: string, value: unknown): Promise<void> {
  const db = await openDatabase(),
    tx = db.transaction('contexts', 'readwrite');
  const done = completed(tx);
  tx.objectStore('contexts').put(value, key);
  await done;
}
export async function readScorerContext<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return result(db.transaction('contexts').objectStore('contexts').get(key));
}

export async function listLegacyBalls(matchId: string): Promise<QueuedBall[]> {
  const db = await openDatabase();
  const rows: QueuedBall[] = await result(
    db.transaction(STORE).objectStore(STORE).index('matchId').getAll(matchId),
  );
  return rows.filter((item) => !item.userId).sort((a, b) => a.createdAt - b.createdAt);
}
export async function discardQueue(matchId: string, userId: string, ids: string[]): Promise<void> {
  const db = await openDatabase(),
    tx = db.transaction(STORE, 'readwrite');
  const done = completed(tx),
    store = tx.objectStore(STORE);
  const rows: QueuedBall[] = await result(store.index('matchId').getAll(matchId));
  for (const row of rows)
    if (ids.includes(row.id) && (row.userId === userId || (userId === '__legacy__' && !row.userId)))
      store.delete(row.id);
  await done;
  notify();
}
