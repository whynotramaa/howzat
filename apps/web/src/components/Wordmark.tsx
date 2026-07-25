import { cn } from '@/lib/cn';

/*
 * The mark.
 *
 * The wordmark is intentionally just the name. The former edge/mark is kept as
 * a standalone favicon so the product header stays quiet and typographic.
 */

export function Wordmark({
  size = 'md',
  tone = 'default',
  showName = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'inverse';
  showName?: boolean;
  className?: string;
}) {
  const name = {
    sm: 'text-[0.8125rem] tracking-[0.2em]',
    md: 'text-sm tracking-[0.2em]',
    lg: 'text-base tracking-[0.22em]',
  }[size];

  const inverse = tone === 'inverse';

  return (
    <span className={cn('inline-flex items-center', className)}>
      {showName ? (
        <span
          className={cn(
            'font-medium uppercase',
            name,
            inverse ? 'text-on-inverse' : 'text-primary',
          )}
        >
          Howzat
        </span>
      ) : null}
    </span>
  );
}

export function WordmarkMark({
  size = 'md',
  tone = 'default',
}: {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'inverse';
}) {
  const sizes = {
    sm: 'size-7 text-[0.9375rem]',
    md: 'size-8 text-base',
    lg: 'size-11 text-xl',
  } as const;
  return (
    <span
      aria-hidden
      className={cn(
        'serif grid shrink-0 place-items-center rounded-[var(--radius-sm)] border pt-px',
        sizes[size],
        tone === 'inverse'
          ? 'border-[var(--accent)]/50 text-on-inverse'
          : 'border-[var(--accent-line)] text-primary',
      )}
    >
      H
    </span>
  );
}
