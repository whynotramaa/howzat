import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

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
    'bg-accent text-on-accent shadow-[var(--shadow-xs)]',
    'hover:bg-accent-strong',
  ),
  secondary: cn(
    'border border-line-strong bg-raised text-primary',
    'hover:bg-hover',
  ),
  quiet: 'text-secondary hover:bg-hover hover:text-primary',
  danger: 'border border-[var(--alert)] bg-transparent text-alert hover:bg-alert-soft',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[0.9375rem] gap-2.5',
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
        'rounded-[var(--radius-md)] font-semibold whitespace-nowrap',
        'transition-all duration-[var(--dur-fast)] ease-[var(--ease)]',
        'active:scale-[0.97]',
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
