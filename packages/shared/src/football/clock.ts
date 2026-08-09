import type { ClockCommand, ClockStatus } from '../types/enums';
import type { ClockReading, MatchClockDto } from '../types/football';

const MS_PER_MINUTE = 60_000;

export function elapsedAt(clock: MatchClockDto, now: number): number {
  if (clock.status !== 'RUNNING' || !clock.runningSince) return clock.elapsedMs;

  const since = Date.parse(clock.runningSince);
  if (Number.isNaN(since)) return clock.elapsedMs;

  return clock.elapsedMs + Math.max(0, now - since);
}

export function readClock(clock: MatchClockDto | null, now: number): ClockReading {
  if (!clock) {
    return {
      elapsedMs: 0,
      minute: 0,
      seconds: 0,
      stoppage: 0,
      period: 1,
      isRunning: false,
      progress: 0,
      display: '00:00',
      minuteLabel: "0'",
    };
  }

  const elapsedMs = elapsedAt(clock, now);
  const regulationMs = clock.periodMinutes * MS_PER_MINUTE;

  const priorMinutes = (clock.currentPeriod - 1) * clock.periodMinutes;
  const inPeriodMinutes = Math.floor(elapsedMs / MS_PER_MINUTE);
  const seconds = Math.floor((elapsedMs % MS_PER_MINUTE) / 1000);

  const overrun = Math.max(0, elapsedMs - regulationMs);
  const stoppage = overrun > 0 ? Math.floor(overrun / MS_PER_MINUTE) + 1 : 0;

  const cappedInPeriod = Math.min(inPeriodMinutes, clock.periodMinutes);
  const spokenBase = priorMinutes + cappedInPeriod;
  const minute = elapsedMs > 0 || clock.currentPeriod > 1 ? spokenBase + (stoppage ? 0 : 1) : 0;

  const clampedMinute = Math.min(minute, priorMinutes + clock.periodMinutes);

  const minuteLabel = stoppage
    ? `${priorMinutes + clock.periodMinutes}+${stoppage}'`
    : `${clampedMinute}'`;

  const display = stoppage
    ? `${priorMinutes + clock.periodMinutes}+${stoppage}:${pad(seconds)}`
    : `${pad(priorMinutes + cappedInPeriod)}:${pad(seconds)}`;

  return {
    elapsedMs,
    minute: clampedMinute,
    seconds,
    stoppage,
    period: clock.currentPeriod,
    isRunning: clock.status === 'RUNNING',
    progress: regulationMs > 0 ? Math.min(1, elapsedMs / regulationMs) : 0,
    display,
    minuteLabel,
  };
}

export function regulationMinutes(clock: Pick<MatchClockDto, 'periods' | 'periodMinutes'>): number {
  return clock.periods * clock.periodMinutes;
}

export function allowedCommands(status: ClockStatus, isLastPeriod: boolean): ClockCommand[] {
  switch (status) {
    case 'NOT_STARTED':
      return ['START'];
    case 'RUNNING':
      return ['PAUSE', 'END_PERIOD'];
    case 'PAUSED':
      return ['RESUME', 'END_PERIOD'];
    case 'PERIOD_BREAK':
      return isLastPeriod ? ['FULL_TIME'] : ['START_NEXT_PERIOD', 'FULL_TIME'];
    case 'FINISHED':
      return [];
  }
}

export function isCommandAllowed(
  status: ClockStatus,
  isLastPeriod: boolean,
  command: ClockCommand,
): boolean {
  return allowedCommands(status, isLastPeriod).includes(command);
}

export function clockStatusLabel(clock: MatchClockDto | null): string {
  if (!clock) return 'Not started';

  const ordinal = periodName(clock.currentPeriod, clock.periods);

  switch (clock.status) {
    case 'NOT_STARTED':
      return 'Kick-off pending';
    case 'RUNNING':
      return ordinal;
    case 'PAUSED':
      return `${ordinal} — paused`;
    case 'PERIOD_BREAK':
      return clock.currentPeriod >= clock.periods ? 'Full time pending' : `${ordinal} ended`;
    case 'FINISHED':
      return 'Full time';
  }
}

export function periodName(period: number, periods: number): string {
  if (periods === 2) return period === 1 ? 'First half' : 'Second half';
  if (periods === 4) return `Quarter ${period}`;
  if (periods === 1) return 'Match';
  return `Period ${period}`;
}

export function shortPeriodName(period: number, periods: number): string {
  if (periods === 2) return period === 1 ? 'H1' : 'H2';
  if (periods === 4) return `Q${period}`;
  if (periods === 1) return 'FT';
  return `P${period}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
