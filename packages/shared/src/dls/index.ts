/**
 * Duckworth-Lewis-Stern, Standard Edition.
 *
 * ## What this is, exactly
 *
 * DLS ships in two editions. The Professional Edition, which the ICC uses for
 * internationals, is a closed program: its parameters are not published, so no
 * one outside the licence can reimplement it. The Standard Edition is the
 * published resource table, and it is what the ICC's own playing conditions
 * fall back to whenever the Professional Edition software is not available at
 * the ground — which is every match this app is likely to score.
 *
 * So this is the Standard Edition, implemented to the letter:
 *
 * - the published resource table, unrounded and unabridged (`./table.ts`)
 * - resources accounted per stoppage, not per innings, so any number of
 *   interruptions in either innings compose correctly
 * - the ratio formula when the chasing side has no more resource than the side
 *   batting first, and the G50 formula when it has more
 * - par floored to whole runs, target one more than par
 *
 * The two editions agree closely at ordinary totals and diverge only for very
 * high first-innings scores, where the Professional Edition sets a steeper
 * target. Below international level the Standard Edition figure *is* the
 * official one, so there is no disparity to answer for.
 */
import { BALLS_PER_OVER } from '../constants';
import type {
  DlsInningsResources,
  DlsInterruption,
  DlsParPosition,
  DlsResourceStep,
  DlsTargetCalculation,
} from '../types/dls';
import type { ValidationIssue, ValidationResult } from '../scoring/validate';
import { DLS_RESOURCE_TABLE, DLS_TABLE_MAX_OVERS } from './table';

export { DLS_RESOURCE_TABLE, DLS_TABLE_MAX_OVERS } from './table';

/** Ten down is all out, whatever the table's last column says. */
const ALL_OUT_WICKETS = 10;

/**
 * G50: the average first-innings score in a 50-over match at this level of
 * cricket. It is only ever consulted when the side batting second ends up with
 * *more* resource than the side batting first — a first-innings washout, in
 * practice — so most matches never touch it.
 *
 * 245 is the ICC's published figure for men's 50-over internationals and 200 is
 * the figure the T20 playing conditions carry. Anything between the two is
 * interpolated on innings length rather than invented, and the scorer can
 * override it for their own competition, which is what the Standard Edition
 * documentation asks them to do.
 */
export const G50_FIFTY_OVER = 245;
export const G50_TWENTY_OVER = 200;

export function defaultG50(oversPerInnings: number): number {
  if (oversPerInnings >= 50) return G50_FIFTY_OVER;
  if (oversPerInnings <= 20) return G50_TWENTY_OVER;

  const span = (oversPerInnings - 20) / 30;
  return Math.round(G50_TWENTY_OVER + span * (G50_FIFTY_OVER - G50_TWENTY_OVER));
}

/**
 * How many overs the chasing side must face before DLS is allowed to decide the
 * match. The ICC sets this at 20 overs for a 50-over game and 5 for a T20; the
 * split at 25 overs reproduces both exactly and gives shorter club formats the
 * five-over floor rather than an unreachable one.
 */
export function minimumOversForResult(oversPerInnings: number): number {
  return oversPerInnings >= 25 ? 20 : 5;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function tableValue(overs: number, wicketsLost: number): number {
  const row = DLS_RESOURCE_TABLE[overs];
  if (!row) return 0;
  return row[wicketsLost] ?? 0;
}

/**
 * The percentage of its resource a side still holds with `ballsRemaining` left
 * and `wicketsLost` down.
 *
 * The published table is indexed by whole overs. A stoppage does not wait for
 * the end of an over, so part-overs are read off by straight-line interpolation
 * between the two rows either side — the same thing the Standard Edition
 * worksheet asks a scorer to do by hand.
 */
export function resourcePercentage(ballsRemaining: number, wicketsLost: number): number {
  if (wicketsLost >= ALL_OUT_WICKETS) return 0;
  if (ballsRemaining <= 0) return 0;

  const wickets = Math.max(0, Math.trunc(wicketsLost));
  const overs = Math.min(ballsRemaining / BALLS_PER_OVER, DLS_TABLE_MAX_OVERS);

  const lower = Math.floor(overs);
  const upper = Math.ceil(overs);

  if (lower === upper) return round2(tableValue(lower, wickets));

  const fraction = overs - lower;
  const value = tableValue(lower, wickets) * (1 - fraction) + tableValue(upper, wickets) * fraction;

  return round2(value);
}

export const oversToBalls = (overs: number): number => Math.round(overs * BALLS_PER_OVER);

export interface DlsInningsInput {
  inningsNumber: number;
  /** The allotment when the innings began, in balls. */
  initialBalls: number;
  /** Chronological. Validate with `validateInterruptions` before trusting it. */
  interruptions: DlsInterruption[];
}

/**
 * Walk an innings' stoppages and total up the resource they cost.
 *
 * A side starts with R(its allotment, 0 wickets). Each stoppage costs it the
 * difference between the resource it held when play was suspended and the
 * resource it holds when play resumes — the wickets column does not move,
 * because no one is dismissed in the rain. What is left is the resource the
 * innings is worth.
 */
export function computeInningsResources(input: DlsInningsInput): DlsInningsResources {
  const startingResource = resourcePercentage(input.initialBalls, 0);

  const steps: DlsResourceStep[] = [];
  let allotted = input.initialBalls;
  let lostResource = 0;

  for (const interruption of input.interruptions) {
    const suspension = clampBalls(interruption.ballsRemainingAtSuspension, allotted);
    const resumption = clampBalls(interruption.ballsRemainingOnResumption, suspension);
    const wickets = Math.max(0, Math.trunc(interruption.wicketsLost));

    const resourceAtSuspension = resourcePercentage(suspension, wickets);
    const resourceOnResumption = resourcePercentage(resumption, wickets);
    const resourceLost = round2(Math.max(0, resourceAtSuspension - resourceOnResumption));

    steps.push({
      interruptionId: interruption.id,
      ballsRemainingAtSuspension: suspension,
      wicketsLost: wickets,
      ballsRemainingOnResumption: resumption,
      resourceAtSuspension,
      resourceOnResumption,
      resourceLost,
      reason: interruption.reason,
    });

    lostResource = round2(lostResource + resourceLost);
    allotted = allotted - suspension + resumption;
  }

  return {
    inningsNumber: input.inningsNumber,
    initialBalls: input.initialBalls,
    revisedBalls: allotted,
    startingResource,
    lostResource,
    availableResource: round2(Math.max(0, startingResource - lostResource)),
    steps,
  };
}

function clampBalls(value: number, ceiling: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.round(value)), ceiling);
}

/**
 * Reject a stoppage that could not have happened, before it is written down.
 *
 * A scorer typing 38 overs left into a 20-over game, or resuming with more
 * overs than were left when the players walked off, is a mistake that would
 * otherwise silently corrupt the target, so it is caught here rather than
 * absorbed by the clamping in `computeInningsResources`.
 */
export function validateInterruptions(input: DlsInningsInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const fail = (code: string, message: string) => issues.push({ code, message });

  let allotted = input.initialBalls;
  let previousBallsBowled = -1;

  for (const [index, interruption] of input.interruptions.entries()) {
    const position = `Stoppage ${index + 1}`;
    const suspension = interruption.ballsRemainingAtSuspension;
    const resumption = interruption.ballsRemainingOnResumption;

    if (!Number.isInteger(suspension) || suspension < 0) {
      fail('DLS_BAD_SUSPENSION', `${position}: balls remaining must be a whole number`);
      continue;
    }

    if (!Number.isInteger(resumption) || resumption < 0) {
      fail('DLS_BAD_RESUMPTION', `${position}: balls on resumption must be a whole number`);
      continue;
    }

    if (suspension > allotted) {
      fail(
        'DLS_SUSPENSION_TOO_LONG',
        `${position}: only ${formatBalls(allotted)} overs were left to bowl at that point, not ${formatBalls(suspension)}`,
      );
      continue;
    }

    if (resumption > suspension) {
      fail(
        'DLS_RESUMPTION_TOO_LONG',
        `${position}: play cannot resume with more overs left than when it stopped`,
      );
      continue;
    }

    if (interruption.wicketsLost < 0 || interruption.wicketsLost >= ALL_OUT_WICKETS) {
      fail('DLS_BAD_WICKETS', `${position}: wickets down must be between 0 and 9`);
      continue;
    }

    const ballsBowled = allotted - suspension;

    if (ballsBowled < previousBallsBowled) {
      fail('DLS_OUT_OF_ORDER', `${position}: stoppages must be recorded in the order they happened`);
      continue;
    }

    previousBallsBowled = ballsBowled;
    allotted = ballsBowled + resumption;
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function formatBalls(balls: number): string {
  return `${Math.floor(balls / BALLS_PER_OVER)}.${balls % BALLS_PER_OVER}`;
}

export interface DlsTargetInput {
  team1Score: number;
  team1Resource: number;
  team2Resource: number;
  g50: number;
}

/**
 * The revised target.
 *
 * Two formulae, and which one applies is decided purely by whose resource is
 * larger:
 *
 * - the chasing side has no more resource than the side batting first, so its
 *   task is scaled down in proportion — `S1 × R2 / R1`
 * - the chasing side has *more* resource, which no amount of scaling can
 *   express, so the extra resource is converted into runs at the level's
 *   average scoring rate — `S1 + G50 × (R2 − R1) / 100`
 *
 * Par is the figure floored to whole runs — the score that ties — and the
 * target is one run more. Flooring rather than rounding is what makes an
 * exactly-equal-resources match come out at "score one more than they did"
 * instead of handing the chasing side a tie it did not earn.
 */
export function computeDlsTarget(input: DlsTargetInput): DlsTargetCalculation {
  const { team1Score, team1Resource, team2Resource, g50 } = input;

  const method = team2Resource > team1Resource ? 'G50' : 'RATIO';

  const rawPar =
    method === 'G50'
      ? team1Score + (g50 * (team2Resource - team1Resource)) / 100
      : team1Resource > 0
        ? (team1Score * team2Resource) / team1Resource
        : 0;

  const parScore = Math.max(0, Math.floor(round2(rawPar)));

  return {
    team1Score,
    team1Resource,
    team2Resource,
    g50,
    method,
    rawPar: round2(rawPar),
    parScore,
    target: parScore + 1,
  };
}

export interface DlsParInput extends DlsTargetInput {
  /** The chasing side's resource for the whole innings, from `computeInningsResources`. */
  team2Resource: number;
  runsScored: number;
  ballsRemaining: number;
  wicketsLost: number;
}

/**
 * Where the chase stands right now against DLS par.
 *
 * The par score at any point in an innings is worked from the resource the
 * chasing side has *used*, not the resource it was given: everything it has
 * spent, priced at the same rate the first innings was. This is the number that
 * decides a match abandoned mid-chase, and the one that belongs on the
 * scoreboard while the rain is still a threat.
 */
export function computeParPosition(input: DlsParInput): DlsParPosition {
  const remaining = resourcePercentage(input.ballsRemaining, input.wicketsLost);
  const resourceUsed = round2(Math.max(0, input.team2Resource - remaining));

  const { parScore } = computeDlsTarget({
    team1Score: input.team1Score,
    team1Resource: input.team1Resource,
    team2Resource: resourceUsed,
    g50: input.g50,
  });

  return {
    parScore,
    runsScored: input.runsScored,
    difference: input.runsScored - parScore,
    ballsRemaining: input.ballsRemaining,
    wicketsLost: input.wicketsLost,
    resourceUsed,
  };
}
