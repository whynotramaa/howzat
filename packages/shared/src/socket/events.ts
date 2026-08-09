import type { MatchSnapshot } from '../types/scoring';
import type { FootballSnapshot } from '../types/football';

export interface ServerToClientEvents {
  ball: (payload: BallBroadcast) => void;
  'innings:complete': (payload: InningsCompleteBroadcast) => void;
  'match:completed': (payload: MatchCompletedBroadcast) => void;
  'match:dls': (payload: DlsRevisedBroadcast) => void;
  'football:event': (payload: FootballEventBroadcast) => void;
  'football:clock': (payload: FootballClockBroadcast) => void;
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

/**
 * A revised target or allotment. It carries no new ball, so `lastEventSeq` has
 * not moved and `isNewerSnapshot` would reject it — viewers apply this one
 * because the scorer changed the terms of the match, not because time passed.
 */
export interface DlsRevisedBroadcast {
  matchId: string;
  snapshot: MatchSnapshot | null;
}

export interface FootballEventBroadcast {
  matchId: string;
  snapshot: FootballSnapshot;
  seq: number;
}

export interface FootballClockBroadcast {
  matchId: string;
  snapshot: FootballSnapshot;
}

export const matchRoom = (matchId: string) => `match:${matchId}`;

export function isNewerSnapshot(current: MatchSnapshot | null, incoming: MatchSnapshot): boolean {
  if (!current) return true;
  if (incoming.matchId !== current.matchId) return true;

  if (incoming.inningsNumber !== current.inningsNumber) {
    return incoming.inningsNumber > current.inningsNumber;
  }

  return incoming.lastEventSeq > current.lastEventSeq;
}

export function hasSequenceGap(current: MatchSnapshot | null, incoming: MatchSnapshot): boolean {
  if (!current) return false;
  if (incoming.inningsNumber !== current.inningsNumber) return false;
  return incoming.lastEventSeq > current.lastEventSeq + 1;
}

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
