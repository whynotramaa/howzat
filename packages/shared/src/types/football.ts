import type { ClockStatus, FootballEventKind, FootballEventType } from './enums';
import type { PlayerRef, TeamRef } from './scoring';

/**
 * The football domain, expressed independently of Prisma so the reducer runs
 * unchanged in the browser, in the API, and in a test — the same discipline as
 * the cricket side.
 */

/** What a scorer submits for one incident. */
export interface FootballEventInput {
  clientEventId: string;
  kind: FootballEventKind;
  /**
   * The side credited with the event. For an own goal that is the side that
   * benefits — not the side of the player who put it in — which is exactly why
   * this is submitted rather than inferred from the player.
   */
  teamId: string;
  /** Null when nobody could say who it was, which at this level is common. */
  playerId: string | null;
  assistPlayerId: string | null;
}

/** An incident as stored: the input plus everything the server decided. */
export interface FootballEvent extends FootballEventInput {
  id: string;
  matchId: string;
  seq: number;
  eventType: FootballEventType;
  supersedesEventId: string | null;
  /** Frozen at write time from the clock; never recomputed. */
  minute: number;
  period: number;
  stoppage: number;
  createdBy: string;
  createdAt: string;
}

// ────────────────────────────────────────────────────────────  clock ──

/**
 * The clock as it crosses the wire.
 *
 * `elapsedMs` is time already banked in the current period and `runningSince`
 * is the instant the current run began, so a client computes the live figure
 * as `elapsedMs + (now − runningSince)`. Sending a single "current elapsed"
 * number instead would be a lie the moment it finished transmitting.
 */
export interface MatchClockDto {
  matchId: string;
  periods: number;
  periodMinutes: number;
  currentPeriod: number;
  status: ClockStatus;
  elapsedMs: number;
  /** ISO instant, or null whenever the clock is not RUNNING. */
  runningSince: string | null;
  /**
   * The server's clock at the moment it answered. A phone whose clock is three
   * minutes fast would otherwise render a match three minutes further along
   * than everybody else's; the client corrects for the skew with this.
   */
  serverNow: string;
}

/** A clock resolved to an instant — what actually gets rendered. */
export interface ClockReading {
  /** Milliseconds elapsed in the current period. */
  elapsedMs: number;
  /** The minute as it is spoken: 1-indexed, and cumulative across periods. */
  minute: number;
  seconds: number;
  /** Minutes past the end of regulation for this period — the "+3" in 45+3. */
  stoppage: number;
  period: number;
  isRunning: boolean;
  /** 0…1 through the current period, clamped — drives the ring. */
  progress: number;
  /** "67:12", or "45+2:40" once regulation time is up. */
  display: string;
  /** "45+2" or "67" — the minute stamped on an event. */
  minuteLabel: string;
}

// ──────────────────────────────────────────────────────────  lineups ──

/**
 * One player on the team sheet.
 *
 * A substitute is the same record with `slot: null` — they can be credited
 * with a goal or shown a card exactly like anybody else, they simply have no
 * place on the pitch graphic. Modelling the bench as an absent position rather
 * than as a separate type is what stops every consumer of a lineup from having
 * to handle two shapes of player.
 */
export interface LineupPlayer extends PlayerRef {
  /** 0 is the goalkeeper; the rest run back to front. Null for a substitute. */
  slot: number | null;
  shirtNumber: number | null;
  isCaptain: boolean;
  /** Normalised pitch coordinates, 0…1, own goal-line to halfway. */
  x: number;
  y: number;
  goals: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  /** True once sent off — the pitch graphic greys them out. */
  isSentOff: boolean;
}

export interface TeamLineup {
  team: TeamRef;
  formation: string;
  /** The starting side, in slot order. */
  players: LineupPlayer[];
  /** The bench, in the order it was named. */
  substitutes: LineupPlayer[];
}

// ───────────────────────────────────────────────────────────  state ──

/** One line of the match's story, as rendered in the timeline. */
export interface FootballIncident {
  id: string;
  seq: number;
  kind: FootballEventKind;
  teamId: string;
  playerId: string | null;
  playerName: string | null;
  assistPlayerId: string | null;
  assistPlayerName: string | null;
  minute: number;
  period: number;
  stoppage: number;
  /** "45+2'" — what appears beside the incident. */
  minuteLabel: string;
}

export interface FootballTeamState {
  teamId: string;
  goals: number;
  /** Shots this side's goalkeeper kept out. */
  saves: number;
  yellowCards: number;
  redCards: number;
  /** Player id → their tally, for the pitch graphic and the team sheet. */
  scorers: Record<string, number>;
  savesBy: Record<string, number>;
  cards: Record<string, { yellow: number; red: number }>;
  /** Sent off, either straight red or a second yellow. */
  sentOff: string[];
}

/**
 * The projection of a football match's event log. Produced by
 * buildFootballState and identical on server and client.
 */
export interface FootballMatchState {
  matchId: string;
  home: FootballTeamState;
  away: FootballTeamState;
  incidents: FootballIncident[];
  lastEventSeq: number;
}

/** The public snapshot cached in Redis under `football:{id}`. */
export interface FootballSnapshot {
  sport: 'FOOTBALL';
  matchId: string;
  publicSlug: string;
  status: string;
  tournamentName: string;
  home: {
    teamId: string;
    name: string;
    short: string;
    color: string;
    goals: number;
    saves: number;
    yellowCards: number;
    redCards: number;
  };
  away: {
    teamId: string;
    name: string;
    short: string;
    color: string;
    goals: number;
    saves: number;
    yellowCards: number;
    redCards: number;
  };
  clock: MatchClockDto | null;
  lineups: { home: TeamLineup | null; away: TeamLineup | null };
  incidents: FootballIncident[];
  resultText: string | null;
  lastEventSeq: number;
  updatedAt: string;
}

/**
 * The scorer's view. The console needs the squads to name a scorer and the
 * clock to stamp a minute; a spectator snapshot carries neither.
 */
export interface FootballScorerStateDto {
  matchId: string;
  status: string;
  home: { team: TeamRef; squad: PlayerRef[]; formation: string | null };
  away: { team: TeamRef; squad: PlayerRef[]; formation: string | null };
  state: FootballMatchState;
  clock: MatchClockDto | null;
  snapshot: FootballSnapshot | null;
}
