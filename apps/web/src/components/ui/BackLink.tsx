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
        'group inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-primary',
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="size-3.5 transition-transform duration-[var(--dur-fast)] group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 3.5 5.5 8l4.5 4.5" />
      </svg>
      {children}
    </Link>
  );
}
