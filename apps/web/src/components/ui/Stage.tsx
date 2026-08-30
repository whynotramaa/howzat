import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------ icons */

/*
 * Cricket needs its own vocabulary and emoji will not carry it — a flame in
 * Segoe UI and a flame on iOS are different drawings. These are 20px, stroke
 * 1.6, rounded joins, and they inherit colour like text.
 */

type IconProps = { className?: string };

function svg(path: ReactNode, extra?: ReactNode) {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={cn('size-[1.125em] shrink-0', className)}
      >
        {path}
        {extra}
      </svg>
    );
  };
}

export const FlameIcon = svg(
  <path d="M10 18c2.9 0 5-2 5-4.7 0-3.4-3.2-4.6-2.6-8.3C10.4 6.2 9 8 9 9.6c0 .9-.6 1.2-1.1.7-.5-.5-.7-1.3-.7-2C6 9.6 5 11.3 5 13.3 5 16 7.1 18 10 18Z" />,
);

export const TrophyIcon = svg(
  <>
    <path d="M6.5 2.8h7v4a3.5 3.5 0 0 1-7 0v-4Z" />
    <path d="M6.5 4.2H4.4v1.1a2.6 2.6 0 0 0 2.1 2.5M13.5 4.2h2.1v1.1a2.6 2.6 0 0 1-2.1 2.5" />
    <path d="M10 10.3v3.1M7 17.2h6M8 13.4h4l.6 3.8H7.4l.6-3.8Z" />
  </>,
);

export const TargetIcon = svg(
  <>
    <circle cx="10" cy="10" r="7" />
    <circle cx="10" cy="10" r="3.4" />
    <circle cx="10" cy="10" r="0.9" fill="currentColor" stroke="none" />
  </>,
);

export const BoltIcon = svg(<path d="M11 2.5 4.8 11.2h4.4L9 17.5l6.2-8.7h-4.4l.2-6.3Z" />);

export const BallIcon = svg(
  <>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M6.4 4.1c1.6 1.4 2.6 3.6 2.6 5.9s-1 4.5-2.6 5.9M13.6 4.1c-1.6 1.4-2.6 3.6-2.6 5.9s1 4.5 2.6 5.9" />
  </>,
);

export const EyeIcon = svg(
  <>
    <path d="M1.8 10S4.9 4.8 10 4.8 18.2 10 18.2 10 15.1 15.2 10 15.2 1.8 10 1.8 10Z" />
    <circle cx="10" cy="10" r="2.4" />
  </>,
);

export const TrendIcon = svg(
  <>
    <path d="M2.5 13.5 7.5 8.5l3 3 6-6.5" />
    <path d="M12.4 5h4.1v4.1" />
  </>,
);

export const StumpsIcon = svg(
  <>
    <path d="M6 6.5v11M10 6.5v11M14 6.5v11" />
    <path d="M4.6 5.4h10.8" />
  </>,
);

export const UndoIcon = svg(
  <>
    <path d="M4 8.5h8.2a3.8 3.8 0 0 1 0 7.6H8" />
    <path d="m7 5-3 3.5L7 12" />
  </>,
);

export const ClockIcon = svg(
  <>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M10 5.8V10l2.8 1.8" />
  </>,
);

/* --------------------------------------------------------------- surfaces */

/**
 * The hero surface for anything that represents a match. The notches sit at
 * `notchY` so they can line up with a real divider inside the card.
 */
export function Ticket({
  children,
  className,
  notchY = '50%',
  style,
}: {
  children: ReactNode;
  className?: string;
  notchY?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className={cn('ticket grain', className)}
      style={{ '--notch-y': notchY, ...style } as CSSProperties}
    >
      {children}
    </section>
  );
}

export function Plate({
  children,
  className,
  quiet = false,
}: {
  children: ReactNode;
  className?: string;
  quiet?: boolean;
}) {
  return <div className={cn(quiet ? 'plate-quiet' : 'plate', className)}>{children}</div>;
}

export function SectionHead({
  title,
  meta,
  icon,
}: {
  title: string;
  meta?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="micro flex items-center gap-2 text-muted">
        {icon}
        {title}
      </p>
      {meta !== undefined ? <div className="flex items-center gap-2">{meta}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------- ball tokens */

export type TokenKind = 'dot' | 'run' | 'four' | 'six' | 'wicket' | 'extra';

export function tokenKind(display: string, isWicket?: boolean): TokenKind {
  if (isWicket || display.includes('W')) return 'wicket';
  if (/[a-z]/.test(display)) return 'extra';
  if (display === '6') return 'six';
  if (display === '4') return 'four';
  if (display === '·' || display === '0') return 'dot';
  return 'run';
}

export function BallToken({
  display,
  isWicket,
  size = 'md',
  className,
  onClick,
  title,
}: {
  display: string;
  isWicket?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const kind = tokenKind(display, isWicket);
  const label = display === '0' ? '·' : display;
  const classes = cn('token mono', onClick && 'token-button', className);

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        data-kind={kind}
        data-size={size}
        className={classes}
      >
        {label}
      </button>
    );
  }

  return (
    <span data-kind={kind} data-size={size} className={classes} title={title}>
      {label}
    </span>
  );
}

/**
 * The over as a row of objects. The last token animates in, which is how the
 * eye learns that a delivery just landed without anything else moving.
 */
export function OverTrack({
  balls,
  size = 'md',
  animateLast = true,
  emptyLabel = 'No balls bowled yet this over',
}: {
  balls: Array<{ key: string | number; display: string; isWicket?: boolean }>;
  size?: 'sm' | 'md' | 'lg';
  animateLast?: boolean;
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
          className={animateLast && index === balls.length - 1 ? 'token-in' : undefined}
        >
          <BallToken display={ball.display} isWicket={ball.isWicket} size={size} />
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- data bits */

const TILE_TONES = {
  pos: 'text-pos',
  hot: 'text-hot',
  cool: 'text-cool',
  analytic: 'text-analytic',
  plain: 'text-primary',
} as const;

/**
 * A metric you could collect: big number, tiny label, an icon that says what
 * kind of thing it is. Used in the 2x2 highlight grids.
 */
export function StatTile({
  icon,
  label,
  value,
  sub,
  tone = 'plain',
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof TILE_TONES;
  className?: string;
}) {
  return (
    <div className={cn('plate-quiet flex flex-col gap-3 p-4 sm:p-5', className)}>
      <p className={cn('micro flex items-center gap-1.5', TILE_TONES[tone])}>
        {icon}
        {label}
      </p>
      <p className={cn('figure text-[1.75rem] sm:text-[2rem]', TILE_TONES[tone])}>{value}</p>
      {sub !== undefined ? <p className="text-[0.75rem] text-muted">{sub}</p> : null}
    </div>
  );
}

export function Meter({
  value,
  tone = 'pos',
  marker,
  className,
  label,
}: {
  /** 0–1. */
  value: number;
  tone?: 'pos' | 'cool' | 'hot';
  /** 0–1, drawn as a hairline the fill is racing. */
  marker?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn('meter', className)} role="img" aria-label={label}>
      <span
        className="meter-fill"
        data-tone={tone === 'pos' ? undefined : tone}
        style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }}
      />
      {marker !== undefined ? (
        <span
          aria-hidden
          className="meter-marker"
          style={{ left: `${Math.min(1, Math.max(0, marker)) * 100}%` }}
        />
      ) : null}
    </div>
  );
}

/** Over-by-over runs as bars. Wicket overs burn orange. */
export function Spark({
  overs,
  className,
}: {
  overs: Array<{ number: number; runs: number; wickets: number }>;
  className?: string;
}) {
  const peak = Math.max(6, ...overs.map((over) => over.runs));

  return (
    <div className={cn('spark', className)} role="img" aria-label="Runs in each of the recent overs">
      {overs.map((over) => (
        <span
          key={over.number}
          className="spark-bar"
          data-tone={over.wickets > 0 ? 'hot' : over.runs >= 10 ? 'pos' : undefined}
          style={{ height: `${Math.max(8, (over.runs / peak) * 100)}%` }}
          title={`Over ${over.number + 1}: ${over.runs} run${over.runs === 1 ? '' : 's'}`}
        />
      ))}
    </div>
  );
}

export function LivePill({ live = true, label }: { live?: boolean; label?: string }) {
  return (
    <span className={cn('pill-lg', live && 'pill-live')}>
      {live ? <span aria-hidden className="beacon size-2 rounded-full bg-current" /> : null}
      {label ?? (live ? 'Live' : 'Result')}
    </span>
  );
}
