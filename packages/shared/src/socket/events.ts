import type { MatchSnapshot } from '../types/scoring';
import type { FootballSnapshot } from '../types/football';

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
  /**
   * Football's equivalent of `ball` — one event per goal, card or undo.
   *
   * A separate name rather than a widened `ball` payload: a cricket viewer and
   * a football viewer are never in the same room, and a union carried on one
   * event would make every handler on both sides start with a discriminant
   * check for a case that cannot occur.
   */
  'football:event': (payload: FootballEventBroadcast) => void;
  /**
   * The clock moved — started, paused, resumed, or a period ended. Sent on
   * command only, never on a tick: viewers interpolate the seconds locally
   * from `runningSince`, so a running clock costs no traffic at all.
   */
  'football:clock': (payload: FootballClockBroadcast) => void;
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

export interface FootballEventBroadcast {
  matchId: string;
  /** Whole snapshot, for the same self-healing reason as BallBroadcast. */
  snapshot: FootballSnapshot;
  seq: number;
}

export interface FootballClockBroadcast {
  matchId: string;
  snapshot: FootballSnapshot;
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

/**
 * The football twin of isNewerSnapshot. Simpler, because a football match has
 * no innings to restart the sequence: `seq` alone is monotonic for the whole
 * match, so a strictly greater one is strictly newer.
 *
 * The `>=` is deliberate. A clock broadcast carries the same seq as the last
 * event — pausing the watch does not record an incident — and dropping it as
 * "not newer" would leave every viewer's clock running after the whistle.
 */
export function isNewerFootballSnapshot(
  current: FootballSnapshot | null,
  incoming: FootballSnapshot,
): boolean {
  if (!current) return true;
  if (incoming.matchId !== current.matchId) return true;
  if (incoming.lastEventSeq !== current.lastEventSeq) {
    return incoming.lastEventSeq > current.lastEventSeq;
  }

  return Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt);
}
