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
        'rounded-[var(--radius-lg)] border border-line bg-raised shadow-[var(--shadow-xs)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div {...props} className={cn('border-b border-line px-6 py-5 sm:px-8', className)}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: CardProps) {
  return (
    <div {...props} className={cn('px-6 py-6 sm:px-8', className)}>
      {children}
    </div>
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
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
          <h2 className="serif text-[1.75rem] text-primary sm:text-[2rem]">{title}</h2>
          {description ? <p className="mt-2.5 max-w-2xl text-secondary">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2.5">{action}</div> : null}
      </div>
      <div className="rule" />
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
        'flex flex-col items-center gap-3 rounded-[var(--radius-lg)] px-6 py-20 text-center',
        'border border-dashed border-line-strong bg-raised/40',
      )}
    >
      <p className="serif text-2xl text-primary">{title}</p>
      <p className="max-w-md text-secondary">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
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
        'flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-line bg-raised px-5 py-4',
        className,
      )}
    >
      <span className={cn('tabular text-[1.75rem] leading-none font-semibold', tones[tone])}>
        {value}
      </span>
      <span className="eyebrow">{label}</span>
      {hint ? <span className="text-[0.8125rem] text-muted">{hint}</span> : null}
    </div>
  );
}
