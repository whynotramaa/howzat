import type { ExtraType, InningsEndReason, WicketType, BallEventType } from './enums';

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

export interface BallInput {
  clientEventId: string;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  runsOffBat: number;
  extraRuns: number;
  extraType: ExtraType | null;
  isWicket: boolean;
  wicketType: WicketType | null;
  dismissedPlayerId: string | null;
  fielderId: string | null;
}

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

export interface InningsContext {
  inningsId: string;
  matchId: string;
  number: number;
  battingTeam: TeamRef;
  bowlingTeam: TeamRef;
  oversQuota: number;
  targetRuns: number | null;
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
  dismissal: string | null;
  position: number;
}

export interface BowlerState {
  playerId: string;
  name: string;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  dots: number;
  wides: number;
  noBalls: number;
}

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

export interface MatchState {
  inningsId: string;
  matchId: string;
  inningsNumber: number;

  runs: number;
  wickets: number;
  legalBalls: number;
  extras: ExtrasBreakdown;

  batsmen: Record<string, BatsmanState>;
  bowlers: Record<string, BowlerState>;

  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;

  needsNewBatsman: boolean;
  needsNewBowler: boolean;

  thisOver: BallSummary[];
  currentOverNumber: number;
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
