import { useCallback, useEffect, useRef, useState } from 'react';
import { hasSequenceGap, isNewerSnapshot, type MatchSnapshot } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

interface LiveMatch {
  snapshot: MatchSnapshot | null;
  connection: ConnectionState;
  viewers: number;
  error: string | null;
  isLoading: boolean;
  notStarted: boolean;
  refetch: () => void;
}

interface SnapshotResponse {
  snapshot?: null;
  matchId?: string;
  message?: string;
}

export function useLiveMatch(slug: string): LiveMatch {
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notStarted, setNotStarted] = useState(false);

  const latest = useRef<MatchSnapshot | null>(null);
  const matchId = useRef<string | null>(null);

  const applySnapshot = useCallback((incoming: MatchSnapshot) => {
    if (!isNewerSnapshot(latest.current, incoming)) return;
    latest.current = incoming;
    setSnapshot(incoming);
  }, []);

  const fetchSnapshot = useCallback(async () => {
    try {
      const data = await apiFetch<MatchSnapshot | SnapshotResponse>(
        `/public/matches/${slug}/snapshot`,
      );

      if ('snapshot' in data && data.snapshot === null) {
        matchId.current = data.matchId ?? null;
        setNotStarted(true);
      } else {
        const full = data as MatchSnapshot;
        matchId.current = full.matchId;
        setNotStarted(false);
        latest.current = full;
        setSnapshot(full);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the score');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!matchId.current) return;

    const socket = getSocket();
    const id = matchId.current;

    const join = () => {
      socket.emit('join', { matchId: id });
      setConnection('live');
    };

    if (socket.connected) join();

    socket.on('connect', () => {
      join();
      void fetchSnapshot();
    });

    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.io.on('reconnect_attempt', () => setConnection('reconnecting'));
    socket.io.on('error', () => setConnection('offline'));

    socket.on('ball', (payload) => {
      if (payload.matchId !== id) return;

      if (hasSequenceGap(latest.current, payload.snapshot)) {
        void fetchSnapshot();
        return;
      }

      applySnapshot(payload.snapshot);
    });

    socket.on('innings:complete', (payload) => {
      if (payload.matchId === id) applySnapshot(payload.snapshot);
    });

    socket.on('match:completed', (payload) => {
      if (payload.matchId === id) void fetchSnapshot();
    });

    socket.on('joined', (payload) => setViewers(payload.viewers));
    socket.on('viewers', (payload) => {
      if (payload.matchId === id) setViewers(payload.count);
    });

    return () => {
      socket.emit('leave', { matchId: id });
      socket.off('connect');
      socket.off('disconnect');
      socket.off('ball');
      socket.off('innings:complete');
      socket.off('match:completed');
      socket.off('joined');
      socket.off('viewers');
    };
  }, [applySnapshot, fetchSnapshot, snapshot?.matchId, notStarted]);

  return {
    snapshot,
    connection,
    viewers,
    error,
    isLoading,
    notStarted,
    refetch: () => void fetchSnapshot(),
  };
}
