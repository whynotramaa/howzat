import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  meta?: ReactNode;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="View options"
      className={cn(
        'flex max-w-full gap-6 overflow-x-auto border-b border-line',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2',
              'text-[0.9375rem] whitespace-nowrap transition-colors duration-[var(--dur-fast)]',
              active
                ? 'border-[var(--text-primary)] font-semibold text-primary'
                : 'border-transparent font-medium text-muted hover:text-secondary',
            )}
          >
            {item.label}
            {item.meta !== undefined ? (
              <span
                className="bg-sunken px-1.5 text-xs leading-[18px] font-semibold text-muted"
              >
                {item.meta}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
