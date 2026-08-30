import type { CSSProperties, ReactNode } from 'react';
import type { BallSummary } from '@howzat/shared';
import { TeamMark } from '@/components/ui/Pill';
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

/* ── The board ───────────────────────────────────────────────────────────── */

export interface Readout {
  label: string;
  value: ReactNode;
  tone?: 'plain' | 'accent' | 'live';
}

const READOUT_TONE = {
  plain: 'text-primary',
  accent: 'text-accent',
  live: 'text-live',
} as const;

/**
 * The one loud thing on either scoring page. Everything else in the console
 * and the live page is a hairline and a label; the board gets the big figure,
 * the crop marks and the unlit segments behind the number.
 */
export function Scoreboard({
  team,
  eyebrow,
  status,
  runs,
  wickets,
  overs,
  quota,
  readouts,
  size = 'lg',
  children,
}: {
  team: { name: string; shortName: string; primaryColor: string };
  eyebrow: string;
  status?: ReactNode;
  runs: number;
  wickets: number;
  overs: string;
  quota?: string | null;
  readouts?: ReadonlyArray<Readout>;
  size?: 'md' | 'lg';
  children?: ReactNode;
}) {
  const pad = size === 'lg' ? 'px-5 sm:px-9' : 'px-5 sm:px-7';

  return (
    <section
      style={{ '--team-a': team.primaryColor } as CSSProperties}
      className="crop relative rounded-[var(--radius-lg)] border border-line bg-raised"
    >
      <div
        className={cn('flex flex-wrap items-center justify-between gap-x-5 gap-y-3 pt-6 pb-5', pad)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-primary">{team.name}</p>
            <p className="eyebrow mt-2">{eyebrow}</p>
          </div>
        </div>
        {status}
      </div>

      <div className={cn('dot-rule', size === 'lg' ? 'mx-5 sm:mx-9' : 'mx-5 sm:mx-7')} />

      <div
        className={cn(
          'flex flex-wrap items-end justify-between gap-x-10 gap-y-5 pt-7 pb-8 sm:pt-9',
          pad,
        )}
      >
        <p
          key={`${runs}-${wickets}`}
          className={cn(
            'led score-hit score-figure flex items-baseline text-primary',
            size === 'lg' ? 'text-[clamp(3.75rem,17vw,7rem)]' : 'text-[clamp(3.25rem,13vw,5rem)]',
          )}
        >
          <span aria-hidden className="led-ghost flex items-baseline">
            <span>{'8'.repeat(String(runs).length)}</span>
            <span className="font-normal">/</span>
            <span>{'8'.repeat(String(wickets).length)}</span>
          </span>
          <span>{runs}</span>
          <span aria-hidden className="font-normal text-muted">
            /
          </span>
          <span className="text-muted">{wickets}</span>
        </p>

        <div className="pb-1.5">
          <p className="mono flex items-baseline text-[1.375rem] font-medium text-primary">
            <span key={overs} className="figure-in">
              {overs}
            </span>
            {quota ? <span className="text-base text-muted">/{quota}</span> : null}
          </p>
          <p className="eyebrow mt-2.5">Overs</p>
        </div>
      </div>

      {readouts && readouts.length > 0 ? (
        <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          {readouts.map((readout, index) => (
            <div
              key={readout.label}
              className={cn(
                'px-5 py-4 sm:px-7',
                index % 2 === 1 && 'border-l border-line',
                index > 0 && 'sm:border-l sm:border-line',
                index > 1 && 'border-t border-line sm:border-t-0',
              )}
            >
              <dd
                className={cn(
                  'mono text-[1.375rem] leading-none font-medium',
                  READOUT_TONE[readout.tone ?? 'plain'],
                )}
              >
                {readout.value}
              </dd>
              <dt className="eyebrow mt-2.5">{readout.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}

      {children ? <div className="border-t border-line">{children}</div> : null}
    </section>
  );
}

/* ── The momentum ────────────────────────────────────────────────────────── */

/**
 * Runs in each over as a row of hollow bars. Wicket overs are drawn in the
 * live colour, which is the only place the eye needs to stop.
 */
export function RunsPerOver({
  balls,
  className,
}: {
  balls: ReadonlyArray<BallSummary>;
  className?: string;
}) {
  const overs = groupOvers(balls);

  if (overs.length === 0) {
    return <p className="text-sm text-muted">No overs to plot yet.</p>;
  }

  const peak = Math.max(6, ...overs.map((over) => over.runs));

  return (
    <div className={className}>
      <div className="flex h-32 items-end gap-1.5 border-b border-line">
        {overs.map((over) => (
          <div
            key={over.number}
            title={`Over ${over.number + 1}: ${over.runs} run${over.runs === 1 ? '' : 's'}${
              over.wickets > 0 ? `, ${over.wickets}w` : ''
            }`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5"
          >
            <span
              className={cn(
                'mono text-center text-[0.625rem] leading-none',
                over.wickets > 0 ? 'text-live' : 'text-muted',
              )}
            >
              {over.runs}
            </span>
            <span
              aria-hidden
              style={{ height: `${Math.max(4, (over.runs / peak) * 82)}%` }}
              className={cn(
                'rpo-bar w-full rounded-t-[2px] border border-b-0',
                over.wickets > 0
                  ? 'border-[var(--live)] bg-live-soft'
                  : 'border-[var(--accent-line)] bg-accent-soft',
              )}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-1.5">
        {overs.map((over) => (
          <span
            key={over.number}
            className="mono min-w-0 flex-1 text-center text-[0.625rem] text-muted"
          >
            {overs.length > 12 && over.number % 2 === 1 ? '' : over.number + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

function groupOvers(
  balls: ReadonlyArray<BallSummary>,
): Array<{ number: number; runs: number; wickets: number }> {
  const byOver = new Map<number, { runs: number; wickets: number }>();

  for (const ball of balls) {
    const entry = byOver.get(ball.overNumber) ?? { runs: 0, wickets: 0 };
    entry.runs += ball.runs;
    entry.wickets += ball.isWicket ? 1 : 0;
    byOver.set(ball.overNumber, entry);
  }

  return [...byOver.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, entry]) => ({ number, ...entry }));
}

/* ── The panel ───────────────────────────────────────────────────────────── */

/** One hairline box with a labelled head. The only container these pages use. */
export function Panel({
  title,
  meta,
  icon,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  meta?: ReactNode;
  icon?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn('min-w-0 rounded-[var(--radius-lg)] border border-line bg-raised', className)}
    >
      <div className="flex min-h-[3.25rem] items-center justify-between gap-4 border-b border-line px-5 py-3">
        <p className="eyebrow flex items-center gap-2">
          {icon}
          {title}
        </p>
        {meta !== undefined ? <div className="flex items-center gap-2">{meta}</div> : null}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
