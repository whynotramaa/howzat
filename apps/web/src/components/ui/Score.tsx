import type { CSSProperties, ReactNode } from 'react';
import type { BallSummary } from '@howzat/shared';
import { TeamMark } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';

/* ── Deliveries ──────────────────────────────────────────────────────────── */

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
        <span key={ball.key} className="chip-land" style={{ '--i': index } as CSSProperties}>
          <BallChip display={ball.display} isWicket={ball.isWicket} />
        </span>
      ))}
    </div>
  );
}

/* ── Rows ────────────────────────────────────────────────────────────────── */

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

/* ── Containers ──────────────────────────────────────────────────────────── */

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

/* ── The board ───────────────────────────────────────────────────────────── */

/**
 * The score and nothing else. Every rate, average and breakdown belongs below
 * the players, which is the order a spectator actually reads in.
 */
export function Scoreboard({
  team,
  eyebrow,
  status,
  runs,
  wickets,
  overs,
  quota,
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

      <div className={cn('flex items-end justify-between gap-6 pt-7 pb-8 sm:pt-9', pad)}>
        <p
          key={`${runs}-${wickets}`}
          className={cn(
            'score-hit score-figure flex items-baseline text-primary',
            size === 'lg' ? 'text-[clamp(3.75rem,17vw,7rem)]' : 'text-[clamp(3.25rem,13vw,5rem)]',
          )}
        >
          <span>{runs}</span>
          <span aria-hidden className="font-normal text-muted">
            /
          </span>
          <span className="text-muted">{wickets}</span>
        </p>

        <div className="flex shrink-0 items-end gap-5 pb-1.5 sm:gap-7">
          <span aria-hidden className="dot-rule-v hidden self-stretch sm:block" />
          <div>
            <p className="mono flex items-baseline text-[1.375rem] font-medium text-primary">
              <span key={overs} className="figure-in">
                {overs}
              </span>
              {quota ? <span className="text-base text-muted">/{quota}</span> : null}
            </p>
            <p className="eyebrow mt-2.5">Overs</p>
          </div>
        </div>
      </div>

      {children ? <div className="border-t border-line">{children}</div> : null}
    </section>
  );
}

/* ── The crease ──────────────────────────────────────────────────────────── */

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

/**
 * The scorebook page. Feint ruling behind it, the striker's row lit and
 * annotated by hand, the bowler's figures given the same weight as a batter's
 * score because the scorer needs both at a glance.
 */
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
    <Panel title="At the crease" meta={action} bodyClassName="p-0">
      {batters.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col">
          {batters.map((batter) => (
            <li key={batter.id} className="flex items-center gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate',
                    batter.onStrike ? 'font-semibold text-primary' : 'text-secondary',
                  )}
                >
                  {batter.name}
                  {batter.onStrike ? (
                    <>
                      <span aria-hidden>*</span>
                      <span className="sr-only"> on strike</span>
                    </>
                  ) : null}
                </p>
                <p className="mono mt-1 flex flex-wrap gap-x-3 text-[0.6875rem] text-muted">
                  <span>{batter.fours}×4</span>
                  <span>{batter.sixes}×6</span>
                  <span>
                    SR {batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : '—'}
                  </span>
                </p>
              </div>

              <p className="score-figure shrink-0 text-[1.75rem] text-primary">
                {batter.runs}
                <span className="mono ml-1 text-[0.8125rem] font-normal text-muted">
                  ({batter.balls})
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-4 bg-sunken px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Bowling</p>
          <p className="mt-1.5 truncate font-medium text-primary">{bowler?.name ?? 'Not named'}</p>
        </div>

        {bowlerAction}

        <div className="shrink-0 text-right">
          <p className="score-figure text-[1.75rem] text-primary">
            {bowler?.wickets ?? 0}
            <span className="text-muted">/{bowler?.runs ?? 0}</span>
          </p>
          <p className="mono mt-1 text-[0.6875rem] text-muted">
            {bowler ? `${bowler.overs} ov · ${bowler.maidens} mdn` : '0.0 ov'}
            {bowler?.econ != null ? ` · econ ${bowler.econ.toFixed(2)}` : ''}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ── The numbers, in a sentence ──────────────────────────────────────────── */

/**
 * The rates and the breakdown, set as text on a ruled line rather than boxed
 * up as tiles. They are supporting figures and they should read like it.
 */
export function StatLine({
  items,
  note,
}: {
  items: ReadonlyArray<{ label: string; value: ReactNode; tone?: 'plain' | 'accent' | 'live' }>;
  note?: string;
}) {
  return (
    <div className="border-y border-line py-4">
      <dl className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline gap-2.5">
            <dt className="eyebrow">{item.label}</dt>
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

        {note ? <span className="hand ml-auto text-xl text-muted">{note}</span> : null}
      </dl>
    </div>
  );
}

/* ── The momentum ────────────────────────────────────────────────────────── */

/**
 * Runs in each over as a row of hollow bars. Wicket overs are drawn in the
 * live colour, the peak is called out by hand, and hovering an over gives you
 * the ball-by-ball total without a legend.
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
  const best = overs.reduce((top, over) => (over.runs > top.runs ? over : top), overs[0]!);

  return (
    <div className={className}>
      <div className="flex h-32 items-end gap-1.5">
        {overs.map((over, index) => (
          <div
            key={over.number}
            data-wicket={over.wickets > 0}
            className="rpo-col flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5"
          >
            <span className="rpo-tip rounded-[var(--radius-xs)] border border-line bg-raised px-2 py-1">
              <span className="mono text-[0.625rem] text-primary">
                ov {over.number + 1} · {over.runs}
                {over.wickets > 0 ? ` · ${over.wickets}w` : ''}
              </span>
            </span>

            {over.number === best.number && best.runs > 0 ? (
              <span className="hand text-center text-lg leading-none text-muted">best</span>
            ) : null}

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
              style={
                {
                  height: `${Math.max(4, (over.runs / peak) * 78)}%`,
                  '--i': index,
                } as CSSProperties
              }
              className={cn(
                'rpo-bar w-full rounded-t-[3px] border border-b-0',
                over.wickets > 0
                  ? 'border-[var(--live)] bg-live-soft'
                  : 'border-[var(--accent-line)] bg-accent-soft',
              )}
            />
          </div>
        ))}
      </div>

      <div className="dot-rule" />

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
