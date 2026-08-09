import { clockStatusLabel, shortPeriodName, type MatchClockDto } from '@howzat/shared';
import { cn } from '@/lib/cn';
import { useClockReading } from './useMatchClock';

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
  showTrack?: boolean;
  className?: string;
}) {
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
