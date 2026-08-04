import { Router } from 'express';
import { buildState, formatOvers, bowlingFigures } from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { asyncHandler, requireParam } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { getSnapshot, loadEvents, loadInningsContext } from '../snapshot';
import { getFootballSnapshot } from '../football/snapshot';
import { getStandings } from '../standings/service';
import { loadTournamentMatches } from '../tournaments/report';

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
        tournament: {
          select: {
            id: true,
            name: true,
            sport: true,
            oversPerInnings: true,
            periods: true,
            periodMinutes: true,
          },
        },
        innings: { orderBy: { number: 'asc' } },
      },
    });

    if (!match) throw notFound('Match');

    res.json({
      id: match.id,
      publicSlug: match.publicSlug,
      // The share link is one URL for both codes, so the very first thing it
      // has to answer is which scoreboard to draw.
      sport: match.tournament.sport,
      tournamentId: match.tournament.id,
      tournamentName: match.tournament.name,
      periods: match.tournament.periods,
      periodMinutes: match.tournament.periodMinutes,
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

/**
 * The football twin of the snapshot endpoint. A separate path rather than a
 * union on the cricket one: a spectator page already knows which sport it is
 * rendering by the time it asks, and one endpoint answering two unrelated
 * shapes would make every caller start with a discriminant check.
 */
publicRouter.get(
  '/matches/:slug/football',
  asyncHandler(async (req, res) => {
    const slug = requireParam(req, 'slug');
    const matchId = await resolveSlug(slug);

    const snapshot = await getFootballSnapshot(matchId);

    if (!snapshot) {
      res.json({ snapshot: null, matchId, message: 'This match has not kicked off yet' });
      return;
    }

    // Deliberately uncached at the edge, unlike the cricket snapshot. That one
    // is a set of numbers that only change when a ball is bowled; this one
    // carries `serverNow`, which every viewer measures their own clock against,
    // and a five-second-old copy would put five seconds of skew on the watch.
    res.setHeader('Cache-Control', 'no-store');
    res.json(snapshot);
  }),
);

/**
 * The whole tournament, shareable without a login like everything else here:
 * the full points table and *every* fixture, each carrying whatever it has
 * produced — a scoreline and a result once it is over, a kick-off time while
 * it is still to come.
 *
 * It used to answer with five fixtures and no scores, which made the public
 * board a teaser for a page that did not exist. A tournament is a season, and
 * the thing people want from a link to one is the season.
 */
publicRouter.get(
  '/tournaments/:tournamentId/standings',
  asyncHandler(async (req, res) => {
    const tournamentId = requireParam(req, 'tournamentId');

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        sport: true,
        format: true,
        status: true,
        teamsCount: true,
        playersPerTeam: true,
        oversPerInnings: true,
        periods: true,
        periodMinutes: true,
      },
    });

    if (!tournament) throw notFound('Tournament');

    const [items, matches] = await Promise.all([
      getStandings(tournamentId),
      loadTournamentMatches(tournamentId, tournament.sport),
    ]);

    const live = matches.filter((match) =>
      ['LIVE', 'INNINGS_BREAK'].includes(match.status),
    ).length;
    const completed = matches.filter((match) =>
      ['COMPLETED', 'ABANDONED'].includes(match.status),
    ).length;

    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({
      tournament,
      items,
      matches,
      totals: {
        total: matches.length,
        completed,
        live,
        upcoming: matches.length - completed - live,
      },
      generatedAt: new Date().toISOString(),
    });
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
