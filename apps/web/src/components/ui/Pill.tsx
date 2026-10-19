import type { ReactNode } from 'react';
import type { MatchStatus } from '@howzat/shared';
import { cn } from '@/lib/cn';

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
    sm: 'size-7 text-[0.5625rem]',
    md: 'size-9 text-[0.625rem]',
    lg: 'size-12 text-[0.75rem]',
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full border-[1.5px] bg-raised',
        'font-bold tracking-[0.04em] text-primary',
        sizes[size],
      )}
      style={{ borderColor: color }}
    >
      {shortName}
    </span>
  );
}
