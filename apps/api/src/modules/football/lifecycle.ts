import {
  buildFootballState,
  elapsedAt,
  footballResultText,
  isCommandAllowed,
  isValidFormation,
  readClock,
  type ClockCommand,
  type FootballLineupInput,
  type KickOffInput,
  type MatchClockDto,
} from '@howzat/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { unprocessable } from '../../lib/errors';
import { publishMatchEvent } from '../../realtime/bus';
import { assertTeamEligible } from '../teams/eligibility';
import {
  buildFootballSnapshot,
  footballContextFor,
  loadFootballEvents,
  loadFootballMatch,
  toClockDto,
  writeFootballSnapshot,
} from './snapshot';

/**
 * The state machine a football match walks through:
 *
 *   SCHEDULED → TOSS (team sheets named) → LIVE ⇄ INNINGS_BREAK → COMPLETED
 *
 * The status enum is cricket's, and reusing it rather than adding a parallel
 * one is a considered trade. Every screen, filter and index in the product
 * already keys on MatchStatus, and a second enum would have forked all of them
 * to express the same five ideas. The only awkward name is INNINGS_BREAK, which
 * here means half-time — the concept is identical, the word is not, and the UI
 * says "half-time" wherever a football match is being shown.
 */

// ──────────────────────────────────────────────────────  team sheets ──

/**
 * Freezes both team sheets and the shapes they line up in. Replaces any
 * previous selection wholesale, which is safe only before kick-off — enforced
 * below, for the same reason the cricket XI is locked at the first ball.
 */
export async function setFootballLineups(matchId: string, input: FootballLineupInput) {
  const match = await loadFootballMatch(matchId);

  if (match.status !== 'SCHEDULED' && match.status !== 'TOSS') {
    throw unprocessable(
      'MATCH_STARTED',
      'The team sheets are locked once the match has kicked off',
    );
  }

  const squadSize = match.tournament.playersPerTeam;
  const expected = new Set([match.team1!.id, match.team2!.id]);
  const given = new Set(input.teams.map((team) => team.teamId));

  if (given.size !== 2 || ![...given].every((id) => expected.has(id))) {
    throw unprocessable('WRONG_TEAMS', 'The team sheets must be for the two teams in this match');
  }

  // Both squads must still hold a full complement — the same predicate that
  // gates fixture generation, applied at its second call site.
  await assertTeamEligible(match.team1!.id);
  await assertTeamEligible(match.team2!.id);

  for (const team of input.teams) {
    // The *starting* side must be exact. The bench is free to be any size the
    // squad allows, which is why only this half is checked against squadSize.
    if (team.players.length !== squadSize) {
      throw unprocessable(
        'LINEUP_INCOMPLETE',
        `Name exactly ${squadSize} starters — ${team.players.length} selected`,
        { teamId: team.teamId, named: team.players.length, required: squadSize },
      );
    }

    if (!isValidFormation(team.formation, squadSize)) {
      throw unprocessable(
        'BAD_FORMATION',
        `${team.formation} does not add up to ${squadSize} players including the goalkeeper`,
        { teamId: team.teamId, formation: team.formation },
      );
    }
  }

  // Every named player must actually belong to the team naming them — the
  // bench included, because a substitute can be shown a card from it.
  const playerIds = input.teams.flatMap((team) => [
    ...team.players.map((player) => player.playerId),
    ...team.substitutes,
  ]);

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, teamId: true, name: true },
  });

  const byId = new Map(players.map((player) => [player.id, player]));

  for (const team of input.teams) {
    for (const playerId of [
      ...team.players.map((entry) => entry.playerId),
      ...team.substitutes,
    ]) {
      const player = byId.get(playerId);

      if (!player) {
        throw unprocessable('UNKNOWN_PLAYER', `Player ${playerId} does not exist`);
      }

      if (player.teamId !== team.teamId) {
        throw unprocessable(
          'PLAYER_WRONG_TEAM',
          `${player.name} is not registered to the team that named them`,
        );
      }
    }
  }

  const rows: Prisma.MatchPlayerCreateManyInput[] = input.teams.flatMap((team) => [
    ...team.players.map((player) => ({
      matchId,
      teamId: team.teamId,
      playerId: player.playerId,
      lineupSlot: player.slot,
      shirtNumber: player.shirtNumber,
      isCaptain: player.isCaptain,
      // Slot 0 is the goalkeeper by definition of the formation geometry, so
      // the keeper flag is derived rather than asked for a second time. It is
      // also the only position football asks anyone to name.
      isKeeper: player.slot === 0,
    })),
    // The bench: on the team sheet, with no slot, which is what makes them
    // substitutes everywhere downstream.
    ...team.substitutes.map((playerId) => ({
      matchId,
      teamId: team.teamId,
      playerId,
      lineupSlot: null,
      shirtNumber: null,
      isCaptain: false,
      isKeeper: false,
    })),
  ]);

  const home = input.teams.find((team) => team.teamId === match.team1!.id);
  const away = input.teams.find((team) => team.teamId === match.team2!.id);

  await prisma.$transaction([
    prisma.matchPlayer.deleteMany({ where: { matchId } }),
    prisma.matchPlayer.createMany({ data: rows }),
    prisma.match.update({
      where: { id: matchId },
      data: {
        team1Formation: home?.formation,
        team2Formation: away?.formation,
        // TOSS is the pre-match staging state in both codes; football simply
        // reaches it by naming a team sheet rather than by spinning a coin.
        status: 'TOSS',
      },
    }),
  ]);

  return prisma.matchPlayer.findMany({
    where: { matchId },
    include: { player: true },
    orderBy: [{ teamId: 'asc' }, { lineupSlot: 'asc' }],
  });
}

// ────────────────────────────────────────────────────────────  clock ──

/**
 * Kick-off.
 *
 * The clock's length is resolved here from three sources, most specific first,
 * and then *copied* onto the clock rather than referenced — so an organizer
 * editing the tournament next week cannot move the watch on a match that has
 * already been played.
 */
export async function kickOff(matchId: string, input: KickOffInput = {}) {
  const match = await loadFootballMatch(matchId);

  if (match.clock) {
    throw unprocessable('ALREADY_STARTED', 'This match has already kicked off');
  }

  if (match.status !== 'TOSS') {
    throw unprocessable('LINEUPS_NOT_SET', 'Name both team sheets before kicking off');
  }

  // Starters only. A bench of different sizes is normal and must not make one
  // side's team sheet look incomplete.
  const starters = await prisma.matchPlayer.count({
    where: { matchId, lineupSlot: { not: null } },
  });
  const required = match.tournament.playersPerTeam * 2;

  if (starters !== required) {
    throw unprocessable(
      'LINEUPS_NOT_SET',
      `Both starting sides must be named — ${starters} of ${required} players selected`,
    );
  }

  // Three places this can come from, most specific first: what the person
  // blowing the whistle just chose, what was saved on this fixture earlier,
  // and the tournament's default. Resolved once, here, and then frozen onto
  // the clock — so editing the tournament next week cannot move a watch that
  // is already running.
  const periods = input.periods ?? match.periods ?? match.tournament.periods;
  const periodMinutes =
    input.periodMinutes ?? match.periodMinutes ?? match.tournament.periodMinutes;

  const now = new Date();

  const [, clock] = await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      // Persisted on the match as well as the clock so the fixture still
      // reports its own length after full time, when the clock is history.
      data: { status: 'LIVE', periods, periodMinutes },
    }),
    prisma.matchClock.create({
      data: {
        matchId,
        periods,
        periodMinutes,
        currentPeriod: 1,
        status: 'RUNNING',
        elapsedMs: 0,
        runningSince: now,
        startedAt: now,
      },
    }),
    prisma.tournament.update({
      where: { id: match.tournamentId },
      data: { status: 'IN_PROGRESS' },
    }),
  ]);

  await broadcastClock(matchId);

  return clock;
}

/**
 * Every movement of the watch, in one guarded transition.
 *
 * The legality table lives in @howzat/shared and is consulted by the console
 * before it offers a button and by this function before it obeys one — one
 * rule, enforced twice, which is the only arrangement where the greyed-out
 * button and the 422 can never disagree.
 */
export async function moveClock(matchId: string, command: ClockCommand) {
  const match = await loadFootballMatch(matchId);
  const clock = match.clock;

  if (!clock) {
    throw unprocessable('NOT_STARTED', 'This match has not kicked off yet');
  }

  const isLastPeriod = clock.currentPeriod >= clock.periods;

  if (!isCommandAllowed(clock.status, isLastPeriod, command)) {
    throw unprocessable(
      'CLOCK_COMMAND_REFUSED',
      `The clock cannot be told to ${command.toLowerCase().replace(/_/g, ' ')} from ${clock.status
        .toLowerCase()
        .replace(/_/g, ' ')}`,
      { status: clock.status, command },
    );
  }

  const now = new Date();
  // Banking the run before changing state is what makes a pause lossless: the
  // elapsed figure is recomputed from the same arithmetic the client renders.
  const banked = elapsedAt(toClockDto(clock)!, now.getTime());

  const data: Prisma.MatchClockUpdateInput = (() => {
    switch (command) {
      case 'START':
        return { status: 'RUNNING', runningSince: now, startedAt: clock.startedAt ?? now };
      case 'PAUSE':
        return { status: 'PAUSED', elapsedMs: banked, runningSince: null };
      case 'RESUME':
        return { status: 'RUNNING', runningSince: now };
      case 'END_PERIOD':
        return { status: 'PERIOD_BREAK', elapsedMs: banked, runningSince: null };
      case 'START_NEXT_PERIOD':
        // The next period starts from zero: elapsed time is per-period, and the
        // cumulative minute is reconstructed from currentPeriod when read.
        return {
          status: 'RUNNING',
          currentPeriod: clock.currentPeriod + 1,
          elapsedMs: 0,
          runningSince: now,
        };
      case 'FULL_TIME':
        return { status: 'FINISHED', elapsedMs: banked, runningSince: null };
    }
  })();

  const updated = await prisma.matchClock.update({ where: { matchId }, data });

  if (command === 'FULL_TIME') {
    await completeFootballMatch(matchId);
  } else {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        // Half-time reuses cricket's break state; see the note at the top.
        status: updated.status === 'PERIOD_BREAK' ? 'INNINGS_BREAK' : 'LIVE',
      },
    });
    await broadcastClock(matchId);
  }

  return updated;
}

/**
 * Where the clock stands right now, for stamping an event's minute.
 *
 * Read from the database rather than passed in by the caller, because the
 * minute on a goal is the one number in the football log that cannot be
 * re-derived later and must not be a client's opinion.
 */
export function clockReadingFor(clock: MatchClockDto | null) {
  return readClock(clock, Date.now());
}

// ────────────────────────────────────────────────────────  full time ──

/**
 * Writes the result. A draw names no winner, which is the difference that made
 * this worth writing rather than reusing completeMatch: cricket's result writer
 * assumes a chase and a defence, and football has neither.
 */
export async function completeFootballMatch(matchId: string) {
  const match = await loadFootballMatch(matchId);
  const events = await loadFootballEvents(matchId);
  const state = buildFootballState(footballContextFor(match), events);

  const { text, winner } = footballResultText(
    { name: match.team1!.name, goals: state.home.goals },
    { name: match.team2!.name, goals: state.away.goals },
  );

  const winnerTeamId =
    winner === 'HOME' ? match.team1!.id : winner === 'AWAY' ? match.team2!.id : null;

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { status: 'COMPLETED', winnerTeamId, resultText: text },
  });

  await prisma.matchClock.updateMany({
    where: { matchId },
    data: { status: 'FINISHED', runningSince: null },
  });

  await broadcastClock(matchId);

  // The trigger for the league table rebuild. Awaited because a serverless host
  // freezes this instance the moment the response goes out, which would leave
  // the recompute half-finished.
  await publishMatchEvent('match:completed', {
    matchId,
    tournamentId: match.tournamentId,
    winnerTeamId,
  });

  return updated;
}

/**
 * Re-projects and fans out. Called after anything that moves the clock but
 * records no incident, which a snapshot broadcast still has to reflect —
 * a paused watch that keeps ticking on every viewer's phone is worse than no
 * clock at all.
 */
export async function broadcastClock(matchId: string): Promise<void> {
  const match = await loadFootballMatch(matchId);
  const events = await loadFootballEvents(matchId);
  const state = buildFootballState(footballContextFor(match), events);
  const snapshot = buildFootballSnapshot(match, state);

  await writeFootballSnapshot(snapshot);
  await publishMatchEvent('football:clock', { matchId, snapshot });
}
