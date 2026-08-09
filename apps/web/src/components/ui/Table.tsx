import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Align = 'left' | 'center' | 'right';

const ALIGNMENT: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

type Density = 'default' | 'compact';

const PADDING: Record<Density, { th: string; td: string }> = {
  default: { th: 'px-4 py-3.5', td: 'px-4 py-4' },
  compact: { th: 'px-3 py-3.5', td: 'px-3 py-3.5' },
};

const DensityContext = createContext<Density>('default');

export function Table({
  density = 'default',
  className,
  children,
}: {
  density?: Density;
  className?: string;
  children: ReactNode;
}) {
  return (
    <DensityContext.Provider value={density}>
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </DensityContext.Provider>
  );
}

export function Th({
  align = 'center',
  className,
  children,
}: {
  align?: Align;
  className?: string;
  children?: ReactNode;
}) {
  const { th } = PADDING[useContext(DensityContext)];

  return (
    <th
      scope="col"
      className={cn('eyebrow font-medium whitespace-nowrap', th, ALIGNMENT[align], className)}
    >
      {children}
    </th>
  );
}

export function Td({
  align = 'center',
  emphasis = false,
  className,
  children,
}: {
  align?: Align;
  emphasis?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const { td } = PADDING[useContext(DensityContext)];

  return (
    <td
      className={cn(
        'mono',
        td,
        ALIGNMENT[align],
        emphasis ? 'font-medium text-primary' : 'text-secondary',
        className,
      )}
    >
      {children}
    </td>
  );
}
