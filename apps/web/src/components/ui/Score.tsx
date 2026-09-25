import type { CSSProperties, ReactNode } from 'react';
import type { BallSummary } from '@howzat/shared';
import { TeamMark } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';

type BallKind = 'dot' | 'run' | 'four' | 'six' | 'wicket' | 'extra';

function ballKind(display: string, isWicket?: boolean): BallKind {
  if (isWicket || display.includes('W')) return 'wicket';
  if (/[a-z]/.test(display)) return 'extra';
  if (display === '4') return 'four';
  if (display === '6') return 'six';
  if (display === '0') return 'dot';
  return 'run';
}

export function BallChip({
  display,
  isWicket,
  size = 'md',
}: {
  display: string;
  isWicket?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      data-kind={ballKind(display, isWicket)}
      className={cn('ball', size === 'sm' ? 'size-7 text-[0.6875rem]' : 'size-9 text-[0.8125rem]')}
    >
      {display === '0' ? '•' : display}
    </span>
  );
}

export function OverStrip({
  balls,
  emptyLabel = 'No balls bowled yet this over',
  size,
}: {
  balls: Array<{ key: string | number; display: string; isWicket?: boolean }>;
  emptyLabel?: string;
  size?: 'sm' | 'md';
}) {
  if (balls.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {balls.map((ball) => (
        <span key={ball.key} className="chip-land">
          <BallChip display={ball.display} isWicket={ball.isWicket} size={size} />
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
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn('min-w-0 truncate text-sm', emphasis ? 'text-primary' : 'text-secondary')}>
        {label}
      </span>
      <span
        className={cn(
          'tabular shrink-0 text-sm',
          emphasis ? 'font-semibold text-primary' : 'font-medium text-primary',
        )}
      >
        {value}
      </span>
    </div>
  );
}

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
      className={cn(
        'min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised',
        className,
      )}
    >
      <div className="flex min-h-11 items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <p className="eyebrow flex items-center gap-2">
          {icon ? <span className="text-muted">{icon}</span> : null}
          {title}
        </p>
        {meta !== undefined ? <div className="flex items-center gap-2">{meta}</div> : null}
      </div>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function RollingNumber({ value }: { value: number }) {
  const digits = String(value).split('');
  return (
    <span className="roll" aria-label={String(value)}>
      {digits.map((digit, index) => (
        <span key={digits.length - index} aria-hidden className="roll-col">
          <span className="roll-strip" style={{ '--n': Number(digit) } as CSSProperties}>
            {'0123456789'.split('').map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

export function Scoreboard({
  team,
  eyebrow,
  status,
  runs,
  wickets,
  overs,
  quota,
  stats,
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
  stats?: ReadonlyArray<{ label: string; value: ReactNode }>;
  size?: 'md' | 'lg';
  children?: ReactNode;
}) {
  return (
    <section className="board overflow-hidden rounded-[var(--radius-xl)]">
      <div className="flex items-center justify-between gap-4 px-4 pt-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold text-primary">{team.name}</p>
            <p className="text-xs text-muted">{eyebrow}</p>
          </div>
        </div>
        {status}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-4 pt-4 pb-5 sm:px-6">
        <div className="flex items-baseline gap-3">
          <p
            className={cn(
              'score-figure flex items-baseline text-primary',
              size === 'lg' ? 'text-[3.5rem] sm:text-[4.25rem]' : 'text-[3rem] sm:text-[3.5rem]',
            )}
          >
            <RollingNumber value={runs} />
            <span aria-hidden className="mx-[0.04em] font-[300] text-muted italic">
              /
            </span>
            <span className="text-muted">
              <RollingNumber value={wickets} />
            </span>
          </p>
          <p className="mono text-lg font-medium text-secondary">
            <span key={overs} className="figure-in inline-block">
              ({overs}
            </span>
            {quota ? <span className="text-muted">/{quota}</span> : null})
          </p>
        </div>

        {stats && stats.length > 0 ? (
          <dl className="flex gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="board-stat">
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {children ? <div className="border-t border-line">{children}</div> : null}
    </section>
  );
}

export interface CreaseBatter {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  onStrike: boolean;
}

export interface CreaseBowler {
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  econ: number | null;
}

const GRID = 'grid grid-cols-[minmax(0,1fr)_repeat(5,2.75rem)] items-center gap-x-1 sm:grid-cols-[minmax(0,1fr)_repeat(5,3.5rem)]';

function HeadRow({ first, cols, action }: { first: string; cols: string[]; action?: ReactNode }) {
  return (
    <div className={cn(GRID, 'eyebrow bg-sunken px-4 py-2.5')}>
      <span className="flex items-center gap-3">
        {first}
        {action}
      </span>
      {cols.map((col) => (
        <span key={col} className="text-right">
          {col}
        </span>
      ))}
    </div>
  );
}

export function CreaseCard({
  batters,
  bowler,
  emptyLabel = 'Nobody at the crease yet.',
  action,
  bowlerAction,
}: {
  batters: CreaseBatter[];
  bowler: CreaseBowler | null;
  emptyLabel?: string;
  action?: ReactNode;
  bowlerAction?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
      <HeadRow first="Batter" cols={['R', 'B', '4s', '6s', 'SR']} action={action} />
      {batters.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">{emptyLabel}</p>
      ) : (
        batters.map((batter) => (
          <div key={batter.id} className={cn(GRID, 'border-b border-line px-4 py-3 text-sm')}>
            <span
              className={cn(
                'flex min-w-0 items-center gap-2',
                batter.onStrike ? 'font-semibold text-primary' : 'text-secondary',
              )}
            >
              <span className="truncate">{batter.name}</span>
              {batter.onStrike ? (
                <>
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="sr-only">on strike</span>
                </>
              ) : null}
            </span>
            <span className="score-figure text-right text-lg text-primary">{batter.runs}</span>
            <span className="mono text-right text-secondary">{batter.balls}</span>
            <span className="mono text-right text-secondary">{batter.fours}</span>
            <span className="mono text-right text-secondary">{batter.sixes}</span>
            <span className="mono text-right text-secondary">
              {batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : '0.0'}
            </span>
          </div>
        ))
      )}

      <HeadRow first="Bowler" cols={['O', 'M', 'R', 'W', 'ECO']} action={bowlerAction} />
      <div className={cn(GRID, 'px-4 py-3 text-sm')}>
        <span className="truncate font-semibold text-primary">{bowler?.name ?? 'Not named'}</span>
        <span className="mono text-right text-secondary">{bowler?.overs ?? '0.0'}</span>
        <span className="mono text-right text-secondary">{bowler?.maidens ?? 0}</span>
        <span className="mono text-right text-secondary">{bowler?.runs ?? 0}</span>
        <span className="score-figure text-right text-lg text-primary">{bowler?.wickets ?? 0}</span>
        <span className="mono text-right text-secondary">
          {bowler?.econ != null ? bowler.econ.toFixed(2) : '0.00'}
        </span>
      </div>
    </section>
  );
}

export function StatLine({
  items,
  note,
}: {
  items: ReadonlyArray<{ label: string; value: ReactNode; tone?: 'plain' | 'accent' | 'live' }>;
  note?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
      <dl className="grid grid-cols-2 sm:grid-flow-col sm:grid-cols-none">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-1 border-line px-4 py-3 not-last:border-r max-sm:border-b"
          >
            <dt className="eyebrow">
              {item.label}
            </dt>
            <dd
              className={cn(
                'mono text-[0.9375rem] font-medium',
                item.tone === 'accent'
                  ? 'text-accent'
                  : item.tone === 'live'
                    ? 'text-live'
                    : 'text-primary',
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {note ? <p className="border-t border-line px-4 py-2 text-xs text-muted">{note}</p> : null}
    </section>
  );
}

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
      <div className="flex h-32 items-end gap-1 border-b border-line">
        {overs.map((over, index) => (
          <div
            key={over.number}
            className="rpo-col flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="rpo-tip rounded-[var(--radius-xs)] bg-inverse px-2 py-1 text-[0.6875rem] font-medium text-on-inverse">
              Ov {over.number + 1}: {over.runs}
              {over.wickets > 0 ? `, ${over.wickets}w` : ''}
            </span>
            {over.wickets > 0 ? (
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-live" />
            ) : null}
            <span
              aria-hidden
              style={
                {
                  height: `${Math.max(3, (over.runs / peak) * 88)}%`,
                  '--i': index,
                } as CSSProperties
              }
              className={cn(
                'rpo-bar w-full max-w-6 rounded-t-[3px]',
                over.wickets > 0 ? 'bg-live' : 'bg-accent',
              )}
            />
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex gap-1">
        {overs.map((over) => (
          <span
            key={over.number}
            className="tabular min-w-0 flex-1 text-center text-[0.625rem] text-muted"
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
