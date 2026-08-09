import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-[var(--radius-lg)] border border-line bg-sunken',
        className,
      )}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-raised p-6 sm:p-8">
      <div className="h-3 w-24 animate-pulse rounded-full bg-sunken" />
      <div className="mt-4 h-7 w-2/5 animate-pulse rounded bg-sunken" />
      <div className="mt-7 flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-4 animate-pulse rounded bg-sunken"
            style={{ width: `${88 - index * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;

  const message =
    error instanceof ApiError
      ? (Object.values(error.fieldErrors)[0] ?? error.message)
      : error instanceof Error
        ? error.message
        : 'Something went wrong. Check your connection and try again.';

  const details =
    error instanceof ApiError && Array.isArray(error.details)
      ? (error.details as Array<{ teamName?: string; reason?: string }>)
      : null;

  return (
    <div
      role="alert"
      className={cn(
        'rounded-[var(--radius-md)] border border-[var(--alert)] bg-alert-soft px-4 py-3.5',
        'text-sm text-primary',
      )}
    >
      <p className="font-medium">{message}</p>
      {details ? (
        <ul className="mt-2 flex flex-col gap-1 text-secondary">
          {details.map((detail, index) => (
            <li key={detail.teamName ?? index}>
              {detail.teamName ? (
                <span className="font-medium text-primary">{detail.teamName} — </span>
              ) : null}
              {detail.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SquadProgress({
  count,
  squadSize,
  showLabel = true,
}: {
  count: number;
  squadSize: number;
  showLabel?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center">
      {showLabel ? (
        <p className="mono text-[0.75rem] font-medium text-secondary">
          {count > squadSize ? `${count} · ${squadSize} start` : `${count} on ${squadSize}`}
        </p>
      ) : null}
    </div>
  );
}
