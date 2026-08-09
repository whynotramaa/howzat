import type { Sport } from '@howzat/shared';
import { cn } from '@/lib/cn';

export function SportMark({ sport, className }: { sport: Sport; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-3.5 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" />

      {sport === 'CRICKET' ? (
        <>
          <path d="M5.1 3.1C6.4 5 6.4 11 5.1 12.9" />
          <path d="M3.3 5.2l1.4.9M2.6 8h1.6M3.3 10.8l1.4-.9" strokeWidth={0.9} />
        </>
      ) : (
        <>
          <path d="M8 5.2l2.1 1.5-.8 2.4H6.7l-.8-2.4z" strokeLinejoin="round" />
          <path
            d="M8 5.2V2M10.1 6.7l2.6-1M9.3 9.1l1.6 2.6M6.7 9.1l-1.6 2.6M5.9 6.7l-2.6-1"
            strokeWidth={0.9}
          />
        </>
      )}
    </svg>
  );
}

export function SportEyebrow({
  sport,
  detail,
  className,
}: {
  sport: Sport;
  detail?: string;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2 text-muted', className)}>
      <SportMark sport={sport} />
      <span className="eyebrow">
        {sport === 'FOOTBALL' ? 'Football' : 'Cricket'}
        {detail ? <span className="text-line-strong"> · </span> : null}
        {detail}
      </span>
    </span>
  );
}
