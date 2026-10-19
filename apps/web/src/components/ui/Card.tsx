import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-[var(--radius-lg)] border border-line bg-raised',
        className,
      )}
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
        <h2 className="serif text-[2rem] text-primary">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>
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
        'flex flex-col items-center gap-2 rounded-[var(--radius-lg)] px-6 py-20 text-center',
        'border border-dashed border-line-strong',
      )}
    >
      <p className="serif text-[2rem] text-primary">{title}</p>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
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
    accent: 'text-primary',
    success: 'text-success',
    live: 'text-live',
  } as const;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[var(--radius-lg)] border border-line bg-raised px-5 py-5',
        className,
      )}
    >
      <span className="eyebrow">{label}</span>
      <span
        className={cn(
          'serif tabular text-[2.5rem] leading-none',
          tones[tone],
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}
