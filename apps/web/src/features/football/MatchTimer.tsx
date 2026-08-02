import { memo } from 'react';
import {
  clockStatusLabel,
  periodName,
  shortPeriodName,
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
 * What it is made of, and why each part is there:
 *
 *  • A recess, a face and a specular arc — three layers of CSS, no images. The
 *    dial is the only object in the product with real depth, and it earns it by
 *    being the one thing on the screen looked *at* rather than read past.
 *  • A minute ring of sixty ticks, lit to the current minute, with every fifth
 *    tick longer. An arc tells you roughly how far through you are; ticks tell
 *    you *which minute*, which is what anyone actually wants off a football
 *    clock.
 *  • One accent arc, with a lit cap travelling at its head. The arc advances
 *    about a third of a degree a second and nobody perceives that; the cap is
 *    what makes the gauge read as running.
 *  • A colon that blinks once a second. The oldest running-clock affordance
 *    there is, it costs one keyframe, and it means the clock reads as live even
 *    in a still screenshot.
 *
 * Stoppage time is drawn as a second, thinner arc *inside* the completed first
 * one rather than by letting the first keep going — because that is what
 * stoppage time is, and a ring that silently overfills means nothing.
 *
 * Performance note: this component owns the tick. The console around it does
 * not re-render as the seconds move, and the sixty tick marks are memoised on
 * the lit count, so a second passing costs one small subtree.
 */

type Size = 'sm' | 'md' | 'lg';

const DIAL: Record<
  Size,
  { box: number; stroke: number; bezel: number; digits: string; label: string; status: string }
> = {
  sm: {
    box: 132,
    stroke: 4,
    bezel: 6,
    digits: 'text-[1.5rem]',
    label: 'text-[0.5rem] tracking-[0.2em]',
    status: 'text-[0.75rem]',
  },
  md: {
    box: 208,
    stroke: 6,
    bezel: 9,
    digits: 'text-[2.5rem]',
    label: 'text-[0.5625rem] tracking-[0.22em]',
    status: 'text-[0.8125rem]',
  },
  lg: {
    box: 292,
    stroke: 8,
    bezel: 12,
    digits: 'text-[3.5rem]',
    label: 'text-[0.625rem] tracking-[0.24em]',
    status: 'text-sm',
  },
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
  // The tick lives here rather than in the console: the seconds are the only
  // thing changing, so the seconds are the only thing that should re-render.
  const reading = useClockReading(clock);

  const { box, stroke, bezel, digits, label, status } = DIAL[size];

  const centre = box / 2;
  const tickOuter = centre - bezel - 2;
  const majorTick = size === 'lg' ? 9 : size === 'md' ? 7 : 5;
  const radius = tickOuter - majorTick - stroke;
  const circumference = 2 * Math.PI * radius;

  const inStoppage = reading.stoppage > 0;
  const periodMinutes = clock?.periodMinutes ?? 45;
  const isHeld = !reading.isRunning && clock?.status === 'PAUSED';

  // Stoppage rarely runs past a tenth of the period, so the overrun arc is
  // scaled against that — otherwise six added minutes would draw as a sliver.
  const overrun = inStoppage
    ? Math.min(1, reading.stoppage / Math.max(1, periodMinutes * 0.15))
    : 0;
  const overrunRadius = radius - stroke - 4;

  const [minutes, seconds] = reading.display.split(':');
  const litTicks = Math.round(reading.progress * 60);

  // Where the arc's head is standing. −90° because the ring starts at twelve.
  const headAngle = (reading.progress * 360 - 90) * (Math.PI / 180);
  const headX = centre + Math.cos(headAngle) * radius;
  const headY = centre + Math.sin(headAngle) * radius;

  return (
    <div className={cn('flex flex-col items-center gap-5', className)}>
      <div className="dial-well relative" style={{ width: box, height: box, padding: bezel }}>
        <div className="dial-face absolute" style={{ inset: bezel }} />
        <div className="dial-gloss absolute" style={{ inset: bezel }} />

        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          className="absolute inset-0"
          aria-hidden
        >
          <MinuteRing
            centre={centre}
            outer={tickOuter}
            major={majorTick}
            lit={litTicks}
            tone={inStoppage ? 'var(--warning)' : 'var(--accent-strong)'}
          />

          <g transform={`rotate(-90 ${centre} ${centre})`}>
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
                // While running the arc steps once a second, and one second of a
                // 45-minute half is a third of a degree. A linear transition of
                // exactly one second means the head glides rather than stepping,
                // and lands precisely where the next tick will start it.
                transition: reading.isRunning
                  ? 'stroke-dashoffset 1s linear, stroke 300ms linear'
                  : 'stroke-dashoffset 480ms var(--ease), stroke 300ms linear',
              }}
            />

            {inStoppage ? (
              <circle
                cx={centre}
                cy={centre}
                r={overrunRadius}
                fill="none"
                stroke="var(--warning)"
                strokeWidth={Math.max(2, stroke - 3)}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * overrunRadius}
                strokeDashoffset={2 * Math.PI * overrunRadius * (1 - overrun)}
                style={{ transition: 'stroke-dashoffset 480ms var(--ease)' }}
              />
            ) : null}
          </g>

          {reading.progress > 0 ? (
            <circle
              className="dial-head"
              cx={headX}
              cy={headY}
              r={stroke * 0.62}
              fill={inStoppage ? 'var(--warning)' : 'var(--accent-strong)'}
              style={{
                transition: reading.isRunning
                  ? 'cx 1s linear, cy 1s linear'
                  : 'cx 480ms var(--ease), cy 480ms var(--ease)',
              }}
            />
          ) : null}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span
            className={cn(
              'mono flex items-baseline leading-none font-medium tabular-nums',
              digits,
              inStoppage ? 'text-warning' : 'text-primary',
              // Paused reads as held rather than broken: the figures step back
              // to secondary instead of greying out entirely.
              isHeld && 'text-secondary',
            )}
          >
            {minutes}
            <span
              className={cn(
                'px-[0.05em]',
                reading.isRunning ? 'clock-colon' : isHeld ? 'dial-breathe' : 'opacity-40',
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

      <div className="flex flex-col items-center gap-3">
        <p
          className={cn(
            'flex items-center gap-2 font-medium text-secondary',
            status,
            inStoppage && 'text-warning',
          )}
          aria-live="polite"
        >
          {reading.isRunning ? (
            <span
              aria-hidden
              className={cn(
                'live-pulse size-1.5 rounded-full',
                inStoppage ? 'bg-[var(--warning)]' : 'bg-[var(--accent-strong)]',
              )}
            />
          ) : null}
          {inStoppage ? `${clockStatusLabel(clock)} · +${reading.stoppage}` : clockStatusLabel(clock)}
        </p>

        {clock && clock.periods > 1 ? (
          <PeriodPips current={reading.period} total={clock.periods} status={clock.status} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Sixty marks, lit to where the clock is.
 *
 * Memoised on the lit count rather than re-drawn on every tick: the ring only
 * changes once a minute, and sixty SVG nodes rebuilt every second was a
 * measurable share of why the console felt heavy on a phone.
 */
const MinuteRing = memo(function MinuteRing({
  centre,
  outer,
  major,
  lit,
  tone,
}: {
  centre: number;
  outer: number;
  major: number;
  lit: number;
  tone: string;
}) {
  return (
    <g transform={`rotate(-90 ${centre} ${centre})`}>
      {Array.from({ length: 60 }).map((_, index) => {
        const angle = (index / 60) * 2 * Math.PI;
        const isMajor = index % 5 === 0;
        const inner = outer - (isMajor ? major : major * 0.55);
        const isLit = index < lit;

        return (
          <line
            key={index}
            x1={centre + Math.cos(angle) * inner}
            y1={centre + Math.sin(angle) * inner}
            x2={centre + Math.cos(angle) * outer}
            y2={centre + Math.sin(angle) * outer}
            stroke={isLit ? tone : 'var(--line)'}
            strokeWidth={isMajor ? 1.8 : 1}
            strokeLinecap="round"
            opacity={isLit ? 1 : isMajor ? 0.85 : 0.5}
          />
        );
      })}
    </g>
  );
});

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
                ? 'w-8 bg-[var(--accent-strong)]'
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
