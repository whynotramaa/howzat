import type {
  InningsEndReason,
  InningsStatus,
  MatchStage,
  MatchStatus,
  NotificationType,
  PlayerRole,
  TossDecision,
  TournamentFormat,
  TournamentStatus,
} from './enums';
import type { InningsContext, MatchState, TeamRef } from './scoring';

/**
 * API response shapes. These are the contract between apps/api and apps/web —
 * the API's serializers are typed against them, and the web client's fetch
 * wrapper returns them. Dates cross the wire as ISO strings, never as Date.
 */

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  createdAt: string;
}

/** The subset of a user that is safe to show to another user. */
export interface UserRef {
  id: string;
  username: string;
  name: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  /** Seconds until accessToken expires; the client refreshes just before. */
  expiresIn: number;
}

export interface TournamentDto {
  id: string;
  organizerId: string;
  name: string;
  format: TournamentFormat;
  teamsCount: number;
  oversPerInnings: number;
  doubleRoundRobin: boolean;
  status: TournamentStatus;
  createdAt: string;
  /** Present on list/detail reads so the UI can show setup progress. */
  registeredTeams?: number;
  eligibleTeams?: number;
}

export interface TeamDto {
  id: string;
  tournamentId: string;
  name: string;
  shortName: string;
  primaryColor: string;
  createdAt: string;
  /** Derived, not stored — see assertTeamEligible on the API side. */
  playerCount: number;
  isEligible: boolean;
}

export interface PlayerDto {
  id: string;
  teamId: string;
  name: string;
  /** A real account's handle, or a generated `guest_…` placeholder. */
  username: string;
  /** False for a placeholder — nothing links this slot to a profile. */
  isRegistered: boolean;
  userId: string | null;
  role: PlayerRole;
  battingStyle: string | null;
  bowlingStyle: string | null;
  createdAt: string;
}

export interface TeamWithPlayersDto extends TeamDto {
  players: PlayerDto[];
}

export interface MatchTeamRef {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
}

export interface MatchDto {
  id: string;
  tournamentId: string;
  round: number;
  stage: MatchStage;
  team1: MatchTeamRef | null;
  team2: MatchTeamRef | null;
  scheduledAt: string | null;
  venue: string | null;
  status: MatchStatus;
  tossWinnerId: string | null;
  tossDecision: TossDecision | null;
  oversPerInnings: number;
  winnerTeamId: string | null;
  resultText: string | null;
  publicSlug: string;
  scorers: UserRef[];
  currentInnings: number | null;
}

/** One row of the points table, as rendered. */
export interface StandingsRowDto {
  position: number;
  team: MatchTeamRef;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  /** The NRR inputs are exposed so a disputed number can be traced. */
  runsScored: number;
  oversFaced: string;
  runsConceded: number;
  oversBowled: string;
  nrr: number;
  nrrText: string;
}

/** What fixture generation will produce, shown before anything is written. */
export interface FixturePreviewDto {
  rounds: Array<{
    round: number;
    matches: Array<{ home: MatchTeamRef; away: MatchTeamRef }>;
  }>;
  playoffs: Array<{ stage: MatchStage; label: string; description: string }>;
  totalMatches: number;
}

export interface InningsDto {
  id: string;
  matchId: string;
  number: number;
  battingTeamId: string;
  bowlingTeamId: string;
  oversQuota: number;
  targetRuns: number | null;
  status: InningsStatus;
  endReason: InningsEndReason | null;
}

/** A match plus the innings the scorer is currently working on. */
export interface MatchWithInningsDto extends MatchDto {
  innings: InningsDto[];
}

/**
 * The scorer's view of a live innings — the full reducer state, not the
 * spectator snapshot.
 *
 * A console has to answer questions a scoreboard never asks: who is still to
 * bat, whose over it is, whether a new batsman is owed. Those live in
 * MatchState, so the console gets the state and the context it was folded
 * from, and runs the same `validateBall` the server does before spending a
 * round-trip on a tap that cannot be legal.
 */
export interface ScorerStateDto {
  match: MatchDto;
  innings: InningsDto | null;
  state: MatchState | null;
  context: InningsContext | null;
  /**
   * Who bowled the over just completed, when one has just ended. The
   * consecutive-overs rule is checked against this, and it cannot be derived
   * from `state` alone once the over has rolled over.
   */
  previousOverBowlerId: string | null;
}

// ───────────────────────────────────────────────── player profiles ──

/** One player's card from one match — the unit a career total is built from. */
export interface PlayerMatchStatsDto {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  teamName: string;
  opponentName: string | null;
  playedAt: string;
  batted: boolean;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  bowled: boolean;
  oversBowled: string;
  runsConceded: number;
  wickets: number;
  maidens: number;
  catches: number;
  runOuts: number;
  stumpings: number;
}

/**
 * Career totals: every PlayerMatchStats row belonging to this account, summed.
 * Averages are null rather than 0 when undefined (nobody dismissed, nobody
 * bowled) — a batting average of 0 and no completed innings are different
 * facts and a profile should not conflate them.
 */
export interface CareerStatsDto {
  matches: number;
  batting: {
    innings: number;
    runs: number;
    ballsFaced: number;
    notOuts: number;
    highScore: number;
    /** True when the high score was an unbeaten innings — rendered as "84*". */
    highScoreNotOut: boolean;
    average: number | null;
    strikeRate: number | null;
    fours: number;
    sixes: number;
    fifties: number;
    hundreds: number;
    ducks: number;
  };
  bowling: {
    innings: number;
    ballsBowled: number;
    oversBowled: string;
    runsConceded: number;
    wickets: number;
    maidens: number;
    average: number | null;
    economy: number | null;
    strikeRate: number | null;
    /** Best innings figures, as "4/23". Null until they have bowled. */
    bestFigures: string | null;
    fiveWicketHauls: number;
  };
  fielding: {
    catches: number;
    runOuts: number;
    stumpings: number;
    dismissals: number;
  };
}

/** A user's public profile: who they are, plus what they have done. */
export interface PlayerProfileDto {
  user: UserRef;
  createdAt: string;
  /** Tournaments this account has organized — the "organizer" side of a profile. */
  tournamentsOrganized: number;
  matchesScored: number;
  career: CareerStatsDto;
  /** Most recent first, capped — the profile is a summary, not an archive. */
  recentMatches: PlayerMatchStatsDto[];
}

/** Tournament leaderboard projection used by the organizer stats dashboard. */
export interface TournamentPlayerStatsDto {
  playerId: string;
  playerName: string;
  username: string;
  team: TeamRef;
  matches: number;
  innings: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  average: number | null;
  strikeRate: number | null;
  wickets: number;
  oversBowled: string;
  ballsBowled: number;
  runsConceded: number;
  economy: number | null;
  maidens: number;
  catches: number;
  runOuts: number;
  stumpings: number;
}

export interface TournamentStatsDto {
  tournamentId: string;
  players: TournamentPlayerStatsDto[];
  orangeCap: TournamentPlayerStatsDto | null;
  purpleCap: TournamentPlayerStatsDto | null;
}

// ────────────────────────────────────────── notifications & dashboard ──

/**
 * One notice, exactly as it was written. `title` and `body` are server-authored
 * prose rather than a payload the client formats: the record of what someone
 * was told has to be stable, and a client that renders its own copy from ids
 * would rewrite history every time the wording changed.
 */
export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** A path within the web app, or null when the notice has nowhere to go. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationFeedDto {
  items: NotificationDto[];
  unread: number;
}

/** A squad slot this account holds, with the tournament it belongs to. */
export interface SquadMembershipDto {
  playerId: string;
  role: PlayerRole;
  joinedAt: string;
  team: MatchTeamRef;
  squadSize: number;
  tournament: {
    id: string;
    name: string;
    status: TournamentStatus;
    format: TournamentFormat;
    oversPerInnings: number;
  };
}

/**
 * A fixture as it looks from one person's side of it: their team, the opponent,
 * and whether they are in it as a player or holding the scorer's tablet.
 */
export interface DashboardMatchDto {
  id: string;
  publicSlug: string;
  round: number;
  stage: MatchStage;
  status: MatchStatus;
  scheduledAt: string | null;
  venue: string | null;
  oversPerInnings: number;
  tournament: { id: string; name: string };
  /** Null when this match is on the list only because they are scoring it. */
  myTeam: MatchTeamRef | null;
  opponent: MatchTeamRef | null;
  isScorer: boolean;
  isPlayer: boolean;
  resultText: string | null;
  winnerTeamId: string | null;
}

/**
 * Everything the signed-in account is involved in, from every angle at once:
 * the squads they have been added to, what is coming up, what is on right now,
 * and what they have already done. An organizer, a scorer and a player are the
 * same person on different days, so this is one screen rather than three.
 */
export interface PlayerDashboardDto {
  user: UserRef;
  squads: SquadMembershipDto[];
  live: DashboardMatchDto[];
  upcoming: DashboardMatchDto[];
  recent: DashboardMatchDto[];
  career: CareerStatsDto;
  /**
   * The most recent tournaments this account runs, capped — enough to get back
   * into one without leaving the page, not the full shelf. `tournamentsOrganized`
   * is the true total, so the UI can say how many more there are.
   */
  organizing: TournamentDto[];
  tournamentsOrganized: number;
  matchesToScore: number;
  unreadNotifications: number;
}

/** Every error the API returns has exactly this shape. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
}
