import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

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

export function SectionHeading({
  eyebrow: _eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-primary">{title}</h2>
        {description ? (
          <p className="mt-0.5 max-w-2xl text-[0.8125rem] text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid-canvas flex flex-col items-center gap-1.5 rounded-[var(--radius-lg)] px-6 py-14 text-center',
        'border border-dashed border-line-strong',
      )}
    >
      <p className="text-[0.9375rem] font-semibold text-primary">{title}</p>
      <p className="max-w-sm text-[0.8125rem] text-muted">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'accent' | 'success' | 'live';
  className?: string;
}) {
  const tones = {
    default: 'text-primary',
    accent: 'text-accent',
    success: 'text-success',
    live: 'text-live',
  } as const;

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-[var(--radius-md)] border border-line bg-raised px-3.5 py-3',
        className,
      )}
    >
      <span className="eyebrow">{label}</span>
      <span
        className={cn(
          'tabular text-xl leading-tight font-semibold tracking-[-0.03em]',
          tones[tone],
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}
