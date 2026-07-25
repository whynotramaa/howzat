import type { ExtraType, InningsEndReason, WicketType, BallEventType } from './enums';

/**
 * The scoring domain, expressed independently of Prisma so the reducer can run
 * unchanged in the browser, in the API, and in a test.
 */

export interface PlayerRef {
  id: string;
  name: string;
}

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
}

/** What a scorer submits for one delivery. */
export interface BallInput {
  clientEventId: string;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  runsOffBat: number;
  /** Includes the automatic 1-run penalty for a wide or no-ball. */
  extraRuns: number;
  extraType: ExtraType | null;
  isWicket: boolean;
  wicketType: WicketType | null;
  dismissedPlayerId: string | null;
  fielderId: string | null;
}

/** A ball as stored: the input plus everything the server decides. */
export interface BallEvent extends BallInput {
  id: string;
  inningsId: string;
  seq: number;
  overNumber: number;
  ballNumber: number;
  eventType: BallEventType;
  supersedesEventId: string | null;
  isLegalDelivery: boolean;
  createdBy: string;
  createdAt: string;
}

/** Everything the reducer needs that is not in the event log itself. */
export interface InningsContext {
  inningsId: string;
  matchId: string;
  number: number;
  battingTeam: TeamRef;
  bowlingTeam: TeamRef;
  oversQuota: number;
  targetRuns: number | null;
  /** The batting XI, in batting order. */
  battingXI: PlayerRef[];
  bowlingXI: PlayerRef[];
}

export interface BatsmanState {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  /** "c Kohli b Bumrah", assembled at dismissal. */
  dismissal: string | null;
  /** Order of arrival at the crease, 1-indexed. */
  position: number;
}

export interface BowlerState {
  playerId: string;
  name: string;
  /** Legal deliveries only — wides and no-balls do not count towards an over. */
  balls: number;
  maidens: number;
  /** Runs charged to the bowler: byes and leg-byes are excluded. */
  runs: number;
  wickets: number;
  dots: number;
  wides: number;
  noBalls: number;
}

/** One entry in the over ticker: "1", "W", "4", "wd", "·". */
export interface BallSummary {
  seq: number;
  overNumber: number;
  ballNumber: number;
  display: string;
  runs: number;
  isWicket: boolean;
  extraType: ExtraType | null;
  isLegalDelivery: boolean;
}

export interface FallOfWicket {
  wicket: number;
  playerId: string;
  name: string;
  /** Team score when the wicket fell. */
  teamRuns: number;
  overs: string;
}

export interface Partnership {
  runs: number;
  balls: number;
  batsmanIds: [string, string];
  isCurrent: boolean;
}

export interface ExtrasBreakdown {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  total: number;
}

/**
 * The projection of an innings' event log. Produced by buildState, updated
 * incrementally by applyBall, and identical on server and client.
 */
export interface MatchState {
  inningsId: string;
  matchId: string;
  inningsNumber: number;

  runs: number;
  wickets: number;
  /** Legal deliveries bowled. Overs are derived, never stored as a decimal. */
  legalBalls: number;
  extras: ExtrasBreakdown;

  batsmen: Record<string, BatsmanState>;
  bowlers: Record<string, BowlerState>;

  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;

  /** True once a wicket falls: the scorer must name the incoming batsman. */
  needsNewBatsman: boolean;
  /** True at an over boundary: the scorer must name the next bowler. */
  needsNewBowler: boolean;

  thisOver: BallSummary[];
  /** The over currently in progress, 0-indexed. */
  currentOverNumber: number;
  /**
   * Runs charged to the bowler in the current over. Tracked here rather than
   * derived from thisOver because a maiden ignores byes and leg-byes, which
   * the ticker summaries do not distinguish.
   */
  currentOverBowlerRuns: number;
  recentBalls: BallSummary[];
  fallOfWickets: FallOfWicket[];
  partnerships: Partnership[];

  isComplete: boolean;
  endReason: InningsEndReason | null;

  targetRuns: number | null;
  oversQuota: number;
  lastEventSeq: number;
}

/** The public snapshot cached in Redis under match:{id}. */
export interface MatchSnapshot {
  matchId: string;
  publicSlug: string;
  status: string;
  inningsNumber: number;
  batting: {
    teamId: string;
    name: string;
    short: string;
    color: string;
    runs: number;
    wickets: number;
    overs: string;
    balls: number;
    runRate: number;
    /**
     * The innings' full allotment, so a viewer can see how much of it is gone.
     * Optional because snapshots written before it existed are still sitting in
     * Redis under a six-hour TTL, and a live match must not break while they
     * age out — the UI drops the overs gauge rather than showing a wrong one.
     */
    oversQuota?: number;
  };
  bowling: { teamId: string; name: string; short: string; color: string };
  target: number | null;
  required: { runs: number; balls: number; rrr: number } | null;
  batsmen: Array<{
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    sr: number;
    onStrike: boolean;
  }>;
  bowler: {
    playerId: string;
    name: string;
    overs: string;
    maidens: number;
    runs: number;
    wickets: number;
    econ: number;
  } | null;
  thisOver: string[];
  recentBalls: BallSummary[];
  extras: ExtrasBreakdown;
  fallOfWickets: FallOfWicket[];
  resultText: string | null;
  lastEventSeq: number;
  updatedAt: string;
}
