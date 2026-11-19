import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { SceneName } from '@/components/ui/Sketch';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn('rounded-[var(--radius-lg)] border border-line bg-raised', className)}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div {...props} className={cn('border-b border-line px-4 py-3', className)}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: CardProps) {
  return (
    <div {...props} className={cn('p-4', className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  art?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('page-header', className)}>
      {back ? <div className="-ml-1 mb-2">{back}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-primary">{title}</h1>
          {eyebrow ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-muted">
              {eyebrow}
            </div>
          ) : null}
          {description ? (
            <p className="mt-1 max-w-[56ch] text-[0.8125rem] text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 className="section-title text-primary">{title}</h2>
        {description ? <p className="mt-0.5 text-[0.8125rem] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  compact,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  scene?: SceneName;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-line-strong px-6 text-center',
        compact ? 'py-8' : 'py-12',
      )}
    >
      <p className="text-[0.9375rem] font-semibold text-primary">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[0.8125rem] text-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

type StatTone = 'default' | 'accent' | 'success' | 'live';

const STAT_TONES: Record<StatTone, string> = {
  default: 'text-primary',
  accent: 'text-cta',
  success: 'text-success',
  live: 'text-live',
};

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  className,
  style,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        'stat-tile flex min-w-0 flex-col justify-between gap-2 px-4 py-3',
        className,
      )}
    >
      <span className="eyebrow">{label}</span>
      <div>
        <span
          className={cn('score-figure tabular block leading-none', STAT_TONES[tone])}
        >
          {value}
        </span>
        {hint ? <span className="mt-2 block truncate text-xs text-muted">{hint}</span> : null}
      </div>
    </div>
  );
}

export function StatStrip({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode; hint?: ReactNode; tone?: StatTone }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'stat-strip grid grid-cols-2',
        items.length >= 4 ? 'lg:grid-cols-4' : 'sm:grid-cols-3',
        className,
      )}
    >
      {items.map((item) => (
        <StatTile key={item.label} {...item} />
      ))}
    </div>
  );
}
