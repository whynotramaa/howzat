import { MAX_FOOTBALL_SQUAD, PLAYERS_PER_TEAM, type Sport } from '@howzat/shared';
import { unprocessable } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

/**
 * The full-squad gate, in one place. The brief makes it non-negotiable and the
 * plan calls for enforcing it at exactly two points — fixture generation
 * (Phase 3) and the team-sheet lock at toss or kick-off (Phase 4) — so it must
 * be a predicate, not a rule re-typed at each call site.
 *
 * The size itself is the tournament's rather than a constant. Cricket still
 * answers eleven and always will, but football is played five, seven and eleven
 * a side on the same municipal pitch, and a hard-coded 11 would have made the
 * second sport a special case of the first at every one of these call sites.
 */

export interface TeamEligibility {
  teamId: string;
  playerCount: number;
  isEligible: boolean;
  /** Non-null when ineligible: what the organizer still has to do. */
  reason: string | null;
  /** The starting side. In football the squad may exceed it. */
  squadSize: number;
  maxSquadSize: number;
}

/**
 * The largest squad a side may hold.
 *
 * Cricket is an equality — a squad *is* the eleven who play. Football is a
 * range with a lot of room in it, because the squad and the starting side are
 * different numbers: a five-a-side team turns up with twelve and rolls
 * substitutes all evening. The starting five are picked from the squad at the
 * team sheet, so the squad list only has to say who is available.
 */
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

/** The rules a team is judged against: its tournament's. */
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

/** Throws 422 unless the team holds exactly a full squad. */
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

/**
 * Batch form for fixture generation, which needs to report *every* incomplete
 * team at once rather than failing on the first one it happens to hit.
 */
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
