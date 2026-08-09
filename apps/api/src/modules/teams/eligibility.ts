import { MAX_FOOTBALL_SQUAD, PLAYERS_PER_TEAM, type Sport } from '@howzat/shared';
import { unprocessable } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

export interface TeamEligibility {
  teamId: string;
  playerCount: number;
  isEligible: boolean;
  reason: string | null;
  squadSize: number;
  maxSquadSize: number;
}

export function maxSquadSizeFor(sport: Sport, squadSize: number): number {
  return sport === 'FOOTBALL' ? MAX_FOOTBALL_SQUAD : squadSize;
}

export function evaluateEligibility(
  teamId: string,
  playerCount: number,
  squadSize: number = PLAYERS_PER_TEAM,
  sport: Sport = 'CRICKET',
): TeamEligibility {
  const maxSquadSize = maxSquadSizeFor(sport, squadSize);
  const isEligible = playerCount >= squadSize && playerCount <= maxSquadSize;
  const shortfall = squadSize - playerCount;

  return {
    teamId,
    playerCount,
    isEligible,
    squadSize,
    maxSquadSize,
    reason: isEligible
      ? null
      : shortfall > 0
        ? `Needs ${shortfall} more player${shortfall === 1 ? '' : 's'} (${playerCount}/${squadSize})`
        : `Has ${playerCount} players — at most ${maxSquadSize} can be registered`,
  };
}

export async function squadRulesForTeam(
  teamId: string,
): Promise<{ squadSize: number; sport: Sport }> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { tournament: { select: { playersPerTeam: true, sport: true } } },
  });

  return {
    squadSize: team?.tournament.playersPerTeam ?? PLAYERS_PER_TEAM,
    sport: team?.tournament.sport ?? 'CRICKET',
  };
}

export async function getTeamEligibility(teamId: string): Promise<TeamEligibility> {
  const [playerCount, rules] = await Promise.all([
    prisma.player.count({ where: { teamId } }),
    squadRulesForTeam(teamId),
  ]);

  return evaluateEligibility(teamId, playerCount, rules.squadSize, rules.sport);
}

export async function assertTeamEligible(teamId: string): Promise<void> {
  const eligibility = await getTeamEligibility(teamId);

  if (!eligibility.isEligible) {
    throw unprocessable('TEAM_NOT_ELIGIBLE', eligibility.reason ?? 'Team is not eligible', {
      teamId,
      playerCount: eligibility.playerCount,
      required: eligibility.squadSize,
    });
  }
}

export async function assertTournamentTeamsEligible(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { playersPerTeam: true, sport: true },
  });

  const squadSize = tournament?.playersPerTeam ?? PLAYERS_PER_TEAM;
  const sport = tournament?.sport ?? 'CRICKET';

  const teams = await prisma.team.findMany({
    where: { tournamentId },
    select: { id: true, name: true, _count: { select: { players: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const ineligible = teams
    .map((team) => ({
      team,
      eligibility: evaluateEligibility(team.id, team._count.players, squadSize, sport),
    }))
    .filter(({ eligibility }) => !eligibility.isEligible);

  if (ineligible.length > 0) {
    throw unprocessable(
      'TEAMS_NOT_ELIGIBLE',
      `${ineligible.length} team${ineligible.length === 1 ? '' : 's'} do not have a full squad of ${squadSize}`,
      ineligible.map(({ team, eligibility }) => ({
        teamId: team.id,
        teamName: team.name,
        playerCount: eligibility.playerCount,
        reason: eligibility.reason,
      })),
    );
  }
}
