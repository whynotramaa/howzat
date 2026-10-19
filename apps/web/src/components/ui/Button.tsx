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
    'bg-accent-fill text-on-accent shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]',
    'hover:bg-[color-mix(in_oklab,var(--accent-fill)_90%,#000)]',
  ),
  secondary: cn(
    'border border-line bg-raised text-primary shadow-[var(--shadow-xs)]',
    'hover:border-line-strong hover:bg-hover',
  ),
  quiet: 'text-secondary hover:bg-hover hover:text-primary',
  danger: 'border border-line bg-raised text-alert hover:border-[var(--alert)] hover:bg-alert-soft',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[0.8125rem] gap-1.5',
  md: 'h-9 px-3.5 text-[0.8125rem] gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
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
      type="button"
      {...props}
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      className={cn(
        'group relative inline-flex shrink-0 select-none items-center justify-center',
        'rounded-[var(--radius-md)] font-medium whitespace-nowrap',
        'transition-all duration-[var(--dur-fast)] ease-[var(--ease)]',
        'active:scale-[0.98]',
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
        'text-[0.8125rem] text-secondary underline decoration-[var(--line-strong)] decoration-1 underline-offset-4',
        'transition-colors hover:text-primary hover:decoration-[var(--accent-fill)]',
        'disabled:pointer-events-none disabled:opacity-40 disabled:no-underline',
        className,
      )}
    >
      {children}
    </button>
  );
}
