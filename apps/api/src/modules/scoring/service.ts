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
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { notFound, unprocessable } from '../../lib/errors';
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
      select: { id: true, publicSlug: true, status: true, resultText: true },
    });

    if (!match) throw notFound('Match');

    const innings = await loadLiveInnings(matchId);

    const existing = await prisma.ballEvent.findUnique({
      where: { clientEventId: input.clientEventId },
      select: { inningsId: true },
    });

    if (existing) {
      const { state, snapshot } = await project(match, existing.inningsId);
      await writeSnapshot(snapshot);

      logger.debug({ matchId, clientEventId: input.clientEventId }, 'Duplicate ball ignored');

      return {
        snapshot,
        state,
        duplicate: true,
        inningsCompleted: state.isComplete,
        matchCompleted: match.status === 'COMPLETED',
      };
    }

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

    const created = await prisma.ballEvent
      .create({
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
      })
      .catch(async (err) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return null;
        }
        throw err;
      });

    if (!created) {
      const { state: current, snapshot } = await project(match, innings.id);
      return {
        snapshot,
        state: current,
        duplicate: true,
        inningsCompleted: current.isComplete,
        matchCompleted: false,
      };
    }

    const nextState = buildState(context, [...events, toBallEvent(created)]);
    const snapshot = buildSnapshot(match, nextState, context);

    let matchCompleted = false;

    if (nextState.isComplete) {
      const outcome = await closeInnings(innings.id, nextState);
      matchCompleted = outcome.matchCompleted;

      const refreshed = await prisma.match.findUnique({
        where: { id: matchId },
        select: { status: true, resultText: true },
      });

      if (refreshed) {
        snapshot.status = refreshed.status;
        snapshot.resultText = refreshed.resultText;
      }

      void publishMatchEvent('innings:complete', {
        matchId,
        inningsNumber: nextState.inningsNumber,
        snapshot,
      });
    }

    await writeSnapshot(snapshot);
    void publishMatchEvent('ball', { matchId, snapshot, seq: created.seq });

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
      select: { id: true, publicSlug: true, status: true, resultText: true },
    });

    if (!match) throw notFound('Match');

    const target = await prisma.ballEvent.findUnique({ where: { id: targetEventId } });

    if (!target || target.matchId !== matchId) throw notFound('Ball');

    if (target.eventType !== 'BALL') {
      throw unprocessable('NOT_CORRECTABLE', 'Only a delivery can be corrected');
    }

    const duplicate = await prisma.ballEvent.findUnique({
      where: { clientEventId: replacement.clientEventId },
      select: { id: true },
    });

    if (duplicate) {
      const { state, snapshot } = await project(match, target.inningsId);
      return {
        snapshot,
        state,
        duplicate: true,
        inningsCompleted: state.isComplete,
        matchCompleted: false,
      };
    }

    const events = await loadEvents(target.inningsId);
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

    await writeSnapshot(snapshot);
    void publishMatchEvent('ball', { matchId, snapshot, seq: snapshot.lastEventSeq });

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
      select: { id: true, publicSlug: true, status: true, resultText: true },
    });

    if (!match) throw notFound('Match');

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
    void publishMatchEvent('ball', { matchId, snapshot, seq: snapshot.lastEventSeq });

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
  match: { id: string; publicSlug: string; status: string; resultText: string | null },
  inningsId: string,
): Promise<{ state: MatchState; context: InningsContext; snapshot: MatchSnapshot }> {
  const context = await loadInningsContext(inningsId);
  const events = await loadEvents(inningsId);
  const state = buildState(context, events);

  return { state, context, snapshot: buildSnapshot(match, state, context) };
}
