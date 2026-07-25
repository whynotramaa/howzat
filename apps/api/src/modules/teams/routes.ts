import { Router } from 'express';
import {
  PLAYERS_PER_TEAM,
  bulkCreatePlayersSchema,
  createPlayerSchema,
  updateTeamSchema,
  type TeamWithPlayersDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseBody, requireParam } from '../../lib/http';
import { conflict } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { requireAuth } from '../../middleware/auth';
import { assertSquadEditable, loadOwnedTeam } from '../tournaments/guards';
import {
  resolvePlayerIdentities,
  resolvePlayerIdentity,
  toPlayerCreateData,
  type ResolvedPlayer,
} from '../players/resolve';
import { notifySquadAdditions } from '../notifications/service';
import { evaluateEligibility } from './eligibility';
import { toPlayerDto, toTeamDto } from './serialize';

/**
 * Signed in is the only blanket requirement. Whether this particular team is
 * yours to touch is settled by loadOwnedTeam on every route below — which is
 * the check that actually matters, and the one a role gate would have made
 * look redundant while protecting nothing extra.
 */
export const teamsRouter = Router();

teamsRouter.use(requireAuth);

teamsRouter.get(
  '/:teamId',
  asyncHandler(async (req, res) => {
    const teamId = requireParam(req, 'teamId');
    await loadOwnedTeam(teamId, req.user!.id);

    const team = await prisma.team.findUniqueOrThrow({
      where: { id: teamId },
      include: { players: { orderBy: { createdAt: 'asc' } } },
    });

    const dto: TeamWithPlayersDto = {
      ...toTeamDto(team, evaluateEligibility(team.id, team.players.length)),
      players: team.players.map(toPlayerDto),
    };

    res.json(dto);
  }),
);

teamsRouter.patch(
  '/:teamId',
  asyncHandler(async (req, res) => {
    const teamId = requireParam(req, 'teamId');
    const existing = await loadOwnedTeam(teamId, req.user!.id);
    assertSquadEditable(existing.tournament.status);

    const input = parseBody(updateTeamSchema, req.body);

    const team = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.shortName ? { shortName: input.shortName.toUpperCase() } : {}),
        ...(input.primaryColor ? { primaryColor: input.primaryColor } : {}),
      },
      include: { _count: { select: { players: true } } },
    });

    res.json(toTeamDto(team, evaluateEligibility(team.id, team._count.players)));
  }),
);

teamsRouter.delete(
  '/:teamId',
  asyncHandler(async (req, res) => {
    const teamId = requireParam(req, 'teamId');
    const team = await loadOwnedTeam(teamId, req.user!.id);
    assertSquadEditable(team.tournament.status);

    await prisma.team.delete({ where: { id: teamId } });
    res.status(204).end();
  }),
);

// ─────────────────────────────────────────── players within a team ──

teamsRouter.get(
  '/:teamId/players',
  asyncHandler(async (req, res) => {
    const teamId = requireParam(req, 'teamId');
    await loadOwnedTeam(teamId, req.user!.id);

    const players = await prisma.player.findMany({
      where: { teamId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      items: players.map(toPlayerDto),
      total: players.length,
      ...evaluateEligibility(teamId, players.length),
    });
  }),
);

teamsRouter.post(
  '/:teamId/players',
  asyncHandler(async (req, res) => {
    const teamId = requireParam(req, 'teamId');
    const team = await loadOwnedTeam(teamId, req.user!.id);
    assertSquadEditable(team.tournament.status);

    const input = parseBody(createPlayerSchema, req.body);
    await assertRoomInSquad(teamId, 1);

    const identity = await resolvePlayerIdentity(input, teamId);

    const player = await prisma.player.create({
      data: toPlayerCreateData(teamId, identity, input),
    });

    await notifyAddedAccounts([identity], team);

    res.status(201).json(toPlayerDto(player));
  }),
);

/**
 * Bulk add — the realistic path to a full XI. All-or-nothing inside one
 * transaction so a squad never lands half-populated.
 */
teamsRouter.post(
  '/:teamId/players/bulk',
  asyncHandler(async (req, res) => {
    const teamId = requireParam(req, 'teamId');
    const team = await loadOwnedTeam(teamId, req.user!.id);
    assertSquadEditable(team.tournament.status);

    const { players } = parseBody(bulkCreatePlayersSchema, req.body);
    await assertRoomInSquad(teamId, players.length);

    const identities = await resolvePlayerIdentities(players, teamId);

    await prisma.player.createMany({
      data: players.map((player, index) =>
        toPlayerCreateData(teamId, identities[index]!, player),
      ),
    });

    await notifyAddedAccounts(identities, team);

    const all = await prisma.player.findMany({
      where: { teamId },
      orderBy: { createdAt: 'asc' },
    });

    res.status(201).json({
      items: all.map(toPlayerDto),
      total: all.length,
      ...evaluateEligibility(teamId, all.length),
    });
  }),
);

type OwnedTeam = Awaited<ReturnType<typeof loadOwnedTeam>>;

/**
 * Tell the registered accounts among a batch that they are now in this squad.
 *
 * Guests are skipped because there is nobody to tell — a placeholder has no
 * account and no address. So is the organizer adding themselves, which is the
 * one case where the notice would be telling someone what they just did.
 *
 * Failure here is logged, never propagated: the players are already in the
 * team, and a notification problem must not report the squad as unsaved.
 */
async function notifyAddedAccounts(
  identities: ResolvedPlayer[],
  team: OwnedTeam,
): Promise<void> {
  const userIds = identities
    .map((identity) => identity.userId)
    .filter((userId): userId is string => userId !== null && userId !== team.tournament.organizerId);

  if (userIds.length === 0) return;

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });

    await notifySquadAdditions(
      users.map((user) => ({ userId: user.id, email: user.email, name: user.name })),
      {
        teamId: team.id,
        teamName: team.name,
        tournamentId: team.tournament.id,
        tournamentName: team.tournament.name,
        organizerName: team.tournament.organizer.name,
      },
    );
  } catch (error) {
    logger.error(
      { err: error, teamId: team.id, count: userIds.length },
      'Squad addition succeeded but the players could not be notified',
    );
  }
}

/**
 * A squad may not exceed eleven. Capping on the way in means the eligibility
 * check only ever has to report "too few", and the organizer finds out at the
 * moment they overfill rather than at fixture generation.
 */
async function assertRoomInSquad(teamId: string, adding: number): Promise<void> {
  const current = await prisma.player.count({ where: { teamId } });

  if (current + adding > PLAYERS_PER_TEAM) {
    throw conflict(
      `A squad holds exactly ${PLAYERS_PER_TEAM} players. This team has ${current}; adding ${adding} would make ${current + adding}.`,
      { current, adding, max: PLAYERS_PER_TEAM },
    );
  }
}
