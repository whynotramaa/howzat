import { Router } from 'express';
import {
  aggregateCareer,
  type DashboardMatchDto,
  type PlayerDashboardDto,
  type SquadMembershipDto,
} from '@howzat/shared';
import type { Match, Sport, Team } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { toTeamRef } from '../fixtures/service';
import { toTournamentDto } from '../tournaments/serialize';

/**
 * The signed-in account's own view of itself.
 *
 * A player who has just been added to a squad has no way in from anywhere else:
 * they do not own the tournament, so /tournaments is empty for them, and the
 * public share link needs a slug they were never sent. This is the screen that
 * closes that loop — it is reachable from the notification, and it answers the
 * two questions the notification raises: which team, and when do I play.
 */
export const meRouter = Router();

meRouter.use(requireAuth);

/** Matches that have not started; the point of the screen. */
const UPCOMING_LIMIT = 8;
/** Enough to see the last few results without turning this into an archive. */
const RECENT_LIMIT = 5;
/** A way back into what you were running, not a second tournaments page. */
const ORGANIZING_LIMIT = 2;

meRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true },
    });
    if (!user) throw notFound('User');

    // Every squad slot this account holds, newest first — someone added to a
    // tournament this morning should see it at the top, not buried under a
    // league they played in two seasons ago.
    const players = await prisma.player.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        team: {
          include: {
            tournament: {
              select: {
                id: true,
                name: true,
                sport: true,
                status: true,
                format: true,
                oversPerInnings: true,
              },
            },
            _count: { select: { players: true } },
          },
        },
      },
    });

    const squads: SquadMembershipDto[] = players.map((player) => ({
      playerId: player.id,
      role: player.role,
      joinedAt: player.createdAt.toISOString(),
      team: toTeamRef(player.team),
      squadSize: player.team._count.players,
      tournament: player.team.tournament,
    }));

    const myTeamIds = new Set(players.map((player) => player.teamId));

    const [playingMatches, scoringAssignments, organizedCount, organizing] = await Promise.all([
      myTeamIds.size === 0
        ? Promise.resolve([])
        : prisma.match.findMany({
            where: {
              OR: [
                { team1Id: { in: [...myTeamIds] } },
                { team2Id: { in: [...myTeamIds] } },
              ],
            },
            include: {
              team1: true,
              team2: true,
              tournament: { select: { id: true, name: true, sport: true } },
            },
          }),
      prisma.scorerAssignment.findMany({
        where: { scorerId: userId },
        include: {
          match: {
            include: {
              team1: true,
              team2: true,
              tournament: { select: { id: true, name: true, sport: true } },
            },
          },
        },
      }),
      prisma.tournament.count({ where: { organizerId: userId } }),
      // The same shape the tournaments page uses, so the card on the dashboard
      // can show setup progress rather than being a bare name and a link.
      prisma.tournament.findMany({
        where: { organizerId: userId },
        orderBy: { createdAt: 'desc' },
        take: ORGANIZING_LIMIT,
        include: { teams: { select: { _count: { select: { players: true } } } } },
      }),
    ]);

    // One match can reach this list twice — a scorer who is also in one of the
    // squads is a normal Sunday. Merge on id so the card carries both roles
    // rather than appearing as two fixtures.
    const byId = new Map<string, DashboardMatchDto>();

    for (const match of playingMatches) {
      byId.set(match.id, toDashboardMatch(match, myTeamIds, { isPlayer: true, isScorer: false }));
    }

    for (const assignment of scoringAssignments) {
      const existing = byId.get(assignment.matchId);
      if (existing) {
        existing.isScorer = true;
        continue;
      }
      byId.set(
        assignment.matchId,
        toDashboardMatch(assignment.match, myTeamIds, { isPlayer: false, isScorer: true }),
      );
    }

    const all = [...byId.values()];

    const live = all
      .filter((match) => match.status === 'LIVE' || match.status === 'INNINGS_BREAK')
      .sort(bySchedule('asc'));

    const upcoming = all
      .filter((match) => match.status === 'SCHEDULED' || match.status === 'TOSS')
      // Undated fixtures sort last: a generated fixture list has no calendar
      // until the organizer gives it one, and "TBC" below "Saturday 3pm" is the
      // order someone reads them in.
      .sort(bySchedule('asc'))
      .slice(0, UPCOMING_LIMIT);

    const recent = all
      .filter((match) => match.status === 'COMPLETED' || match.status === 'ABANDONED')
      .sort(bySchedule('desc'))
      .slice(0, RECENT_LIMIT);

    const [stats, unreadNotifications] = await Promise.all([
      prisma.playerMatchStats.findMany({ where: { player: { userId } } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    const dashboard: PlayerDashboardDto = {
      user,
      squads,
      live,
      upcoming,
      recent,
      career: aggregateCareer(stats),
      organizing: organizing.map((tournament) =>
        toTournamentDto(tournament, {
          registeredTeams: tournament.teams.length,
          eligibleTeams: tournament.teams.filter(
            (team) => team._count.players === tournament.playersPerTeam,
          ).length,
        }),
      ),
      tournamentsOrganized: organizedCount,
      matchesToScore: scoringAssignments.filter(
        (assignment) => assignment.match.status !== 'COMPLETED' && assignment.match.status !== 'ABANDONED',
      ).length,
      unreadNotifications,
    };

    res.json(dashboard);
  }),
);

type MatchForDashboard = Match & {
  team1: Team | null;
  team2: Team | null;
  tournament: { id: string; name: string; sport: Sport };
};

function toDashboardMatch(
  match: MatchForDashboard,
  myTeamIds: Set<string>,
  roles: { isPlayer: boolean; isScorer: boolean },
): DashboardMatchDto {
  const mine =
    match.team1 && myTeamIds.has(match.team1.id)
      ? match.team1
      : match.team2 && myTeamIds.has(match.team2.id)
        ? match.team2
        : null;

  const other = mine && match.team1?.id === mine.id ? match.team2 : mine ? match.team1 : match.team2;

  return {
    id: match.id,
    publicSlug: match.publicSlug,
    sport: match.tournament.sport,
    round: match.round,
    stage: match.stage,
    status: match.status,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    venue: match.venue,
    oversPerInnings: match.oversPerInnings,
    tournament: match.tournament,
    myTeam: mine ? toTeamRef(mine) : null,
    // With no squad in this match the pairing is just the fixture, so the
    // "opponent" slot carries team2 and myTeam stays null rather than lying.
    opponent: other ? toTeamRef(other) : null,
    isScorer: roles.isScorer,
    isPlayer: roles.isPlayer,
    resultText: match.resultText,
    winnerTeamId: match.winnerTeamId,
  };
}

/** Undated fixtures always sort to the end, whichever way the dated ones go. */
function bySchedule(direction: 'asc' | 'desc') {
  return (a: DashboardMatchDto, b: DashboardMatchDto): number => {
    if (!a.scheduledAt && !b.scheduledAt) return a.round - b.round;
    if (!a.scheduledAt) return 1;
    if (!b.scheduledAt) return -1;

    const delta = Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt);
    return direction === 'asc' ? delta : -delta;
  };
}
