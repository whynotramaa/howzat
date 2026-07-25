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
  submit: (input: BallRequestInput) => Promise<unknown>,
) {
  const [items, setItems] = useState<QueuedBall[]>([]);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const draining = useRef(false);

  const refresh = useCallback(async () => {
    setItems(await listQueuedBalls(matchId));
  }, [matchId]);

  const drain = useCallback(async () => {
    if (draining.current || !navigator.onLine) return;
    draining.current = true;
    setSyncState('syncing');
    try {
      const synced = await drainBallQueue(matchId, submit);
      await refresh();
      const remaining = await listQueuedBalls(matchId);
      setSyncState(remaining.some((item) => item.status === 'failed') ? 'failed' : synced > 0 ? 'synced' : 'idle');
    } finally {
      draining.current = false;
    }
  }, [matchId, refresh, submit]);

  const enqueue = useCallback(async (input: BallRequestInput) => {
    setSyncState('idle');
    await enqueueBall(matchId, input);
    await refresh();
    if (navigator.onLine) await drain();
  }, [drain, matchId, refresh]);

  const retryFailed = useCallback(async () => {
    await resetFailedBalls(matchId);
    await refresh();
    await drain();
  }, [drain, matchId, refresh]);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeToBallQueue(() => void refresh());
    const wentOnline = () => {
      setIsOnline(true);
      void drain();
    };
    const wentOffline = () => setIsOnline(false);
    window.addEventListener('online', wentOnline);
    window.addEventListener('offline', wentOffline);
    return () => {
      unsubscribe();
      window.removeEventListener('online', wentOnline);
      window.removeEventListener('offline', wentOffline);
    };
  }, [drain, refresh]);

  return {
    items,
    pending: items.filter((item) => item.status === 'pending'),
    failed: items.filter((item) => item.status === 'failed'),
    isOnline,
    syncState,
    enqueue,
    drain,
    retryFailed,
  };
}
