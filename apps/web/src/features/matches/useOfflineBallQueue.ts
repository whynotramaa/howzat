import { useCallback, useEffect, useRef, useState } from 'react';
import type { BallRequestInput } from '@howzat/shared';
import {
  drainBallQueue,
  enqueueBall,
  listQueuedBalls,
  resetFailedBalls,
  subscribeToBallQueue,
  type QueuedBall,
} from '@/lib/offlineBallQueue';

export function useOfflineBallQueue(
  matchId: string,
  userId: string,
  inningsId: string | undefined,
  submit: (input: BallRequestInput, inningsId: string) => Promise<unknown>,
) {
  const [items, setItems] = useState<QueuedBall[]>([]);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const draining = useRef(false);
  const refresh = useCallback(async () => {
    try {
      setItems(await listQueuedBalls(matchId, userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offline storage failed');
    }
  }, [matchId, userId]);
  const drain = useCallback(async () => {
    if (draining.current || !navigator.onLine || !userId) return;
    draining.current = true;
    setSyncState('syncing');
    try {
      const synced = await drainBallQueue(matchId, userId, submit);
      const remaining = await listQueuedBalls(matchId, userId);
      setItems(remaining);
      setError(null);
      setSyncState(
        remaining.some((item) => item.status === 'failed') ? 'failed' : synced ? 'synced' : 'idle',
      );
    } catch (err) {
      setSyncState('failed');
      setError(err instanceof Error ? err.message : 'Will retry when connected');
    } finally {
      draining.current = false;
    }
  }, [matchId, userId, submit]);
  const enqueue = useCallback(
    async (input: BallRequestInput) => {
      if (!inningsId) throw new Error('The innings has not loaded.');
      await enqueueBall(matchId, input, { userId, inningsId });
      await refresh();
      void drain();
    },
    [matchId, userId, inningsId, refresh, drain],
  );
  const retryFailed = useCallback(async () => {
    await resetFailedBalls(matchId, userId);
    await refresh();
    await drain();
  }, [matchId, userId, refresh, drain]);
  useEffect(() => {
    let active = true;
    setItems([]);
    void refresh().then(() => {
      if (active) void drain();
    });
    const unsubscribe = subscribeToBallQueue(() => {
      if (active) void refresh();
    });
    const online = () => {
      setIsOnline(true);
      void drain();
    };
    const offline = () => setIsOnline(false);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void drain();
    }, 15_000);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [refresh, drain]);
  return {
    items,
    pending: items.filter((item) => item.status === 'pending'),
    failed: items.filter((item) => item.status === 'failed'),
    isOnline,
    syncState,
    error,
    enqueue,
    drain,
    retryFailed,
  };
}
