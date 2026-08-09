import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

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

export function OversFigure({
  overs,
  quota,
  quotaLabel,
  tone = 'default',
}: {
  overs: string;
  quota?: number;
  /**
   * The allotment already written as overs and balls. DLS can cut an innings to
   * 40.3 overs, which the whole-over `quota` cannot say.
   */
  quotaLabel?: string;
  tone?: 'default' | 'inverse';
}) {
  const allotment = quotaLabel ?? (quota === undefined ? undefined : String(quota));

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
      {allotment !== undefined ? (
        <span
          className={cn(
            'mono text-sm',
            tone === 'inverse' ? 'text-muted-on-inverse' : 'text-muted',
          )}
        >
          /{allotment}
        </span>
      ) : null}
    </p>
  );
}

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
          style={{ '--delay': `${index * 40}ms` } as React.CSSProperties}
        >
          <BallChip display={ball.display} isWicket={ball.isWicket} />
        </span>
      ))}
    </div>
  );
}

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
