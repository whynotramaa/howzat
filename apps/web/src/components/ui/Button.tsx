import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * Buttons in this system are ink, outline, or quiet — brass is never a button
 * fill, because a page with four gold buttons has no accent left.
 *
 * The primary is a solid ink slab in light and a bone slab in dark: the highest
 * contrast pair available, which is what makes it read as the one action worth
 * taking. Labels are sentence case with a hair of positive tracking, and the
 * press state is a 1px settle rather than a scale — the button feels like it has
 * mass instead of bouncing.
 */

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: cn(
    'bg-inverse text-on-inverse shadow-[var(--shadow-sm)]',
    'hover:shadow-[var(--shadow-md)] hover:brightness-110',
  ),
  secondary: cn(
    'border border-line-strong bg-raised text-primary',
    'hover:border-[var(--accent-line)] hover:bg-hover',
  ),
  quiet: 'text-secondary hover:bg-hover hover:text-primary',
  danger: 'border border-[var(--alert)] bg-transparent text-alert hover:bg-alert-soft',
};

const sizes: Record<Size, string> = {
  // Generous horizontal padding is most of what makes these feel considered.
  // 44px minimum height on md and lg — this app gets used one-handed, at a ground.
  sm: 'h-9 px-3.5 text-[0.8125rem] gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-[3.25rem] px-7 text-[0.9375rem] gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={cn(
        'group relative inline-flex shrink-0 select-none items-center justify-center',
        'rounded-[var(--radius-sm)] font-medium tracking-[0.01em] whitespace-nowrap',
        'transition-all duration-[var(--dur-fast)] ease-[var(--ease)]',
        'active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {isLoading ? (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border border-current border-t-transparent opacity-70"
        />
      ) : null}
      {children}
    </button>
  );
}

/**
 * A text link that behaves like an action. Used for the third-priority thing on
 * a page, where even a quiet button would be too much furniture.
 */
export function TextAction({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'text-sm text-secondary underline decoration-[var(--line-strong)] decoration-1 underline-offset-4',
        'transition-colors hover:text-primary hover:decoration-[var(--accent-strong)]',
        'disabled:pointer-events-none disabled:opacity-40 disabled:no-underline',
        className,
      )}
    >
      {children}
    </button>
  );
}
