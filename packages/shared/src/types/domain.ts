import type {
  InningsEndReason,
  InningsStatus,
  MatchStage,
  MatchStatus,
  NotificationType,
  PlayerRole,
  Sport,
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
  sport: Sport;
  format: TournamentFormat;
  teamsCount: number;
  /** Eleven for cricket, always; the organizer's choice for football. */
  playersPerTeam: number;
  oversPerInnings: number;
  doubleRoundRobin: boolean;
  /** Football clock settings. Inert on a cricket tournament. */
  periods: number;
  periodMinutes: number;
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
  /**
   * The tournament's squad size, carried on the team so a squad screen can
   * render "9 on 11" without also fetching the tournament it belongs to.
   * In football this is the *starting* side; the squad may exceed it.
   */
  squadSize: number;
  /**
   * The largest squad this team may hold. Equal to squadSize in cricket, where
   * a squad is exactly the eleven who play; larger in football, where the bench
   * is part of the team sheet.
   */
  maxSquadSize: number;
  /**
   * Carried for the same reason squadSize is: a squad screen has to know
   * whether to ask for a batting role or stay out of the way, and making that
   * cost a second request would flash the wrong form.
   */
  sport: Sport;
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
  /**
   * Denormalized from the tournament. Every screen that opens a match has to
   * decide which console to show before it knows anything else, and making
   * that decision cost a second request would put a flash of the wrong sport
   * on the page.
   */
  sport: Sport;
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
  /** Football only, null on a cricket match. */
  team1Formation?: string | null;
  team2Formation?: string | null;
}

/**
 * One row of the points table, as rendered.
 *
 * Both codes share the row rather than having one each, because the left half
 * — position, played, won, lost, points — is identical and the table component
 * that renders it should not have to be written twice. What differs is the
 * tie-breaker column: NRR and its inputs for cricket, goals and goal
 * difference for football. Each side fills its own and leaves the other at
 * zero, and `sport` on the table tells the renderer which to show.
 */
export interface StandingsRowDto {
  position: number;
  team: MatchTeamRef;
  played: number;
  won: number;
  lost: number;
  /** Ties in cricket; draws in football. */
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
  /** Football's tie-breakers, exposed on the same principle. */
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  goalDifferenceText: string;
}

/**
 * One fixture as it appears on a tournament report — the board, the results,
 * and the shareable PDF, which are three renderings of the same list.
 *
 * `score` is the thing the old public payload was missing. A result line reads
 * "Riverside won by 24 runs", which says who won but not what they made, and a
 * report of a tournament nobody attended has to answer both.
 */
export interface TournamentMatchDto {
  id: string;
  publicSlug: string;
  round: number;
  stage: MatchStage;
  status: MatchStatus;
  scheduledAt: string | null;
  venue: string | null;
  resultText: string | null;
  winnerTeamId: string | null;
  team1: MatchTeamRef | null;
  team2: MatchTeamRef | null;
  /**
   * Each side's figure, already formatted for the code being played —
   * "165/6 (20.0)" in cricket, "2" in football. Null on a fixture that has not
   * produced one, which is the honest answer for anything not yet played.
   */
  score: { team1: string | null; team2: string | null } | null;
}

/**
 * A whole tournament in one payload: the table, and every fixture with whatever
 * it has produced so far. Serves the public board and the PDF alike, so the two
 * can never drift apart.
 */
export interface TournamentReportDto {
  tournament: {
    id: string;
    name: string;
    sport: Sport;
    format: TournamentFormat;
    status: TournamentStatus;
    teamsCount: number;
    playersPerTeam: number;
    oversPerInnings: number;
    periods: number;
    periodMinutes: number;
  };
  items: StandingsRowDto[];
  matches: TournamentMatchDto[];
  /** Counted server-side so every consumer agrees on what "played" means. */
  totals: { total: number; completed: number; live: number; upcoming: number };
  generatedAt: string;
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
  sport: 'CRICKET';
  tournamentId: string;
  players: TournamentPlayerStatsDto[];
  orangeCap: TournamentPlayerStatsDto | null;
  purpleCap: TournamentPlayerStatsDto | null;
}

/** One player's tournament record in football. */
export interface FootballPlayerStatsDto {
  playerId: string;
  playerName: string;
  username: string;
  team: TeamRef;
  /** Team sheets named in matches that have finished. */
  matches: number;
  goals: number;
  assists: number;
  /**
   * Kept out of `goals` and shown in its own column. An own goal is a thing
   * that happened to a player, not something they achieved, and adding it to
   * their tally would make the golden boot a lie.
   */
  ownGoals: number;
  /** Shots kept out. Mostly a goalkeeper's column, but not exclusively. */
  saves: number;
  /**
   * Goals let in while this player was their side's goalkeeper, and zero for
   * everybody else. Attributed by position rather than by event, because a
   * goal is scored *against a team* — nobody records which keeper was beaten,
   * they record who scored.
   */
  goalsConceded: number;
  /** Matches keeping goal in which nothing was let in. */
  cleanSheets: number;
  /** True when they kept goal in at least one match — gates the keeper columns. */
  isGoalkeeper: boolean;
  yellowCards: number;
  redCards: number;
  /** Goals per appearance, null before they have played. */
  goalsPerMatch: number | null;
  /**
   * Yellows plus three per red — the usual weighting, so one sending-off
   * outranks two bookings. Drives the "most booked" ordering.
   */
  disciplinePoints: number;
}

export interface FootballTournamentStatsDto {
  sport: 'FOOTBALL';
  tournamentId: string;
  players: FootballPlayerStatsDto[];
  /** Most goals, most assists, and the worst disciplinary record. */
  goldenBoot: FootballPlayerStatsDto | null;
  playmaker: FootballPlayerStatsDto | null;
  mostBooked: FootballPlayerStatsDto | null;
  /** The keeper with the most clean sheets, then the fewest goals conceded. */
  goldenGlove: FootballPlayerStatsDto | null;
  totals: {
    goals: number;
    ownGoals: number;
    saves: number;
    yellowCards: number;
    redCards: number;
    matchesPlayed: number;
    /** Across finished matches only, so it is comparable between tournaments. */
    goalsPerMatch: number | null;
  };
}

/**
 * What `GET /tournaments/:id/stats` answers with, for either code.
 *
 * One endpoint and a discriminated union rather than two routes: the caller is
 * a single panel on a single screen, and making it choose a URL before it knows
 * the sport would push the dispatch up into every page that renders it.
 */
export type AnyTournamentStatsDto = TournamentStatsDto | FootballTournamentStatsDto;

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
    sport: Sport;
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
  sport: Sport;
  round: number;
  stage: MatchStage;
  status: MatchStatus;
  scheduledAt: string | null;
  venue: string | null;
  oversPerInnings: number;
  tournament: { id: string; name: string; sport: Sport };
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
