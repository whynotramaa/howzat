/**
 * A single stoppage, recorded the way an ICC scorer fills in a DLS worksheet:
 * how much of the innings was left when the players walked off, how many
 * wickets were down at that moment, and how much was left when they came back.
 *
 * Everything DLS needs is expressible in this one shape:
 *
 * - a delayed start        — suspension at the full allotment, 0 wickets down
 * - a mid-innings stoppage — the ordinary case
 * - an innings called off  — resumption at 0 balls
 *
 * Balls rather than overs, because a stoppage does not wait for the end of an
 * over and 34.3 overs left is not a number the table can be indexed by.
 */
export interface DlsInterruption {
  id: string;
  inningsNumber: number;
  ballsRemainingAtSuspension: number;
  wicketsLost: number;
  ballsRemainingOnResumption: number;
  reason: string | null;
  createdAt: string;
}

/** One line of the resource arithmetic, kept so the console can show its working. */
export interface DlsResourceStep {
  interruptionId: string;
  ballsRemainingAtSuspension: number;
  wicketsLost: number;
  ballsRemainingOnResumption: number;
  resourceAtSuspension: number;
  resourceOnResumption: number;
  resourceLost: number;
  reason: string | null;
}

export interface DlsInningsResources {
  inningsNumber: number;
  /** The allotment when the innings began, in balls. */
  initialBalls: number;
  /** The allotment after every stoppage has been applied, in balls. */
  revisedBalls: number;
  /** R(initialBalls, 0) — what the side started with. */
  startingResource: number;
  /** The sum of every step's `resourceLost`. */
  lostResource: number;
  /** startingResource − lostResource: the side's resource for the whole innings. */
  availableResource: number;
  steps: DlsResourceStep[];
}

export type DlsTargetMethod = 'RATIO' | 'G50';

export interface DlsTargetCalculation {
  team1Score: number;
  team1Resource: number;
  team2Resource: number;
  g50: number;
  method: DlsTargetMethod;
  /** The unrounded DLS figure, kept for the audit trail. */
  rawPar: number;
  /** The score that ties, whole runs. */
  parScore: number;
  /** parScore + 1 — the score that wins. */
  target: number;
}

/** Where a rain-shortened chase stands right now, against the DLS par score. */
export interface DlsParPosition {
  parScore: number;
  runsScored: number;
  /** Positive means the chasing side is ahead of par. */
  difference: number;
  ballsRemaining: number;
  wicketsLost: number;
  resourceUsed: number;
}

/** The slice of DLS a public viewer needs: what par is, and what to chase. */
export interface DlsSnapshot {
  applied: boolean;
  /** Present during the chase — the score that would tie if play stopped now. */
  par: number | null;
  /** Runs ahead of par; negative is behind. */
  difference: number | null;
  revisedTarget: number | null;
  /** The revised allotment as cricket writes it, e.g. "40.3". */
  revisedOvers: string | null;
  decided: boolean;
}

export interface DlsStateDto {
  matchId: string;
  applied: boolean;
  g50: number;
  /** The full-length allotment the match was scheduled for, in overs. */
  scheduledOvers: number;
  /** Overs the chasing side must face before DLS can decide the match. */
  minimumOversForResult: number;
  interruptions: DlsInterruption[];
  firstInnings: DlsInningsResources | null;
  secondInnings: DlsInningsResources | null;
  /**
   * Whether the chase has actually been set up. The second innings' resources
   * are projected from the moment DLS is switched on, long before there is an
   * innings to attach a stoppage to.
   */
  hasSecondInnings: boolean;
  /** Present once the first innings is complete and a revised target exists. */
  calculation: DlsTargetCalculation | null;
  /** Present while the second innings is live or finished. */
  par: DlsParPosition | null;
  decidedByDls: boolean;
}
