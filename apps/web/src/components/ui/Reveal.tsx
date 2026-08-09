import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

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
