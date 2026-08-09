import type { ClockStatus, FootballEventKind, FootballEventType } from './enums';
import type { PlayerRef, TeamRef } from './scoring';

export interface FootballEventInput {
  clientEventId: string;
  kind: FootballEventKind;
  teamId: string;
  playerId: string | null;
  assistPlayerId: string | null;
  playerOffId: string | null;
}

export interface FootballEvent extends FootballEventInput {
  id: string;
  matchId: string;
  seq: number;
  eventType: FootballEventType;
  supersedesEventId: string | null;
  minute: number;
  period: number;
  stoppage: number;
  createdBy: string;
  createdAt: string;
}

export interface MatchClockDto {
  matchId: string;
  periods: number;
  periodMinutes: number;
  currentPeriod: number;
  status: ClockStatus;
  elapsedMs: number;
  runningSince: string | null;
  serverNow: string;
}

export interface ClockReading {
  elapsedMs: number;
  minute: number;
  seconds: number;
  stoppage: number;
  period: number;
  isRunning: boolean;
  progress: number;
  display: string;
  minuteLabel: string;
}

export interface LineupPlayer extends PlayerRef {
  slot: number | null;
  shirtNumber: number | null;
  isCaptain: boolean;
  x: number;
  y: number;
  goals: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  isSentOff: boolean;
  isOnPitch: boolean;
  cameOnAt: string | null;
  wentOffAt: string | null;
}

export interface TeamLineup {
  team: TeamRef;
  formation: string;
  players: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface FootballIncident {
  id: string;
  seq: number;
  kind: FootballEventKind;
  teamId: string;
  playerId: string | null;
  playerName: string | null;
  assistPlayerId: string | null;
  assistPlayerName: string | null;
  playerOffId: string | null;
  playerOffName: string | null;
  minute: number;
  period: number;
  stoppage: number;
  minuteLabel: string;
}

export interface FootballTeamState {
  teamId: string;
  goals: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  scorers: Record<string, number>;
  savesBy: Record<string, number>;
  cards: Record<string, { yellow: number; red: number }>;
  sentOff: string[];
  substitutions: Array<{ onId: string; offId: string; minute: number; minuteLabel: string }>;
  subbedOn: string[];
  subbedOff: string[];
}

export interface FootballMatchState {
  matchId: string;
  home: FootballTeamState;
  away: FootballTeamState;
  incidents: FootballIncident[];
  lastEventSeq: number;
}

export interface FootballSnapshotSide {
  teamId: string;
  name: string;
  short: string;
  color: string;
  goals: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  /** Changes this side has made so far. */
  substitutionsUsed: number;
}

export interface FootballSnapshot {
  sport: 'FOOTBALL';
  matchId: string;
  publicSlug: string;
  status: string;
  tournamentName: string;
  home: FootballSnapshotSide;
  away: FootballSnapshotSide;
  /** Changes allowed per side, or `null` for a rolling, unlimited futsal bench. */
  substitutionLimit: number | null;
  clock: MatchClockDto | null;
  lineups: { home: TeamLineup | null; away: TeamLineup | null };
  incidents: FootballIncident[];
  resultText: string | null;
  lastEventSeq: number;
  updatedAt: string;
}

export interface FootballScorerStateDto {
  matchId: string;
  status: string;
  home: { team: TeamRef; squad: PlayerRef[]; formation: string | null };
  away: { team: TeamRef; squad: PlayerRef[]; formation: string | null };
  state: FootballMatchState;
  clock: MatchClockDto | null;
  snapshot: FootballSnapshot | null;
}
