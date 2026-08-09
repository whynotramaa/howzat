import {
  buildFootballState,
  materializeFootballEvents,
  resolveOnPitch,
  type FootballEventRequestInput,
  type FootballSnapshot,
} from '@howzat/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { unprocessable } from '../../lib/errors';
import { matchLockKey, withLock } from '../../lib/lock';
import { publishMatchEvent } from '../../realtime/bus';
import {
  buildFootballSnapshot,
  footballContextFor,
  loadFootballEvents,
  loadFootballMatch,
  toClockDto,
  writeFootballSnapshot,
} from './snapshot';
import { clockReadingFor } from './lifecycle';

export interface FootballEventResult {
  snapshot: FootballSnapshot;
  duplicate: boolean;
  seq: number;
}

async function project(matchId: string): Promise<{ snapshot: FootballSnapshot; seq: number }> {
  const match = await loadFootballMatch(matchId);
  const events = await loadFootballEvents(matchId);
  const state = buildFootballState(footballContextFor(match), events);
  const snapshot = buildFootballSnapshot(match, state);

  return { snapshot, seq: state.lastEventSeq };
}

export async function recordFootballEvent(
  matchId: string,
  input: FootballEventRequestInput,
  userId: string,
): Promise<FootballEventResult> {
  return withLock(matchLockKey(matchId), async () => {
    const match = await loadFootballMatch(matchId);

    const existing = await prisma.footballEvent.findUnique({
      where: { clientEventId: input.clientEventId },
      select: { id: true },
    });

    if (existing) {
      const { snapshot, seq } = await project(matchId);
      await writeFootballSnapshot(snapshot);

      logger.debug({ matchId, clientEventId: input.clientEventId }, 'Duplicate event ignored');
      return { snapshot, duplicate: true, seq };
    }

    if (match.status !== 'LIVE' && match.status !== 'INNINGS_BREAK') {
      throw unprocessable(
        'MATCH_NOT_LIVE',
        'Kick off before recording anything — a match that is not under way has no minute to stamp',
      );
    }

    if (input.teamId !== match.team1!.id && input.teamId !== match.team2!.id) {
      throw unprocessable('NOT_IN_MATCH', 'That team is not playing in this match');
    }

    const calledUp =
      input.kind === 'SUBSTITUTION' && input.playerId
        ? await isSquadCallUp(input.teamId, input.playerId, match.matchPlayers)
        : false;

    if (input.playerId || input.assistPlayerId || input.playerOffId) {
      const named = [input.playerId, input.assistPlayerId, input.playerOffId].filter(
        (id): id is string => id !== null,
      );
      const onTeamSheet = new Set(match.matchPlayers.map((entry) => entry.playerId));
      if (calledUp) onTeamSheet.add(input.playerId!);

      for (const id of named) {
        if (!onTeamSheet.has(id)) {
          throw unprocessable('NOT_ON_TEAM_SHEET', 'That player is not on either team sheet');
        }
      }
    }

    if (input.assistPlayerId && input.assistPlayerId === input.playerId) {
      throw unprocessable('SELF_ASSIST', 'A player cannot assist their own goal');
    }

    if (input.assistPlayerId && input.kind !== 'GOAL') {
      throw unprocessable('ASSIST_NOT_APPLICABLE', 'Only a goal can carry an assist');
    }

    if (input.kind === 'SUBSTITUTION') {
      await assertSubstitutionIsLegal(
        matchId,
        input.teamId,
        input.playerId!,
        input.playerOffId!,
        calledUp,
      );
    } else if (input.playerOffId) {
      throw unprocessable('SUB_NOT_APPLICABLE', 'Only a substitution names a player coming off');
    }

    if (calledUp) await addToTeamSheet(matchId, input.teamId, input.playerId!);

    const reading = clockReadingFor(toClockDto(match.clock));
    const seq = await nextSeq(matchId);

    const created = await insertEvent({
      matchId,
      clientEventId: input.clientEventId,
      seq,
      eventType: 'EVENT',
      supersedesEventId: null,
      kind: input.kind,
      teamId: input.teamId,
      playerId: input.playerId,
      assistPlayerId: input.assistPlayerId,
      playerOffId: input.playerOffId,
      minute: reading.minute,
      period: reading.period,
      stoppage: reading.stoppage,
      createdBy: userId,
    });

    if (created === 'DUPLICATE') {
      const { snapshot, seq: currentSeq } = await project(matchId);
      await writeFootballSnapshot(snapshot);
      return { snapshot, duplicate: true, seq: currentSeq };
    }

    const { snapshot } = await project(matchId);
    await writeFootballSnapshot(snapshot);
    await publishMatchEvent('football:event', { matchId, snapshot, seq });

    return { snapshot, duplicate: false, seq };
  });
}

export async function undoFootballEvent(
  matchId: string,
  clientEventId: string,
  targetEventId: string | undefined,
  userId: string,
): Promise<FootballEventResult> {
  return withLock(matchLockKey(matchId), async () => {
    await loadFootballMatch(matchId);

    const existing = await prisma.footballEvent.findUnique({
      where: { clientEventId },
      select: { id: true },
    });

    if (existing) {
      const { snapshot, seq } = await project(matchId);
      return { snapshot, duplicate: true, seq };
    }

    const events = await loadFootballEvents(matchId);
    const standing = materializeFootballEvents(events);

    const target = targetEventId
      ? standing.find((event) => event.id === targetEventId)
      : standing[standing.length - 1];

    if (!target) {
      throw unprocessable(
        'NOTHING_TO_UNDO',
        targetEventId
          ? 'That incident has already been undone, or never existed'
          : 'There is nothing left to undo',
      );
    }

    const seq = await nextSeq(matchId);

    const created = await insertEvent({
      matchId,
      clientEventId,
      seq,
      eventType: 'UNDO',
      supersedesEventId: target.id,
      kind: target.kind,
      teamId: target.teamId,
      playerId: target.playerId,
      assistPlayerId: target.assistPlayerId,
      playerOffId: target.playerOffId,
      minute: target.minute,
      period: target.period,
      stoppage: target.stoppage,
      createdBy: userId,
    });

    if (created === 'DUPLICATE') {
      const { snapshot, seq: currentSeq } = await project(matchId);
      return { snapshot, duplicate: true, seq: currentSeq };
    }

    const { snapshot } = await project(matchId);
    await writeFootballSnapshot(snapshot);
    await publishMatchEvent('football:event', { matchId, snapshot, seq });

    return { snapshot, duplicate: false, seq };
  });
}

async function isSquadCallUp(
  teamId: string,
  playerId: string,
  sheet: { playerId: string }[],
): Promise<boolean> {
  if (sheet.some((entry) => entry.playerId === playerId)) return false;

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId },
    select: { id: true },
  });

  return player !== null;
}

async function addToTeamSheet(matchId: string, teamId: string, playerId: string): Promise<void> {
  try {
    await prisma.matchPlayer.create({
      data: { matchId, teamId, playerId, lineupSlot: null },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
  }

  logger.debug({ matchId, teamId, playerId }, 'Called a squad player onto the team sheet');
}

async function assertSubstitutionIsLegal(
  matchId: string,
  teamId: string,
  onId: string,
  offId: string,
  isCallUp: boolean,
): Promise<void> {
  const match = await loadFootballMatch(matchId);
  const events = await loadFootballEvents(matchId);
  const state = buildFootballState(footballContextFor(match), events);

  const side = teamId === match.team1!.id ? state.home : state.away;

  const starters = match.matchPlayers
    .filter((entry) => entry.teamId === teamId && entry.lineupSlot !== null)
    .map((entry) => ({ playerId: entry.playerId, slot: entry.lineupSlot! }));

  const onPitch = new Set(resolveOnPitch(starters, side).values());

  const onSide = (playerId: string) =>
    match.matchPlayers.some((entry) => entry.teamId === teamId && entry.playerId === playerId);

  if (!(isCallUp || onSide(onId)) || !onSide(offId)) {
    throw unprocessable('WRONG_TEAM', 'Both players must be on that side of the team sheet');
  }

  if (!onPitch.has(offId)) {
    throw unprocessable(
      'NOT_ON_PITCH',
      side.sentOff.includes(offId)
        ? 'That player has been sent off — a side that goes down to ten plays on'
        : 'That player is not on the pitch',
    );
  }

  if (onPitch.has(onId)) {
    throw unprocessable('ALREADY_ON', 'That player is already playing');
  }

  if (side.sentOff.includes(onId)) {
    throw unprocessable('SENT_OFF', 'A player who has been sent off cannot come back on');
  }

  // A player who has been taken off may come back on: these are rolling
  // substitutions, capped only by the limit the scorer set at kick off.
  const limit = match.subLimit;

  if (limit !== null && side.substitutions.length >= limit) {
    throw unprocessable(
      'SUB_LIMIT_REACHED',
      `That side has used all ${limit} of its substitutions`,
      { teamId, limit, used: side.substitutions.length },
    );
  }
}

async function nextSeq(matchId: string): Promise<number> {
  const last = await prisma.footballEvent.findFirst({
    where: { matchId },
    orderBy: { seq: 'desc' },
    select: { seq: true },
  });

  return (last?.seq ?? 0) + 1;
}

async function insertEvent(
  data: Prisma.FootballEventUncheckedCreateInput,
): Promise<'OK' | 'DUPLICATE'> {
  try {
    await prisma.footballEvent.create({ data });
    return 'OK';
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'DUPLICATE';
    }
    throw err;
  }
}
