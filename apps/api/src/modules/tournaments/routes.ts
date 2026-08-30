import { Router } from 'express';
import {
  createTeamSchema,
  createTournamentSchema,
  updateTournamentSchema,
  type TeamDto,
  type TournamentDto,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseBody, requireParam } from '../../lib/http';
import { conflict, unprocessable } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { assertSquadEditable, loadOwnedTournament } from './guards';
import { evaluateEligibility } from '../teams/eligibility';
import { toTeamDto } from '../teams/serialize';
import { toTournamentDto } from './serialize';

export const tournamentsRouter = Router();

tournamentsRouter.use(requireAuth);

tournamentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const tournaments = await prisma.tournament.findMany({
      where: { organizerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        teams: { select: { id: true, _count: { select: { players: true } } } },
      },
    });

    const items: TournamentDto[] = tournaments.map((tournament) => {
      const eligible = tournament.teams.filter(
        (team) => team._count.players === tournament.playersPerTeam,
      ).length;

      return toTournamentDto(tournament, {
        registeredTeams: tournament.teams.length,
        eligibleTeams: eligible,
      });
    });

    res.json({ items, total: items.length });
  }),
);

tournamentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { teams, ...settings } = parseBody(createTournamentSchema, req.body);

    // Sides come in with the tournament for a one-off match, where "two teams
    // and go" is the whole point. Nested create keeps it one transaction.
    const tournament = await prisma.tournament.create({
      data: {
        ...settings,
        organizerId: req.user!.id,
        ...(teams?.length
          ? {
              teams: {
                create: teams.map((team) => ({
                  name: team.name,
                  shortName: team.shortName.toUpperCase(),
                  primaryColor: team.primaryColor,
                })),
              },
            }
          : {}),
      },
    });

    res
      .status(201)
      .json(toTournamentDto(tournament, { registeredTeams: teams?.length ?? 0, eligibleTeams: 0 }));
  }),
);

tournamentsRouter.get(
  '/:tournamentId',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    await loadOwnedTournament(tournamentId, req.user!.id);

    const tournament = await prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      include: { teams: { select: { id: true, _count: { select: { players: true } } } } },
    });

    const eligible = tournament.teams.filter(
      (team) => team._count.players === tournament.playersPerTeam,
    ).length;

    res.json(
      toTournamentDto(tournament, {
        registeredTeams: tournament.teams.length,
        eligibleTeams: eligible,
      }),
    );
  }),
);

tournamentsRouter.patch(
  '/:tournamentId',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    const existing = await loadOwnedTournament(tournamentId, req.user!.id);
    const input = parseBody(updateTournamentSchema, req.body);

    if (input.teamsCount !== undefined) {
      const registered = await prisma.team.count({ where: { tournamentId } });
      if (input.teamsCount < registered) {
        throw conflict(
          `${registered} teams are already registered — remove some before lowering the team count to ${input.teamsCount}`,
        );
      }
    }

    if (
      existing.status !== 'DRAFT' &&
      (input.format !== undefined ||
        input.oversPerInnings !== undefined ||
        input.doubleRoundRobin !== undefined)
    ) {
      throw unprocessable(
        'FIXTURES_EXIST',
        'Fixtures have been generated — format and overs can no longer be changed',
      );
    }

    const tournament = await prisma.tournament.update({
      where: { id: tournamentId },
      data: input,
    });

    res.json(toTournamentDto(tournament));
  }),
);

tournamentsRouter.delete(
  '/:tournamentId',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    const tournament = await loadOwnedTournament(tournamentId, req.user!.id);

    if (tournament.status === 'IN_PROGRESS') {
      throw unprocessable(
        'TOURNAMENT_IN_PROGRESS',
        'Matches are under way — a live tournament cannot be deleted',
      );
    }

    await prisma.tournament.delete({ where: { id: tournamentId } });
    res.status(204).end();
  }),
);

tournamentsRouter.get(
  '/:tournamentId/teams',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    const tournament = await loadOwnedTournament(tournamentId, req.user!.id);

    const teams = await prisma.team.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { players: true } } },
    });

    const items: TeamDto[] = teams.map((team) =>
      toTeamDto(
        team,
        evaluateEligibility(
          team.id,
          team._count.players,
          tournament.playersPerTeam,
          tournament.sport,
        ),
        tournament.sport,
      ),
    );

    res.json({
      items,
      total: items.length,
      eligibleCount: items.filter((team) => team.isEligible).length,
    });
  }),
);

tournamentsRouter.post(
  '/:tournamentId/teams',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');
    const tournament = await loadOwnedTournament(tournamentId, req.user!.id);
    assertSquadEditable(tournament.status);

    const input = parseBody(createTeamSchema, req.body);

    const registered = await prisma.team.count({ where: { tournamentId } });
    if (registered >= tournament.teamsCount) {
      throw conflict(
        `This tournament is set up for ${tournament.teamsCount} teams and already has that many. Raise the team count first.`,
      );
    }

    const team = await prisma.team.create({
      data: {
        tournamentId,
        name: input.name,
        shortName: input.shortName.toUpperCase(),
        primaryColor: input.primaryColor,
      },
    });

    res
      .status(201)
      .json(
        toTeamDto(
          team,
          evaluateEligibility(team.id, 0, tournament.playersPerTeam, tournament.sport),
          tournament.sport,
        ),
      );
  }),
);
