import { clockStatusLabel, shortPeriodName, type MatchClockDto } from '@howzat/shared';
import { cn } from '@/lib/cn';
import { useClockReading } from './useMatchClock';

/*
 * The clock.
 *
 * It is a readout, not an instrument. The previous version was a machined dial —
 * a recess, a specular arc, sixty tick marks and a travelling cap — and it was
 * the wrong answer to the right question: the number matters most, so the number
 * should be the only thing drawn.
 *
 * What is left, and why:
 *
 *  • The figures, large, tabular and tight. Everything else on this screen is
 *    sized relative to them.
 *  • A colon that blinks once a second — the oldest running-clock affordance
 *    there is, one keyframe, and it means the clock reads as live even in a
 *    still screenshot.
 *  • One hairline track under the figures, filling across the period. A progress
 *    line answers "how far through" without asking anyone to interpret a gauge.
 *  • A single line of state beneath: the period, what the clock is doing, and one
 *    mark per period when there is more than one.
 *
 * Stoppage is a chip beside the figures rather than a second ring. Added time is
 * a small number that is read literally; it was never a shape.
 *
 * Performance note: this component owns the tick. The console around it does not
 * re-render as the seconds move.
 */

type Size = 'sm' | 'md' | 'lg';

const SCALE: Record<Size, { digits: string; meta: string; chip: string; gap: string }> = {
  sm: {
    digits: 'text-[1.5rem]',
    meta: 'text-[0.6875rem]',
    chip: 'text-[0.625rem] px-1.5 py-[0.1rem]',
    gap: 'gap-2',
  },
  md: {
    digits: 'text-[2.25rem]',
    meta: 'text-[0.75rem]',
    chip: 'text-[0.6875rem] px-2 py-[0.15rem]',
    gap: 'gap-2.5',
  },
  lg: {
    digits: 'text-[3.25rem] sm:text-[3.75rem]',
    meta: 'text-[0.8125rem]',
    chip: 'text-[0.75rem] px-2 py-[0.2rem]',
    gap: 'gap-3',
  },
};

export function MatchTimer({
  clock,
  size = 'md',
  align = 'start',
  showTrack = true,
  className,
}: {
  clock: MatchClockDto | null;
  size?: Size;
  align?: 'start' | 'center';
  /** The period-progress hairline. Off where the clock sits inside a busy row. */
  showTrack?: boolean;
  className?: string;
}) {
  // The tick lives here rather than in the console: the seconds are the only
  // thing changing, so the seconds are the only thing that should re-render.
  const reading = useClockReading(clock);
  const { digits, meta, chip, gap } = SCALE[size];

  const inStoppage = reading.stoppage > 0;
  const isHeld = !reading.isRunning && clock?.status === 'PAUSED';
  const [minutes, seconds] = reading.display.split(':');

  return (
    <div
      className={cn('flex min-w-0 flex-col', gap, align === 'center' && 'items-center', className)}
    >
      <div className="flex items-baseline gap-2.5">
        <span
          className={cn(
            'clock-digits',
            digits,
            inStoppage ? 'text-warning' : 'text-primary',
            // Paused reads as held rather than broken: the figures step back to
            // secondary instead of greying out entirely.
            isHeld && 'text-secondary',
          )}
        >
          {minutes}
          <span className={cn('px-[0.04em]', reading.isRunning ? 'clock-colon' : 'opacity-45')}>
            :
          </span>
          {seconds}
        </span>

        {inStoppage ? (
          <span
            className={cn(
              'mono rounded-full border border-[var(--warning)] font-medium text-warning',
              chip,
            )}
          >
            +{reading.stoppage}
          </span>
        ) : null}
      </div>

      {showTrack ? (
        <div className="clock-track w-full" aria-hidden>
          <span
            className="clock-fill"
            style={{
              width: `${Math.min(100, reading.progress * 100)}%`,
              background: inStoppage ? 'var(--warning)' : 'var(--accent-strong)',
              // One second of a 45-minute half is a third of a degree of arc and
              // a fifth of a percent of this line — a linear transition of
              // exactly one second means it creeps rather than steps.
              transition: reading.isRunning
                ? 'width 1s linear, background 300ms linear'
                : 'width 480ms var(--ease), background 300ms linear',
            }}
          />
        </div>
      ) : null}

      <p
        className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-secondary', meta)}
        aria-live="polite"
      >
        {reading.isRunning ? (
          <span
            aria-hidden
            className={cn(
              'live-pulse size-1.5 shrink-0 rounded-full',
              inStoppage ? 'bg-[var(--warning)]' : 'bg-[var(--accent-strong)]',
            )}
          />
        ) : null}

        {clock ? (
          <span className="font-medium text-primary">
            {shortPeriodName(reading.period, clock.periods)}
          </span>
        ) : null}

        <span aria-hidden className="text-line-strong">
          ·
        </span>
        <span>{clockStatusLabel(clock)}</span>

        {clock && clock.periods > 1 ? (
          <PeriodPips current={reading.period} total={clock.periods} status={clock.status} />
        ) : null}
      </p>
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
    <span className="ml-0.5 flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, index) => {
        const period = index + 1;
        const done = period < current || (period === current && status === 'FINISHED');

        return (
          <span
            key={period}
            className={cn(
              'h-[3px] rounded-full transition-all duration-[var(--dur)] ease-[var(--ease)]',
              period === current && status !== 'FINISHED'
                ? 'w-5 bg-[var(--accent-strong)]'
                : done
                  ? 'w-2.5 bg-line-strong'
                  : 'w-2.5 bg-line',
            )}
          />
        );
      })}
    </span>
  );
}

/**
 * The compact form, for a scoreboard header or a fixture row. Same arithmetic,
 * figures only — a clock beside a scoreline should not out-weigh the scoreline.
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
