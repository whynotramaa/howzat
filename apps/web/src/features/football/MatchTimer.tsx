import {
  clockStatusLabel,
  periodName,
  shortPeriodName,
  type ClockReading,
  type MatchClockDto,
} from '@howzat/shared';
import { cn } from '@/lib/cn';
import { useClockReading } from './useMatchClock';

/*
 * The watch.
 *
 * Drawn as an instrument rather than a label, because everything in a football
 * match hangs off this number and the person reading it is holding a phone at
 * arm's length on a touchline in daylight.
 *
 * What it is made of, and why:
 *
 *  • A minute ring of sixty ticks, lit up to the current minute. A bare arc
 *    tells you roughly how far through you are; ticks tell you *which minute*,
 *    which is the thing anyone actually wants off a football clock.
 *  • One accent arc over the top, at hairline weight, in the same stroke as
 *    every rule on the page.
 *  • A colon that blinks once a second while running. This is the oldest
 *    running-clock affordance there is, it costs nothing, and it means the
 *    clock reads as live even in a still screenshot.
 *  • No transition on the arc while running. It advances four times a second
 *    in imperceptible steps; a 400ms ease on top of that made it lag visibly
 *    behind the digits, which was most of why the old one felt wrong.
 *
 * Stoppage time is drawn as a second, thinner arc *over* the completed first
 * one rather than by letting the first keep going — because that is what
 * stoppage time is, and a ring that silently overfills means nothing.
 */

type Size = 'sm' | 'md' | 'lg';

const DIAL: Record<Size, { box: number; stroke: number; digits: string; label: string }> = {
  sm: { box: 128, stroke: 4, digits: 'text-[1.375rem]', label: 'text-[0.5rem]' },
  md: { box: 196, stroke: 6, digits: 'text-[2.25rem]', label: 'text-[0.5625rem]' },
  lg: { box: 260, stroke: 7, digits: 'text-[3.25rem]', label: 'text-[0.625rem]' },
};

export function MatchTimer({
  clock,
  reading: providedReading,
  size = 'md',
  className,
}: {
  clock: MatchClockDto | null;
  /** Supplied by the console, which already holds an optimistic reading. */
  reading?: ClockReading;
  size?: Size;
  className?: string;
}) {
  // The spectator page has no controller of its own, so it ticks from the
  // snapshot. The console passes its optimistic reading straight through.
  const own = useClockReading(providedReading ? null : clock);
  const reading = providedReading ?? own;

  const { box, stroke, digits, label } = DIAL[size];

  const radius = (box - stroke * 2 - 14) / 2;
  const centre = box / 2;
  const circumference = 2 * Math.PI * radius;

  const inStoppage = reading.stoppage > 0;
  const periodMinutes = clock?.periodMinutes ?? 45;

  // Stoppage rarely runs past a tenth of the period, so the overrun arc is
  // scaled against that — otherwise six added minutes would draw as a sliver.
  const overrun = inStoppage
    ? Math.min(1, reading.stoppage / Math.max(1, periodMinutes * 0.15))
    : 0;

  const [minutes, seconds] = reading.display.split(':');
  const litTicks = Math.round(reading.progress * 60);

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="relative" style={{ width: box, height: box }}>
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90" aria-hidden>
          <circle cx={centre} cy={centre} r={radius} fill="var(--surface-sunken)" />

          {/* The minute ring. Sixty marks, lit to where the clock is. */}
          <g>
            {Array.from({ length: 60 }).map((_, index) => {
              const angle = (index / 60) * 2 * Math.PI;
              const outer = radius + stroke + 5;
              const inner = outer - (index % 5 === 0 ? 5 : 3);

              return (
                <line
                  key={index}
                  x1={centre + Math.cos(angle) * inner}
                  y1={centre + Math.sin(angle) * inner}
                  x2={centre + Math.cos(angle) * outer}
                  y2={centre + Math.sin(angle) * outer}
                  stroke={
                    index < litTicks
                      ? inStoppage
                        ? 'var(--warning)'
                        : 'var(--accent-strong)'
                      : 'var(--line)'
                  }
                  strokeWidth={index % 5 === 0 ? 1.4 : 0.9}
                  strokeLinecap="round"
                />
              );
            })}
          </g>

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
            style={{
              // While running the arc steps four times a second in increments
              // too small to see; easing on top of that only makes it lag the
              // digits. A transition is for the jumps — a pause, a new period.
              transition: reading.isRunning
                ? 'stroke 300ms linear'
                : 'stroke-dashoffset 420ms var(--ease), stroke 300ms linear',
            }}
          />

          {inStoppage ? (
            <circle
              cx={centre}
              cy={centre}
              r={radius - stroke - 3}
              fill="none"
              stroke="var(--warning)"
              strokeWidth={Math.max(2, stroke - 2)}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * (radius - stroke - 3)}
              strokeDashoffset={2 * Math.PI * (radius - stroke - 3) * (1 - overrun)}
              style={{ transition: 'stroke-dashoffset 420ms var(--ease)' }}
            />
          ) : null}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <span
            className={cn(
              'mono flex items-baseline leading-none font-medium tabular-nums',
              digits,
              inStoppage ? 'text-warning' : 'text-primary',
              // Paused reads as held rather than broken: the figures step back
              // to secondary instead of greying out entirely.
              !reading.isRunning && clock?.status === 'PAUSED' && 'text-secondary',
            )}
          >
            {minutes}
            <span
              className={cn(
                'px-[0.06em]',
                reading.isRunning ? 'clock-colon' : 'opacity-45',
              )}
            >
              :
            </span>
            {seconds}
          </span>

          <span className={cn('eyebrow', label)}>
            {clock ? shortPeriodName(reading.period, clock.periods) : '—'}
          </span>
        </div>
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
 * filled. Marks rather than "2 of 4" because it is read at a glance, beside a
 * number that is already being read carefully.
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
              'h-1 rounded-full transition-all duration-[var(--dur)] ease-[var(--ease)]',
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

export { useClockReading };
