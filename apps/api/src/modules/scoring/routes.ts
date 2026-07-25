import { Router } from 'express';
import { ballSchema, correctionSchema, undoSchema } from '@howzat/shared';
import { asyncHandler, parseBody, requireParam } from '../../lib/http';
import { requireAuth } from '../../middleware/auth';
import { requireScorerForMatch } from '../../middleware/requireScorerForMatch';
import { rateLimitBallWrites } from '../../middleware/rateLimit';
import { correctBall, recordBall, undoLastBall } from './service';

/**
 * Ball ingest. Mounted on /matches so the route carries :matchId, which is
 * what requireScorerForMatch keys on.
 *
 * All writes are HTTP, never websocket. Keeping them here means auth,
 * idempotency, validation and retry semantics live in one place and the
 * realtime layer stays a read-only fan-out that can be swapped or removed.
 */
export const scoringRouter = Router();

scoringRouter.use(requireAuth);

scoringRouter.post(
  '/:matchId/balls',
  requireScorerForMatch,
  rateLimitBallWrites,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const input = parseBody(ballSchema, req.body);

    const result = await recordBall(matchId, input, req.user!.id);

    // 200 for a duplicate, 201 for a new ball. Both carry the same body, so a
    // client replaying its offline queue cannot tell the difference — which is
    // exactly what idempotency is for.
    res.status(result.duplicate ? 200 : 201).json({
      snapshot: result.snapshot,
      duplicate: result.duplicate,
      inningsCompleted: result.inningsCompleted,
      matchCompleted: result.matchCompleted,
    });
  }),
);

scoringRouter.post(
  '/:matchId/balls/correct',
  requireScorerForMatch,
  rateLimitBallWrites,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const { targetEventId, replacement } = parseBody(correctionSchema, req.body);

    const result = await correctBall(matchId, targetEventId, replacement, req.user!.id);

    res.json({
      snapshot: result.snapshot,
      duplicate: result.duplicate,
      inningsCompleted: result.inningsCompleted,
    });
  }),
);

scoringRouter.post(
  '/:matchId/balls/undo',
  requireScorerForMatch,
  rateLimitBallWrites,
  asyncHandler(async (req, res) => {
    const matchId = requireParam(req, 'matchId');
    const { clientEventId, targetEventId } = parseBody(undoSchema, req.body);

    const result = await undoLastBall(matchId, clientEventId, targetEventId, req.user!.id);

    res.json({
      snapshot: result.snapshot,
      duplicate: result.duplicate,
      inningsCompleted: result.inningsCompleted,
    });
  }),
);
