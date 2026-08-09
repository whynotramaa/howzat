import { describe, expect, it } from 'vitest';
import {
  buildFootballState,
  footballResultText,
  lastChangeFor,
  materializeFootballEvents,
  resolveOnPitch,
  substitutionsRemaining,
} from './reducer';
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
    p4: { id: 'p4', name: 'Arun' },
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
    playerOffId: null,
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
    const result = footballResultText({ name: 'Rovers', goals: 3 }, { name: 'United', goals: 1 });
    expect(result).toEqual({ text: 'Rovers won 3–1', winner: 'HOME' });
  });

  it('names no winner for a draw', () => {
    const result = footballResultText({ name: 'Rovers', goals: 2 }, { name: 'United', goals: 2 });
    expect(result).toEqual({ text: 'Match drawn 2–2', winner: null });
  });
});

describe('substitutions', () => {
  const starters = [
    { playerId: 'p1', slot: 0 },
    { playerId: 'p2', slot: 1 },
  ];

  function sub(onId: string, offId: string, teamId = 'home'): FootballEvent {
    return event('SUBSTITUTION', teamId, onId, { playerOffId: offId });
  }

  it('records who came on and who went off', () => {
    const state = buildFootballState(context, [sub('p3', 'p2')]);

    expect(state.home.subbedOn).toEqual(['p3']);
    expect(state.home.subbedOff).toEqual(['p2']);
    expect(state.home.substitutions).toHaveLength(1);
  });

  it('puts the incoming player in the outgoing player’s position', () => {
    const state = buildFootballState(context, [sub('p3', 'p2')]);
    const onPitch = resolveOnPitch(starters, state.home);

    expect(onPitch.get(1)).toBe('p3');
    expect(onPitch.get(0)).toBe('p1');
    expect([...onPitch.values()]).not.toContain('p2');
  });

  it('resolves a second change through the same position', () => {
    const state = buildFootballState(context, [sub('p3', 'p2'), sub('p4', 'p3')]);
    const onPitch = resolveOnPitch(starters, state.home);

    expect(onPitch.get(1)).toBe('p4');
  });

  it('leaves the position empty when a player is sent off', () => {
    const state = buildFootballState(context, [event('RED_CARD', 'home', 'p1')]);
    const onPitch = resolveOnPitch(starters, state.home);

    expect(onPitch.has(0)).toBe(false);
    expect(onPitch.size).toBe(1);
  });

  it('drops a change naming somebody who is not on the pitch', () => {
    const state = buildFootballState(context, [sub('p4', 'nobody')]);
    const onPitch = resolveOnPitch(starters, state.home);

    expect([...onPitch.values()]).toEqual(['p1', 'p2']);
  });

  it('is undone like anything else in the log', () => {
    const change = sub('p3', 'p2');
    const undo: FootballEvent = {
      ...event('SUBSTITUTION', 'home', null),
      eventType: 'UNDO',
      supersedesEventId: change.id,
    };

    const state = buildFootballState(context, [change, undo]);

    expect(state.home.substitutions).toHaveLength(0);
    expect(resolveOnPitch(starters, state.home).get(1)).toBe('p2');
  });

  it('names both players in the timeline', () => {
    const state = buildFootballState(context, [sub('p3', 'p1')]);

    expect(state.incidents[0]?.playerName).toBe('Imran');
    expect(state.incidents[0]?.playerOffName).toBe('Sunil');
  });

  it('puts a player who has already come off back on the pitch', () => {
    const state = buildFootballState(context, [sub('p3', 'p2'), sub('p2', 'p3')]);
    const onPitch = resolveOnPitch(starters, state.home);

    expect(onPitch.get(1)).toBe('p2');
    expect(state.home.substitutions).toHaveLength(2);
  });

  it('counts every change, however often a player comes and goes', () => {
    const state = buildFootballState(context, [
      sub('p3', 'p2'),
      sub('p2', 'p3'),
      sub('p3', 'p2'),
      sub('p4', 'p1'),
    ]);

    expect(state.home.substitutions).toHaveLength(4);
    expect(substitutionsRemaining(state.home, null)).toBeNull();
    expect(substitutionsRemaining(state.home, 5)).toBe(1);
    expect(substitutionsRemaining(state.home, 3)).toBe(0);
  });

  it('reports the latest time a rolling substitute came on and went off', () => {
    const state = buildFootballState(context, [sub('p3', 'p2'), sub('p2', 'p3'), sub('p3', 'p2')]);

    const labels = state.home.substitutions.map((change) => change.minuteLabel);

    expect(lastChangeFor(state.home, 'p3')).toEqual({ on: labels[2], off: labels[1] });
    expect(lastChangeFor(state.home, 'p2')).toEqual({ on: labels[1], off: labels[2] });
    expect(lastChangeFor(state.home, 'p1')).toEqual({ on: null, off: null });
  });
});
