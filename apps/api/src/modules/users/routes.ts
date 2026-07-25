import { Router } from 'express';
import { z } from 'zod';
import {
  aggregateCareer,
  formatOvers,
  usernameSchema,
  type PlayerMatchStatsDto,
  type PlayerProfileDto,
  type UserRef,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseQuery, requireParam } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';

/**
 * User lookup and profiles. Signed-in only: a public endpoint that confirms
 * whether a username exists is an enumeration oracle, and there is no reason
 * a spectator needs it.
 */
export const usersRouter = Router();

usersRouter.use(requireAuth);

const searchSchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(40),
});

/**
 * Prefix search over username and name — what an organizer actually types,
 * whether they are looking for a scorer to assign or a player to add to a
 * squad. One search serves both because there is nothing to distinguish.
 */
usersRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q } = parseQuery(searchSchema, req.query);

    const users = await prisma.user.findMany({
      where: {
        // An unverified signup is not yet someone you can add to a team.
        emailVerifiedAt: { not: null },
        OR: [
          { username: { startsWith: q.toLowerCase() } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, name: true },
      orderBy: { username: 'asc' },
      take: 10,
    });

    res.json({ items: users satisfies UserRef[] });
  }),
);

const RECENT_MATCHES = 10;

/** A public profile: identity, what they have run, and what they have done. */
usersRouter.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const username = usernameSchema.parse(requireParam(req, 'username'));

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
        _count: { select: { scorerAssignments: true, tournaments: true } },
      },
    });

    if (!user) throw notFound('User');

    // Every squad slot this account holds, across every tournament. The stats
    // rows hang off those, which is how one profile accumulates a career from
    // matches played for entirely unrelated teams.
    const stats = await prisma.playerMatchStats.findMany({
      where: { player: { userId: user.id } },
      orderBy: { updatedAt: 'desc' },
      include: {
        match: {
          select: {
            id: true,
            scheduledAt: true,
            createdAt: true,
            team1: { select: { id: true, name: true } },
            team2: { select: { id: true, name: true } },
            tournament: { select: { id: true, name: true } },
          },
        },
        player: { select: { team: { select: { id: true, name: true } } } },
      },
    });

    const career = aggregateCareer(stats);

    const recentMatches: PlayerMatchStatsDto[] = stats
      .slice(0, RECENT_MATCHES)
      .map((row) => {
        const { match } = row;
        const opponent = match.team1?.id === row.teamId ? match.team2 : match.team1;

        return {
          matchId: match.id,
          tournamentId: match.tournament.id,
          tournamentName: match.tournament.name,
          teamName: row.player.team.name,
          opponentName: opponent?.name ?? null,
          playedAt: (match.scheduledAt ?? match.createdAt).toISOString(),
          batted: row.batted,
          runs: row.runs,
          ballsFaced: row.ballsFaced,
          fours: row.fours,
          sixes: row.sixes,
          isOut: row.isOut,
          bowled: row.bowled,
          oversBowled: formatOvers(row.ballsBowled),
          runsConceded: row.runsConceded,
          wickets: row.wickets,
          maidens: row.maidens,
          catches: row.catches,
          runOuts: row.runOuts,
          stumpings: row.stumpings,
        };
      });

    const profile: PlayerProfileDto = {
      user: { id: user.id, username: user.username, name: user.name },
      createdAt: user.createdAt.toISOString(),
      tournamentsOrganized: user._count.tournaments,
      matchesScored: user._count.scorerAssignments,
      career,
      recentMatches,
    };

    res.json(profile);
  }),
);
