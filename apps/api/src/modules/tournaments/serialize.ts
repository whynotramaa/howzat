import type { Tournament } from '@prisma/client';
import type { TournamentDto } from '@howzat/shared';

export function toTournamentDto(
  tournament: Tournament,
  counts?: { registeredTeams: number; eligibleTeams: number },
): TournamentDto {
  return {
    id: tournament.id,
    organizerId: tournament.organizerId,
    name: tournament.name,
    sport: tournament.sport,
    format: tournament.format,
    teamsCount: tournament.teamsCount,
    playersPerTeam: tournament.playersPerTeam,
    oversPerInnings: tournament.oversPerInnings,
    doubleRoundRobin: tournament.doubleRoundRobin,
    periods: tournament.periods,
    periodMinutes: tournament.periodMinutes,
    status: tournament.status,
    createdAt: tournament.createdAt.toISOString(),
    ...(counts ?? {}),
  };
}
