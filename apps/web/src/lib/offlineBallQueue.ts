import type { BallRequestInput } from '@howzat/shared';

export type QueuedBallStatus = 'pending' | 'failed';

export interface QueuedBall {
  id: string;
  matchId: string;
  input: BallRequestInput;
  status: QueuedBallStatus;
  error: string | null;
  createdAt: number;
}

const DB_NAME = 'howzat-offline';
const DB_VERSION = 1;
const STORE = 'balls';
const memory = new Map<string, QueuedBall>();
const subscribers = new Set<() => void>();
let databasePromise: Promise<IDBDatabase | null> | null = null;

function notify(): void {
  subscribers.forEach((listener) => listener());
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  databasePromise ??= new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('matchId', 'matchId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline storage failed'));
  });
}

export function subscribeToBallQueue(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export async function listQueuedBalls(matchId: string): Promise<QueuedBall[]> {
  const db = await openDatabase();
  if (!db) {
    return [...memory.values()].filter((item) => item.matchId === matchId).sort(byCreatedAt);
  }

  const transaction = db.transaction(STORE, 'readonly');
  const rows = await requestResult(transaction.objectStore(STORE).index('matchId').getAll(matchId));
  return rows.sort(byCreatedAt);
}

export async function enqueueBall(matchId: string, input: BallRequestInput): Promise<QueuedBall> {
  const item: QueuedBall = {
    id: input.clientEventId,
    matchId,
    input,
    status: 'pending',
    error: null,
    createdAt: Date.now(),
  };
  const db = await openDatabase();
  if (!db) memory.set(item.id, item);
  else await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).put(item));
  notify();
  return item;
}

export async function removeQueuedBall(id: string): Promise<void> {
  const db = await openDatabase();
  if (!db) memory.delete(id);
  else await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
  notify();
}

export async function markQueuedBallFailed(id: string, error: string): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    const item = memory.get(id);
    if (item) memory.set(id, { ...item, status: 'failed', error });
  } else {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const item = await requestResult(store.get(id));
    if (item) await requestResult(store.put({ ...item, status: 'failed', error }));
  }
  notify();
}

export async function resetFailedBalls(matchId: string): Promise<void> {
  const items = await listQueuedBalls(matchId);
  for (const item of items) {
    if (item.status !== 'failed') continue;
    const db = await openDatabase();
    if (!db) memory.set(item.id, { ...item, status: 'pending', error: null });
    else
      await requestResult(
        db
          .transaction(STORE, 'readwrite')
          .objectStore(STORE)
          .put({ ...item, status: 'pending', error: null }),
      );
  }
  notify();
}

export async function drainBallQueue(
  matchId: string,
  submit: (input: BallRequestInput) => Promise<unknown>,
): Promise<number> {
  const items = await listQueuedBalls(matchId);
  let synced = 0;
  for (const item of items) {
    try {
      await submit(item.input);
      await removeQueuedBall(item.id);
      synced += 1;
    } catch (error) {
      await markQueuedBallFailed(
        item.id,
        error instanceof Error ? error.message : 'Could not sync this ball',
      );
      break;
    }
  }
  return synced;
}

function byCreatedAt(a: QueuedBall, b: QueuedBall): number {
  return a.createdAt - b.createdAt;
}
