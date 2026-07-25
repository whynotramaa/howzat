import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The load-in.
 *
 * Content rises 10px into place, staggered by index, as one orchestrated moment
 * when a page first paints. It is not a scroll effect and it does not repeat —
 * a page that keeps animating as you use it is a page that is animating at you.
 *
 * The stagger step is deliberately small: 60ms across five blocks is 300ms in
 * total, which is a page settling, not a sequence you sit and watch.
 */
export function Reveal({
  index = 0,
  step = 60,
  as: Component = 'div',
  className,
  children,
}: {
  index?: number;
  step?: number;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Component
      className={cn('reveal', className)}
      style={{ '--delay': `${index * step}ms` } as React.CSSProperties}
    >
      {children}
    </Component>
  );
}
