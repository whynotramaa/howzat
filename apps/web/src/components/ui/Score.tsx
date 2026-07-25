import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * The scoreboard vocabulary: figures that change, and the over strip.
 *
 * These are the pieces that have to look like a scorecard rather than a
 * dashboard. Everything is tabular, so nothing shifts width as the score moves,
 * and a changed figure lifts into place once — keyed on the value, so it fires
 * on the ball that changed it and on nothing else.
 */

export function ScoreFigure({
  runs,
  wickets,
  size = 'lg',
  tone = 'default',
}: {
  runs: number;
  wickets: number;
  size?: 'md' | 'lg' | 'xl';
  tone?: 'default' | 'inverse';
}) {
  const sizes = {
    md: 'text-[2.5rem]',
    lg: 'text-[3.25rem] sm:text-[4rem]',
    xl: 'text-[4rem] sm:text-[5.5rem]',
  } as const;

  return (
    <p
      className={cn(
        'score-figure flex items-baseline',
        sizes[size],
        tone === 'inverse' ? 'text-on-inverse' : 'text-primary',
      )}
    >
      {/* Keyed on the value: React remounts it, the animation runs once. */}
      <span key={runs} className="figure-in">
        {runs}
      </span>
      <span
        aria-hidden
        className={cn(
          'mx-[0.06em] font-normal',
          tone === 'inverse' ? 'text-muted-on-inverse' : 'text-muted',
        )}
      >
        /
      </span>
      <span key={wickets} className="figure-in">
        {wickets}
      </span>
    </p>
  );
}

/** Overs, in mono, with the quota after it when there is one. */
export function OversFigure({
  overs,
  quota,
  tone = 'default',
}: {
  overs: string;
  quota?: number;
  tone?: 'default' | 'inverse';
}) {
  return (
    <p className="flex items-baseline gap-1">
      <span
        key={overs}
        className={cn(
          'mono figure-in text-2xl font-medium',
          tone === 'inverse' ? 'text-on-inverse' : 'text-primary',
        )}
      >
        {overs}
      </span>
      {quota !== undefined ? (
        <span
          className={cn(
            'mono text-sm',
            tone === 'inverse' ? 'text-muted-on-inverse' : 'text-muted',
          )}
        >
          /{quota}
        </span>
      ) : null}
    </p>
  );
}

/**
 * One delivery. A dot is a dot — the mark a scorer actually writes — not a zero,
 * and a wicket is the only chip allowed a solid fill.
 */
export function BallChip({ display, isWicket }: { display: string; isWicket?: boolean }) {
  const wicket = isWicket || display.includes('W');
  const boundary = display === '4' || display === '6';
  const extra = /[a-z]/.test(display) && !wicket;

  return (
    <span
      className={cn(
        'mono grid size-9 shrink-0 place-items-center rounded-full border text-[0.8125rem] font-medium',
        wicket
          ? 'border-[var(--live)] bg-live text-white'
          : boundary
            ? 'border-[var(--accent-strong)] bg-accent-soft text-accent'
            : extra
              ? 'border-dashed border-line-strong bg-transparent text-secondary'
              : 'border-line bg-sunken text-secondary',
      )}
    >
      {display === '0' ? '·' : display}
    </span>
  );
}

/** The current over, laid out left to right the way it is written in a book. */
export function OverStrip({
  balls,
  emptyLabel = 'No balls bowled yet this over',
}: {
  balls: Array<{ key: string | number; display: string; isWicket?: boolean }>;
  emptyLabel?: string;
}) {
  if (balls.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {balls.map((ball, index) => (
        <span
          key={ball.key}
          className="reveal"
          // The over builds left to right on load, one ball after another.
          style={{ '--delay': `${index * 40}ms` } as React.CSSProperties}
        >
          <BallChip display={ball.display} isWicket={ball.isWicket} />
        </span>
      ))}
    </div>
  );
}

/**
 * A label and value on one line, separated by a leader rule — the layout a
 * printed scorecard uses, and the reason these read as records rather than rows
 * of a table.
 */
export function LeaderRow({
  label,
  value,
  emphasis = false,
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={cn('shrink-0 text-sm', emphasis ? 'text-primary' : 'text-secondary')}>
        {label}
      </span>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-line" />
      <span
        className={cn(
          'tabular shrink-0 text-sm',
          emphasis ? 'font-semibold text-primary' : 'text-primary',
        )}
      >
        {value}
      </span>
    </div>
  );
}
