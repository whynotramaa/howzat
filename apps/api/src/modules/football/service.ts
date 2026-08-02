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

/**
 * The football write path, in the same order the cricket one uses:
 *
 *   1. authorization (route middleware)
 *   2. acquire lock:match:{id}
 *   3. read the log, stamp the minute, insert
 *   4. duplicate clientEventId → return the current snapshot with 200
 *   5. project, write the Redis snapshot
 *   6. publish
 *   7. release the lock
 *
 * Steps 3 and 5 are not atomic across two systems, and pretending otherwise
 * would be dishonest: Postgres is the truth, Redis is derived, and a crash
 * between them costs a stale cache rather than a lost goal.
 */

export interface FootballEventResult {
  snapshot: FootballSnapshot;
  /** True when this exact clientEventId had already been recorded. */
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

    // ── idempotency ─────────────────────────────────────────────────
    // A retry must be indistinguishable from the original success. The
    // scorer's phone has no way to know whether its first attempt landed,
    // so replaying a queued tap has to be safe.
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

    // A named player must be on one of the two team sheets. Which side they
    // are on is deliberately not checked against `teamId`: an own goal is
    // credited to the opposition, and that is the whole point of the field.
    if (input.playerId || input.assistPlayerId || input.playerOffId) {
      const named = [input.playerId, input.assistPlayerId, input.playerOffId].filter(
        (id): id is string => id !== null,
      );
      const onTeamSheet = new Set(match.matchPlayers.map((entry) => entry.playerId));

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
      await assertSubstitutionIsLegal(matchId, input.teamId, input.playerId!, input.playerOffId!);
    } else if (input.playerOffId) {
      throw unprocessable('SUB_NOT_APPLICABLE', 'Only a substitution names a player coming off');
    }

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

/**
 * Undo. Appends a row that names the event it removes; nothing is deleted,
 * because a goal that was wrongly given has to stay visible as a goal that was
 * wrongly given.
 */
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
      // An UNDO row carries a copy of what it removes rather than nulls: the
      // log is read by people as well as by the reducer, and "undo" with no
      // subject is an entry nobody can interpret a season later.
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

/**
 * The rules of a change, checked against the state the log actually produces
 * rather than against the team sheet as it was named.
 *
 * Football has no re-entry: once a player is off, they are off. That single
 * rule is what makes the other two checks necessary rather than paranoid — a
 * console that let you bring back somebody already hooked would produce a
 * pitch with twelve players on it, and no later correction could tell which of
 * the two appearances was the mistake.
 */
async function assertSubstitutionIsLegal(
  matchId: string,
  teamId: string,
  onId: string,
  offId: string,
): Promise<void> {
  const match = await loadFootballMatch(matchId);
  const events = await loadFootballEvents(matchId);
  const state = buildFootballState(footballContextFor(match), events);

  const side = teamId === match.team1!.id ? state.home : state.away;

  const starters = match.matchPlayers
    .filter((entry) => entry.teamId === teamId && entry.lineupSlot !== null)
    .map((entry) => ({ playerId: entry.playerId, slot: entry.lineupSlot! }));

  const onPitch = new Set(resolveOnPitch(starters, side).values());

  const belongsToSide = match.matchPlayers.some(
    (entry) => entry.teamId === teamId && (entry.playerId === onId || entry.playerId === offId),
  );

  if (!belongsToSide) {
    throw unprocessable('WRONG_TEAM', 'Both players must be on that side of the team sheet');
  }

  if (!onPitch.has(offId)) {
    throw unprocessable(
      'NOT_ON_PITCH',
      side.subbedOff.includes(offId)
        ? 'That player has already been substituted'
        : side.sentOff.includes(offId)
          ? 'That player has been sent off — a side that goes down to ten plays on'
          : 'That player is not on the pitch',
    );
  }

  if (onPitch.has(onId)) {
    throw unprocessable('ALREADY_ON', 'That player is already playing');
  }

  if (side.subbedOff.includes(onId)) {
    throw unprocessable('NO_RE_ENTRY', 'A player who has been taken off cannot come back on');
  }
}

/**
 * The next sequence number for this match. Read inside the lock, so it cannot
 * race; the unique index on (matchId, seq) is the belt to that braces, and a
 * violation is surfaced as a duplicate rather than a 500.
 */
async function nextSeq(matchId: string): Promise<number> {
  const last = await prisma.footballEvent.findFirst({
    where: { matchId },
    orderBy: { seq: 'desc' },
    select: { seq: true },
  });

  return (last?.seq ?? 0) + 1;
}

async function insertEvent(data: Prisma.FootballEventUncheckedCreateInput): Promise<'OK' | 'DUPLICATE'> {
  try {
    await prisma.footballEvent.create({ data });
    return 'OK';
  } catch (err) {
    // P2002 is a unique violation: either the same clientEventId arrived twice
    // concurrently, or two writers raced for a sequence number. Both are the
    // retry case, and both are answered with the current state.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'DUPLICATE';
    }
    throw err;
  }
}
