import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

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
