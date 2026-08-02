import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  allowedCommands,
  elapsedAt,
  isCommandAllowed,
  readClock,
  type ClockCommand,
  type ClockReading,
  type MatchClockDto,
} from '@howzat/shared';

/**
 * The clock, as the browser experiences it.
 *
 * Three separate problems live here, and they were the reason the watch felt
 * wrong before:
 *
 *  1. **Skew jitter.** `serverNow` is stamped when the response is generated,
 *     so `serverNow − Date.now()` measures clock difference *plus* one-way
 *     latency. Latency varies between 40ms and 400ms, so recomputing skew on
 *     every refetch made the displayed time jump back and forth by a few
 *     hundred milliseconds several times a second. Skew is now measured once
 *     and only re-adopted when it drifts by more than a second — real clock
 *     drift, rather than the network breathing.
 *
 *  2. **Re-subscription churn.** React Query hands back a new object on every
 *     refetch, so an effect keyed on the clock object tore down and rebuilt the
 *     tick interval constantly. The effect is keyed on a *signature* of the
 *     fields that actually matter, so a refetch that changes nothing changes
 *     nothing.
 *
 *  3. **The round trip.** Pressing pause used to POST, wait, invalidate and
 *     refetch before the display stopped — half a second of a clock still
 *     running after you told it to stop, which reads as broken rather than as
 *     slow. The command is now applied locally first, using the same shared
 *     arithmetic the server uses, and the optimistic value is held until the
 *     server confirms the state it was predicting.
 */

/** The fields that actually change what is rendered. */
function signatureOf(clock: MatchClockDto | null): string {
  if (!clock) return 'none';
  return [
    clock.status,
    clock.runningSince ?? '-',
    clock.elapsedMs,
    clock.currentPeriod,
    clock.periods,
    clock.periodMinutes,
  ].join('|');
}

/** How far this browser's clock is from the server's, ignoring latency noise. */
function useServerSkew(clock: MatchClockDto | null): number {
  const skew = useRef(0);
  const measured = clock?.serverNow ? Date.parse(clock.serverNow) - Date.now() : 0;

  // Only adopt a change big enough to be a real difference of clocks. Anything
  // smaller is the round trip, and chasing it makes the seconds stutter.
  if (Number.isFinite(measured) && Math.abs(measured - skew.current) > 1_000) {
    skew.current = measured;
  }

  return skew.current;
}

/**
 * A live reading that ticks locally.
 *
 * `tickMs` is deliberately faster than one second: at exactly 1000ms the
 * displayed second and the real second drift in and out of phase and the clock
 * visibly skips one. Sampling four times a second means every second lands
 * within 250ms of where it belongs and none is ever missed.
 */
export function useClockReading(clock: MatchClockDto | null, tickMs = 250): ClockReading {
  const skew = useServerSkew(clock);
  const signature = signatureOf(clock);

  const [, forceTick] = useState(0);
  const isRunning = clock?.status === 'RUNNING';

  // `signature` is in the dependency list rather than `clock` on purpose: React
  // Query hands back a fresh object on every refetch, and keying on identity
  // tore this interval down and rebuilt it several times a second. Every field
  // the effect actually depends on is inside the signature string.
  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => forceTick((n) => n + 1), tickMs);
    return () => window.clearInterval(timer);
  }, [signature, isRunning, tickMs]);

  return readClock(clock, Date.now() + skew);
}

export interface MatchClockController {
  /** What to render — the optimistic clock while one is pending. */
  clock: MatchClockDto | null;
  reading: ClockReading;
  commands: ClockCommand[];
  /** True while a command is in flight, for the button's own state only. */
  isPending: boolean;
  run: (command: ClockCommand) => void;
}

/**
 * Applies a command locally, exactly as the server will.
 *
 * This is the same transition table as apps/api/src/modules/football/lifecycle
 * — deliberately duplicated rather than shared, because the server's version
 * writes to a database and this one has to be a pure function of the DTO. The
 * shared `elapsedAt` does the arithmetic in both, which is the part that would
 * actually hurt if it diverged.
 */
function predict(clock: MatchClockDto, command: ClockCommand, now: number): MatchClockDto {
  const banked = elapsedAt(clock, now);
  const iso = new Date(now).toISOString();

  switch (command) {
    case 'START':
      return { ...clock, status: 'RUNNING', runningSince: iso };
    case 'PAUSE':
      return { ...clock, status: 'PAUSED', elapsedMs: banked, runningSince: null };
    case 'RESUME':
      return { ...clock, status: 'RUNNING', runningSince: iso };
    case 'END_PERIOD':
      return { ...clock, status: 'PERIOD_BREAK', elapsedMs: banked, runningSince: null };
    case 'START_NEXT_PERIOD':
      return {
        ...clock,
        status: 'RUNNING',
        currentPeriod: clock.currentPeriod + 1,
        elapsedMs: 0,
        runningSince: iso,
      };
    case 'FULL_TIME':
      return { ...clock, status: 'FINISHED', elapsedMs: banked, runningSince: null };
  }
}

/**
 * The whole watch: what to draw, what may be pressed, and what pressing does.
 *
 * The optimistic value is dropped as soon as the server reports the status it
 * was predicting — not on a timer, and not on the first response that arrives.
 * Waiting for the *status* to agree is what stops a slow refetch that was
 * already in flight from briefly rewinding the clock to before the press.
 */
export function useMatchClock(
  serverClock: MatchClockDto | null,
  submit: (command: ClockCommand) => Promise<unknown>,
): MatchClockController {
  const [optimistic, setOptimistic] = useState<MatchClockDto | null>(null);
  const [isPending, setPending] = useState(false);

  useEffect(() => {
    if (!optimistic || !serverClock) return;

    if (
      serverClock.status === optimistic.status &&
      serverClock.currentPeriod === optimistic.currentPeriod
    ) {
      setOptimistic(null);
    }
  }, [serverClock, optimistic]);

  const clock = optimistic ?? serverClock;
  const reading = useClockReading(clock);

  const commands = useMemo(
    () =>
      clock ? allowedCommands(clock.status, clock.currentPeriod >= clock.periods) : [],
    [clock],
  );

  const run = useCallback(
    (command: ClockCommand) => {
      if (!clock) return;
      if (!isCommandAllowed(clock.status, clock.currentPeriod >= clock.periods, command)) return;

      // Locally first. The whistle has already gone; the network is not the
      // scorer's problem.
      setOptimistic(predict(clock, command, Date.now()));
      setPending(true);

      void submit(command)
        .catch(() => {
          // The server refused, so the prediction was wrong. Dropping it snaps
          // straight back to the truth rather than leaving a clock that
          // disagrees with everyone else's.
          setOptimistic(null);
        })
        .finally(() => setPending(false));
    },
    [clock, submit],
  );

  return { clock, reading, commands, isPending, run };
}
