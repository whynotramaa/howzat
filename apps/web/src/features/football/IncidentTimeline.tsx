import {
  FOOTBALL_EVENT_LABELS,
  type FootballEventKind,
  type FootballIncident,
} from '@howzat/shared';
import { cn } from '@/lib/cn';

export function IncidentTimeline({
  incidents,
  homeTeamId,
  homeShort,
  awayShort,
  emptyMessage = 'Nothing has happened yet. Goals and cards appear here as they are recorded.',
}: {
  incidents: FootballIncident[];
  homeTeamId: string;
  homeShort: string;
  awayShort: string;
  emptyMessage?: string;
}) {
  if (incidents.length === 0) {
    return <p className="py-6 text-center text-[0.8125rem] text-muted">{emptyMessage}</p>;
  }

  return (
    <ol className="flex flex-col">
      {incidents.map((incident, index) => {
        const isHome = incident.teamId === homeTeamId;

        return (
          <li
            key={incident.id}
            className={cn('flex items-center gap-3.5 py-3', index > 0 && 'border-t border-line')}
          >
            <span className="mono w-14 shrink-0 text-right text-[0.8125rem] text-muted tabular-nums">
              {incident.minuteLabel}
            </span>

            <Mark kind={incident.kind} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-primary">
                {incident.kind === 'SUBSTITUTION' ? (
                  <>
                    <span className="text-success">↑</span> {incident.playerName ?? 'Substitute'}
                  </>
                ) : (
                  (incident.playerName ?? label(incident.kind))
                )}
                {incident.kind === 'OWN_GOAL' ? (
                  <span className="ml-1.5 text-[0.75rem] text-muted">(og)</span>
                ) : null}
              </p>

              {incident.kind === 'SUBSTITUTION' ? (
                <p className="truncate text-[0.75rem] text-muted">
                  <span className="text-alert">↓</span> {incident.playerOffName ?? 'Player off'}
                </p>
              ) : incident.assistPlayerName ? (
                <p className="truncate text-[0.75rem] text-muted">
                  assist {incident.assistPlayerName}
                </p>
              ) : incident.playerName ? (
                <p className="text-[0.75rem] text-muted">{label(incident.kind)}</p>
              ) : null}
            </div>

            <span
              className={cn(
                'mono shrink-0 rounded-full border border-line bg-sunken px-2 py-0.5',
                'text-[0.625rem] tracking-[0.06em] text-secondary',
              )}
            >
              {isHome ? homeShort : awayShort}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Mark({ kind }: { kind: FootballEventKind }) {
  if (kind === 'YELLOW_CARD' || kind === 'RED_CARD') {
    return (
      <span
        aria-hidden
        className={cn(
          'h-4 w-3 shrink-0 rounded-[1px] ring-1 ring-black/25',
          kind === 'RED_CARD' ? 'bg-[#c8332a]' : 'bg-[#e0b23c]',
        )}
      />
    );
  }

  if (kind === 'SUBSTITUTION') {
    return (
      <span aria-hidden className="grid size-4 shrink-0 place-items-center text-secondary">
        <svg
          viewBox="0 0 16 16"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            d="M2 5h9M9 3l2 2-2 2M14 11H5m2-2-2 2 2 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (kind === 'SAVE') {
    return (
      <span
        aria-hidden
        className="grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-[var(--success)]"
      >
        <span className="size-1 rounded-full bg-[var(--success)]" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-full',
        kind === 'OWN_GOAL' ? 'bg-line-strong' : 'bg-[var(--accent-strong)]',
      )}
    >
      <span className="size-1.5 rounded-full bg-white/85" />
    </span>
  );
}

function label(kind: FootballEventKind): string {
  return FOOTBALL_EVENT_LABELS[kind];
}
