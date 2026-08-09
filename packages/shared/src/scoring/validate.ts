import { BALLS_PER_OVER } from '../constants';
import type { BallInput, InningsContext, MatchState } from '../types/scoring';
import { formatOvers, quotaBalls } from './format';

export interface ValidationIssue {
  code: string;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; issues: ValidationIssue[] };

export function validateBall(
  state: MatchState,
  input: BallInput,
  context: InningsContext,
  options: { matchStatus: string; previousOverBowlerId?: string | null } = {
    matchStatus: 'LIVE',
  },
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const fail = (code: string, message: string) => issues.push({ code, message });

  if (options.matchStatus !== 'LIVE') {
    fail('MATCH_NOT_LIVE', `The match is ${options.matchStatus.toLowerCase()}, not live`);
  }

  if (state.isComplete) {
    fail('INNINGS_COMPLETE', 'This innings has already ended');
  }

  const battingIds = new Set(context.battingXI.map((player) => player.id));
  const bowlingIds = new Set(context.bowlingXI.map((player) => player.id));

  if (!battingIds.has(input.strikerId)) {
    fail('STRIKER_NOT_IN_XI', 'The striker is not in the batting XI');
  }

  if (!battingIds.has(input.nonStrikerId)) {
    fail('NON_STRIKER_NOT_IN_XI', 'The non-striker is not in the batting XI');
  }

  if (input.strikerId === input.nonStrikerId) {
    fail('SAME_BATSMAN', 'The striker and non-striker cannot be the same player');
  }

  if (!bowlingIds.has(input.bowlerId)) {
    fail('BOWLER_NOT_IN_XI', 'The bowler is not in the bowling XI');
  }

  const striker = state.batsmen[input.strikerId];
  if (striker?.isOut) {
    fail('STRIKER_ALREADY_OUT', `${striker.name} is already out`);
  }

  const nonStriker = state.batsmen[input.nonStrikerId];
  if (nonStriker?.isOut) {
    fail('NON_STRIKER_ALREADY_OUT', `${nonStriker.name} is already out`);
  }

  if (
    state.thisOver.length === 0 &&
    options.previousOverBowlerId &&
    options.previousOverBowlerId === input.bowlerId
  ) {
    fail('CONSECUTIVE_OVERS', 'A bowler cannot bowl two overs in a row');
  }

  if (!Number.isInteger(input.runsOffBat) || input.runsOffBat < 0 || input.runsOffBat > 6) {
    fail('INVALID_RUNS', 'Runs off the bat must be a whole number between 0 and 6');
  }

  if (!Number.isInteger(input.extraRuns) || input.extraRuns < 0 || input.extraRuns > 10) {
    fail('INVALID_EXTRAS', 'Extra runs must be a whole number between 0 and 10');
  }

  const isWide = input.extraType === 'WIDE';
  const isNoBall = input.extraType === 'NO_BALL';

  if ((isWide || isNoBall) && input.extraRuns < 1) {
    fail('MISSING_PENALTY', 'A wide or no-ball always carries at least 1 run');
  }

  if (isWide && input.runsOffBat > 0) {
    fail('RUNS_OFF_WIDE', 'Runs cannot come off the bat on a wide');
  }

  if ((input.extraType === 'BYE' || input.extraType === 'LEG_BYE') && input.runsOffBat > 0) {
    fail('RUNS_OFF_BYE', 'Byes and leg-byes are not scored off the bat');
  }

  if (input.extraType === null && input.extraRuns > 0) {
    fail('EXTRAS_WITHOUT_TYPE', 'Extra runs need an extra type');
  }

  const legalThisOver = state.thisOver.filter((ball) => ball.isLegalDelivery).length;

  if (legalThisOver >= BALLS_PER_OVER) {
    fail('OVER_COMPLETE', 'This over already has six legal deliveries');
  }

  const quota = quotaBalls(context);

  if (state.legalBalls >= quota) {
    fail('QUOTA_EXHAUSTED', `The innings quota of ${formatOvers(quota)} overs is used up`);
  }

  if (input.isWicket) {
    if (!input.wicketType) {
      fail('MISSING_WICKET_TYPE', 'A wicket needs a dismissal type');
    }

    const dismissedId = input.dismissedPlayerId ?? input.strikerId;

    if (dismissedId !== input.strikerId && dismissedId !== input.nonStrikerId) {
      fail('DISMISSED_NOT_AT_CREASE', 'Only a batsman at the crease can be dismissed');
    }

    if (input.wicketType === 'RUN_OUT' && !input.fielderId) {
      fail('MISSING_FIELDER', 'A run-out needs the fielder who effected it');
    }

    if (input.wicketType === 'CAUGHT' && !input.fielderId) {
      fail('MISSING_FIELDER', 'A catch needs the fielder who took it');
    }

    if (input.fielderId && !bowlingIds.has(input.fielderId)) {
      fail('FIELDER_NOT_IN_XI', 'The fielder is not in the fielding XI');
    }

    if (isWide && !['RUN_OUT', 'STUMPED', 'OBSTRUCTING_FIELD'].includes(input.wicketType ?? '')) {
      fail('IMPOSSIBLE_WICKET', 'Only a run-out or stumping can happen off a wide');
    }

    if (isNoBall && !['RUN_OUT', 'OBSTRUCTING_FIELD'].includes(input.wicketType ?? '')) {
      fail('IMPOSSIBLE_WICKET', 'Only a run-out can happen off a no-ball');
    }
  } else if (input.wicketType || input.dismissedPlayerId) {
    fail('WICKET_FLAG_MISSING', 'Dismissal details were given but the ball is not a wicket');
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function isLegalDelivery(extraType: BallInput['extraType']): boolean {
  return extraType !== 'WIDE' && extraType !== 'NO_BALL';
}
