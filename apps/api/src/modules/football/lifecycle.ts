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

  await assertTeamEligible(match.team1!.id);
  await assertTeamEligible(match.team2!.id);

  for (const team of input.teams) {
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
    for (const playerId of [...team.players.map((entry) => entry.playerId), ...team.substitutes]) {
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
      isKeeper: player.slot === 0,
    })),
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

export async function kickOff(matchId: string, input: KickOffInput = {}) {
  const match = await loadFootballMatch(matchId);

  if (match.clock) {
    throw unprocessable('ALREADY_STARTED', 'This match has already kicked off');
  }

  if (match.status !== 'TOSS') {
    throw unprocessable('LINEUPS_NOT_SET', 'Name both team sheets before kicking off');
  }

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

  const periods = input.periods ?? match.periods ?? match.tournament.periods;
  const periodMinutes =
    input.periodMinutes ?? match.periodMinutes ?? match.tournament.periodMinutes;

  const subLimit = input.substitutionLimit !== undefined ? input.substitutionLimit : match.subLimit;

  const now = new Date();

  const [, clock] = await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: { status: 'LIVE', periods, periodMinutes, subLimit },
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
        status: updated.status === 'PERIOD_BREAK' ? 'INNINGS_BREAK' : 'LIVE',
      },
    });
    await broadcastClock(matchId);
  }

  return updated;
}

export function clockReadingFor(clock: MatchClockDto | null) {
  return readClock(clock, Date.now());
}

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

  await publishMatchEvent('match:completed', {
    matchId,
    tournamentId: match.tournamentId,
    winnerTeamId,
  });

  return updated;
}

export async function broadcastClock(matchId: string): Promise<void> {
  const match = await loadFootballMatch(matchId);
  const events = await loadFootballEvents(matchId);
  const state = buildFootballState(footballContextFor(match), events);
  const snapshot = buildFootballSnapshot(match, state);

  await writeFootballSnapshot(snapshot);
  await publishMatchEvent('football:clock', { matchId, snapshot });
}
