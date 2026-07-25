import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * Tabs, drawn as an underlined index rather than a pill group.
 *
 * The active tab is marked by a brass rule sitting on the same hairline that
 * runs under the whole row — so the indicator looks like part of the page's
 * ruling rather than a widget stuck on top of it.
 */

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** A count or a status shown after the label, e.g. the number of fixtures. */
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
    <div role="tablist" className={cn('flex gap-1 border-b border-line', className)}>
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
              'relative -mb-px inline-flex items-center gap-2 px-4 pt-2 pb-3.5',
              'text-sm font-medium whitespace-nowrap transition-colors duration-[var(--dur-fast)]',
              active ? 'text-primary' : 'text-muted hover:text-secondary',
            )}
          >
            {item.label}
            {item.meta !== undefined ? (
              <span className="tabular text-[0.6875rem] text-muted">{item.meta}</span>
            ) : null}

            <span
              aria-hidden
              className={cn(
                'absolute inset-x-0 bottom-0 h-[2px] transition-opacity duration-[var(--dur)]',
                active ? 'bg-[var(--accent-strong)] opacity-100' : 'opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
