import { BALLS_PER_OVER } from '../constants';
import type {
  BallEvent,
  BallSummary,
  BatsmanState,
  BowlerState,
  InningsContext,
  MatchState,
} from '../types/scoring';
import type { WicketType } from '../types/enums';
import { formatOvers } from './format';

export const BOWLER_CREDITED: ReadonlySet<WicketType> = new Set<WicketType>([
  'BOWLED',
  'CAUGHT',
  'LBW',
  'STUMPED',
  'HIT_WICKET',
]);

const RECENT_BALLS_KEPT = 30;

export function createInitialState(context: InningsContext): MatchState {
  return {
    inningsId: context.inningsId,
    matchId: context.matchId,
    inningsNumber: context.number,

    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },

    batsmen: {},
    bowlers: {},

    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,

    needsNewBatsman: false,
    needsNewBowler: false,

    thisOver: [],
    currentOverNumber: 0,
    currentOverBowlerRuns: 0,
    recentBalls: [],
    fallOfWickets: [],
    partnerships: [],

    isComplete: false,
    endReason: null,

    targetRuns: context.targetRuns,
    oversQuota: context.oversQuota,
    lastEventSeq: 0,
  };
}

export function materializeEvents(events: BallEvent[]): BallEvent[] {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  const replacements = new Map<string, BallEvent>();
  const removed = new Set<string>();

  for (const event of ordered) {
    if (!event.supersedesEventId) continue;

    if (event.eventType === 'CORRECTION') {
      replacements.set(event.supersedesEventId, event);
    } else if (event.eventType === 'UNDO') {
      removed.add(event.supersedesEventId);
    }
  }

  const result: BallEvent[] = [];

  for (const event of ordered) {
    if (event.eventType !== 'BALL') continue;
    if (removed.has(event.id)) continue;

    const replacement = replacements.get(event.id);

    if (replacement) {
      result.push({
        ...replacement,
        overNumber: event.overNumber,
        ballNumber: event.ballNumber,
      });
    } else {
      result.push(event);
    }
  }

  return result;
}

export function buildState(context: InningsContext, events: BallEvent[]): MatchState {
  const deliveries = materializeEvents(events);

  let state = createInitialState(context);
  for (const delivery of deliveries) {
    state = applyBall(state, delivery, context);
  }

  const highestSeq = events.reduce((max, event) => Math.max(max, event.seq), 0);

  return { ...state, lastEventSeq: highestSeq };
}

export function applyBall(
  state: MatchState,
  event: BallEvent,
  context: InningsContext,
): MatchState {
  if (state.isComplete) return state;

  const isWide = event.extraType === 'WIDE';
  const isNoBall = event.extraType === 'NO_BALL';
  const isLegal = !isWide && !isNoBall;

  const teamRuns = event.runsOffBat + event.extraRuns;

  const bowlerRuns = event.runsOffBat + (isWide || isNoBall ? event.extraRuns : 0);

  const facedDelivery = !isWide;

  const runsRun = isWide
    ? Math.max(0, event.extraRuns - 1)
    : isNoBall
      ? event.runsOffBat + Math.max(0, event.extraRuns - 1)
      : event.runsOffBat + event.extraRuns;

  const batsmen = { ...state.batsmen };
  const bowlers = { ...state.bowlers };

  const striker = ensureBatsman(batsmen, event.strikerId, context);
  ensureBatsman(batsmen, event.nonStrikerId, context);
  const bowler = ensureBowler(bowlers, event.bowlerId, context);

  batsmen[event.strikerId] = {
    ...striker,
    runs: striker.runs + event.runsOffBat,
    balls: striker.balls + (facedDelivery ? 1 : 0),
    fours: striker.fours + (event.runsOffBat === 4 ? 1 : 0),
    sixes: striker.sixes + (event.runsOffBat === 6 ? 1 : 0),
  };

  bowlers[event.bowlerId] = {
    ...bowler,
    balls: bowler.balls + (isLegal ? 1 : 0),
    runs: bowler.runs + bowlerRuns,
    dots: bowler.dots + (isLegal && teamRuns === 0 ? 1 : 0),
    wides: bowler.wides + (isWide ? 1 : 0),
    noBalls: bowler.noBalls + (isNoBall ? 1 : 0),
  };

  const extras = { ...state.extras };
  if (isWide) extras.wides += event.extraRuns;
  else if (isNoBall) extras.noBalls += event.extraRuns;
  else if (event.extraType === 'BYE') extras.byes += event.extraRuns;
  else if (event.extraType === 'LEG_BYE') extras.legByes += event.extraRuns;
  extras.total = extras.wides + extras.noBalls + extras.byes + extras.legByes;

  const runs = state.runs + teamRuns;
  const legalBalls = state.legalBalls + (isLegal ? 1 : 0);
  let wickets = state.wickets;

  const fallOfWickets = [...state.fallOfWickets];
  let needsNewBatsman = false;

  if (event.isWicket) {
    wickets += 1;

    const dismissedId = event.dismissedPlayerId ?? event.strikerId;
    const dismissed = ensureBatsman(batsmen, dismissedId, context);

    batsmen[dismissedId] = {
      ...dismissed,
      isOut: true,
      dismissal: describeDismissal(event, context),
    };

    if (event.wicketType && BOWLER_CREDITED.has(event.wicketType)) {
      const current = bowlers[event.bowlerId]!;
      bowlers[event.bowlerId] = { ...current, wickets: current.wickets + 1 };
    }

    fallOfWickets.push({
      wicket: wickets,
      playerId: dismissedId,
      name: dismissed.name,
      teamRuns: runs,
      overs: formatOvers(legalBalls),
    });

    needsNewBatsman = true;
  }

  let strikerId: string | null = event.strikerId;
  let nonStrikerId: string | null = event.nonStrikerId;

  if (runsRun % 2 === 1) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }

  const overJustEnded = isLegal && legalBalls % BALLS_PER_OVER === 0 && legalBalls > 0;

  if (overJustEnded) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }

  const summary = summarize(event, teamRuns);
  const thisOver = overJustEnded ? [] : [...state.thisOver, summary];

  const overBowlerRuns = state.currentOverBowlerRuns + bowlerRuns;

  if (overJustEnded && overBowlerRuns === 0) {
    const current = bowlers[event.bowlerId]!;
    bowlers[event.bowlerId] = { ...current, maidens: current.maidens + 1 };
  }

  const recentBalls = [...state.recentBalls, summary].slice(-RECENT_BALLS_KEPT);

  const vacatedId = event.isWicket ? (event.dismissedPlayerId ?? event.strikerId) : null;
  if (vacatedId !== null && vacatedId === strikerId) strikerId = null;
  if (vacatedId !== null && vacatedId === nonStrikerId) nonStrikerId = null;

  const partnerships = updatePartnerships(state, event, teamRuns, facedDelivery);

  const wicketsAllowed = Math.max(1, context.battingXI.length - 1);
  const quotaBalls = context.oversQuota * BALLS_PER_OVER;
  const target = context.targetRuns;

  let isComplete = false;
  let endReason: MatchState['endReason'] = null;

  if (target !== null && runs >= target) {
    isComplete = true;
    endReason = 'TARGET_CHASED';
  } else if (wickets >= wicketsAllowed) {
    isComplete = true;
    endReason = 'ALL_OUT';
  } else if (legalBalls >= quotaBalls) {
    isComplete = true;
    endReason = 'OVERS_COMPLETE';
  }

  return {
    ...state,
    runs,
    wickets,
    legalBalls,
    extras,
    batsmen,
    bowlers,
    strikerId,
    nonStrikerId,
    bowlerId: event.bowlerId,
    needsNewBatsman: isComplete ? false : needsNewBatsman,
    needsNewBowler: isComplete ? false : overJustEnded,
    thisOver,
    currentOverNumber: overJustEnded ? state.currentOverNumber + 1 : state.currentOverNumber,
    currentOverBowlerRuns: overJustEnded ? 0 : overBowlerRuns,
    recentBalls,
    fallOfWickets,
    partnerships,
    isComplete,
    endReason,
    lastEventSeq: Math.max(state.lastEventSeq, event.seq),
  };
}

function ensureBatsman(
  batsmen: Record<string, BatsmanState>,
  playerId: string,
  context: InningsContext,
): BatsmanState {
  const existing = batsmen[playerId];
  if (existing) return existing;

  const created: BatsmanState = {
    playerId,
    name: nameOf(context.battingXI, playerId),
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
    dismissal: null,
    position: Object.keys(batsmen).length + 1,
  };

  batsmen[playerId] = created;
  return created;
}

function ensureBowler(
  bowlers: Record<string, BowlerState>,
  playerId: string,
  context: InningsContext,
): BowlerState {
  const existing = bowlers[playerId];
  if (existing) return existing;

  const created: BowlerState = {
    playerId,
    name: nameOf(context.bowlingXI, playerId),
    balls: 0,
    maidens: 0,
    runs: 0,
    wickets: 0,
    dots: 0,
    wides: 0,
    noBalls: 0,
  };

  bowlers[playerId] = created;
  return created;
}

function nameOf(squad: InningsContext['battingXI'], playerId: string): string {
  return squad.find((player) => player.id === playerId)?.name ?? 'Unknown player';
}

function updatePartnerships(
  state: MatchState,
  event: BallEvent,
  teamRuns: number,
  facedDelivery: boolean,
): MatchState['partnerships'] {
  const pair: [string, string] = [event.strikerId, event.nonStrikerId];
  const partnerships = state.partnerships.map((partnership) => ({ ...partnership }));
  const current = partnerships[partnerships.length - 1];

  const samePair =
    current !== undefined &&
    current.isCurrent &&
    current.batsmanIds.includes(pair[0]) &&
    current.batsmanIds.includes(pair[1]);

  if (samePair && current) {
    current.runs += teamRuns;
    current.balls += facedDelivery ? 1 : 0;
  } else {
    if (current) current.isCurrent = false;
    partnerships.push({
      runs: teamRuns,
      balls: facedDelivery ? 1 : 0,
      batsmanIds: pair,
      isCurrent: true,
    });
  }

  if (event.isWicket) {
    const last = partnerships[partnerships.length - 1];
    if (last) last.isCurrent = false;
  }

  return partnerships;
}

function summarize(event: BallEvent, teamRuns: number): BallSummary {
  return {
    seq: event.seq,
    overNumber: event.overNumber,
    ballNumber: event.ballNumber,
    display: displayFor(event),
    runs: teamRuns,
    isWicket: event.isWicket,
    extraType: event.extraType,
    isLegalDelivery: event.extraType !== 'WIDE' && event.extraType !== 'NO_BALL',
  };
}

function displayFor(event: BallEvent): string {
  if (event.isWicket && event.extraType === null) {
    return event.runsOffBat > 0 ? `${event.runsOffBat}W` : 'W';
  }

  switch (event.extraType) {
    case 'WIDE': {
      const extra = event.extraRuns - 1;
      return extra > 0 ? `${extra}wd` : 'wd';
    }
    case 'NO_BALL': {
      const off = event.runsOffBat + Math.max(0, event.extraRuns - 1);
      const glyph = off > 0 ? `${off}nb` : 'nb';
      return event.isWicket ? `${glyph}W` : glyph;
    }
    case 'BYE':
      return `${event.extraRuns}b`;
    case 'LEG_BYE':
      return `${event.extraRuns}lb`;
    default:
      return event.runsOffBat === 0 ? '·' : String(event.runsOffBat);
  }
}

function describeDismissal(event: BallEvent, context: InningsContext): string {
  const bowler = nameOf(context.bowlingXI, event.bowlerId);
  const fielder = event.fielderId ? nameOf(context.bowlingXI, event.fielderId) : null;

  switch (event.wicketType) {
    case 'BOWLED':
      return `b ${bowler}`;
    case 'CAUGHT':
      return fielder ? `c ${fielder} b ${bowler}` : `c & b ${bowler}`;
    case 'LBW':
      return `lbw b ${bowler}`;
    case 'STUMPED':
      return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`;
    case 'HIT_WICKET':
      return `hit wicket b ${bowler}`;
    case 'RUN_OUT':
      return fielder ? `run out (${fielder})` : 'run out';
    case 'RETIRED_HURT':
      return 'retired hurt';
    case 'OBSTRUCTING_FIELD':
      return 'obstructing the field';
    default:
      return 'out';
  }
}
