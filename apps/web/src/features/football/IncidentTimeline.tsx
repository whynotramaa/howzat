import type { FootballEventKind, FootballIncident } from '@howzat/shared';
import { cn } from '@/lib/cn';

/*
 * The story of the match, as a column.
 *
 * Both sides run down one line rather than two, with the minute as the spine
 * and each incident set against the side it belongs to. Two parallel columns
 * would have read as two matches; one column with a lean is how a match report
 * actually goes — 12', 34', 45+2' — and it stays readable at phone width, which
 * two columns do not.
 */

export function IncidentTimeline({
  incidents,
  homeTeamId,
  homeShort,
  awayShort,
  emptyMessage = 'Nothing has happened yet. Goals and cards appear here as they are recorded.',
}: {
  /** Newest first. */
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
            className={cn(
              'flex items-center gap-3.5 py-3',
              index > 0 && 'border-t border-line',
            )}
          >
            <span className="mono w-14 shrink-0 text-right text-[0.8125rem] text-muted tabular-nums">
              {incident.minuteLabel}
            </span>

            <Mark kind={incident.kind} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-primary">
                {incident.playerName ?? label(incident.kind)}
                {incident.kind === 'OWN_GOAL' ? (
                  <span className="ml-1.5 text-[0.75rem] text-muted">(og)</span>
                ) : null}
              </p>

              {incident.assistPlayerName ? (
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

/**
 * The icon. A card is drawn as a card and a goal as a filled disc — the two
 * things a football graphic can assume everyone already reads without a key.
 */
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

  return (
    <span
      aria-hidden
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-full',
        kind === 'OWN_GOAL'
          ? 'bg-line-strong'
          : 'bg-[var(--accent-strong)]',
      )}
    >
      <span className="size-1.5 rounded-full bg-white/85" />
    </span>
  );
}

function label(kind: FootballEventKind): string {
  switch (kind) {
    case 'GOAL':
      return 'Goal';
    case 'OWN_GOAL':
      return 'Own goal';
    case 'YELLOW_CARD':
      return 'Yellow card';
    case 'RED_CARD':
      return 'Red card';
  }
}
