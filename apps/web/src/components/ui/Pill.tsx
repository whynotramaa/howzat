import type { ReactNode } from 'react';
import type { MatchStatus } from '@howzat/shared';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'live' | 'warning';

const tones: Record<Tone, string> = {
  neutral: 'border-line bg-raised text-secondary',
  accent: 'border-[var(--accent-line)] bg-accent-soft text-accent',
  success: 'border-line bg-raised text-success',
  live: 'border-[var(--accent-line)] bg-accent-soft text-accent',
  warning: 'border-line bg-warning-soft text-warning',
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
        'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border px-1.5',
        'text-[0.6875rem] leading-none font-medium',
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

export function TeamMark({
  shortName,
  color,
  size = 'md',
}: {
  shortName: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'size-6 text-[0.5625rem]',
    md: 'size-8 text-[0.625rem]',
    lg: 'size-11 text-[0.6875rem]',
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-[var(--radius-sm)]',
        'font-semibold tracking-[0.02em] text-white',
        'ring-1 ring-black/10 ring-inset',
        sizes[size],
      )}
      style={{ background: color }}
    >
      {shortName}
    </span>
  );
}
