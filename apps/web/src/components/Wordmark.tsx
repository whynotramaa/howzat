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
            'serif leading-none tracking-[-0.01em]',
            size === 'lg' ? 'text-[2.25rem]' : size === 'sm' ? 'text-[1.625rem]' : 'text-[1.875rem]',
            tone === 'inverse' ? 'text-white' : 'text-primary',
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
  size?: Size;
  tone?: 'default' | 'inverse';
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn(
        'shrink-0',
        tone === 'inverse' ? 'text-white' : 'text-primary',
        size === 'lg' ? 'size-10' : size === 'sm' ? 'size-7' : 'size-8',
      )}
    >
      <path d="M9.2 12.4c.2 4 .1 8.2-.2 13.1M16 12.2c.1 4.3 0 8.6-.1 13.3M22.7 12.5c.1 4 .2 8.2.1 13" />
      <path d="M7.8 9.6c2.6-.3 5.2-.2 7.6.1" />
      <path d="M18.4 6.9c2.3-1.2 4.6-1.8 6.9-2.1" />
      <path d="M5 27.3c7.4-.5 14.7-.4 22 .1" strokeWidth="1.4" />
    </svg>
  );
}
