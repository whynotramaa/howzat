import { useEffect, useState } from 'react';
import {
  CLOCK_TICK_MS,
  clockStatusLabel,
  periodName,
  readClock,
  shortPeriodName,
  type ClockReading,
  type MatchClockDto,
} from '@howzat/shared';
import { cn } from '@/lib/cn';

/*
 * The watch.
 *
 * Everything a football match hangs off is this number, so it is drawn as an
 * instrument rather than as a label: a sunken dial, a hairline track, and one
 * accent arc sweeping through the period. The figures are the mono face at a
 * size nobody has to lean in for, because the person reading it is holding a
 * phone at arm's length on a touchline in daylight.
 *
 * Three deliberate restraints, all of them the same restraint the rest of the
 * system observes. The arc is a stroke, never a fill — a filled pie chart of
 * elapsed time reads as a loading spinner. There is no drop shadow under the
 * dial; it rests on the page like every other surface here. And nothing pulses
 * except the running indicator, which is a status, not decoration.
 *
 * Once regulation time is gone the arc completes and a second, thinner arc
 * begins over the top in amber. That is what stoppage time *is* — time past the
 * end of the allotment — and drawing it as an overrun rather than letting the
 * first arc keep going is the difference between a clock that means something
 * and a progress bar that has run out of road.
 */

/**
 * The live reading, ticked locally.
 *
 * The clock is never polled. The server sends a banked total and the instant
 * the current run started; everything after that is arithmetic this component
 * does four times a second against its own `Date.now()`, corrected for the skew
 * between the two machines. A paused clock does not tick at all.
 */
export function useClockReading(clock: MatchClockDto | null): ClockReading {
  const [reading, setReading] = useState(() => readClock(clock, Date.now() + skewOf(clock)));

  useEffect(() => {
    const skew = skewOf(clock);
    setReading(readClock(clock, Date.now() + skew));

    if (!clock || clock.status !== 'RUNNING') return;

    const timer = window.setInterval(
      () => setReading(readClock(clock, Date.now() + skew)),
      CLOCK_TICK_MS,
    );

    return () => window.clearInterval(timer);
  }, [clock]);

  return reading;
}

/**
 * How far this browser's clock is from the server's.
 *
 * A phone whose clock is three minutes fast would otherwise render the match
 * three minutes further along than everyone else's, and on a shared scoreboard
 * that is not a rounding error — it is two different matches.
 */
function skewOf(clock: MatchClockDto | null): number {
  if (!clock?.serverNow) return 0;
  const server = Date.parse(clock.serverNow);
  return Number.isNaN(server) ? 0 : server - Date.now();
}

type Size = 'sm' | 'md' | 'lg';

const DIAL: Record<Size, { box: number; stroke: number; digits: string; label: string }> = {
  sm: { box: 132, stroke: 5, digits: 'text-[1.5rem]', label: 'text-[0.5625rem]' },
  md: { box: 200, stroke: 7, digits: 'text-[2.5rem]', label: 'text-[0.625rem]' },
  lg: { box: 264, stroke: 8, digits: 'text-[3.5rem]', label: 'text-[0.6875rem]' },
};

export function MatchTimer({
  clock,
  size = 'md',
  className,
}: {
  clock: MatchClockDto | null;
  size?: Size;
  className?: string;
}) {
  const reading = useClockReading(clock);
  const { box, stroke, digits, label } = DIAL[size];

  const radius = (box - stroke * 2 - 10) / 2;
  const centre = box / 2;
  const circumference = 2 * Math.PI * radius;

  const inStoppage = reading.stoppage > 0;
  // Stoppage rarely runs past a tenth of the period, so the overrun arc is
  // scaled against that rather than the whole dial — otherwise six added
  // minutes would draw as a sliver nobody could see.
  const overrunFraction = inStoppage
    ? Math.min(1, reading.stoppage / Math.max(1, (clock?.periodMinutes ?? 45) * 0.15))
    : 0;

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="relative" style={{ width: box, height: box }}>
        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          className="-rotate-90"
          aria-hidden
        >
          {/* The recess the dial sits in. */}
          <circle cx={centre} cy={centre} r={radius} fill="var(--surface-sunken)" />

          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={stroke}
          />

          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            stroke={inStoppage ? 'var(--line-strong)' : 'var(--accent-strong)'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - reading.progress)}
            // Long enough to read as a sweep, short enough that a resumed clock
            // catches up immediately rather than crawling to where it belongs.
            style={{ transition: 'stroke-dashoffset 400ms var(--ease), stroke 300ms linear' }}
          />

          {inStoppage ? (
            <circle
              cx={centre}
              cy={centre}
              r={radius - stroke - 3}
              fill="none"
              stroke="var(--warning)"
              strokeWidth={Math.max(2, stroke - 3)}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * (radius - stroke - 3)}
              strokeDashoffset={2 * Math.PI * (radius - stroke - 3) * (1 - overrunFraction)}
              style={{ transition: 'stroke-dashoffset 400ms var(--ease)' }}
            />
          ) : null}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <span
            className={cn(
              'mono leading-none font-medium tabular-nums',
              digits,
              inStoppage ? 'text-warning' : 'text-primary',
            )}
          >
            {reading.display}
          </span>

          <span className={cn('eyebrow', label)}>
            {clock ? shortPeriodName(reading.period, clock.periods) : '—'}
          </span>
        </div>

        {/* The running mark rides the rim rather than sitting in the middle,
            where it would compete with the figures for the same glance. */}
        {reading.isRunning ? (
          <span
            aria-hidden
            className="live-pulse absolute top-1.5 left-1/2 size-2 -translate-x-1/2 rounded-full bg-[var(--accent-strong)]"
          />
        ) : null}
      </div>

      <p className="text-[0.8125rem] text-secondary" aria-live="polite">
        {clockStatusLabel(clock)}
      </p>

      {clock && clock.periods > 1 ? (
        <PeriodPips current={reading.period} total={clock.periods} status={clock.status} />
      ) : null}
    </div>
  );
}

/**
 * Where the match is in its shape: one mark per period, the one being played
 * filled. Marks rather than a written "2 of 4" because it is read at a glance,
 * beside a number that is already being read carefully.
 */
function PeriodPips({
  current,
  total,
  status,
}: {
  current: number;
  total: number;
  status: MatchClockDto['status'];
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`${periodName(current, total)} of ${total}`}
    >
      {Array.from({ length: total }).map((_, index) => {
        const period = index + 1;
        const done = period < current || (period === current && status === 'FINISHED');

        return (
          <span
            key={period}
            className={cn(
              'h-1 rounded-full transition-all duration-[var(--dur)]',
              period === current && status !== 'FINISHED'
                ? 'w-7 bg-[var(--accent-strong)]'
                : done
                  ? 'w-4 bg-line-strong'
                  : 'w-4 bg-line',
            )}
          />
        );
      })}
    </div>
  );
}

/**
 * The compact form, for a scoreboard header or a fixture row. Same arithmetic,
 * no dial — a clock beside a scoreline should not out-weigh the scoreline.
 */
export function InlineClock({
  clock,
  className,
}: {
  clock: MatchClockDto | null;
  className?: string;
}) {
  const reading = useClockReading(clock);

  if (!clock) return null;

  return (
    <span
      className={cn(
        'mono inline-flex items-center gap-1.5 text-sm tabular-nums',
        reading.stoppage > 0 ? 'text-warning' : 'text-primary',
        className,
      )}
    >
      {reading.isRunning ? (
        <span aria-hidden className="live-pulse size-1.5 rounded-full bg-[var(--accent-strong)]" />
      ) : null}
      {reading.display}
    </span>
  );
}
