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

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  createdAt: string;
}

export interface UserRef {
  id: string;
  username: string;
  name: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

export interface TournamentDto {
  id: string;
  organizerId: string;
  name: string;
  sport: Sport;
  format: TournamentFormat;
  teamsCount: number;
  playersPerTeam: number;
  oversPerInnings: number;
  doubleRoundRobin: boolean;
  periods: number;
  periodMinutes: number;
  status: TournamentStatus;
  createdAt: string;
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
  playerCount: number;
  isEligible: boolean;
  squadSize: number;
  maxSquadSize: number;
  sport: Sport;
}

export interface PlayerDto {
  id: string;
  teamId: string;
  name: string;
  username: string;
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
  team1Formation?: string | null;
  team2Formation?: string | null;
}

export interface StandingsRowDto {
  position: number;
  team: MatchTeamRef;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  runsScored: number;
  oversFaced: string;
  runsConceded: number;
  oversBowled: string;
  nrr: number;
  nrrText: string;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  goalDifferenceText: string;
}

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
  score: { team1: string | null; team2: string | null } | null;
}

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
  totals: { total: number; completed: number; live: number; upcoming: number };
  generatedAt: string;
}

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

export interface MatchWithInningsDto extends MatchDto {
  innings: InningsDto[];
}

export interface ScorerStateDto {
  match: MatchDto;
  innings: InningsDto | null;
  state: MatchState | null;
  context: InningsContext | null;
  previousOverBowlerId: string | null;
}

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

export interface CareerStatsDto {
  matches: number;
  batting: {
    innings: number;
    runs: number;
    ballsFaced: number;
    notOuts: number;
    highScore: number;
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

export interface PlayerProfileDto {
  user: UserRef;
  createdAt: string;
  tournamentsOrganized: number;
  matchesScored: number;
  career: CareerStatsDto;
  recentMatches: PlayerMatchStatsDto[];
}

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

export interface FootballPlayerStatsDto {
  playerId: string;
  playerName: string;
  username: string;
  team: TeamRef;
  matches: number;
  goals: number;
  assists: number;
  ownGoals: number;
  saves: number;
  goalsConceded: number;
  cleanSheets: number;
  isGoalkeeper: boolean;
  yellowCards: number;
  redCards: number;
  goalsPerMatch: number | null;
  disciplinePoints: number;
}

export interface FootballTournamentStatsDto {
  sport: 'FOOTBALL';
  tournamentId: string;
  players: FootballPlayerStatsDto[];
  goldenBoot: FootballPlayerStatsDto | null;
  playmaker: FootballPlayerStatsDto | null;
  mostBooked: FootballPlayerStatsDto | null;
  goldenGlove: FootballPlayerStatsDto | null;
  totals: {
    goals: number;
    ownGoals: number;
    saves: number;
    yellowCards: number;
    redCards: number;
    matchesPlayed: number;
    goalsPerMatch: number | null;
  };
}

export type AnyTournamentStatsDto = TournamentStatsDto | FootballTournamentStatsDto;

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationFeedDto {
  items: NotificationDto[];
  unread: number;
}

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
  myTeam: MatchTeamRef | null;
  opponent: MatchTeamRef | null;
  isScorer: boolean;
  isPlayer: boolean;
  resultText: string | null;
  winnerTeamId: string | null;
}

export interface PlayerDashboardDto {
  user: UserRef;
  squads: SquadMembershipDto[];
  live: DashboardMatchDto[];
  upcoming: DashboardMatchDto[];
  recent: DashboardMatchDto[];
  career: CareerStatsDto;
  organizing: TournamentDto[];
  tournamentsOrganized: number;
  matchesToScore: number;
  unreadNotifications: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
