import type { Player, Team } from '@prisma/client';
import type { PlayerDto, TeamDto } from '@howzat/shared';
import type { TeamEligibility } from './eligibility';

export function toTeamDto(team: Team, eligibility: TeamEligibility): TeamDto {
  return {
    id: team.id,
    tournamentId: team.tournamentId,
    name: team.name,
    shortName: team.shortName,
    primaryColor: team.primaryColor,
    createdAt: team.createdAt.toISOString(),
    playerCount: eligibility.playerCount,
    isEligible: eligibility.isEligible,
  };
}

export function toPlayerDto(player: Player): PlayerDto {
  return {
    id: player.id,
    teamId: player.teamId,
    name: player.name,
    username: player.username,
    isRegistered: player.userId !== null,
    userId: player.userId,
    role: player.role,
    battingStyle: player.battingStyle,
    bowlingStyle: player.bowlingStyle,
    createdAt: player.createdAt.toISOString(),
  };
}
