import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Scene, type SceneName } from '@/components/ui/Sketch';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn('rounded-[var(--radius-xl)] border border-line bg-raised', className)}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div {...props} className={cn('border-b border-line px-5 py-4', className)}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: CardProps) {
  return (
    <div {...props} className={cn('p-5', className)}>
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
  art,
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
    <header className={cn('page-header reveal', className)}>
      {back ? <div className="-ml-0.5 mb-4">{back}</div> : null}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <div className="eyebrow flex flex-wrap items-center gap-x-2.5 gap-y-1">{eyebrow}</div>
          ) : null}
          <h1 className="display mt-2 max-w-[32ch] text-primary">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-[56ch] text-[0.9375rem] leading-relaxed text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="page-actions flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
        {art ? <div className="hidden w-[120px] shrink-0 lg:block">{art}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeading({
  eyebrow,
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
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2.5">{eyebrow}</p> : null}
        <h2 className="section-title text-primary">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  scene = 'scorebook',
  compact,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  scene?: SceneName;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'paper-grain flex flex-col items-center rounded-[var(--radius-xl)] border border-dashed border-line-strong px-6 text-center',
        compact ? 'py-6' : 'py-8',
      )}
    >
      <Scene name={scene} className={compact ? 'max-w-[80px]' : 'max-w-[100px]'} />
      <p className={cn('display mt-5 text-primary', compact ? 'text-[1.5rem]' : 'text-[2rem]')}>
        {title}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
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
        'stat-tile flex min-w-0 flex-col justify-between gap-3 rounded-[var(--radius-xl)] border border-line bg-raised px-4 py-4',
        className,
      )}
    >
      <span className="eyebrow">{label}</span>
      <div>
        <span
          className={cn('score-figure tabular block text-[2rem] leading-none', STAT_TONES[tone])}
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
      {items.map((item, index) => (
        <StatTile
          key={item.label}
          {...item}
          className="reveal"
          style={{ '--delay': `${80 + index * 60}ms` } as CSSProperties}
        />
      ))}
    </div>
  );
}
