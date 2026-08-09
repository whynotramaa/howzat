import type { Match, Sport, Team, User } from '@prisma/client';
import type { InningsDto, MatchDto } from '@howzat/shared';
import { toTeamRef } from '../fixtures/service';

type MatchWithRelations = Match & {
  team1: Team | null;
  team2: Team | null;
  scorerAssignments?: Array<{ scorer: Pick<User, 'id' | 'username' | 'name'> }>;
  innings?: Array<{ number: number; status: string }>;
  tournament?: { sport: Sport };
};

export function toMatchDto(match: MatchWithRelations): MatchDto {
  const live = match.innings?.find((entry) => entry.status === 'IN_PROGRESS');

  return {
    id: match.id,
    tournamentId: match.tournamentId,
    sport: match.tournament?.sport ?? 'CRICKET',
    round: match.round,
    stage: match.stage,
    team1: match.team1 ? toTeamRef(match.team1) : null,
    team2: match.team2 ? toTeamRef(match.team2) : null,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    venue: match.venue,
    status: match.status,
    tossWinnerId: match.tossWinnerId,
    tossDecision: match.tossDecision,
    oversPerInnings: match.oversPerInnings,
    winnerTeamId: match.winnerTeamId,
    resultText: match.resultText,
    publicSlug: match.publicSlug,
    team1Formation: match.team1Formation,
    team2Formation: match.team2Formation,
    scorers:
      match.scorerAssignments?.map((assignment) => ({
        id: assignment.scorer.id,
        username: assignment.scorer.username,
        name: assignment.scorer.name,
      })) ?? [],
    currentInnings: live?.number ?? null,
  };
}

export function toInningsDto(innings: {
  id: string;
  matchId: string;
  number: number;
  battingTeamId: string;
  bowlingTeamId: string;
  oversQuota: number;
  targetRuns: number | null;
  status: InningsDto['status'];
  endReason: InningsDto['endReason'];
}): InningsDto {
  return {
    id: innings.id,
    matchId: innings.matchId,
    number: innings.number,
    battingTeamId: innings.battingTeamId,
    bowlingTeamId: innings.bowlingTeamId,
    oversQuota: innings.oversQuota,
    targetRuns: innings.targetRuns,
    status: innings.status,
    endReason: innings.endReason,
  };
}
