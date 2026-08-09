import type {
  FootballSnapshot,
  MatchSnapshot,
  MatchStage,
  MatchStatus,
  Sport,
  TossDecision,
  TournamentReportDto,
} from '@howzat/shared';
import { apiFetch } from '@/lib/api';

export interface PublicMatchHeader {
  id: string;
  publicSlug: string;
  sport: Sport;
  tournamentId: string;
  tournamentName: string;
  periods: number;
  periodMinutes: number;
  round: number;
  stage: MatchStage;
  status: MatchStatus;
  venue: string | null;
  scheduledAt: string | null;
  oversPerInnings: number;
  tossWinnerId: string | null;
  tossDecision: TossDecision | null;
  winnerTeamId: string | null;
  resultText: string | null;
  teams: Array<{ id: string; name: string; shortName: string; primaryColor: string } | null>;
}

export interface ScorecardTeam {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
}

export interface ScorecardInnings {
  number: number;
  battingTeam: ScorecardTeam;
  bowlingTeam: ScorecardTeam;
  runs: number;
  wickets: number;
  overs: string;
  /** The allotment this innings ran to — below the scheduled figure under DLS. */
  quotaOvers?: string;
  targetRuns?: number | null;
  extras: { wides: number; noBalls: number; byes: number; legByes: number; total: number };
  batting: Array<{
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isOut: boolean;
    dismissal: string;
  }>;
  bowling: Array<{
    playerId: string;
    name: string;
    overs: string;
    maidens: number;
    runs: number;
    wickets: number;
    figures: string;
  }>;
  fallOfWickets: Array<{ wicket: number; name: string; teamRuns: number; overs: string }>;
  partnerships?: Array<{ runs: number; balls: number; batsmanIds: [string, string] }>;
}

export interface ScorecardResponse {
  matchId: string;
  innings: ScorecardInnings[];
}

export function fetchMatchHeader(slug: string): Promise<PublicMatchHeader> {
  return apiFetch<PublicMatchHeader>(`/public/matches/${slug}`);
}

export function fetchScorecard(slug: string): Promise<ScorecardResponse> {
  return apiFetch<ScorecardResponse>(`/public/matches/${slug}/scorecard`);
}

export async function fetchCricketSnapshot(slug: string): Promise<MatchSnapshot | null> {
  const payload = await apiFetch<MatchSnapshot | { snapshot: null }>(
    `/public/matches/${slug}/snapshot`,
  );

  return 'snapshot' in payload && payload.snapshot === null ? null : (payload as MatchSnapshot);
}

export async function fetchFootballSnapshot(slug: string): Promise<FootballSnapshot | null> {
  const payload = await apiFetch<FootballSnapshot | { snapshot: null }>(
    `/public/matches/${slug}/football`,
  );

  return 'snapshot' in payload && payload.snapshot === null ? null : (payload as FootballSnapshot);
}

export function fetchTournamentReport(tournamentId: string): Promise<TournamentReportDto> {
  return apiFetch<TournamentReportDto>(`/public/tournaments/${tournamentId}/standings`);
}

export function stageLabel(stage: MatchStage, round: number): string {
  return stage === 'LEAGUE' ? `Round ${round}` : stage.replace(/_/g, ' ');
}

export function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'Result';
    case 'LIVE':
      return 'Live';
    case 'INNINGS_BREAK':
      return 'Interval';
    case 'ABANDONED':
      return 'Abandoned';
    default:
      return 'Fixture';
  }
}

export function formatWhen(iso: string | null): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
