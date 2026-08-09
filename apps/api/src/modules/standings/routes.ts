import { Router } from 'express';
import { asyncHandler, requireParam } from '../../lib/http';
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

    const targetTeamId = String(req.query.teamId ?? '');
    const qualificationSpots = Math.max(1, Number(req.query.spots ?? 4));
    const maxRelevantFixtures = req.query.maxFixtures
      ? Math.max(1, Number(req.query.maxFixtures))
      : undefined;

    if (!targetTeamId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'teamId is required' } });
      return;
    }

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
