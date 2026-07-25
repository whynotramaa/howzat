import type { MatchSnapshot } from '../types/scoring';

/**
 * The typed client↔server event map. Shared so the server cannot emit an event
 * the client does not expect, and vice versa.
 *
 * Note what is *not* here: there is no event for submitting a ball. Every
 * write goes over HTTP. Sockets are a read-only fan-out, which keeps auth,
 * idempotency, validation and retry semantics in one well-understood place
 * and makes this whole layer disposable.
 */

export interface ServerToClientEvents {
  /**
   * Sent after every recorded ball, correction and undo. Carries the whole
   * snapshot rather than a minimal delta — see the note in ServerEventPayloads.
   */
  ball: (payload: BallBroadcast) => void;
  'innings:complete': (payload: InningsCompleteBroadcast) => void;
  'match:completed': (payload: MatchCompletedBroadcast) => void;
  /** Live viewer count for the room, so the page can show "142 watching". */
  viewers: (payload: { matchId: string; count: number }) => void;
  joined: (payload: { matchId: string; viewers: number }) => void;
  error: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  join: (payload: { matchId: string }) => void;
  leave: (payload: { matchId: string }) => void;
}

export interface BallBroadcast {
  matchId: string;
  /**
   * The full projected state. A delta would be smaller, but a snapshot is
   * self-healing: a client that misses one is corrected by the next, and
   * `seq` monotonicity is enough to discard an out-of-order arrival.
   */
  snapshot: MatchSnapshot;
  seq: number;
}

export interface InningsCompleteBroadcast {
  matchId: string;
  inningsNumber: number;
  snapshot: MatchSnapshot;
}

export interface MatchCompletedBroadcast {
  matchId: string;
  tournamentId: string;
  winnerTeamId: string | null;
}

export const matchRoom = (matchId: string) => `match:${matchId}`;

/**
 * True when an incoming broadcast is newer than what the client already has.
 * Snapshots can arrive out of order across a flaky mobile connection; applying
 * an older one would visibly rewind the score.
 */
export function isNewerSnapshot(current: MatchSnapshot | null, incoming: MatchSnapshot): boolean {
  if (!current) return true;
  if (incoming.matchId !== current.matchId) return true;

  // A new innings restarts the sequence, so seq alone is not sufficient.
  if (incoming.inningsNumber !== current.inningsNumber) {
    return incoming.inningsNumber > current.inningsNumber;
  }

  return incoming.lastEventSeq > current.lastEventSeq;
}

/**
 * Whether the client missed at least one event and should refetch rather than
 * trust what it has. With whole-snapshot broadcasts this is not a correctness
 * requirement — it drives the "reconnecting" affordance and the resync after
 * a dropped connection.
 */
export function hasSequenceGap(current: MatchSnapshot | null, incoming: MatchSnapshot): boolean {
  if (!current) return false;
  if (incoming.inningsNumber !== current.inningsNumber) return false;
  return incoming.lastEventSeq > current.lastEventSeq + 1;
}
