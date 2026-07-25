import type { ReactNode } from 'react';
import type { MatchStatus } from '@howzat/shared';
import { cn } from '@/lib/cn';

/*
 * Status marks.
 *
 * Every pill in the system is a hairline outline with a soft wash — never a
 * saturated filled badge. The one exception is LIVE, which is allowed to be a
 * solid because it is the single most important state in the product.
 */

type Tone = 'neutral' | 'accent' | 'success' | 'live' | 'warning';

const tones: Record<Tone, string> = {
  neutral: 'border-line bg-sunken text-secondary',
  accent: 'border-[var(--accent-line)] bg-accent-soft text-accent',
  success: 'border-[var(--success)]/35 bg-success-soft text-success',
  live: 'border-[var(--live)] bg-live text-white',
  warning: 'border-[var(--warning)]/40 bg-warning-soft text-warning',
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
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-[0.6875rem] leading-none font-medium tracking-[0.08em] uppercase',
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
      {status === 'LIVE' ? (
        <span aria-hidden className="live-pulse size-1.5 rounded-full bg-current" />
      ) : null}
      {label}
    </Pill>
  );
}

/**
 * A team's abbreviation on its own colour. The team colour is organizer-chosen
 * and could be anything, so the text is forced white with a hairline of the
 * same colour underneath — which keeps a pale kit from vanishing on a pale ground.
 */
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
    sm: 'size-8 text-[0.625rem]',
    md: 'size-11 text-[0.6875rem]',
    lg: 'size-14 text-xs',
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-[var(--radius-sm)]',
        'font-semibold tracking-[0.06em] text-white',
        // A dark inner ring keeps light kit colours legible against paper.
        'ring-1 ring-black/15 ring-inset',
        sizes[size],
      )}
      style={{ background: color }}
    >
      {shortName}
    </span>
  );
}
