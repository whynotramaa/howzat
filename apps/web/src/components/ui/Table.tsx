import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Table primitives, shared by the standings, the tournament stats panel and
 * the live scorecards — three tables that had drifted into three near-identical
 * private copies of the same two components.
 *
 * Alignment is a prop rather than a className because `cn` is a plain joiner:
 * passing "text-right" alongside a baked-in "text-center" leaves both on the
 * element and lets the stylesheet's ordering decide the winner. A prop that
 * chooses one class cannot silently lose that argument.
 */

type Align = 'left' | 'center' | 'right';

const ALIGNMENT: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * Live scorecards carry more columns on a phone, so they tighten the cells.
 * It travels by context: threading it through forty call sites would bury the
 * one thing each cell is actually saying.
 */
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
  /** Width and layout only — the visual chrome belongs to the caller's wrapper. */
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
  /** Lifts the one number in the row that the reader came for. */
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
