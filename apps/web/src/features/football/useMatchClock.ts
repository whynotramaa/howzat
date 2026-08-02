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
 * Four separate problems live here, and between them they were the whole reason
 * the watch felt wrong:
 *
 *  1. **Skew re-measured against a stale stamp.** `serverNow` belongs to the
 *     response that carried it — it is a fixed instant, not a running clock. The
 *     old code recomputed `serverNow − Date.now()` on *every render*, so as the
 *     local clock advanced past a stamp that never moved, the measured "skew"
 *     drifted a further second every second. The one-second re-adoption guard
 *     then fired on that drift and yanked the correction backwards, which is
 *     precisely the 20:07 → 20:08 → 20:07 stutter: the display crept forward a
 *     second, the skew snapped back a second, forever. Skew is now sampled
 *     **once per distinct `serverNow`** — a new stamp is a new measurement, the
 *     same stamp is the same measurement no matter how long it is held.
 *
 *  2. **Skew jitter.** Even between genuinely fresh stamps, `serverNow − now`
 *     measures clock difference *plus* one-way latency, and latency breathes.
 *     Only a difference big enough to be a real disagreement of clocks is
 *     adopted; anything smaller is the network, and chasing it makes seconds
 *     stutter.
 *
 *  3. **Re-subscription churn.** React Query hands back a new object on every
 *     refetch, so an effect keyed on the clock object tore down and rebuilt the
 *     tick constantly. The effect is keyed on a *signature* of the fields that
 *     actually matter.
 *
 *  4. **Ticking faster than the display changes.** The old loop re-rendered four
 *     times a second to catch second boundaries it could not predict — and it
 *     did that re-render at the top of the console, so the entire page, incident
 *     log included, re-rendered 4× a second. The tick now *aims* at the next
 *     second boundary and fires once, which is one render per visible change.
 *
 * The round trip is handled the same way as before: a command is applied locally
 * first, using the shared arithmetic the server uses, and the optimistic value
 * is held until the server confirms the state it was predicting.
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

/**
 * How far this browser's clock is from the server's, ignoring latency noise.
 *
 * Sampled per distinct `serverNow`. Holding the same stamp for a minute must not
 * produce a skew that grows by a minute — that is measuring the passage of time,
 * not a difference of clocks, and it was the bug.
 */
function useServerSkew(clock: MatchClockDto | null): number {
  const skew = useRef(0);
  const sampled = useRef<string | null>(null);

  const stamp = clock?.serverNow ?? null;

  if (stamp && stamp !== sampled.current) {
    sampled.current = stamp;

    const measured = Date.parse(stamp) - Date.now();

    // Only adopt a change big enough to be a real difference of clocks. Anything
    // smaller is the round trip.
    if (Number.isFinite(measured) && Math.abs(measured - skew.current) > 1_000) {
      skew.current = measured;
    }
  }

  return skew.current;
}

/**
 * A live reading that ticks locally, once per second, on the second.
 *
 * A fixed interval cannot do this: 1000ms drifts out of phase with the clock's
 * own seconds and visibly skips one, and anything faster burns renders on
 * frames where no digit changed. Each tick instead measures how far it is to the
 * next whole second of *match* time and sleeps exactly that long, so every
 * render corresponds to a digit that moved.
 */
export function useClockReading(clock: MatchClockDto | null): ClockReading {
  const skew = useServerSkew(clock);
  const signature = signatureOf(clock);
  const isRunning = clock?.status === 'RUNNING';

  const [, forceTick] = useState(0);

  // Read inside the timeout without making the effect depend on object identity:
  // React Query replaces this object on every refetch and `signature` already
  // covers every field the schedule depends on.
  const latest = useRef(clock);
  latest.current = clock;

  const skewRef = useRef(skew);
  skewRef.current = skew;

  useEffect(() => {
    if (!isRunning) return;

    let timer = 0;

    const schedule = () => {
      const current = latest.current;
      if (!current) return;

      const elapsed = elapsedAt(current, Date.now() + skewRef.current);
      // 12ms past the boundary rather than exactly on it: a timeout that lands a
      // hair early would render the second it just left and need a second wake.
      const wait = 1_000 - (elapsed % 1_000) + 12;

      timer = window.setTimeout(() => {
        forceTick((n) => n + 1);
        schedule();
      }, wait);
    };

    schedule();
    return () => window.clearTimeout(timer);
  }, [signature, isRunning]);

  return readClock(clock, Date.now() + skew);
}

export interface MatchClockController {
  /** What to render — the optimistic clock while one is pending. */
  clock: MatchClockDto | null;
  /**
   * A reading resolved at the instant it is asked for.
   *
   * A function rather than a value on purpose: the console needs the minute to
   * stamp a goal with, and it needs it *when the goal is recorded* — not on
   * every tick. Handing back a live value would mean re-rendering the whole
   * console once a second to keep a number nobody is looking at up to date.
   */
  readNow: () => ClockReading;
  /** Enough of the reading to drive a button, and it only changes on command. */
  isRunning: boolean;
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
 *
 * `serverNow` is carried through untouched: it is a measurement of the server's
 * clock, and a prediction made on this device is not evidence about that.
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
 *
 * Note what this hook does *not* do: it does not tick. The seconds belong to
 * whichever component draws them, so the console around it re-renders when the
 * match changes and not when the clock does.
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

  const skew = useServerSkew(clock);
  const skewRef = useRef(skew);
  skewRef.current = skew;

  const latest = useRef(clock);
  latest.current = clock;

  const readNow = useCallback(() => readClock(latest.current, Date.now() + skewRef.current), []);

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

  return {
    clock,
    readNow,
    isRunning: clock?.status === 'RUNNING',
    commands,
    isPending,
    run,
  };
}
