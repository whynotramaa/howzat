import { Router } from 'express';
import { buildState, formatOvers, bowlingFigures } from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { asyncHandler, requireParam } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { getSnapshot, loadEvents, loadInningsContext } from '../snapshot';
import { getStandings } from '../standings/service';

/**
 * The public surface behind a share link. No auth, no cookies, no organizer
 * data — only what a spectator needs. Matches are addressed by their random
 * publicSlug rather than their id, so nothing here can be enumerated.
 */
export const publicRouter = Router();

/** slug → id is immutable, so it caches indefinitely and saves a query per hit. */
async function resolveSlug(slug: string): Promise<string> {
  const cacheKey = `slug:${slug}`;

  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return cached;

  const match = await prisma.match.findUnique({
    where: { publicSlug: slug },
    select: { id: true },
  });

  if (!match) throw notFound('Match');

  await redis.set(cacheKey, match.id, 'EX', 86_400).catch(() => undefined);

  return match.id;
}

/** Match header: teams, status, toss, result. Enough to render before scoring. */
publicRouter.get(
  '/matches/:slug',
  asyncHandler(async (req, res) => {
    const slug = requireParam(req, 'slug');

    const match = await prisma.match.findUnique({
      where: { publicSlug: slug },
      include: {
        team1: true,
        team2: true,
        tournament: { select: { name: true, oversPerInnings: true } },
        innings: { orderBy: { number: 'asc' } },
      },
    });

    if (!match) throw notFound('Match');

    res.json({
      id: match.id,
      publicSlug: match.publicSlug,
      tournamentName: match.tournament.name,
      round: match.round,
      stage: match.stage,
      status: match.status,
      venue: match.venue,
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
      oversPerInnings: match.oversPerInnings,
      tossWinnerId: match.tossWinnerId,
      tossDecision: match.tossDecision,
      winnerTeamId: match.winnerTeamId,
      resultText: match.resultText,
      teams: [match.team1, match.team2].map((team) =>
        team
          ? {
              id: team.id,
              name: team.name,
              shortName: team.shortName,
              primaryColor: team.primaryColor,
            }
          : null,
      ),
      innings: match.innings.map((entry) => ({
        number: entry.number,
        battingTeamId: entry.battingTeamId,
        targetRuns: entry.targetRuns,
        status: entry.status,
        endReason: entry.endReason,
      })),
    });
  }),
);

/**
 * Step one of the mid-match join: current state, instantly, from Redis.
 * A cold cache falls back to folding the event log, so this is always correct
 * — never a replay from ball one, never a miss.
 */
publicRouter.get(
  '/matches/:slug/snapshot',
  asyncHandler(async (req, res) => {
    const slug = requireParam(req, 'slug');
    const matchId = await resolveSlug(slug);

    const snapshot = await getSnapshot(matchId);

    if (!snapshot) {
      res.json({ snapshot: null, matchId, message: 'This match has not started yet' });
      return;
    }

    // Viewers may sit on this for a while; a short cache is fine because the
    // socket delivers the updates.
    res.setHeader('Cache-Control', 'public, max-age=5');
    res.json(snapshot);
  }),
);

/** The points table, shareable without a login like everything else here. */
publicRouter.get(
  '/tournaments/:tournamentId/standings',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, format: true, status: true },
    });

    if (!tournament) throw notFound('Tournament');

    const matches = await prisma.match.findMany({
      where: { tournamentId, team1Id: { not: null }, team2Id: { not: null } },
      orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { round: 'asc' }],
      take: 12,
      include: {
        team1: { select: { id: true, name: true, shortName: true, primaryColor: true } },
        team2: { select: { id: true, name: true, shortName: true, primaryColor: true } },
      },
    });

    const statusPriority: Record<string, number> = {
      LIVE: 0,
      INNINGS_BREAK: 1,
      SCHEDULED: 2,
      COMPLETED: 3,
      ABANDONED: 4,
    };
    const featuredMatches = matches
      .sort((a, b) => (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9))
      .slice(0, 5)
      .map((match) => ({
        id: match.id,
        publicSlug: match.publicSlug,
        round: match.round,
        stage: match.stage,
        status: match.status,
        scheduledAt: match.scheduledAt?.toISOString() ?? null,
        resultText: match.resultText,
        team1: match.team1,
        team2: match.team2,
      }));

    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ tournament, items: await getStandings(tournamentId), matches: featuredMatches });
  }),
);

/** The full scorecard for every innings played so far. */
publicRouter.get(
  '/matches/:slug/scorecard',
  asyncHandler(async (req, res) => {
    const slug = requireParam(req, 'slug');
    const matchId = await resolveSlug(slug);

    const innings = await prisma.innings.findMany({
      where: { matchId },
      orderBy: { number: 'asc' },
      select: { id: true, number: true },
    });

    const cards = await Promise.all(
      innings.map(async (entry) => {
        const context = await loadInningsContext(entry.id);
        const events = await loadEvents(entry.id);
        const state = buildState(context, events);

        return {
          number: entry.number,
          battingTeam: context.battingTeam,
          bowlingTeam: context.bowlingTeam,
          runs: state.runs,
          wickets: state.wickets,
          overs: formatOvers(state.legalBalls),
          extras: state.extras,
          // Batting order, with everyone who came to the crease.
          batting: Object.values(state.batsmen)
            .sort((a, b) => a.position - b.position)
            .map((batsman) => ({
              playerId: batsman.playerId,
              name: batsman.name,
              runs: batsman.runs,
              balls: batsman.balls,
              fours: batsman.fours,
              sixes: batsman.sixes,
              isOut: batsman.isOut,
              dismissal: batsman.dismissal ?? 'not out',
            })),
          bowling: Object.values(state.bowlers).map((bowler) => ({
            playerId: bowler.playerId,
            name: bowler.name,
            overs: formatOvers(bowler.balls),
            maidens: bowler.maidens,
            runs: bowler.runs,
            wickets: bowler.wickets,
            figures: bowlingFigures(bowler.balls, bowler.maidens, bowler.runs, bowler.wickets),
          })),
          fallOfWickets: state.fallOfWickets,
          partnerships: state.partnerships,
        };
      }),
    );

    res.json({ matchId, innings: cards });
  }),
);
