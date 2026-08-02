import type { FootballSnapshot, MatchSnapshot } from '@howzat/shared';
import { logger } from '../lib/logger';

/**
 * The seam between the write path and the transport.
 *
 * Phase 4 needs to announce that a ball landed; Phase 5 will deliver those
 * announcements over socket.io with the Redis adapter. Publishing through an
 * interface means the scoring code never imports socket.io, and the transport
 * stays genuinely disposable — swapping or removing it touches one file.
 */

export interface MatchEvents {
  ball: { matchId: string; snapshot: MatchSnapshot; seq: number };
  'innings:complete': { matchId: string; inningsNumber: number; snapshot: MatchSnapshot };
  'match:completed': { matchId: string; tournamentId: string; winnerTeamId: string | null };
  'football:event': { matchId: string; snapshot: FootballSnapshot; seq: number };
  'football:clock': { matchId: string; snapshot: FootballSnapshot };
}

export type MatchEventName = keyof MatchEvents;

/**
 * A discriminated union rather than two loose generics: it is what lets a
 * transport `switch` on the event name and have the payload narrow with it.
 */
export type MatchEventEnvelope = {
  [K in MatchEventName]: { event: K; payload: MatchEvents[K] };
}[MatchEventName];

export interface MatchEventPublisher {
  publish(envelope: MatchEventEnvelope): void;
}

/** With no transport attached, events are logged and dropped. */
const noopPublisher: MatchEventPublisher = {
  publish({ event, payload }) {
    logger.debug({ event, matchId: payload.matchId }, 'Match event (no transport attached)');
  },
};

let publisher: MatchEventPublisher = noopPublisher;

export function setMatchEventPublisher(next: MatchEventPublisher): void {
  publisher = next;
}

/**
 * In-process subscribers, distinct from the transport.
 *
 * The transport pushes an event outward to connected clients; a subscriber
 * reacts to it inside this process. The points table is the motivating case:
 * it must recompute when a match completes, and the brief is explicit that
 * this is event-triggered rather than a cron or a poll.
 */
type Subscriber<K extends MatchEventName> = (payload: MatchEvents[K]) => void | Promise<void>;

const subscribers = new Map<MatchEventName, Array<Subscriber<MatchEventName>>>();

export function onMatchEvent<K extends MatchEventName>(event: K, handler: Subscriber<K>): void {
  const existing = subscribers.get(event) ?? [];
  existing.push(handler as Subscriber<MatchEventName>);
  subscribers.set(event, existing);
}

/**
 * Returns a promise that settles once every subscriber has finished.
 *
 * Callers on a hot path (a ball write) can drop it with `void` and keep the
 * old fire-and-forget behaviour. Callers running on a serverless platform
 * must await it: the instance is frozen the moment the response is sent, so
 * a detached rebuild would be truncated part-way through with no error.
 *
 * A failing subscriber still never fails the caller — each one is caught
 * individually, so the returned promise always resolves.
 */
export function publishMatchEvent<K extends MatchEventName>(
  event: K,
  payload: MatchEvents[K],
): Promise<void> {
  try {
    publisher.publish({ event, payload } as MatchEventEnvelope);
  } catch (err) {
    // Fan-out is best-effort. Postgres already has the ball; a transport
    // failure must never fail the write that succeeded.
    logger.error({ err, event }, 'Failed to publish match event');
  }

  const running = (subscribers.get(event) ?? []).map(async (handler) => {
    try {
      await handler(payload);
    } catch (err) {
      logger.error({ err, event }, 'Match event subscriber failed');
    }
  });

  return Promise.all(running).then(() => undefined);
}
