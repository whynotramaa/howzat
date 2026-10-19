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
      role="tablist"
      className={cn(
        'flex w-full max-w-full gap-7 overflow-x-auto border-b border-line',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative -mb-px inline-flex h-12 items-center gap-2 border-b-[1.5px]',
              'text-[0.875rem] font-medium whitespace-nowrap transition-colors duration-[var(--dur-fast)]',
              active
                ? 'border-current text-primary'
                : 'border-transparent text-muted hover:text-primary',
            )}
          >
            {item.label}
            {item.meta !== undefined ? (
              <span
                className={cn(
                  'tabular text-[0.75rem]',
                  active ? 'text-secondary' : 'text-muted',
                )}
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
