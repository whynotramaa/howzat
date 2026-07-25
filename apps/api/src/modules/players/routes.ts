import { Router } from 'express';
import { updatePlayerSchema } from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseBody, requireParam } from '../../lib/http';
import { requireAuth } from '../../middleware/auth';
import { assertSquadEditable, loadOwnedPlayer } from '../tournaments/guards';
import { toPlayerDto } from '../teams/serialize';

export const playersRouter = Router();

/** Ownership is enforced per player by loadOwnedPlayer, not by a role. */
playersRouter.use(requireAuth);

playersRouter.patch(
  '/:playerId',
  asyncHandler(async (req, res) => {
    const playerId = requireParam(req, 'playerId');
    const existing = await loadOwnedPlayer(playerId, req.user!.id);
    assertSquadEditable(existing.team.tournament.status);

    const input = parseBody(updatePlayerSchema, req.body);

    const player = await prisma.player.update({
      where: { id: playerId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.battingStyle !== undefined ? { battingStyle: input.battingStyle } : {}),
        ...(input.bowlingStyle !== undefined ? { bowlingStyle: input.bowlingStyle } : {}),
      },
    });

    res.json(toPlayerDto(player));
  }),
);

playersRouter.delete(
  '/:playerId',
  asyncHandler(async (req, res) => {
    const playerId = requireParam(req, 'playerId');
    const player = await loadOwnedPlayer(playerId, req.user!.id);
    assertSquadEditable(player.team.tournament.status);

    await prisma.player.delete({ where: { id: playerId } });
    res.status(204).end();
  }),
);
