import {
  BALLS_PER_OVER,
  buildState,
  isLegalDelivery,
  materializeEvents,
  validateBall,
  type BallEvent,
  type BallRequestInput,
  type InningsContext,
  type MatchSnapshot,
  type MatchState,
} from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { conflict, notFound, unprocessable } from '../../lib/errors';
import { matchLockKey, withLock } from '../../lib/lock';
import { publishMatchEvent } from '../../realtime/bus';
import {
  buildSnapshot,
  loadEvents,
  loadInningsContext,
  toBallEvent,
  writeSnapshot,
} from '../snapshot';
import { closeInnings } from '../matches/lifecycle';
import { dlsSnapshotFor } from '../dls/service';

export interface BallResult {
  snapshot: MatchSnapshot;
  state: MatchState;
  duplicate: boolean;
  inningsCompleted: boolean;
  matchCompleted: boolean;
}

interface LiveInnings {
  id: string;
  matchId: string;
  status: string;
}

async function loadLiveInnings(matchId: string): Promise<LiveInnings> {
  const innings = await prisma.innings.findFirst({
    where: { matchId, status: 'IN_PROGRESS' },
    orderBy: { number: 'desc' },
  });

  if (!innings) {
    throw unprocessable(
      'NO_LIVE_INNINGS',
      'No innings is in progress — start the match or the second innings first',
    );
  }

  return innings;
}

function previousOverBowlerId(events: BallEvent[], state: MatchState): string | null {
  if (state.thisOver.length > 0) return null;
  if (state.legalBalls === 0) return null;

  const deliveries = materializeEvents(events);
  const last = deliveries[deliveries.length - 1];

  return last?.bowlerId ?? null;
}

export async function recordBall(
  matchId: string,
  input: BallRequestInput,
  userId: string,
): Promise<BallResult> {
  return withLock(matchLockKey(matchId), async () => {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, publicSlug: true, status: true, resultText: true, revision: true },
    });

    if (!match) throw notFound('Match');

    const existing = await prisma.ballEvent.findUnique({
      where: { clientEventId: input.clientEventId },
    });

    if (existing) {
      assertSameRequest(existing, matchId, input, 'BALL');
      const { state, snapshot } = await project(match, existing.inningsId);

      logger.debug({ matchId, clientEventId: input.clientEventId }, 'Duplicate ball ignored');

      return {
        snapshot,
        state,
        duplicate: true,
        inningsCompleted: state.isComplete,
        matchCompleted: match.status === 'COMPLETED',
      };
    }

    const innings = await loadLiveInnings(matchId);
    if (input.inningsId && input.inningsId !== innings.id)
      throw unprocessable('WRONG_INNINGS', 'This queued ball belongs to another innings');
    const context = await loadInningsContext(innings.id);
    const events = await loadEvents(innings.id);
    const state = buildState(context, events);

    const verdict = validateBall(state, input, context, {
      matchStatus: match.status,
      previousOverBowlerId: previousOverBowlerId(events, state),
    });

    if (!verdict.ok) {
      throw unprocessable(
        verdict.issues[0]?.code ?? 'INVALID_BALL',
        verdict.issues[0]?.message ?? 'That ball is not legal',
        verdict.issues,
      );
    }

    const legal = isLegalDelivery(input.extraType);
    const legalThisOver = state.thisOver.filter((ball) => ball.isLegalDelivery).length;

    const created = await prisma.ballEvent.create({
      data: {
        matchId,
        inningsId: innings.id,
        clientEventId: input.clientEventId,
        seq: state.lastEventSeq + 1,
        overNumber: state.currentOverNumber,
        ballNumber: Math.min(legalThisOver + 1, BALLS_PER_OVER),
        eventType: 'BALL',
        isLegalDelivery: legal,
        runsOffBat: input.runsOffBat,
        extraRuns: input.extraRuns,
        extraType: input.extraType,
        isWicket: input.isWicket,
        wicketType: input.wicketType,
        dismissedPlayerId: input.dismissedPlayerId,
        fielderId: input.fielderId,
        strikerId: input.strikerId,
        nonStrikerId: input.nonStrikerId,
        bowlerId: input.bowlerId,
        createdBy: userId,
      },
    });

    const nextState = buildState(context, [...events, toBallEvent(created)]);
    const snapshot = buildSnapshot(match, nextState, context, await dlsSnapshotFor(matchId));

    let matchCompleted = false;

    if (nextState.isComplete) {
      const outcome = await closeInnings(innings.id, nextState);
      matchCompleted = outcome.matchCompleted;

      const refreshed = await prisma.match.findUnique({
        where: { id: matchId },
        select: { status: true, resultText: true, revision: true },
      });

      if (refreshed) {
        snapshot.status = refreshed.status;
        snapshot.resultText = refreshed.resultText;
      }

      // Closing the first innings creates the chase, which is the moment the
      // revised target exists — so the snapshot has to be told again.
      snapshot.dls = await dlsSnapshotFor(matchId);

      await publishMatchEvent('innings:complete', {
        matchId,
        inningsNumber: nextState.inningsNumber,
        snapshot,
      });
    }

    await writeSnapshot(snapshot);
    await publishMatchEvent('ball', { matchId, snapshot, seq: created.seq });

    return {
      snapshot,
      state: nextState,
      duplicate: false,
      inningsCompleted: nextState.isComplete,
      matchCompleted,
    };
  });
}

export async function correctBall(
  matchId: string,
  targetEventId: string,
  replacement: BallRequestInput,
  userId: string,
): Promise<BallResult> {
  return withLock(matchLockKey(matchId), async () => {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, publicSlug: true, status: true, resultText: true, revision: true },
    });

    if (!match) throw notFound('Match');

    const target = await prisma.ballEvent.findUnique({ where: { id: targetEventId } });

    if (!target || target.matchId !== matchId) throw notFound('Ball');

    if (target.eventType !== 'BALL') {
      throw unprocessable('NOT_CORRECTABLE', 'Only a delivery can be corrected');
    }

    const duplicate = await prisma.ballEvent.findUnique({
      where: { clientEventId: replacement.clientEventId },
    });

    if (duplicate) {
      assertSameRequest(duplicate, matchId, replacement, 'CORRECTION', target.id);
      const { state, snapshot } = await project(match, target.inningsId);
      return {
        snapshot,
        state,
        duplicate: true,
        inningsCompleted: state.isComplete,
        matchCompleted: false,
      };
    }

    const live = await loadLiveInnings(matchId);
    if (match.status !== 'LIVE' || live.id !== target.inningsId) {
      throw unprocessable('MATCH_CLOSED', 'Only the current live innings can be corrected');
    }

    const events = await loadEvents(target.inningsId);
    const active = materializeEvents(events);
    if (active.at(-1)?.id !== target.id && active.at(-1)?.supersedesEventId !== target.id) {
      throw unprocessable('HISTORICAL_EDIT', 'Undo later balls before correcting this delivery');
    }
    const context = await loadInningsContext(target.inningsId);
    const before = buildState(
      context,
      events.filter((event) => event.id !== target.id && event.supersedesEventId !== target.id),
    );
    const verdict = validateBall(before, replacement, context, {
      matchStatus: match.status,
      previousOverBowlerId: previousOverBowlerId(
        events.filter((event) => event.id !== target.id && event.supersedesEventId !== target.id),
        before,
      ),
    });
    if (!verdict.ok)
      throw unprocessable(
        'INVALID_BALL',
        verdict.issues[0]?.message ?? 'Invalid correction',
        verdict.issues,
      );
    const highestSeq = events.reduce((max, event) => Math.max(max, event.seq), 0);

    await prisma.ballEvent.create({
      data: {
        matchId,
        inningsId: target.inningsId,
        clientEventId: replacement.clientEventId,
        seq: highestSeq + 1,
        overNumber: target.overNumber,
        ballNumber: target.ballNumber,
        eventType: 'CORRECTION',
        supersedesEventId: target.id,
        isLegalDelivery: isLegalDelivery(replacement.extraType),
        runsOffBat: replacement.runsOffBat,
        extraRuns: replacement.extraRuns,
        extraType: replacement.extraType,
        isWicket: replacement.isWicket,
        wicketType: replacement.wicketType,
        dismissedPlayerId: replacement.dismissedPlayerId,
        fielderId: replacement.fielderId,
        strikerId: replacement.strikerId,
        nonStrikerId: replacement.nonStrikerId,
        bowlerId: replacement.bowlerId,
        createdBy: userId,
      },
    });

    const { state, snapshot } = await project(match, target.inningsId);
    if (state.isComplete) {
      await closeInnings(target.inningsId, state);
      const updated = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
      snapshot.status = updated.status;
      snapshot.resultText = updated.resultText;
    }

    await writeSnapshot(snapshot);
    await publishMatchEvent('ball', { matchId, snapshot, seq: snapshot.lastEventSeq });

    return {
      snapshot,
      state,
      duplicate: false,
      inningsCompleted: state.isComplete,
      matchCompleted: false,
    };
  });
}

export async function undoLastBall(
  matchId: string,
  clientEventId: string,
  targetEventId: string | undefined,
  userId: string,
): Promise<BallResult> {
  return withLock(matchLockKey(matchId), async () => {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, publicSlug: true, status: true, resultText: true, revision: true },
    });

    if (!match) throw notFound('Match');

    const prior = await prisma.ballEvent.findUnique({ where: { clientEventId } });
    if (prior) {
      if (
        prior.matchId !== matchId ||
        prior.eventType !== 'UNDO' ||
        (targetEventId && targetEventId !== prior.supersedesEventId)
      )
        throw conflict('This request ID belongs to a different action');
      const { state, snapshot } = await project(match, prior.inningsId);
      return {
        state,
        snapshot,
        duplicate: true,
        inningsCompleted: state.isComplete,
        matchCompleted: match.status === 'COMPLETED',
      };
    }
    if (match.status !== 'LIVE')
      throw unprocessable('MATCH_CLOSED', 'Only a live innings can be undone');
    const innings = await loadLiveInnings(matchId);
    const events = await loadEvents(innings.id);

    const alreadyUndone = new Set(
      events
        .filter((event) => event.eventType === 'UNDO' && event.supersedesEventId)
        .map((event) => event.supersedesEventId!),
    );

    const deliveries = events.filter(
      (event) => event.eventType === 'BALL' && !alreadyUndone.has(event.id),
    );

    const target = targetEventId
      ? deliveries.find((event) => event.id === targetEventId)
      : deliveries[deliveries.length - 1];

    if (target && target.id !== deliveries.at(-1)?.id) {
      throw unprocessable('HISTORICAL_EDIT', 'Undo the latest delivery first');
    }
    if (!target) {
      throw unprocessable('NOTHING_TO_UNDO', 'There is no ball left to undo in this innings');
    }

    const duplicate = await prisma.ballEvent.findUnique({
      where: { clientEventId },
      select: { id: true },
    });

    if (!duplicate) {
      const highestSeq = events.reduce((max, event) => Math.max(max, event.seq), 0);

      await prisma.ballEvent.create({
        data: {
          matchId,
          inningsId: innings.id,
          clientEventId,
          seq: highestSeq + 1,
          overNumber: target.overNumber,
          ballNumber: target.ballNumber,
          eventType: 'UNDO',
          supersedesEventId: target.id,
          isLegalDelivery: false,
          runsOffBat: 0,
          extraRuns: 0,
          extraType: null,
          isWicket: false,
          strikerId: target.strikerId,
          nonStrikerId: target.nonStrikerId,
          bowlerId: target.bowlerId,
          createdBy: userId,
        },
      });
    }

    const { state, snapshot } = await project(match, innings.id);

    await writeSnapshot(snapshot);
    await publishMatchEvent('ball', { matchId, snapshot, seq: snapshot.lastEventSeq });

    return {
      snapshot,
      state,
      duplicate: Boolean(duplicate),
      inningsCompleted: state.isComplete,
      matchCompleted: false,
    };
  });
}

async function project(
  match: {
    id: string;
    publicSlug: string;
    status: string;
    resultText: string | null;
    revision?: number;
  },
  inningsId: string,
): Promise<{ state: MatchState; context: InningsContext; snapshot: MatchSnapshot }> {
  const context = await loadInningsContext(inningsId);
  const events = await loadEvents(inningsId);
  const state = buildState(context, events);

  return {
    state,
    context,
    snapshot: buildSnapshot(match, state, context, await dlsSnapshotFor(match.id)),
  };
}

function assertSameRequest(
  existing: Record<string, unknown>,
  matchId: string,
  input: BallRequestInput,
  eventType: string,
  target?: string,
): void {
  if (
    existing.matchId !== matchId ||
    existing.eventType !== eventType ||
    (target && existing.supersedesEventId !== target) ||
    Object.entries(input).some(([key, value]) => existing[key] !== value)
  ) {
    throw conflict('This request ID has already been used for a different action');
  }
}
