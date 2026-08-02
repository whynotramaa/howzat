import type { Player, Team } from '@prisma/client';
import type { PlayerDto, Sport, TeamDto } from '@howzat/shared';
import type { TeamEligibility } from './eligibility';

export function toTeamDto(
  team: Team,
  eligibility: TeamEligibility,
  sport: Sport = 'CRICKET',
): TeamDto {
  return {
    id: team.id,
    tournamentId: team.tournamentId,
    name: team.name,
    shortName: team.shortName,
    primaryColor: team.primaryColor,
    createdAt: team.createdAt.toISOString(),
    playerCount: eligibility.playerCount,
    isEligible: eligibility.isEligible,
    squadSize: eligibility.squadSize,
    maxSquadSize: eligibility.maxSquadSize,
    sport,
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
