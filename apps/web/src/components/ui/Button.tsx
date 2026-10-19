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
  primary: 'btn-primary font-medium',
  secondary: 'btn-secondary font-medium',
  quiet: 'font-medium text-secondary hover:text-primary hover:bg-hover',
  danger: 'font-medium border border-line text-alert hover:border-[var(--alert)]',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 px-5 text-[0.8125rem] gap-2',
  md: 'h-12 px-7 text-[0.9375rem] gap-2.5',
  lg: 'h-14 px-9 text-base gap-3',
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
        'rounded-[var(--radius-md)] tracking-[-0.005em] whitespace-nowrap',
        'transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]',
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
          className="size-4 animate-spin rounded-full border border-current border-t-transparent opacity-70"
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
        'text-[0.8125rem] font-medium text-primary underline decoration-[var(--line-strong)] decoration-1 underline-offset-4',
        'transition-colors hover:decoration-current',
        'disabled:pointer-events-none disabled:opacity-40 disabled:no-underline',
        className,
      )}
    >
      {children}
    </button>
  );
}
