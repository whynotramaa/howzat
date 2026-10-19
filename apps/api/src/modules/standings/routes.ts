import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler, requireParam, parseQuery } from '../../lib/http';
import { requireAuth } from '../../middleware/auth';
import { loadOwnedTournament } from '../tournaments/guards';
import { getStandings, recomputeStandings } from './service';
import { getQualificationScenarios } from './qualification';

export const standingsRouter = Router();

standingsRouter.use(requireAuth);

standingsRouter.get(
  '/:tournamentId/standings',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    await loadOwnedTournament(tournamentId, req.user!.id);

    res.json({ items: await getStandings(tournamentId) });
  }),
);

standingsRouter.get(
  '/:tournamentId/qualification',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    await loadOwnedTournament(tournamentId, req.user!.id);

    const {
      teamId: targetTeamId,
      spots: qualificationSpots,
      maxFixtures: maxRelevantFixtures,
    } = parseQuery(
      z.object({
        teamId: z.string().min(1),
        spots: z.coerce.number().int().min(1).max(32).default(4),
        maxFixtures: z.coerce.number().int().min(1).max(8).optional(),
      }),
      req.query,
    );

    res.json(
      await getQualificationScenarios(
        tournamentId,
        targetTeamId,
        Number.isFinite(qualificationSpots) ? qualificationSpots : 4,
        maxRelevantFixtures,
      ),
    );
  }),
);

standingsRouter.post(
  '/:tournamentId/standings/recompute',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    await loadOwnedTournament(tournamentId, req.user!.id);

    await recomputeStandings(tournamentId);

    res.json({ items: await getStandings(tournamentId) });
  }),
);
