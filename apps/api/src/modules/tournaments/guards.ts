import { notFound, unprocessable } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

export async function loadOwnedTournament(tournamentId: string, userId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });

  if (!tournament || tournament.organizerId !== userId) throw notFound('Tournament');

  return tournament;
}

export async function loadOwnedTeam(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      tournament: {
        select: {
          id: true,
          organizerId: true,
          status: true,
          sport: true,
          playersPerTeam: true,
          name: true,
          organizer: { select: { name: true } },
        },
      },
    },
  });

  if (!team || team.tournament.organizerId !== userId) throw notFound('Team');

  return team;
}

export async function loadOwnedPlayer(playerId: string, userId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      team: {
        include: { tournament: { select: { id: true, organizerId: true, status: true } } },
      },
    },
  });

  if (!player || player.team.tournament.organizerId !== userId) throw notFound('Player');

  return player;
}

export function assertSquadEditable(status: string): void {
  if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
    throw unprocessable(
      'TOURNAMENT_LOCKED',
      'This tournament has already started — squads can no longer be changed',
    );
  }
}
