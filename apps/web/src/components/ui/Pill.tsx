import type { ReactNode } from 'react';
import type { MatchStatus } from '@howzat/shared';
import { cn } from '@/lib/cn';
import { pick, seedHash } from '@/lib/seed';

type Tone = 'neutral' | 'accent' | 'success' | 'live' | 'warning';

const tones: Record<Tone, string> = {
  neutral: 'border-line text-secondary',
  accent: 'border-line-strong text-primary',
  success: 'border-line text-success',
  live: 'border-[color-mix(in_oklab,var(--live)_45%,transparent)] text-live',
  warning: 'border-line text-warning',
};

export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5',
        'text-[0.6875rem] leading-none font-semibold tracking-[0.08em] uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS: Record<MatchStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'neutral' },
  TOSS: { label: 'Toss', tone: 'accent' },
  LIVE: { label: 'Live', tone: 'live' },
  INNINGS_BREAK: { label: 'Innings break', tone: 'accent' },
  COMPLETED: { label: 'Result', tone: 'success' },
  ABANDONED: { label: 'Abandoned', tone: 'neutral' },
};

export function StatusPill({ status }: { status: MatchStatus }) {
  const { label, tone } = STATUS[status];

  return (
    <Pill tone={tone}>
      {status === 'LIVE' ? <span aria-hidden className="live-dot" /> : null}
      {label}
    </Pill>
  );
}

const CREST_SHAPES = [
  'M24 3.5c6 2.6 12 3.6 18 3.2.4 14-1.6 26-6 32-3.2 4.2-7.2 6.6-12 8.3-4.8-1.7-8.8-4.1-12-8.3-4.4-6-6.4-18-6-32 6 .4 12-.6 18-3.2Z',
  'M24 3.6c11.4 0 20.6 9 20.4 20.6-.2 11.3-9.2 20.2-20.5 20.2S3.5 35.4 3.6 24C3.7 12.6 12.6 3.6 24 3.6Z',
  'M10 5.5c9.4-.8 18.6-.8 28 0 1.6 0 2.6 1 2.6 2.6.6 9 .2 18-1.6 25-1.4 5.4-8 10-15 13-7-3-13.6-7.6-15-13-1.8-7-2.2-16-1.6-25 0-1.6 1-2.6 2.6-2.6Z',
] as const;

const CREST_PATTERNS = [
  null,
  'M24 0h24v48H24Z',
  'M10 0h5v48h-5ZM21.5 0h5v48h-5ZM33 0h5v48h-5Z',
  'M0 20l24 13 24-13v8L24 41 0 28Z',
  'M-4 38L38-4l8 8L4 46Z',
  'M0 17h48v11H0Z',
] as const;

const CREST_SIZES = {
  sm: 'size-7 text-[0.5625rem]',
  md: 'size-9 text-[0.625rem]',
  lg: 'size-12 text-[0.8125rem]',
  xl: 'size-20 text-[1.25rem]',
} as const;

export function TeamMark({
  shortName,
  color,
  size = 'md',
  className,
}: {
  shortName: string;
  color: string;
  size?: keyof typeof CREST_SIZES;
  className?: string;
}) {
  const seed = seedHash(`${shortName}:${color}`);
  const shapeIndex = seed % CREST_SHAPES.length;
  const shape = CREST_SHAPES[shapeIndex]!;
  const pattern = pick(CREST_PATTERNS, seed, 4);
  const clip = `crest-${seed.toString(36)}`;

  return (
    <span
      aria-hidden
      className={cn('relative inline-grid shrink-0 place-items-center', CREST_SIZES[size], className)}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <clipPath id={clip}>
            <path d={shape} />
          </clipPath>
        </defs>
        <path d={shape} fill={`color-mix(in oklab, ${color} 16%, var(--surface-raised))`} />
        {pattern ? (
          <path d={pattern} fill={color} opacity={0.3} clipPath={`url(#${clip})`} />
        ) : null}
        <path
          d={shape}
          fill="none"
          stroke={color}
          strokeOpacity={0.55}
          strokeWidth={1}
          transform="translate(24 24) scale(.8) translate(-24 -24)"
        />
        <path d={shape} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      </svg>
      <span
        className={cn(
          'relative leading-none font-bold tracking-[0.03em]',
          shapeIndex !== 1 && '-translate-y-[6%]',
          shortName.length > 3 && 'text-[0.8em]',
        )}
        style={{ color: `color-mix(in oklab, ${color} 55%, var(--text-primary))` }}
      >
        {shortName.slice(0, 4)}
      </span>
    </span>
  );
}
