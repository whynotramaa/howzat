import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MatchStatus } from '@howzat/shared';
import { StatusPill, TeamMark } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';

export interface MatchSide {
  name: string;
  shortName: string;
  color: string;
  score?: ReactNode;
  note?: ReactNode;
  winner?: boolean;
}

function Side({ side, decided }: { side: MatchSide | null; decided: boolean }) {
  if (!side)
    return (
      <div className="flex min-h-8 items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-[7px] border border-dashed border-line-strong text-muted">
          ?
        </span>
        <span className="text-sm text-muted">To be decided</span>
      </div>
    );
  return (
    <div className="match-side flex min-w-0 items-center gap-2.5">
      <TeamMark shortName={side.shortName} color={side.color} size="md" />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm font-medium',
          decided && !side.winner ? 'text-secondary' : 'text-primary',
        )}
      >
        {side.name}
      </span>
      {side.score != null && side.score !== '' ? (
        <span className="score-figure shrink-0 text-lg">{side.score}</span>
      ) : null}
      {side.note ? <span className="text-xs text-muted">{side.note}</span> : null}
    </div>
  );
}

export function MatchCard({
  eyebrow,
  status,
  home,
  away,
  result,
  meta,
  actions,
  to,
  label,
  className,
  style,
}: {
  eyebrow?: ReactNode;
  status: MatchStatus;
  home: MatchSide | null;
  away: MatchSide | null;
  result?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  to?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const decided = Boolean(home?.winner || away?.winner);

  return (
    <article
      style={style}
      className={cn(
        'match-ledger relative flex min-w-0 flex-col rounded-[var(--radius-lg)] border border-line bg-raised p-4 transition-colors hover:border-line-strong',
        className,
      )}
    >
      {to ? (
        <Link
          to={to}
          aria-label={label ?? `${home?.name ?? 'TBD'} v ${away?.name ?? 'TBD'}`}
          className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      ) : null}

      <div className="pointer-events-none relative flex min-h-6 items-center justify-between gap-3">
        <div className="min-w-0 truncate text-xs text-muted">{eyebrow}</div>
        <StatusPill status={status} />
      </div>

      <div className="pointer-events-none relative mt-3 grid gap-2">
        <Side side={home} decided={decided} />
        <Side side={away} decided={decided} />
      </div>

      {result ? (
        <p className="pointer-events-none relative mt-3 text-[0.8125rem] font-medium text-primary">
          {result}
        </p>
      ) : null}

      {meta || actions ? (
        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line pt-3">
          <div className="pointer-events-none min-w-0 text-xs text-muted">{meta}</div>
          {actions ? (
            <div className="relative z-10 flex items-center gap-1.5">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function HeroSide({
  side,
  decided,
  align,
}: {
  side: MatchSide | null;
  decided: boolean;
  align: 'start' | 'end';
}) {
  const faded = decided && side && !side.winner;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center gap-2 text-center md:flex-row md:gap-4',
        align === 'end' ? 'md:flex-row-reverse md:text-right' : 'md:text-left',
      )}
    >
      {side ? (
        <TeamMark shortName={side.shortName} color={side.color} size="xl" />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-[12px] border border-dashed border-line-strong text-lg text-muted">
          ?
        </span>
      )}
      <div className="min-w-0">
        <p
          className={cn(
            'line-clamp-2 text-[0.9375rem] font-semibold sm:text-lg',
            faded ? 'text-secondary' : 'text-primary',
          )}
        >
          {side?.name ?? 'To be decided'}
        </p>
        {side?.score != null && side.score !== '' ? (
          <p
            className={cn(
              'score-figure tabular mt-1 text-2xl',
              faded ? 'text-muted' : 'text-primary',
            )}
          >
            {side.score}
          </p>
        ) : null}
        {side?.note ? <p className="mt-1 text-xs text-muted">{side.note}</p> : null}
      </div>
    </div>
  );
}

export function MatchHero({
  eyebrow,
  status,
  home,
  away,
  detail,
  result,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  status: MatchStatus;
  home: MatchSide | null;
  away: MatchSide | null;
  detail?: ReactNode;
  result?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const decided = Boolean(home?.winner || away?.winner);

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised px-4 py-5 md:px-8 md:py-6',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {eyebrow ? (
          <div className="flex min-w-0 flex-wrap gap-x-2 text-xs text-muted">{eyebrow}</div>
        ) : (
          <span />
        )}
        <StatusPill status={status} />
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 md:gap-8">
        <HeroSide side={home} decided={decided} align="start" />
        <span aria-hidden className="text-xs font-medium text-muted">
          vs
        </span>
        <HeroSide side={away} decided={decided} align="end" />
      </div>
      {result ? (
        <p className="mx-auto mt-5 max-w-[40ch] text-center text-sm font-medium text-primary">
          {result}
        </p>
      ) : null}
      {detail ? (
        <div className="mt-3 text-center text-[0.8125rem] text-muted">{detail}</div>
      ) : null}
      {actions ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-line pt-4">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
