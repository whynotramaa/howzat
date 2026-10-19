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
  if (!side) {
    return (
      <div className="flex min-w-0 flex-col items-center gap-2.5 text-center">
        <span className="grid size-12 place-items-center rounded-full border-[1.5px] border-dashed border-line-strong font-serif text-lg text-muted">
          ?
        </span>
        <span className="text-[0.875rem] font-medium text-muted">To be decided</span>
      </div>
    );
  }

  const faded = decided && !side.winner;

  return (
    <div className="flex min-w-0 flex-col items-center gap-2.5 text-center">
      <TeamMark shortName={side.shortName} color={side.color} size="lg" />
      <span
        className={cn(
          'line-clamp-2 max-w-full text-[0.9375rem] leading-snug text-primary',
          side.winner ? 'font-bold' : 'font-semibold',
          faded && 'text-secondary',
        )}
      >
        {side.name}
      </span>
      {side.score != null && side.score !== '' ? (
        <span
          className={cn(
            'score-figure tabular text-[1.875rem] leading-none',
            faded ? 'text-muted' : 'text-primary',
          )}
        >
          {side.score}
        </span>
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
  const live = status === 'LIVE' || status === 'INNINGS_BREAK';
  const decided = Boolean(home?.winner || away?.winner);

  return (
    <article
      style={style}
      className={cn(
        'card-lift relative flex flex-col rounded-[var(--radius-xl)] border bg-raised p-5',
        live ? 'border-[color-mix(in_oklab,var(--live)_40%,var(--line))]' : 'border-line',
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
        <div className="eyebrow min-w-0 truncate">{eyebrow}</div>
        <StatusPill status={status} />
      </div>

      <div className="pointer-events-none relative mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
        <Side side={home} decided={decided} />
        <span
          aria-hidden
          className="mt-1.5 grid size-9 place-items-center rounded-full border border-line bg-surface font-serif text-[1.125rem] leading-none text-muted italic"
        >
          v
        </span>
        <Side side={away} decided={decided} />
      </div>

      {result ? (
        <p className="pointer-events-none relative mt-5 text-center font-serif text-[1.0625rem] leading-snug text-primary italic">
          {result}
        </p>
      ) : null}

      {meta || actions ? (
        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-dashed border-line pt-4">
          <div className="pointer-events-none min-w-0 text-xs text-muted">{meta}</div>
          {actions ? <div className="relative z-10 flex items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

function HeroSide({ side, decided, align }: { side: MatchSide | null; decided: boolean; align: 'start' | 'end' }) {
  const faded = decided && side && !side.winner;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center gap-4 text-center md:flex-row md:gap-5',
        align === 'end' ? 'md:flex-row-reverse md:text-right' : 'md:text-left',
      )}
    >
      {side ? (
        <TeamMark shortName={side.shortName} color={side.color} size="xl" className="max-sm:!size-16" />
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-line-strong font-serif text-2xl text-muted md:size-20">
          ?
        </span>
      )}
      <div className="min-w-0">
        <p
          className={cn(
            'serif line-clamp-2 text-[clamp(1.375rem,3vw,2.5rem)]',
            faded ? 'text-secondary' : 'text-primary',
          )}
        >
          {side?.name ?? 'To be decided'}
        </p>
        {side?.score != null && side.score !== '' ? (
          <p className={cn('score-figure tabular mt-2 text-[clamp(1.75rem,3.4vw,2.75rem)]', faded ? 'text-muted' : 'text-primary')}>
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
        'reveal paper-grain relative overflow-hidden rounded-[var(--radius-xl)] border border-line bg-raised px-5 py-7 md:px-10 md:py-10',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        {eyebrow ? <div className="eyebrow flex flex-wrap justify-center gap-x-2.5">{eyebrow}</div> : null}
        <StatusPill status={status} />
      </div>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 md:gap-8">
        <HeroSide side={home} decided={decided} align="start" />
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-full border border-line-strong bg-surface font-serif text-[1.5rem] leading-none text-secondary italic md:size-14"
        >
          v
        </span>
        <HeroSide side={away} decided={decided} align="end" />
      </div>
      {result ? (
        <p className="serif mx-auto mt-8 max-w-[34ch] text-center text-[clamp(1.25rem,2.4vw,1.75rem)] text-primary">
          {result}
        </p>
      ) : null}
      {detail ? <div className="mt-5 text-center text-[0.8125rem] text-secondary">{detail}</div> : null}
      {actions ? (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2 border-t border-dashed border-line pt-6">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
