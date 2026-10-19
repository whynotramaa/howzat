import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { FootballSnapshot, MatchSnapshot } from '@howzat/shared';

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';
type Snapshot = MatchSnapshot | FootballSnapshot;
interface Empty {
  snapshot: null;
  matchId?: string;
}
export function useLiveSnapshot<T extends Snapshot>(
  slug: string,
  endpoint: string,
  isNewer: (current: T | null, incoming: T) => boolean,
) {
  const [snapshot, setSnapshot] = useState<T | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notStarted, setNotStarted] = useState(false);
  const latest = useRef<T | null>(null);
  const request = useRef(0);
  const apply = useCallback(
    (incoming: T) => {
      if (!isNewer(latest.current, incoming)) return;
      latest.current = incoming;
      setSnapshot(incoming);
      setNotStarted(false);
    },
    [isNewer],
  );
  const fetchSnapshot = useCallback(async () => {
    const id = ++request.current;
    try {
      const data = await apiFetch<T | Empty>(`/public/matches/${slug}/${endpoint}`, {
        cache: 'no-store',
      });
      if (request.current !== id) return;
      if ('snapshot' in data && data.snapshot === null) {
        setMatchId(data.matchId ?? null);
        setNotStarted(true);
      } else {
        const full = data as T;
        setMatchId(full.matchId);
        apply(full);
      }
      setError(null);
    } catch (err) {
      if (request.current === id)
        setError(err instanceof Error ? err.message : 'Could not refresh the score');
    } finally {
      if (request.current === id) setIsLoading(false);
    }
  }, [slug, endpoint, apply]);
  useEffect(() => {
    latest.current = null;
    setSnapshot(null);
    setMatchId(null);
    setIsLoading(true);
    setViewers(0);
    setNotStarted(false);
    void fetchSnapshot();
    const online = () => {
      void fetchSnapshot();
    };
    const offline = () => setConnection('offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void fetchSnapshot();
    }, 30_000);
    return () => {
      request.current += 1;
      window.clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [fetchSnapshot]);
  useEffect(() => {
    if (!matchId) return;
    const socket = getSocket();
    const join = () => {
      socket.emit('join', { matchId });
      setConnection('live');
      void fetchSnapshot();
    };
    const disconnected = () => setConnection('reconnecting');
    const offline = () => setConnection('offline');
    const changed = (payload: { matchId: string; snapshot?: Snapshot | null }) => {
      if (payload.matchId !== matchId) return;
      if (payload.snapshot) apply(payload.snapshot as T);
      else void fetchSnapshot();
    };
    const count = (payload: { matchId: string; count: number }) => {
      if (payload.matchId === matchId) setViewers(payload.count);
    };
    const joined = (payload: { matchId: string; viewers: number }) => {
      if (payload.matchId === matchId) setViewers(payload.viewers);
    };
    const completed = (payload: { matchId: string }) => {
      if (payload.matchId === matchId) void fetchSnapshot();
    };
    socket.on('connect', join);
    socket.on('disconnect', disconnected);
    socket.io.on('reconnect_attempt', disconnected);
    socket.io.on('error', offline);
    socket.on('ball', changed);
    socket.on('innings:complete', changed);
    socket.on('match:dls', changed);
    socket.on('football:event', changed);
    socket.on('football:clock', changed);
    socket.on('match:completed', completed);
    socket.on('viewers', count);
    socket.on('joined', joined);
    if (socket.connected) join();
    const heartbeat = window.setInterval(() => {
      if (socket.connected) socket.emit('join', { matchId });
    }, 60_000);
    return () => {
      window.clearInterval(heartbeat);
      socket.emit('leave', { matchId });
      socket.off('connect', join);
      socket.off('disconnect', disconnected);
      socket.io.off('reconnect_attempt', disconnected);
      socket.io.off('error', offline);
      socket.off('ball', changed);
      socket.off('innings:complete', changed);
      socket.off('match:dls', changed);
      socket.off('football:event', changed);
      socket.off('football:clock', changed);
      socket.off('match:completed', completed);
      socket.off('viewers', count);
      socket.off('joined', joined);
    };
  }, [matchId, apply, fetchSnapshot]);
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
