import { useCallback, useEffect, useRef, useState } from 'react';
import { isNewerFootballSnapshot, type FootballSnapshot } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { ConnectionState } from '@/features/live/useLiveMatch';

/**
 * Snapshot-first, then subscribe — the same two-step the cricket page uses, and
 * for the same reason: a viewer who opens the link in the 70th minute has to
 * see the 70th minute immediately, not a replay from kick-off.
 *
 *   1. GET the snapshot (Redis, or a rebuild if the cache is cold)
 *   2. join match:{id} and apply every broadcast that is newer
 *   3. on reconnect, refetch — the gap while disconnected is unknowable
 *
 * The clock needs no step of its own. It arrives inside the snapshot as a
 * banked total plus a start instant, and the component ticks it locally, so a
 * running match costs exactly as much traffic as a stopped one: nothing.
 */

interface LiveFootball {
  snapshot: FootballSnapshot | null;
  connection: ConnectionState;
  viewers: number;
  error: string | null;
  isLoading: boolean;
  /** True when the match exists but has not kicked off yet. */
  notStarted: boolean;
  refetch: () => void;
}

interface EmptyResponse {
  snapshot?: null;
  matchId?: string;
  message?: string;
}

export function useLiveFootball(slug: string): LiveFootball {
  const [snapshot, setSnapshot] = useState<FootballSnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notStarted, setNotStarted] = useState(false);

  // Read inside socket callbacks without making them a dependency, which would
  // tear down and rebuild the subscription on every single incident.
  const latest = useRef<FootballSnapshot | null>(null);
  const matchId = useRef<string | null>(null);

  const apply = useCallback((incoming: FootballSnapshot) => {
    if (!isNewerFootballSnapshot(latest.current, incoming)) return;
    latest.current = incoming;
    setSnapshot(incoming);
  }, []);

  const fetchSnapshot = useCallback(async () => {
    try {
      const data = await apiFetch<FootballSnapshot | EmptyResponse>(
        `/public/matches/${slug}/football`,
      );

      if ('snapshot' in data && data.snapshot === null) {
        matchId.current = data.matchId ?? null;
        setNotStarted(true);
      } else {
        const full = data as FootballSnapshot;
        matchId.current = full.matchId;
        setNotStarted(false);
        // A refetch after a gap is authoritative: take it unconditionally.
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
      // Anything that happened while we were away is unknown — resync rather
      // than trust a stale snapshot.
      void fetchSnapshot();
    });

    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.io.on('reconnect_attempt', () => setConnection('reconnecting'));
    socket.io.on('error', () => setConnection('offline'));

    socket.on('football:event', (payload) => {
      if (payload.matchId === id) apply(payload.snapshot);
    });

    socket.on('football:clock', (payload) => {
      if (payload.matchId === id) apply(payload.snapshot);
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
      socket.off('football:event');
      socket.off('football:clock');
      socket.off('match:completed');
      socket.off('joined');
      socket.off('viewers');
    };
    // matchId lands with the first snapshot, so this re-runs once it is known.
  }, [apply, fetchSnapshot, snapshot?.matchId, notStarted]);

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
