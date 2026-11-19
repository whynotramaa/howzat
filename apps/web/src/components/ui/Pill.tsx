import type { ReactNode } from 'react';
import type { MatchStatus } from '@howzat/shared';
import { cn } from '@/lib/cn';
import { seedHash } from '@/lib/seed';

type Tone = 'neutral' | 'accent' | 'success' | 'live' | 'warning';

const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-secondary',
  accent: 'bg-[var(--ppl-soft)] text-[var(--ppl-ink)]',
  success: 'bg-success-soft text-success',
  live: 'bg-live-soft text-live',
  warning: 'bg-warning-soft text-warning',
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
        'inline-flex h-6 shrink-0 items-center gap-1.5 px-2',
        'text-xs leading-none font-semibold whitespace-nowrap',
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
  TOSS: { label: 'Toss', tone: 'neutral' },
  LIVE: { label: 'Live', tone: 'live' },
  INNINGS_BREAK: { label: 'Innings break', tone: 'warning' },
  COMPLETED: { label: 'Result', tone: 'success' },
  ABANDONED: { label: 'Abandoned', tone: 'neutral' },
};

export function StatusPill({ status }: { status: MatchStatus }) {
  const { label, tone } = STATUS[status];

  return (
    <Pill tone={tone}>
      {status === 'LIVE' ? <span aria-hidden className="live-square" /> : null}
      {label}
    </Pill>
  );
}

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const GLYPHS: ReactNode[] = [
  <path key="0" {...STROKE} d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 12.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />,
  <path key="1" {...STROKE} d="M5 21V10a7 7 0 0 1 14 0v11M9.5 21v-7a2.5 2.5 0 0 1 5 0v7M3 21h18" />,
  <path key="2" {...STROKE} d="M3 18h18M7 18a5 5 0 0 1 10 0M12 6v3M5.5 9.5l2 2M18.5 9.5l-2 2M2.5 14H5M19 14h2.5" />,
  <path key="3" fill="currentColor" d="M12 12V3l5 4zM12 12h9l-4 5zM12 12v9l-5-4zM12 12H3l4-5z" />,
  <g key="4" {...STROKE}>
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v14M8 11h8M4.5 14a7.5 7.5 0 0 0 15 0" />
  </g>,
  <g key="5" {...STROKE}>
    <path d="M5 11c0-3.3 3.1-6 7-6s7 2.7 7 6z" fill="currentColor" />
    <path d="M7 11c0 6 2.8 10 5 10s5-4 5-10M12 5V2.5" />
  </g>,
  <path key="6" {...STROKE} d="M4 5l8 5.5L20 5M4 11l8 5.5 8-5.5M4 17l8 5 8-5" />,
  <path key="7" fill="currentColor" d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />,
];

const CREST_SIZES = {
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-10',
  xl: 'size-12',
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
  const glyph = GLYPHS[seedHash(shortName) % GLYPHS.length];
  return (
    <span
      aria-hidden
      title={shortName}
      className={cn('inline-grid shrink-0 place-items-center bg-sunken', CREST_SIZES[size], className)}
      style={{ color: `color-mix(in oklab, ${color} 55%, var(--text-primary))` }}
    >
      <svg viewBox="0 0 24 24" className="size-[62%]">
        {glyph}
      </svg>
    </span>
  );
}
