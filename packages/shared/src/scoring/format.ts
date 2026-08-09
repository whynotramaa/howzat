import { BALLS_PER_OVER } from '../constants';

export function formatOvers(balls: number): string {
  const completed = Math.floor(balls / BALLS_PER_OVER);
  const remainder = balls % BALLS_PER_OVER;
  return `${completed}.${remainder}`;
}

export function ballsToOvers(balls: number): number {
  return balls / BALLS_PER_OVER;
}

/**
 * The ball count an innings runs to. DLS can leave an innings owing a part-over
 * — 40.3, not 40 — so a revised `ballsQuota` wins over the whole-over figure
 * wherever one has been set.
 */
export function quotaBalls(innings: { oversQuota: number; ballsQuota?: number | null }): number {
  return innings.ballsQuota ?? innings.oversQuota * BALLS_PER_OVER;
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

export function requiredRunRate(runsNeeded: number, ballsRemaining: number): number | null {
  if (ballsRemaining <= 0) return null;
  return round2(runsNeeded / ballsToOvers(ballsRemaining));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatNrr(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(3)}`;
}

export function bowlingFigures(
  balls: number,
  maidens: number,
  runs: number,
  wickets: number,
): string {
  return `${formatOvers(balls)}-${maidens}-${runs}-${wickets}`;
}
