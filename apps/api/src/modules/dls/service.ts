import {
  BALLS_PER_OVER,
  PLAYERS_PER_TEAM,
  computeDlsTarget,
  computeInningsResources,
  computeParPosition,
  defaultG50,
  formatOvers,
  minimumOversForResult,
  quotaBalls,
  resourcePercentage,
  validateInterruptions,
  type DlsInningsResources,
  type DlsInterruption,
  type DlsInterruptionInput,
  type DlsParPosition,
  type DlsSettingsInput,
  type DlsSnapshot,
  type DlsStateDto,
  type DlsTargetCalculation,
  type MatchState,
} from '@howzat/shared';
import type { Innings, Match } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { notFound, unprocessable } from '../../lib/errors';
import { matchLockKey, withLock } from '../../lib/lock';
import { publishMatchEvent } from '../../realtime/bus';
import { rebuildSnapshot, rebuildState } from '../snapshot';

/**
 * Everything DLS knows about one match, worked out from scratch every time.
 *
 * No revised figure is ever stored as an input. The interruption list is the
 * only thing a scorer writes, and the allotments and the target are derived
 * from it on demand, so deleting a stoppage that was typed wrong puts the match
 * back exactly where it would have been had it never been typed at all.
 */
export interface DlsProjection {
  match: Match;
  first: Innings | null;
  second: Innings | null;
  g50: number;
  firstResources: DlsInningsResources | null;
  secondResources: DlsInningsResources | null;
  firstInningsScore: number | null;
  calculation: DlsTargetCalculation | null;
  par: DlsParPosition | null;
  secondInningsState: MatchState | null;
}

function toDomain(row: {
  id: string;
  inningsNumber: number;
  ballsRemainingAtSuspension: number;
  wicketsLost: number;
  ballsRemainingOnResumption: number;
  reason: string | null;
  createdAt: Date;
}): DlsInterruption {
  return {
    id: row.id,
    inningsNumber: row.inningsNumber,
    ballsRemainingAtSuspension: row.ballsRemainingAtSuspension,
    wicketsLost: row.wicketsLost,
    ballsRemainingOnResumption: row.ballsRemainingOnResumption,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadInterruptions(matchId: string): Promise<DlsInterruption[]> {
  const rows = await prisma.dlsInterruption.findMany({
    where: { matchId },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map(toDomain);
}

/** Runs actually scored in an innings, read back off its ball events. */
async function inningsScore(innings: Innings | null): Promise<number | null> {
  if (!innings) return null;
  const { state } = await rebuildState(innings.id);
  return state.runs;
}

export async function project(matchId: string): Promise<DlsProjection> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { innings: { orderBy: { number: 'asc' } } },
  });

  if (!match) throw notFound('Match');

  const first = match.innings.find((entry) => entry.number === 1) ?? null;
  const second = match.innings.find((entry) => entry.number === 2) ?? null;

  const g50 = match.dlsG50 ?? defaultG50(match.oversPerInnings);
  const interruptions = await loadInterruptions(matchId);

  if (!match.dlsApplied) {
    return {
      match,
      first,
      second,
      g50,
      firstResources: null,
      secondResources: null,
      firstInningsScore: null,
      calculation: null,
      par: null,
      secondInningsState: null,
    };
  }

  // The first innings starts on the match's scheduled allotment — never on the
  // innings row, which is the thing being revised.
  const firstResources = computeInningsResources({
    inningsNumber: 1,
    initialBalls: match.oversPerInnings * BALLS_PER_OVER,
    interruptions: interruptions.filter((entry) => entry.inningsNumber === 1),
  });

  // The chasing side is allotted whatever the side batting first ended up with.
  const secondResources = computeInningsResources({
    inningsNumber: 2,
    initialBalls: firstResources.revisedBalls,
    interruptions: interruptions.filter((entry) => entry.inningsNumber === 2),
  });

  const firstComplete = first?.status === 'COMPLETED';
  const firstInningsScore = firstComplete ? await inningsScore(first) : null;

  const calculation =
    firstInningsScore === null
      ? null
      : computeDlsTarget({
          team1Score: firstInningsScore,
          team1Resource: firstResources.availableResource,
          team2Resource: secondResources.availableResource,
          g50,
        });

  let par: DlsParPosition | null = null;
  let secondInningsState: MatchState | null = null;

  if (second && firstInningsScore !== null) {
    const { state } = await rebuildState(second.id);
    secondInningsState = state;

    par = computeParPosition({
      team1Score: firstInningsScore,
      team1Resource: firstResources.availableResource,
      team2Resource: secondResources.availableResource,
      g50,
      runsScored: state.runs,
      ballsRemaining: Math.max(0, secondResources.revisedBalls - state.legalBalls),
      wicketsLost: state.wickets,
    });
  }

  return {
    match,
    first,
    second,
    g50,
    firstResources,
    secondResources,
    firstInningsScore,
    calculation,
    par,
    secondInningsState,
  };
}

export async function getDlsState(matchId: string): Promise<DlsStateDto> {
  const projection = await project(matchId);
  const interruptions = await loadInterruptions(matchId);

  return {
    matchId,
    applied: projection.match.dlsApplied,
    g50: projection.g50,
    scheduledOvers: projection.match.oversPerInnings,
    minimumOversForResult: minimumOversForResult(projection.match.oversPerInnings),
    interruptions,
    firstInnings: projection.firstResources,
    secondInnings: projection.secondResources,
    hasSecondInnings: projection.second !== null,
    calculation: projection.calculation,
    par: projection.par,
    decidedByDls: projection.match.decidedByDls,
  };
}

/**
 * Push the projection onto the innings rows so the rest of the app — the
 * reducer, the validator, the scoreboard — sees the revised match without
 * knowing DLS exists.
 *
 * Idempotent by construction: it writes derived values only, so calling it
 * twice writes the same thing twice.
 */
export async function applyDlsRevision(matchId: string): Promise<DlsProjection> {
  const projection = await project(matchId);
  const { match, first, second, firstResources, secondResources, calculation } = projection;

  if (!match.dlsApplied || !firstResources || !secondResources) return projection;

  if (first) {
    await prisma.innings.update({
      where: { id: first.id },
      data: {
        ballsQuota: firstResources.revisedBalls,
        oversQuota: wholeOvers(firstResources.revisedBalls),
      },
    });
  }

  if (second) {
    await prisma.innings.update({
      where: { id: second.id },
      data: {
        ballsQuota: secondResources.revisedBalls,
        oversQuota: wholeOvers(secondResources.revisedBalls),
        // Only once the first innings is closed is there a score to scale.
        ...(calculation ? { targetRuns: calculation.target } : {}),
      },
    });
  }

  await rebuildSnapshot(matchId).catch((err: unknown) => {
    logger.warn({ err, matchId }, 'Snapshot rebuild after a DLS revision failed');
    return null;
  });

  logger.info(
    {
      matchId,
      firstResource: firstResources.availableResource,
      secondResource: secondResources.availableResource,
      target: calculation?.target ?? null,
    },
    'DLS revision applied',
  );

  return { ...projection, calculation };
}

/**
 * An innings owing 40.3 overs spans 41 overs of the scorebook. `ballsQuota` is
 * the figure anything that counts uses; this is only for the places that still
 * speak in whole overs.
 */
function wholeOvers(balls: number): number {
  return Math.ceil(balls / BALLS_PER_OVER);
}

export async function updateSettings(
  matchId: string,
  input: DlsSettingsInput,
): Promise<DlsStateDto> {
  return withLock(matchLockKey(matchId), async () => {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw notFound('Match');

    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      throw unprocessable('MATCH_CLOSED', 'This match already has a result');
    }

    const turningOff = input.applied === false;

    if (turningOff) {
      const count = await prisma.dlsInterruption.count({ where: { matchId } });

      if (count > 0) {
        throw unprocessable(
          'DLS_HAS_STOPPAGES',
          'Delete the recorded stoppages before switching DLS off, so the allotments go back with it',
        );
      }
    }

    await prisma.match.update({
      where: { id: matchId },
      data: {
        ...(input.applied === undefined ? {} : { dlsApplied: input.applied }),
        ...(input.g50 === undefined ? {} : { dlsG50: input.g50 }),
      },
    });

    if (turningOff) await restoreScheduledAllotments(matchId);
    else await applyDlsRevision(matchId);

    await broadcastRevision(matchId);

    return getDlsState(matchId);
  });
}

/** Put the innings back on the allotment the fixture was scheduled for. */
async function restoreScheduledAllotments(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { innings: { orderBy: { number: 'asc' } } },
  });

  if (!match) return;

  const first = match.innings.find((entry) => entry.number === 1);
  const second = match.innings.find((entry) => entry.number === 2);

  for (const innings of [first, second]) {
    if (!innings) continue;

    await prisma.innings.update({
      where: { id: innings.id },
      data: { ballsQuota: null, oversQuota: match.oversPerInnings },
    });
  }

  if (second && first) {
    const runs = await inningsScore(first);
    if (runs !== null) {
      await prisma.innings.update({ where: { id: second.id }, data: { targetRuns: runs + 1 } });
    }
  }

  await prisma.match.update({ where: { id: matchId }, data: { dlsParScore: null } });
  await rebuildSnapshot(matchId).catch(() => null);
}

export async function addInterruption(
  matchId: string,
  input: DlsInterruptionInput,
  userId: string,
): Promise<DlsStateDto> {
  return withLock(matchLockKey(matchId), async () => {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { innings: { orderBy: { number: 'asc' } } },
    });

    if (!match) throw notFound('Match');

    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      throw unprocessable('MATCH_CLOSED', 'This match already has a result');
    }

    if (!match.dlsApplied) {
      throw unprocessable('DLS_NOT_APPLIED', 'Turn DLS on for this match before logging a stoppage');
    }

    if (input.inningsNumber === 2 && !match.innings.some((entry) => entry.number === 2)) {
      throw unprocessable(
        'NO_SECOND_INNINGS',
        'The second innings has not been set up yet — close the first one first',
      );
    }

    const existing = await loadInterruptions(matchId);
    const candidate: DlsInterruption = {
      id: 'candidate',
      inningsNumber: input.inningsNumber,
      ballsRemainingAtSuspension: input.ballsRemainingAtSuspension,
      wicketsLost: input.wicketsLost,
      ballsRemainingOnResumption: input.ballsRemainingOnResumption,
      reason: input.reason,
      createdAt: new Date().toISOString(),
    };

    assertCoherent(match.oversPerInnings, [...existing, candidate]);
    await assertNotAlreadyBowled(match.innings, input);

    await prisma.dlsInterruption.create({
      data: {
        matchId,
        inningsNumber: input.inningsNumber,
        ballsRemainingAtSuspension: input.ballsRemainingAtSuspension,
        wicketsLost: input.wicketsLost,
        ballsRemainingOnResumption: input.ballsRemainingOnResumption,
        reason: input.reason,
        createdBy: userId,
      },
    });

    await applyDlsRevision(matchId);
    await broadcastRevision(matchId);

    return getDlsState(matchId);
  });
}

export async function removeInterruption(
  matchId: string,
  interruptionId: string,
): Promise<DlsStateDto> {
  return withLock(matchLockKey(matchId), async () => {
    const row = await prisma.dlsInterruption.findUnique({ where: { id: interruptionId } });

    if (!row || row.matchId !== matchId) throw notFound('Stoppage');

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw notFound('Match');

    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      throw unprocessable('MATCH_CLOSED', 'This match already has a result');
    }

    await prisma.dlsInterruption.delete({ where: { id: interruptionId } });
    await applyDlsRevision(matchId);
    await broadcastRevision(matchId);

    return getDlsState(matchId);
  });
}

/**
 * Refuse a stoppage the innings could not have been at.
 *
 * The overs-remaining figure fixes the moment play stopped, and that moment has
 * to be the one the innings is actually standing on. Behind it and the innings
 * has already bowled past a stoppage that supposedly cut it short; ahead of it
 * and the stoppage has not happened yet — which is what typing the resumption
 * figure into the suspension box looks like. The resource arithmetic would
 * produce a confident number for either.
 */
async function assertNotAlreadyBowled(
  innings: Innings[],
  input: DlsInterruptionInput,
): Promise<void> {
  const target = innings.find((entry) => entry.number === input.inningsNumber);
  if (!target) return;

  const { state } = await rebuildState(target.id);
  const bowled = quotaBalls(target) - input.ballsRemainingAtSuspension;

  if (bowled === state.legalBalls) return;

  throw unprocessable(
    'DLS_WRONG_MOMENT',
    `Innings ${input.inningsNumber} stands at ${formatOvers(state.legalBalls)} overs, so ${formatOvers(quotaBalls(target) - state.legalBalls)} were left to bowl — not ${formatOvers(input.ballsRemainingAtSuspension)}`,
  );
}

function assertCoherent(scheduledOvers: number, interruptions: DlsInterruption[]): void {
  const scheduledBalls = scheduledOvers * BALLS_PER_OVER;

  const firstList = interruptions.filter((entry) => entry.inningsNumber === 1);
  const first = computeInningsResources({
    inningsNumber: 1,
    initialBalls: scheduledBalls,
    interruptions: firstList,
  });

  const firstVerdict = validateInterruptions({
    inningsNumber: 1,
    initialBalls: scheduledBalls,
    interruptions: firstList,
  });

  const secondList = interruptions.filter((entry) => entry.inningsNumber === 2);
  const secondVerdict = validateInterruptions({
    inningsNumber: 2,
    initialBalls: first.revisedBalls,
    interruptions: secondList,
  });

  const issues = [
    ...(firstVerdict.ok ? [] : firstVerdict.issues),
    ...(secondVerdict.ok ? [] : secondVerdict.issues),
  ];

  if (issues.length > 0) {
    throw unprocessable(issues[0]!.code, issues[0]!.message, issues);
  }
}

/** The DLS block a scoreboard shows. */
export function toDlsSnapshot(projection: DlsProjection): DlsSnapshot | null {
  if (!projection.match.dlsApplied) return null;

  return {
    applied: true,
    par: projection.par?.parScore ?? null,
    difference: projection.par?.difference ?? null,
    revisedTarget: projection.calculation?.target ?? null,
    revisedOvers: projection.secondResources
      ? formatOvers(projection.secondResources.revisedBalls)
      : null,
    decided: projection.match.decidedByDls,
  };
}

/**
 * Tell every viewer the terms changed.
 *
 * A revision moves the target without bowling a ball, so the snapshot's
 * sequence number is unchanged and the ordinary `ball` broadcast would be
 * discarded as stale by the client's ordering guard. This event exists to say
 * "apply this regardless".
 */
async function broadcastRevision(matchId: string): Promise<void> {
  const snapshot = await rebuildSnapshot(matchId).catch((err: unknown) => {
    logger.warn({ err, matchId }, 'Could not rebuild the snapshot to broadcast a DLS revision');
    return null;
  });

  void publishMatchEvent('match:dls', { matchId, snapshot });
}

/**
 * End the match where it stands, on DLS.
 *
 * This is the rain-at-the-death case: the chase is live, the players are off
 * for good, and the result is whatever the par score says at the ball they
 * stopped on. The ICC will not allow that judgement until the chasing side has
 * faced its minimum — twenty overs in a 50-over game, five in a T20 — and below
 * it the match is a no result however far ahead either side looked.
 */
export async function concludeUnderDls(
  matchId: string,
  reason?: string,
): Promise<{ resultText: string; winnerTeamId: string | null; parScore: number | null }> {
  return withLock(matchLockKey(matchId), async () => {
    const projection = await project(matchId);
    const { match, second, secondResources, par, secondInningsState } = projection;

    if (!match.dlsApplied) {
      throw unprocessable('DLS_NOT_APPLIED', 'Turn DLS on for this match first');
    }

    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      throw unprocessable('MATCH_CLOSED', 'This match already has a result');
    }

    if (!second || !secondResources || !par || !secondInningsState) {
      throw unprocessable(
        'NO_CHASE',
        'DLS can only decide a match once the second innings is under way',
      );
    }

    const minimumBalls = minimumOversForResult(match.oversPerInnings) * BALLS_PER_OVER;

    if (secondInningsState.legalBalls < minimumBalls) {
      const abandoned = await prisma.match.update({
        where: { id: matchId },
        data: {
          status: 'ABANDONED',
          winnerTeamId: null,
          dlsParScore: null,
          decidedByDls: false,
          resultText: `No result — the chase did not reach the ${minimumOversForResult(match.oversPerInnings)} overs DLS needs`,
        },
      });

      await prisma.innings.update({
        where: { id: second.id },
        data: { status: 'COMPLETED', endReason: 'DLS_TERMINATED' },
      });

      void publishMatchEvent('match:completed', {
        matchId,
        tournamentId: match.tournamentId,
        winnerTeamId: null,
      });

      await broadcastRevision(matchId);

      return { resultText: abandoned.resultText!, winnerTeamId: null, parScore: null };
    }

    const teams = await prisma.team.findMany({
      where: { id: { in: [second.battingTeamId, second.bowlingTeamId] } },
      select: { id: true, name: true },
    });

    const nameOf = (teamId: string) =>
      teams.find((team) => team.id === teamId)?.name ?? 'Unknown team';

    const runs = secondInningsState.runs;
    const suffix = reason ? ` (${reason})` : '';

    let winnerTeamId: string | null = null;
    let resultText: string;

    if (runs > par.parScore) {
      const wicketsLeft = PLAYERS_PER_TEAM - 1 - secondInningsState.wickets;
      winnerTeamId = second.battingTeamId;
      resultText = `${nameOf(second.battingTeamId)} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'} (DLS method)${suffix}`;
    } else if (runs === par.parScore) {
      resultText = `Match tied (DLS method)${suffix}`;
    } else {
      const margin = par.parScore - runs;
      winnerTeamId = second.bowlingTeamId;
      resultText = `${nameOf(second.bowlingTeamId)} won by ${margin} run${margin === 1 ? '' : 's'} (DLS method)${suffix}`;
    }

    await prisma.innings.update({
      where: { id: second.id },
      data: { status: 'COMPLETED', endReason: 'DLS_TERMINATED' },
    });

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'COMPLETED',
        winnerTeamId,
        resultText,
        dlsParScore: par.parScore,
        decidedByDls: true,
      },
    });

    logger.info(
      { matchId, par: par.parScore, runs, winnerTeamId },
      'Match concluded under the DLS par score',
    );

    void publishMatchEvent('match:completed', {
      matchId,
      tournamentId: match.tournamentId,
      winnerTeamId,
    });

    await broadcastRevision(matchId);

    return { resultText, winnerTeamId, parScore: par.parScore };
  });
}

export async function dlsSnapshotFor(matchId: string): Promise<DlsSnapshot | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { dlsApplied: true },
  });

  if (!match?.dlsApplied) return null;

  return toDlsSnapshot(await project(matchId));
}

export { resourcePercentage };
