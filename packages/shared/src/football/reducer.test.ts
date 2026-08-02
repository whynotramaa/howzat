import { describe, expect, it } from 'vitest';
import { buildFootballState, footballResultText, materializeFootballEvents } from './reducer';
import type { FootballContext } from './reducer';
import type { FootballEvent } from '../types/football';
import type { FootballEventKind } from '../types/enums';

const context: FootballContext = {
  matchId: 'm1',
  homeTeamId: 'home',
  awayTeamId: 'away',
  players: {
    p1: { id: 'p1', name: 'Sunil' },
    p2: { id: 'p2', name: 'Ravi' },
    p3: { id: 'p3', name: 'Imran' },
  },
  periodMinutes: 45,
};

let seq = 0;

function event(
  kind: FootballEventKind,
  teamId: string,
  playerId: string | null,
  overrides: Partial<FootballEvent> = {},
): FootballEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    matchId: 'm1',
    clientEventId: `c${seq}`,
    seq,
    eventType: 'EVENT',
    supersedesEventId: null,
    kind,
    teamId,
    playerId,
    assistPlayerId: null,
    minute: seq * 5,
    period: 1,
    stoppage: 0,
    createdBy: 'u1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildFootballState', () => {
  it('credits goals to the side that submitted them', () => {
    const state = buildFootballState(context, [
      event('GOAL', 'home', 'p1'),
      event('GOAL', 'away', 'p3'),
      event('GOAL', 'home', 'p2'),
    ]);

    expect(state.home.goals).toBe(2);
    expect(state.away.goals).toBe(1);
    expect(state.home.scorers).toEqual({ p1: 1, p2: 1 });
  });

  it('counts an own goal for the beneficiary without naming them as a scorer', () => {
    const state = buildFootballState(context, [event('OWN_GOAL', 'home', 'p3')]);

    expect(state.home.goals).toBe(1);
    expect(state.home.scorers).toEqual({});
    expect(state.away.goals).toBe(0);
  });

  it('sends a player off on a second yellow', () => {
    const state = buildFootballState(context, [
      event('YELLOW_CARD', 'home', 'p1'),
      event('YELLOW_CARD', 'home', 'p1'),
    ]);

    expect(state.home.yellowCards).toBe(2);
    expect(state.home.sentOff).toEqual(['p1']);
  });

  it('sends a player off on a straight red', () => {
    const state = buildFootballState(context, [event('RED_CARD', 'away', 'p3')]);
    expect(state.away.sentOff).toEqual(['p3']);
    expect(state.away.redCards).toBe(1);
  });

  it('names the scorer and the assist in the timeline', () => {
    const state = buildFootballState(context, [
      event('GOAL', 'home', 'p1', { assistPlayerId: 'p2' }),
    ]);

    expect(state.incidents[0]?.playerName).toBe('Sunil');
    expect(state.incidents[0]?.assistPlayerName).toBe('Ravi');
  });

  it('writes a stoppage-time minute the way it is spoken', () => {
    const state = buildFootballState(context, [
      event('GOAL', 'home', 'p1', { minute: 45, period: 1, stoppage: 3 }),
    ]);

    expect(state.incidents[0]?.minuteLabel).toBe("45+3'");
  });
});

describe('materializeFootballEvents', () => {
  it('drops an undone goal from the score but leaves it in the log', () => {
    const goal = event('GOAL', 'home', 'p1');
    const undo: FootballEvent = {
      ...event('GOAL', 'home', null),
      eventType: 'UNDO',
      supersedesEventId: goal.id,
    };

    const log = [goal, undo];

    expect(materializeFootballEvents(log)).toHaveLength(0);
    expect(buildFootballState(context, log).home.goals).toBe(0);
    expect(log).toHaveLength(2);
  });

  it('keeps lastEventSeq at the high-water mark of the whole log', () => {
    const goal = event('GOAL', 'home', 'p1');
    const undo: FootballEvent = {
      ...event('GOAL', 'home', null),
      eventType: 'UNDO',
      supersedesEventId: goal.id,
    };

    expect(buildFootballState(context, [goal, undo]).lastEventSeq).toBe(undo.seq);
  });
});

describe('footballResultText', () => {
  it('names a winner and the score', () => {
    const result = footballResultText(
      { name: 'Rovers', goals: 3 },
      { name: 'United', goals: 1 },
    );
    expect(result).toEqual({ text: 'Rovers won 3–1', winner: 'HOME' });
  });

  it('names no winner for a draw', () => {
    const result = footballResultText(
      { name: 'Rovers', goals: 2 },
      { name: 'United', goals: 2 },
    );
    expect(result).toEqual({ text: 'Match drawn 2–2', winner: null });
  });
});
