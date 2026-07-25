import { Router } from 'express';
import { asyncHandler, requireParam } from '../../lib/http';
import { requireAuth } from '../../middleware/auth';
import { loadOwnedTournament } from '../tournaments/guards';
import { getTournamentStats } from './service';

export const statsRouter = Router();

statsRouter.use(requireAuth);

statsRouter.get(
  '/:tournamentId/stats',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    await loadOwnedTournament(tournamentId, req.user!.id);
    res.json(await getTournamentStats(tournamentId));
  }),
);
