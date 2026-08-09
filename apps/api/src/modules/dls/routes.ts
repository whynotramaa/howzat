import { Router } from 'express';
import { dlsConcludeSchema, dlsInterruptionSchema, dlsSettingsSchema } from '@howzat/shared';
import { asyncHandler, parseBody, requireParam } from '../../lib/http';
import { requireAuth } from '../../middleware/auth';
import { requireScorerForMatch } from '../../middleware/requireScorerForMatch';
import {
  addInterruption,
  concludeUnderDls,
  getDlsState,
  removeInterruption,
  updateSettings,
} from './service';

export const dlsRouter = Router();

dlsRouter.use(requireAuth);

dlsRouter.get(
  '/:matchId/dls',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    res.json(await getDlsState(requireParam(req, 'matchId')));
  }),
);

dlsRouter.patch(
  '/:matchId/dls',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(dlsSettingsSchema, req.body ?? {});

    res.json(await updateSettings(matchId, input));
  }),
);

dlsRouter.post(
  '/:matchId/dls/interruptions',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(dlsInterruptionSchema, req.body);

    res.status(201).json(await addInterruption(matchId, input, req.user!.id));
  }),
);

dlsRouter.delete(
  '/:matchId/dls/interruptions/:interruptionId',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const interruptionId = requireParam(req, 'interruptionId');

    res.json(await removeInterruption(matchId, interruptionId));
  }),
);

dlsRouter.post(
  '/:matchId/dls/conclude',
  requireScorerForMatch,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(dlsConcludeSchema, req.body ?? {});

    res.json(await concludeUnderDls(matchId, input.reason));
  }),
);
