import { PLAYERS_PER_TEAM } from '@howzat/shared';
import { unprocessable } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

/**
 * The 11-player gate, in one place. The brief makes it non-negotiable and the
 * plan calls for enforcing it at exactly two points — fixture generation
 * (Phase 3) and the playing-XI lock at toss (Phase 4) — so it must be a
 * predicate, not a rule re-typed at each call site.
 */

export interface TeamEligibility {
  teamId: string;
  playerCount: number;
  isEligible: boolean;
  /** Non-null when ineligible: what the organizer still has to do. */
  reason: string | null;
}

export function evaluateEligibility(teamId: string, playerCount: number): TeamEligibility {
  const isEligible = playerCount === PLAYERS_PER_TEAM;
  const shortfall = PLAYERS_PER_TEAM - playerCount;

  return {
    teamId,
    playerCount,
    isEligible,
    reason: isEligible
      ? null
      : shortfall > 0
        ? `Needs ${shortfall} more player${shortfall === 1 ? '' : 's'} (${playerCount}/${PLAYERS_PER_TEAM})`
        : `Has ${playerCount} players — remove ${-shortfall} to reach ${PLAYERS_PER_TEAM}`,
  };
}

export async function getTeamEligibility(teamId: string): Promise<TeamEligibility> {
  const playerCount = await prisma.player.count({ where: { teamId } });
  return evaluateEligibility(teamId, playerCount);
}

/** Throws 422 unless the team has exactly eleven players. */
export async function assertTeamEligible(teamId: string): Promise<void> {
  const eligibility = await getTeamEligibility(teamId);

  if (!eligibility.isEligible) {
    throw unprocessable('TEAM_NOT_ELIGIBLE', eligibility.reason ?? 'Team is not eligible', {
      teamId,
      playerCount: eligibility.playerCount,
      required: PLAYERS_PER_TEAM,
    });
  }
}

/**
 * Batch form for fixture generation, which needs to report *every* incomplete
 * team at once rather than failing on the first one it happens to hit.
 */
export async function assertTournamentTeamsEligible(tournamentId: string): Promise<void> {
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    select: { id: true, name: true, _count: { select: { players: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const ineligible = teams
    .map((team) => ({ team, eligibility: evaluateEligibility(team.id, team._count.players) }))
    .filter(({ eligibility }) => !eligibility.isEligible);

  if (ineligible.length > 0) {
    throw unprocessable(
      'TEAMS_NOT_ELIGIBLE',
      `${ineligible.length} team${ineligible.length === 1 ? '' : 's'} do not have exactly ${PLAYERS_PER_TEAM} players`,
      ineligible.map(({ team, eligibility }) => ({
        teamId: team.id,
        teamName: team.name,
        playerCount: eligibility.playerCount,
        reason: eligibility.reason,
      })),
    );
  }
}
