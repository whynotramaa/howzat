import {
  PLAYERS_PER_TEAM,
  formatOvers,
  type MatchState,
  type PlayingXiInput,
  type TossInput,
} from '@howzat/shared';
import type { Match, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { notFound, unprocessable } from '../../lib/errors';
import { assertTeamEligible } from '../teams/eligibility';
import { publishMatchEvent } from '../../realtime/bus';

/**
 * The state machine a match walks through:
 *
 *   SCHEDULED → TOSS → LIVE → (INNINGS_BREAK → LIVE) → COMPLETED
 *
 * Each transition is guarded, because every one of them has a downstream
 * consequence that is expensive to unwind: the XI is frozen at toss, the
 * event log opens at the first innings, and completion is what triggers the
 * points table in Phase 6.
 */

export async function loadMatchOrThrow(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team1: true,
      team2: true,
      tournament: { select: { id: true, organizerId: true, oversPerInnings: true } },
      innings: { orderBy: { number: 'asc' } },
    },
  });

  if (!match) throw notFound('Match');
  return match;
}

// ────────────────────────────────────────────────────────────  toss ──

export async function recordToss(matchId: string, input: TossInput) {
  const match = await loadMatchOrThrow(matchId);

  if (match.status !== 'SCHEDULED' && match.status !== 'TOSS') {
    throw unprocessable('MATCH_STARTED', 'The toss can only be set before play begins');
  }

  if (!match.team1Id || !match.team2Id) {
    throw unprocessable(
      'TEAMS_NOT_SET',
      'This bracket slot has no teams yet — its feeder matches must finish first',
    );
  }

  if (input.tossWinnerId !== match.team1Id && input.tossWinnerId !== match.team2Id) {
    throw unprocessable('NOT_IN_MATCH', 'The toss winner must be one of the two teams');
  }

  // Both squads must still hold exactly eleven — the same predicate that
  // gates fixture generation, applied at the second of its two call sites.
  await assertTeamEligible(match.team1Id);
  await assertTeamEligible(match.team2Id);

  return prisma.match.update({
    where: { id: matchId },
    data: {
      tossWinnerId: input.tossWinnerId,
      tossDecision: input.decision,
      status: 'TOSS',
    },
    include: { team1: true, team2: true },
  });
}

// ──────────────────────────────────────────────────────  playing XI ──

/**
 * Freezes both XIs. Replaces any previous selection wholesale, which is safe
 * only while no ball has been bowled — enforced below.
 */
export async function setPlayingXi(matchId: string, input: PlayingXiInput) {
  const match = await loadMatchOrThrow(matchId);

  if (match.status !== 'TOSS' && match.status !== 'SCHEDULED') {
    throw unprocessable(
      'MATCH_STARTED',
      'The playing XI is locked once the first innings has begun',
    );
  }

  if (!match.team1Id || !match.team2Id) {
    throw unprocessable('TEAMS_NOT_SET', 'This match has no teams yet');
  }

  const expected = new Set([match.team1Id, match.team2Id]);
  const given = new Set(input.teams.map((team) => team.teamId));

  if (given.size !== 2 || ![...given].every((id) => expected.has(id))) {
    throw unprocessable('WRONG_TEAMS', 'The XIs must be for the two teams in this match');
  }

  // Every named player must actually belong to the team naming them.
  const playerIds = input.teams.flatMap((team) => team.players.map((player) => player.playerId));

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, teamId: true, name: true },
  });

  const byId = new Map(players.map((player) => [player.id, player]));

  for (const team of input.teams) {
    for (const entry of team.players) {
      const player = byId.get(entry.playerId);

      if (!player) {
        throw unprocessable('UNKNOWN_PLAYER', `Player ${entry.playerId} does not exist`);
      }

      if (player.teamId !== team.teamId) {
        throw unprocessable(
          'PLAYER_WRONG_TEAM',
          `${player.name} is not registered to the team that named them`,
        );
      }
    }
  }

  const rows: Prisma.MatchPlayerCreateManyInput[] = input.teams.flatMap((team) =>
    team.players.map((player) => ({
      matchId,
      teamId: team.teamId,
      playerId: player.playerId,
      battingOrder: player.battingOrder,
      isCaptain: player.isCaptain,
      isKeeper: player.isKeeper,
    })),
  );

  await prisma.$transaction([
    prisma.matchPlayer.deleteMany({ where: { matchId } }),
    prisma.matchPlayer.createMany({ data: rows }),
  ]);

  return prisma.matchPlayer.findMany({
    where: { matchId },
    include: { player: true },
    orderBy: [{ teamId: 'asc' }, { battingOrder: 'asc' }],
  });
}

// ─────────────────────────────────────────────────────────  innings ──

/** Who bats first, derived from the toss rather than asked for again. */
export function battingFirstTeamId(match: Match): string {
  const { tossWinnerId, tossDecision, team1Id, team2Id } = match;

  if (!tossWinnerId || !tossDecision || !team1Id || !team2Id) {
    throw unprocessable('NO_TOSS', 'Record the toss before starting the innings');
  }

  const tossLoserId = tossWinnerId === team1Id ? team2Id : team1Id;

  return tossDecision === 'BAT' ? tossWinnerId : tossLoserId;
}

export async function openFirstInnings(matchId: string) {
  const match = await loadMatchOrThrow(matchId);

  if (match.status === 'LIVE' || match.innings.length > 0) {
    throw unprocessable('ALREADY_STARTED', 'This match has already started');
  }

  if (match.status !== 'TOSS') {
    throw unprocessable('NO_TOSS', 'Record the toss before starting the match');
  }

  const xiCount = await prisma.matchPlayer.count({ where: { matchId } });

  if (xiCount !== PLAYERS_PER_TEAM * 2) {
    throw unprocessable(
      'XI_NOT_SET',
      `Both playing XIs must be named — ${xiCount} of ${PLAYERS_PER_TEAM * 2} players selected`,
    );
  }

  const battingTeamId = battingFirstTeamId(match);
  const bowlingTeamId = battingTeamId === match.team1Id ? match.team2Id! : match.team1Id!;

  const [, innings] = await prisma.$transaction([
    prisma.match.update({ where: { id: matchId }, data: { status: 'LIVE' } }),
    prisma.innings.create({
      data: {
        matchId,
        number: 1,
        battingTeamId,
        bowlingTeamId,
        oversQuota: match.oversPerInnings,
      },
    }),
    prisma.tournament.update({
      where: { id: match.tournamentId },
      data: { status: 'IN_PROGRESS' },
    }),
  ]);

  return innings;
}

/**
 * Closes an innings and decides what happens next: innings two opens with a
 * target, or the match is over and the result is written.
 *
 * Called from inside the scoring lock, so no other ball can land mid-decision.
 */
export async function closeInnings(
  inningsId: string,
  state: MatchState,
): Promise<{ matchCompleted: boolean; nextInningsId: string | null }> {
  const innings = await prisma.innings.findUnique({
    where: { id: inningsId },
    include: { match: { include: { team1: true, team2: true } } },
  });

  if (!innings) throw notFound('Innings');
  if (innings.status === 'COMPLETED') {
    return { matchCompleted: innings.match.status === 'COMPLETED', nextInningsId: null };
  }

  await prisma.innings.update({
    where: { id: inningsId },
    data: { status: 'COMPLETED', endReason: state.endReason },
  });

  if (innings.number === 1) {
    // The chase needs one more than what was just scored.
    const next = await prisma.innings.create({
      data: {
        matchId: innings.matchId,
        number: 2,
        battingTeamId: innings.bowlingTeamId,
        bowlingTeamId: innings.battingTeamId,
        oversQuota: innings.oversQuota,
        targetRuns: state.runs + 1,
      },
    });

    await prisma.match.update({
      where: { id: innings.matchId },
      data: { status: 'INNINGS_BREAK' },
    });

    return { matchCompleted: false, nextInningsId: next.id };
  }

  await completeMatch(innings.matchId, state);
  return { matchCompleted: true, nextInningsId: null };
}

/**
 * Writes the result. The wording follows the convention every scorecard uses:
 * a side batting second wins "by N wickets", a side defending wins "by N runs".
 */
export async function completeMatch(matchId: string, secondInningsState: MatchState) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { innings: { orderBy: { number: 'asc' } }, team1: true, team2: true },
  });

  if (!match) throw notFound('Match');

  const first = match.innings.find((entry) => entry.number === 1);
  const second = match.innings.find((entry) => entry.number === 2);

  if (!first || !second) throw unprocessable('NO_INNINGS', 'The match has no second innings');

  const target = second.targetRuns ?? 0;
  const chasingRuns = secondInningsState.runs;
  const firstInningsRuns = target - 1;

  const chasingTeam = teamById(match, second.battingTeamId);
  const defendingTeam = teamById(match, second.bowlingTeamId);

  let winnerTeamId: string | null = null;
  let resultText: string;

  if (chasingRuns >= target) {
    const wicketsLeft = PLAYERS_PER_TEAM - 1 - secondInningsState.wickets;
    const ballsLeft = second.oversQuota * 6 - secondInningsState.legalBalls;

    winnerTeamId = second.battingTeamId;
    resultText =
      `${chasingTeam} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}` +
      (ballsLeft > 0 ? ` with ${ballsLeft} ball${ballsLeft === 1 ? '' : 's'} to spare` : '');
  } else if (chasingRuns === firstInningsRuns) {
    resultText = 'Match tied';
  } else {
    const margin = firstInningsRuns - chasingRuns;
    winnerTeamId = second.bowlingTeamId;
    resultText = `${defendingTeam} won by ${margin} run${margin === 1 ? '' : 's'}`;
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { status: 'COMPLETED', winnerTeamId, resultText },
  });

  // The trigger for the points table and NRR recompute in Phase 6.
  publishMatchEvent('match:completed', {
    matchId,
    tournamentId: match.tournamentId,
    winnerTeamId,
  });

  return updated;
}

/** Abandons a match without a result — rain, or a side that never showed. */
export async function abandonMatch(matchId: string, resultText?: string) {
  const match = await loadMatchOrThrow(matchId);

  if (match.status === 'COMPLETED') {
    throw unprocessable('ALREADY_COMPLETE', 'This match already has a result');
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'ABANDONED',
      resultText: resultText ?? 'Match abandoned — no result',
      winnerTeamId: null,
    },
  });

  publishMatchEvent('match:completed', {
    matchId,
    tournamentId: match.tournamentId,
    winnerTeamId: null,
  });

  return updated;
}

/** Used in result text and in the innings-break summary. */
export function describeInnings(state: MatchState): string {
  return `${state.runs}/${state.wickets} (${formatOvers(state.legalBalls)})`;
}

function teamById(
  match: { team1: { id: string; name: string } | null; team2: { id: string; name: string } | null },
  teamId: string,
): string {
  if (match.team1?.id === teamId) return match.team1.name;
  if (match.team2?.id === teamId) return match.team2.name;
  return 'Unknown team';
}
