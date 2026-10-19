import { cn } from '@/lib/cn';

type Size = 'sm' | 'md' | 'lg';

export function Wordmark({
  size = 'md',
  tone = 'default',
  showName = true,
  className,
}: {
  size?: Size;
  tone?: 'default' | 'inverse';
  showName?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <WordmarkMark size={size} tone={tone} />
      {showName ? (
        <span
          className={cn(
            'font-semibold tracking-[-0.04em]',
            size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-[0.9375rem]' : 'text-lg',
            tone === 'inverse' ? 'text-on-inverse' : 'text-primary',
          )}
        >
          howzat
        </span>
      ) : null}
    </span>
  );
}

export function WordmarkMark({
  size = 'md',
  tone = 'default',
}: {
  size?: Size;
  tone?: 'default' | 'inverse';
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(
        'shrink-0',
        size === 'lg' ? 'size-10' : size === 'sm' ? 'size-[22px]' : 'size-7',
        tone === 'inverse' ? 'text-on-inverse' : 'text-primary',
      )}
    >
      <rect width="24" height="24" rx="5" fill="currentColor" />
      <g fill={tone === 'inverse' ? 'var(--surface-inverse)' : 'var(--surface-raised)'}>
        <rect x="6.5" y="9" width="2" height="10" rx="0.5" />
        <rect x="11" y="9" width="2" height="10" rx="0.5" />
        <rect x="15.5" y="9" width="2" height="10" rx="0.5" />
      </g>
      <rect x="6" y="6.6" width="5.6" height="1.6" rx="0.8" fill="#f6821f" />
      <rect
        x="12.6"
        y="4.4"
        width="5.6"
        height="1.6"
        rx="0.8"
        fill="#f6821f"
        transform="rotate(-24 15.4 5.2)"
      />
    </svg>
  );
}
