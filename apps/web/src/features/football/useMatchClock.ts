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

function useServerSkew(clock: MatchClockDto | null): number {
  const skew = useRef(0);
  const sampled = useRef<string | null>(null);

  const stamp = clock?.serverNow ?? null;

  if (stamp && stamp !== sampled.current) {
    sampled.current = stamp;

    const measured = Date.parse(stamp) - Date.now();

    if (Number.isFinite(measured) && Math.abs(measured - skew.current) > 1_000) {
      skew.current = measured;
    }
  }

  return skew.current;
}

export function useClockReading(clock: MatchClockDto | null): ClockReading {
  const skew = useServerSkew(clock);
  const signature = signatureOf(clock);
  const isRunning = clock?.status === 'RUNNING';

  const [, forceTick] = useState(0);

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
  clock: MatchClockDto | null;
  readNow: () => ClockReading;
  isRunning: boolean;
  commands: ClockCommand[];
  isPending: boolean;
  run: (command: ClockCommand) => void;
}

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
    () => (clock ? allowedCommands(clock.status, clock.currentPeriod >= clock.periods) : []),
    [clock],
  );

  const run = useCallback(
    (command: ClockCommand) => {
      if (!clock) return;
      if (!isCommandAllowed(clock.status, clock.currentPeriod >= clock.periods, command)) return;

      setOptimistic(predict(clock, command, Date.now()));
      setPending(true);

      void submit(command)
        .catch(() => {
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
