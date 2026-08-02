import { describe, expect, it } from 'vitest';
import { allowedCommands, elapsedAt, readClock, regulationMinutes } from './clock';
import type { MatchClockDto } from '../types/football';

/**
 * The clock is the one thing in football scoring that cannot be re-derived
 * from a log, so it gets tested against instants rather than against a wait.
 */

const T0 = Date.parse('2026-08-02T10:00:00.000Z');

function clock(overrides: Partial<MatchClockDto> = {}): MatchClockDto {
  return {
    matchId: 'm1',
    periods: 2,
    periodMinutes: 45,
    currentPeriod: 1,
    status: 'RUNNING',
    elapsedMs: 0,
    runningSince: new Date(T0).toISOString(),
    serverNow: new Date(T0).toISOString(),
    ...overrides,
  };
}

const minutes = (n: number) => n * 60_000;

describe('elapsedAt', () => {
  it('adds the current run to the banked total', () => {
    expect(elapsedAt(clock({ elapsedMs: minutes(10) }), T0 + minutes(5))).toBe(minutes(15));
  });

  it('freezes at the banked total while paused', () => {
    const paused = clock({ status: 'PAUSED', elapsedMs: minutes(23), runningSince: null });
    expect(elapsedAt(paused, T0 + minutes(60))).toBe(minutes(23));
  });

  it('never runs backwards when the reader is behind the server', () => {
    expect(elapsedAt(clock({ elapsedMs: minutes(4) }), T0 - minutes(2))).toBe(minutes(4));
  });
});

describe('readClock', () => {
  it('reads the first minute from the first second', () => {
    const reading = readClock(clock(), T0 + 1_000);
    expect(reading.minute).toBe(1);
    expect(reading.display).toBe('00:01');
  });

  it('counts the second half from the end of the first', () => {
    const reading = readClock(
      clock({ currentPeriod: 2, elapsedMs: minutes(10), runningSince: null, status: 'PAUSED' }),
      T0,
    );
    expect(reading.minute).toBe(56);
    expect(reading.period).toBe(2);
  });

  it('switches to stoppage time past regulation rather than counting on', () => {
    const reading = readClock(clock({ elapsedMs: minutes(46) + 30_000, status: 'PAUSED', runningSince: null }), T0);
    expect(reading.stoppage).toBe(2);
    expect(reading.minuteLabel).toBe("45+2'");
    expect(reading.display).toBe('45+2:30');
  });

  it('caps progress at a full period so the ring cannot overfill', () => {
    const reading = readClock(clock({ elapsedMs: minutes(80), status: 'PAUSED', runningSince: null }), T0);
    expect(reading.progress).toBe(1);
  });

  it('renders zero with no clock at all', () => {
    expect(readClock(null, T0).display).toBe('00:00');
  });
});

describe('allowedCommands', () => {
  it('offers only kick-off before the match starts', () => {
    expect(allowedCommands('NOT_STARTED', false)).toEqual(['START']);
  });

  it('offers the next period at a break, but not after the last one', () => {
    expect(allowedCommands('PERIOD_BREAK', false)).toContain('START_NEXT_PERIOD');
    expect(allowedCommands('PERIOD_BREAK', true)).toEqual(['FULL_TIME']);
  });

  it('offers nothing once the match is finished', () => {
    expect(allowedCommands('FINISHED', true)).toEqual([]);
  });
});

describe('regulationMinutes', () => {
  it('multiplies out the periods', () => {
    expect(regulationMinutes({ periods: 2, periodMinutes: 45 })).toBe(90);
    expect(regulationMinutes({ periods: 4, periodMinutes: 12 })).toBe(48);
  });
});
