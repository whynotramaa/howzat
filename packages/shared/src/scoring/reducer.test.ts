import { describe, expect, it } from 'vitest';
import { applyBall, buildState, createInitialState, materializeEvents } from './reducer';
import { formatOvers } from './format';
import type { BallEvent, InningsContext } from '../types/scoring';

/**
 * These cover the rules that are silently wrong in most amateur scoring apps:
 * which deliveries count towards the over, who gets charged for what, and when
 * the strike rotates.
 */

const batting = Array.from({ length: 11 }, (_, index) => ({
  id: `bat${index + 1}`,
  name: `Batter ${index + 1}`,
}));

const bowling = Array.from({ length: 11 }, (_, index) => ({
  id: `bowl${index + 1}`,
  name: `Bowler ${index + 1}`,
}));

const context: InningsContext = {
  inningsId: 'innings1',
  matchId: 'match1',
  number: 1,
  battingTeam: { id: 't1', name: 'Team One', shortName: 'ONE', primaryColor: '#000' },
  bowlingTeam: { id: 't2', name: 'Team Two', shortName: 'TWO', primaryColor: '#fff' },
  oversQuota: 20,
  targetRuns: null,
  battingXI: batting,
  bowlingXI: bowling,
};

let seq = 0;

function ball(partial: Partial<BallEvent> = {}): BallEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    inningsId: 'innings1',
    clientEventId: `c${seq}`,
    seq,
    overNumber: 0,
    ballNumber: seq,
    eventType: 'BALL',
    supersedesEventId: null,
    isLegalDelivery: true,
    strikerId: 'bat1',
    nonStrikerId: 'bat2',
    bowlerId: 'bowl1',
    runsOffBat: 0,
    extraRuns: 0,
    extraType: null,
    isWicket: false,
    wicketType: null,
    dismissedPlayerId: null,
    fielderId: null,
    createdBy: 'user1',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function reset() {
  seq = 0;
}

describe('applyBall — deliveries and the over', () => {
  it('counts legal deliveries only, so two extras leave the over at 0.4', () => {
    reset();
    const state = buildState(context, [
      ball({ runsOffBat: 1, strikerId: 'bat1', nonStrikerId: 'bat2' }),
      ball({ runsOffBat: 0, strikerId: 'bat2', nonStrikerId: 'bat1' }),
      ball({ extraType: 'WIDE', extraRuns: 1, strikerId: 'bat2', nonStrikerId: 'bat1' }),
      ball({ extraType: 'NO_BALL', extraRuns: 1, strikerId: 'bat2', nonStrikerId: 'bat1' }),
      ball({ runsOffBat: 4, strikerId: 'bat2', nonStrikerId: 'bat1' }),
      ball({ runsOffBat: 0, strikerId: 'bat2', nonStrikerId: 'bat1' }),
    ]);

    expect(state.legalBalls).toBe(4);
    expect(formatOvers(state.legalBalls)).toBe('0.4');
    // 1 + 0 + wide 1 + no-ball 1 + 4 + 0
    expect(state.runs).toBe(7);
    expect(state.extras).toMatchObject({ wides: 1, noBalls: 1, total: 2 });
  });

  it('rotates strike on odd runs and again at the end of the over', () => {
    reset();
    const deliveries = [
      ball({ runsOffBat: 1 }), // strike rotates to bat2
      ball({ runsOffBat: 0, strikerId: 'bat2', nonStrikerId: 'bat1' }),
      ball({ runsOffBat: 0, strikerId: 'bat2', nonStrikerId: 'bat1' }),
      ball({ runsOffBat: 2, strikerId: 'bat2', nonStrikerId: 'bat1' }), // even, no rotation
      ball({ runsOffBat: 0, strikerId: 'bat2', nonStrikerId: 'bat1' }),
      ball({ runsOffBat: 0, strikerId: 'bat2', nonStrikerId: 'bat1' }), // over ends
    ];

    const state = buildState(context, deliveries);

    expect(state.legalBalls).toBe(6);
    // bat2 was on strike; the over ending swaps the ends back to bat1.
    expect(state.strikerId).toBe('bat1');
    expect(state.needsNewBowler).toBe(true);
    expect(state.thisOver).toHaveLength(0);
  });

  it('does not rotate strike on the wide penalty, only on runs actually run', () => {
    reset();
    const state = buildState(context, [ball({ extraType: 'WIDE', extraRuns: 1 })]);

    expect(state.strikerId).toBe('bat1');
    expect(state.runs).toBe(1);
    // A wide is not a ball faced.
    expect(state.batsmen.bat1?.balls).toBe(0);
  });

  it('credits the striker with facing a no-ball but never a wide', () => {
    reset();
    const state = buildState(context, [
      ball({ extraType: 'NO_BALL', extraRuns: 1, runsOffBat: 4 }),
      ball({ extraType: 'WIDE', extraRuns: 1 }),
    ]);

    expect(state.batsmen.bat1?.balls).toBe(1);
    expect(state.batsmen.bat1?.runs).toBe(4);
    expect(state.batsmen.bat1?.fours).toBe(1);
  });
});

describe('applyBall — who is charged for what', () => {
  it('charges wides and no-balls to the bowler but not byes or leg-byes', () => {
    reset();
    const state = buildState(context, [
      ball({ extraType: 'WIDE', extraRuns: 2 }),
      ball({ extraType: 'BYE', extraRuns: 4 }),
      ball({ extraType: 'LEG_BYE', extraRuns: 2 }),
      ball({ runsOffBat: 3 }),
    ]);

    // Team: 2 + 4 + 2 + 3 = 11. Bowler: wide 2 + off the bat 3 = 5.
    expect(state.runs).toBe(11);
    expect(state.bowlers.bowl1?.runs).toBe(5);
    // Byes and leg-byes go to the team, never to the batsman.
    expect(state.batsmen.bat1?.runs).toBe(3);
  });

  it('credits a caught wicket to the bowler and a run-out to nobody', () => {
    reset();
    const state = buildState(context, [
      ball({
        isWicket: true,
        wicketType: 'CAUGHT',
        dismissedPlayerId: 'bat1',
        fielderId: 'bowl4',
      }),
      ball({
        strikerId: 'bat3',
        nonStrikerId: 'bat2',
        isWicket: true,
        wicketType: 'RUN_OUT',
        dismissedPlayerId: 'bat3',
        fielderId: 'bowl5',
      }),
    ]);

    expect(state.wickets).toBe(2);
    expect(state.bowlers.bowl1?.wickets).toBe(1);
    expect(state.batsmen.bat1?.dismissal).toBe('c Bowler 4 b Bowler 1');
    expect(state.batsmen.bat3?.dismissal).toBe('run out (Bowler 5)');
  });

  it('awards a maiden only when the bowler concedes nothing in the over', () => {
    reset();
    const six = (extra?: Partial<BallEvent>) =>
      Array.from({ length: 6 }, () => ball({ runsOffBat: 0, ...extra }));

    const maiden = buildState(context, six());
    expect(maiden.bowlers.bowl1?.maidens).toBe(1);

    reset();
    // A leg-bye is not the bowler's run, so the over is still a maiden.
    const withLegBye = buildState(context, [
      ball({ extraType: 'LEG_BYE', extraRuns: 1 }),
      ...Array.from({ length: 5 }, () => ball({ runsOffBat: 0 })),
    ]);
    expect(withLegBye.bowlers.bowl1?.maidens).toBe(1);

    reset();
    const notMaiden = buildState(context, [
      ball({ runsOffBat: 1 }),
      ...Array.from({ length: 5 }, () => ball({ runsOffBat: 0 })),
    ]);
    expect(notMaiden.bowlers.bowl1?.maidens).toBe(0);
  });
});

describe('applyBall — innings lifecycle', () => {
  it('ends the innings all out at ten wickets', () => {
    reset();
    const deliveries = Array.from({ length: 10 }, (_, index) =>
      ball({
        strikerId: batting[index]!.id,
        nonStrikerId: batting[10]!.id,
        isWicket: true,
        wicketType: 'BOWLED',
        dismissedPlayerId: batting[index]!.id,
      }),
    );

    const state = buildState(context, deliveries);

    expect(state.wickets).toBe(10);
    expect(state.isComplete).toBe(true);
    expect(state.endReason).toBe('ALL_OUT');
    expect(state.needsNewBatsman).toBe(false);
  });

  it('ends on the quota and reports OVERS_COMPLETE', () => {
    reset();
    const shortInnings: InningsContext = { ...context, oversQuota: 1 };
    const state = buildState(
      shortInnings,
      Array.from({ length: 6 }, () => ball({ runsOffBat: 0 })),
    );

    expect(state.legalBalls).toBe(6);
    expect(state.isComplete).toBe(true);
    expect(state.endReason).toBe('OVERS_COMPLETE');
  });

  it('prefers TARGET_CHASED over OVERS_COMPLETE when the winning run is the last ball', () => {
    reset();
    const chase: InningsContext = { ...context, oversQuota: 1, targetRuns: 6 };
    const state = buildState(chase, [
      ball({ runsOffBat: 1 }),
      ball({ runsOffBat: 1 }),
      ball({ runsOffBat: 1 }),
      ball({ runsOffBat: 1 }),
      ball({ runsOffBat: 1 }),
      ball({ runsOffBat: 1 }),
    ]);

    expect(state.runs).toBe(6);
    expect(state.isComplete).toBe(true);
    expect(state.endReason).toBe('TARGET_CHASED');
  });
});

describe('materializeEvents — corrections and undo', () => {
  it('replaces a superseded ball in place, keeping chronological order', () => {
    reset();
    const original = ball({ runsOffBat: 4 });
    const later = ball({ runsOffBat: 1 });
    const correction = ball({
      runsOffBat: 6,
      eventType: 'CORRECTION',
      supersedesEventId: original.id,
    });

    const deliveries = materializeEvents([original, later, correction]);

    expect(deliveries).toHaveLength(2);
    expect(deliveries[0]?.runsOffBat).toBe(6);
    expect(deliveries[1]?.runsOffBat).toBe(1);

    const state = buildState(context, [original, later, correction]);
    expect(state.runs).toBe(7);
    // lastEventSeq follows the raw log so a client sees the correction arrive.
    expect(state.lastEventSeq).toBe(correction.seq);
  });

  it('drops an undone ball without deleting anything from the log', () => {
    reset();
    const first = ball({ runsOffBat: 4 });
    const mistake = ball({ runsOffBat: 6 });
    const undo = ball({ eventType: 'UNDO', supersedesEventId: mistake.id });

    const state = buildState(context, [first, mistake, undo]);

    expect(state.runs).toBe(4);
    expect(state.legalBalls).toBe(1);
  });
});

describe('buildState — the property the whole architecture rests on', () => {
  it('folding one ball at a time equals rebuilding from the log', () => {
    reset();
    const deliveries = [
      ball({ runsOffBat: 1 }),
      ball({ strikerId: 'bat2', nonStrikerId: 'bat1', extraType: 'WIDE', extraRuns: 1 }),
      ball({ strikerId: 'bat2', nonStrikerId: 'bat1', runsOffBat: 4 }),
      ball({
        strikerId: 'bat2',
        nonStrikerId: 'bat1',
        isWicket: true,
        wicketType: 'LBW',
        dismissedPlayerId: 'bat2',
      }),
    ];

    // This is exactly what the scorer's client does (applyBall on each tap)
    // versus what the server does on a cold cache (buildState over the log).
    // If these ever diverge, the optimistic UI lies.
    const incremental = deliveries.reduce(
      (state, delivery) => applyBall(state, delivery, context),
      createInitialState(context),
    );

    expect(incremental).toEqual(buildState(context, deliveries));
  });
});
