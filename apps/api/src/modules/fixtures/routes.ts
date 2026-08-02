import { Router } from 'express';
import { assignScorerSchema, generateFixturesSchema, updateMatchSchema } from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseBody, requireParam } from '../../lib/http';
import { badRequest, notFound, unprocessable } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { requireAuth } from '../../middleware/auth';
import { invalidateMatchAuthz } from '../../middleware/requireScorerForMatch';
import { notifyScorerAssignment } from '../notifications/service';
import { loadOwnedTournament } from '../tournaments/guards';
import { generateFixtures, previewFixtures } from './service';
import { toMatchDto } from '../matches/serialize';

/**
 * Mounted under /tournaments. Every route loads the tournament through
 * loadOwnedTournament first, so these are the organizer's own by definition:
 * the organizer is whoever created the tournament being addressed.
 *
 * Kept in their own file because fixture generation is a distinct concern
 * from tournament CRUD.
 */
export const fixturesRouter = Router({ mergeParams: true });

fixturesRouter.use(requireAuth);

/** Dry run — what the schedule would look like, before anything is written. */
fixturesRouter.post(
  '/:tournamentId/fixtures/preview',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    const tournament = await loadOwnedTournament(tournamentId, req.user!.id);

    res.json(await previewFixtures(tournament));
  }),
);

fixturesRouter.post(
  '/:tournamentId/fixtures',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    const tournament = await loadOwnedTournament(tournamentId, req.user!.id);
    const { regenerate } = parseBody(generateFixturesSchema, req.body ?? {});

    const created = await generateFixtures(tournament, { regenerate });

    const matches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { createdAt: 'asc' }],
      include: { team1: true, team2: true, tournament: { select: { sport: true } } },
    });

    res.status(201).json({
      created,
      items: matches.map((match) => toMatchDto(match)),
      total: matches.length,
    });
  }),
);

fixturesRouter.get(
  '/:tournamentId/matches',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    await loadOwnedTournament(tournamentId, req.user!.id);

    const matches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { createdAt: 'asc' }],
      include: {
        team1: true,
        team2: true,
        scorerAssignments: {
          select: { scorer: { select: { id: true, username: true, name: true } } },
        },
        innings: { select: { number: true, status: true } },
        tournament: { select: { sport: true } },
      },
    });

    res.json({ items: matches.map((match) => toMatchDto(match)), total: matches.length });
  }),
);

// ────────────────────────────────────── per-match organizer actions ──

fixturesRouter.patch(
  '/:tournamentId/matches/:matchId',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    const matchId = requireParam(req, 'matchId');
    await loadOwnedTournament(tournamentId, req.user!.id);

    const input = parseBody(updateMatchSchema, req.body);

    const existing = await prisma.match.findFirst({ where: { id: matchId, tournamentId } });
    if (!existing) throw notFound('Match');

    if (input.oversPerInnings !== undefined && existing.status !== 'SCHEDULED') {
      throw unprocessable(
        'MATCH_STARTED',
        'The overs cannot be changed once the match has started',
      );
    }

    const match = await prisma.match.update({
      where: { id: matchId },
      data: {
        ...(input.scheduledAt !== undefined
          ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
          : {}),
        ...(input.venue !== undefined ? { venue: input.venue } : {}),
        ...(input.oversPerInnings !== undefined
          ? { oversPerInnings: input.oversPerInnings }
          : {}),
      },
      include: { team1: true, team2: true, tournament: { select: { sport: true } } },
    });

    res.json(toMatchDto(match));
  }),
);

/**
 * Scorer assignment — the row `requireScorerForMatch` looks for, and the only
 * thing that makes anyone a scorer. Being "a scorer" is per match: any account
 * can be assigned to this one without that saying anything about the next.
 *
 * The authz cache is invalidated immediately so access takes effect on the
 * next request rather than up to a minute later.
 */
fixturesRouter.post(
  '/:tournamentId/matches/:matchId/scorers',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    const matchId = requireParam(req, 'matchId');
    await loadOwnedTournament(tournamentId, req.user!.id);

    const input = parseBody(assignScorerSchema, req.body);

    const match = await prisma.match.findFirst({
      where: { id: matchId, tournamentId },
      include: {
        team1: { select: { shortName: true } },
        team2: { select: { shortName: true } },
        tournament: { select: { name: true, organizer: { select: { name: true } } } },
      },
    });
    if (!match) throw notFound('Match');

    const scorer = input.scorerId
      ? await prisma.user.findUnique({ where: { id: input.scorerId } })
      : await prisma.user.findUnique({ where: { username: input.username! } });

    if (!scorer) throw notFound('User');

    // Upsert returns the row either way, so `createdAt` is what distinguishes a
    // fresh assignment from re-saving an existing one — and only a fresh one is
    // worth telling someone about.
    const before = await prisma.scorerAssignment.findUnique({
      where: { matchId_scorerId: { matchId, scorerId: scorer.id } },
      select: { id: true },
    });

    await prisma.scorerAssignment.upsert({
      where: { matchId_scorerId: { matchId, scorerId: scorer.id } },
      update: {},
      create: { matchId, scorerId: scorer.id, assignedBy: req.user!.id },
    });

    await invalidateMatchAuthz(matchId, scorer.id);

    if (!before && scorer.id !== req.user!.id) {
      const fixture =
        match.team1 && match.team2
          ? `${match.team1.shortName} v ${match.team2.shortName}`
          : `round ${match.round}`;

      // Best effort: the assignment is what grants access, and it is already
      // written. A failed notice must not make the organizer retry it.
      try {
        await notifyScorerAssignment(scorer.id, {
          matchId,
          tournamentId,
          tournamentName: match.tournament.name,
          fixtureLabel: fixture,
          organizerName: match.tournament.organizer.name,
        });
      } catch (error) {
        logger.error({ err: error, matchId }, 'Scorer assigned but could not be notified');
      }
    }

    res.status(201).json({
      matchId,
      scorer: { id: scorer.id, username: scorer.username, name: scorer.name },
    });
  }),
);

fixturesRouter.delete(
  '/:tournamentId/matches/:matchId/scorers/:scorerId',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    const matchId = requireParam(req, 'matchId');
    const scorerId = requireParam(req, 'scorerId');
    await loadOwnedTournament(tournamentId, req.user!.id);

    await prisma.scorerAssignment.deleteMany({ where: { matchId, scorerId } });
    await invalidateMatchAuthz(matchId, scorerId);

    res.status(204).end();
  }),
);

/** Exact lookup by handle or email, for assigning a scorer to a match. */
fixturesRouter.get(
  '/:tournamentId/scorers/search',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    await loadOwnedTournament(tournamentId, req.user!.id);

    const { username, email } = req.query;

    if (typeof username === 'string' && username.length >= 3) {
      const user = await prisma.user.findUnique({
        where: { username: username.trim().toLowerCase() },
        select: { id: true, username: true, name: true },
      });
      res.json({ user: user ?? null });
      return;
    }

    if (typeof email === 'string' && email.length >= 3) {
      const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, username: true, name: true },
      });
      res.json({ user: user ?? null });
      return;
    }

    throw badRequest('Provide a username or an email to search for');
  }),
);
