import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

/**
 * The way back up a level.
 *
 * Every page below the dashboard carries one, in the same place, with the name of
 * the thing it returns to rather than the word "back" — on a phone, four screens
 * into a tournament, "← Sunday League" tells you where you are as well as where
 * you are going.
 */
export function BackLink({
  to,
  children,
  className,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex items-center gap-2 text-[0.8125rem] text-muted transition-colors hover:text-primary',
        className,
      )}
    >
      <span
        aria-hidden
        className="mono transition-transform duration-[var(--dur-fast)] group-hover:-translate-x-0.5"
      >
        ←
      </span>
      {children}
    </Link>
  );
}
