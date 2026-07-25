import { BALLS_PER_OVER } from '../constants';

/**
 * Overs are base-6. Every function here exists because the obvious arithmetic
 * is wrong: 16.5 + 0.1 is 17.0 on a scoreboard, not 16.6, and a team that has
 * faced 98 balls has bowled 16.333… overs for NRR but shows "16.2".
 */

/** Display form: 98 balls → "16.2". Never use this in arithmetic. */
export function formatOvers(balls: number): string {
  const completed = Math.floor(balls / BALLS_PER_OVER);
  const remainder = balls % BALLS_PER_OVER;
  return `${completed}.${remainder}`;
}

/** True fraction for run-rate and NRR: 98 balls → 16.333…, 6 balls → 1.0. */
export function ballsToOvers(balls: number): number {
  return balls / BALLS_PER_OVER;
}

export function oversToBalls(overs: number): number {
  return Math.round(overs * BALLS_PER_OVER);
}

/** The over number a ball belongs to, 0-indexed: ball 7 is in over 1. */
export function overNumberForBall(ballIndex: number): number {
  return Math.floor(ballIndex / BALLS_PER_OVER);
}

export function runRate(runs: number, balls: number): number {
  if (balls === 0) return 0;
  return round2(runs / ballsToOvers(balls));
}

export function strikeRate(runs: number, balls: number): number {
  if (balls === 0) return 0;
  return round2((runs / balls) * 100);
}

export function economy(runsConceded: number, balls: number): number {
  if (balls === 0) return 0;
  return round2(runsConceded / ballsToOvers(balls));
}

/**
 * Required run rate for a chase. Returns null when there is nothing left to
 * chase — a 0-balls-remaining RRR of Infinity is not a number to render.
 */
export function requiredRunRate(runsNeeded: number, ballsRemaining: number): number | null {
  if (ballsRemaining <= 0) return null;
  return round2(runsNeeded / ballsToOvers(ballsRemaining));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Three decimals, signed — the conventional presentation of NRR. */
export function formatNrr(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(3)}`;
}

/** "3.2-0-28-2" — the bowling figures line. */
export function bowlingFigures(
  balls: number,
  maidens: number,
  runs: number,
  wickets: number,
): string {
  return `${formatOvers(balls)}-${maidens}-${runs}-${wickets}`;
}
