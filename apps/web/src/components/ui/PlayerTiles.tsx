import { cn } from '@/lib/cn';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';

export interface PlayerTile {
  id: string;
  name: string;
  note?: string | null;
}

export function PlayerTiles({
  label,
  caption,
  players,
  value,
  onChange,
  allowUnknown,
  unknownLabel = 'Not sure',
  emptyLabel = 'No players available',
}: {
  label: string;
  caption?: string;
  players: PlayerTile[];
  value: string | null;
  onChange: (playerId: string | null) => void;
  allowUnknown?: boolean;
  unknownLabel?: string;
  emptyLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="eyebrow">{label}</p>
      {caption ? <p className="-mt-1.5 text-[0.75rem] text-muted">{caption}</p> : null}

      {players.length === 0 && !allowUnknown ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : null}

      {players.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {players.map((player) => {
            const selected = value === player.id;
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onChange(selected ? null : player.id)}
                aria-pressed={selected}
                className={cn(
                  'flex min-w-0 items-center gap-2.5 rounded-[var(--radius-md)] border px-2.5 py-2 text-left',
                  'transition-colors duration-[var(--dur-fast)]',
                  selected
                    ? 'border-[var(--text-primary)] bg-accent-soft'
                    : 'border-line bg-raised hover:bg-hover',
                )}
              >
                <PlayerAvatar seed={player.id} name={player.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                  {player.name}
                </span>
                {player.note ? (
                  <span className="mono shrink-0 text-[0.6875rem] text-muted">{player.note}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {allowUnknown ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={cn(
            'rounded-[var(--radius-md)] border border-dashed px-3 py-2.5 text-left text-sm transition-colors',
            value === null
              ? 'border-line-strong bg-sunken text-secondary'
              : 'border-line text-muted hover:bg-hover',
          )}
        >
          {unknownLabel}
        </button>
      ) : null}
    </div>
  );
}
