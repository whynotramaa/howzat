import { notFound, unprocessable } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

/**
 * Every organizer-scoped write funnels through one of these. Ownership is
 * checked against the tournament even for nested resources, so a team or
 * player id belonging to someone else's tournament is a 404 — not a 403,
 * which would confirm the id exists.
 */

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
          // The squad cap and the eligibility mark are both the tournament's
          // number, so every caller that loads a team already has it.
          playersPerTeam: true,
          // Both are here for the squad-addition notice, which names the
          // tournament and whoever did the adding.
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

/**
 * Squads are editable only while the tournament is still being set up. Once
 * fixtures exist, changing a roster would silently invalidate them; once a
 * match is live, it would rewrite history.
 */
export function assertSquadEditable(status: string): void {
  if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
    throw unprocessable(
      'TOURNAMENT_LOCKED',
      'This tournament has already started — squads can no longer be changed',
    );
  }
}
