import type { FootballSnapshot, MatchSnapshot } from '@howzat/shared';
import { logger } from '../lib/logger';

export interface MatchEvents {
  ball: { matchId: string; snapshot: MatchSnapshot; seq: number };
  'innings:complete': { matchId: string; inningsNumber: number; snapshot: MatchSnapshot };
  'match:completed': { matchId: string; tournamentId: string; winnerTeamId: string | null };
  'match:dls': { matchId: string; snapshot: MatchSnapshot | null };
  'football:event': { matchId: string; snapshot: FootballSnapshot; seq: number };
  'football:clock': { matchId: string; snapshot: FootballSnapshot };
}

export type MatchEventName = keyof MatchEvents;

export type MatchEventEnvelope = {
  [K in MatchEventName]: { event: K; payload: MatchEvents[K] };
}[MatchEventName];

export interface MatchEventPublisher {
  publish(envelope: MatchEventEnvelope): void;
}

const noopPublisher: MatchEventPublisher = {
  publish({ event, payload }) {
    logger.debug({ event, matchId: payload.matchId }, 'Match event (no transport attached)');
  },
};

let publisher: MatchEventPublisher = noopPublisher;

export function setMatchEventPublisher(next: MatchEventPublisher): void {
  publisher = next;
}

type Subscriber<K extends MatchEventName> = (payload: MatchEvents[K]) => void | Promise<void>;

const subscribers = new Map<MatchEventName, Array<Subscriber<MatchEventName>>>();

export function onMatchEvent<K extends MatchEventName>(event: K, handler: Subscriber<K>): void {
  const existing = subscribers.get(event) ?? [];
  existing.push(handler as Subscriber<MatchEventName>);
  subscribers.set(event, existing);
}

export function publishMatchEvent<K extends MatchEventName>(
  event: K,
  payload: MatchEvents[K],
): Promise<void> {
  try {
    publisher.publish({ event, payload } as MatchEventEnvelope);
  } catch (err) {
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
