import type { LineupPlayer, TeamLineup } from '@howzat/shared';
import { FootballAvatar } from '@/components/ui/FootballAvatar';
import { cn } from '@/lib/cn';

/*
 * The formation, on the grass.
 *
 * Drawn as a plan of a pitch rather than as two lists side by side, because a
 * formation is a spatial fact and a list of eleven names is not. Both sides are
 * on one pitch facing each other, which is the only arrangement in which
 * "4-4-2 against 3-5-2" tells you anything you could not have read off a
 * team sheet.
 *
 * The pitch itself is drawn in hairlines on the sunken surface — the same
 * hairline-and-paper vocabulary as every other panel here — and not in green.
 * A green rectangle would be the single most saturated thing in the product,
 * sitting behind twenty-two shirts that each carry a team's own colour, and the
 * shirts are what has to be legible.
 */

const VIEW_W = 100;
const VIEW_H = 64;

export function Pitch({
  home,
  away,
  onSelectPlayer,
  selectedPlayerId,
  className,
}: {
  home: TeamLineup | null;
  away: TeamLineup | null;
  /** When given, every shirt becomes a target — used by the team-sheet editor. */
  onSelectPlayer?: (player: LineupPlayer, side: 'HOME' | 'AWAY') => void;
  selectedPlayerId?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-line bg-sunken',
        className,
      )}
      style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
    >
      <PitchMarkings />

      {home?.players.map((player) => (
        <Shirt
          key={player.id}
          player={player}
          color={home.team.primaryColor}
          side="HOME"
          selected={selectedPlayerId === player.id}
          onSelect={onSelectPlayer}
        />
      ))}

      {away?.players.map((player) => (
        <Shirt
          key={player.id}
          player={player}
          color={away.team.primaryColor}
          side="AWAY"
          selected={selectedPlayerId === player.id}
          onSelect={onSelectPlayer}
        />
      ))}

      {/* The formations, in the corners they belong to. */}
      {home ? (
        <FormationTag formation={home.formation} short={home.team.shortName} side="HOME" />
      ) : null}
      {away ? (
        <FormationTag formation={away.formation} short={away.team.shortName} side="AWAY" />
      ) : null}
    </div>
  );
}

/** Touchlines, halfway, centre circle, both boxes. Nothing else. */
function PitchMarkings() {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <g fill="none" stroke="var(--line-strong)" strokeWidth={0.3} opacity={0.85}>
        <rect x={2} y={2} width={VIEW_W - 4} height={VIEW_H - 4} rx={0.6} />
        <line x1={VIEW_W / 2} y1={2} x2={VIEW_W / 2} y2={VIEW_H - 2} />
        {/* preserveAspectRatio="none" stretches the viewBox, so a circle would
            arrive on screen as an ellipse. An ellipse drawn to compensate lands
            as a circle — the pitch is wider than it is tall in both spaces. */}
        <ellipse cx={VIEW_W / 2} cy={VIEW_H / 2} rx={6} ry={9} />
        <circle cx={VIEW_W / 2} cy={VIEW_H / 2} r={0.5} fill="var(--line-strong)" />

        <rect x={2} y={VIEW_H / 2 - 14} width={11} height={28} />
        <rect x={2} y={VIEW_H / 2 - 6.5} width={4} height={13} />

        <rect x={VIEW_W - 13} y={VIEW_H / 2 - 14} width={11} height={28} />
        <rect x={VIEW_W - 6} y={VIEW_H / 2 - 6.5} width={4} height={13} />
      </g>
    </svg>
  );
}

/**
 * One shirt.
 *
 * Formation coordinates describe a side's own half from its goal line to
 * halfway, so the home team maps straight onto the left half and the away team
 * is mirrored onto the right. Neither side is a special case in the geometry —
 * only in the sign.
 */
function Shirt({
  player,
  color,
  side,
  selected,
  onSelect,
}: {
  player: LineupPlayer;
  color: string;
  side: 'HOME' | 'AWAY';
  selected: boolean;
  onSelect?: (player: LineupPlayer, side: 'HOME' | 'AWAY') => void;
}) {
  const left = side === 'HOME' ? player.x * 50 : 100 - player.x * 50;
  const top = side === 'HOME' ? player.y * 100 : (1 - player.y) * 100;
  // Substitutes have no slot; the shirt falls back to their place on the bench.
  const number = player.shirtNumber ?? (player.slot === null ? null : player.slot + 1);

  const interactive = Boolean(onSelect);
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      {...(interactive
        ? { type: 'button' as const, onClick: () => onSelect!(player, side) }
        : {})}
      style={{ left: `${left}%`, top: `${top}%` }}
      className={cn(
        'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1',
        'transition-transform duration-[var(--dur)] ease-[var(--ease)]',
        interactive && 'hover:z-20 hover:scale-110',
        selected && 'z-20 scale-110',
      )}
    >
      {/* Keyed on the player, not the slot: when a change puts somebody new in
          this position the node remounts and plays the swap, while the position
          itself stays exactly where it was. */}
      <span
        key={player.id}
        className={cn(
          'mono relative grid size-7 place-items-center rounded-full text-[0.5625rem] font-semibold sm:size-9 sm:text-[0.6875rem]',
          'text-white ring-1 ring-black/20 ring-inset',
          player.cameOnAt ? 'shirt-swap' : null,
          selected && 'ring-2 ring-[var(--accent-strong)] ring-offset-1',
          player.isSentOff && 'opacity-40 grayscale',
        )}
        style={{ background: color }}
      >
        {number ?? initials(player.name)}

        {player.goals > 0 ? <Badge tone="accent">{player.goals}</Badge> : null}
        {player.cameOnAt ? <SubArrow /> : null}
        {player.redCards > 0 ? (
          <CardMark tone="red" />
        ) : player.yellowCards > 0 ? (
          <CardMark tone="yellow" count={player.yellowCards} />
        ) : null}
      </span>

      <span
        className={cn(
          'max-w-[5.5rem] truncate rounded-full bg-raised/85 px-1.5 text-[0.5rem] leading-[1.4] text-primary sm:text-[0.625rem]',
          player.isSentOff && 'line-through opacity-60',
        )}
      >
        {player.isCaptain ? <span className="text-accent">© </span> : null}
        {surname(player.name)}
      </span>
    </Tag>
  );
}

/** Came on. Sits opposite the goals badge so the two never collide. */
function SubArrow() {
  return (
    <span
      aria-label="Substitute"
      className="sub-arrows absolute -top-1 -left-1 grid size-3.5 place-items-center rounded-full bg-[var(--success)] ring-1 ring-white/40"
    >
      <svg viewBox="0 0 10 10" className="size-2.5" fill="none" stroke="white" strokeWidth={1.6}>
        <path d="M2 7h6M6 5l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Goals scored, on the shoulder of the shirt. */
function Badge({ tone, children }: { tone: 'accent'; children: number }) {
  return (
    <span
      className={cn(
        'mono absolute -top-1 -right-1 grid size-3.5 place-items-center rounded-full',
        'text-[0.5rem] leading-none font-semibold text-white ring-1 ring-white/40',
        tone === 'accent' && 'bg-[var(--accent-strong)]',
      )}
    >
      {children}
    </span>
  );
}

/** The card itself, drawn as a card — nobody needs a legend for this one. */
function CardMark({ tone, count }: { tone: 'yellow' | 'red'; count?: number }) {
  return (
    <span
      className={cn(
        'absolute -bottom-1 -left-1 h-3 w-[0.5rem] rounded-[1px] ring-1 ring-black/30',
        tone === 'red' ? 'bg-[#c8332a]' : 'bg-[#e0b23c]',
      )}
      aria-label={count && count > 1 ? `${count} yellow cards` : `${tone} card`}
    />
  );
}

function FormationTag({
  formation,
  short,
  side,
}: {
  formation: string;
  short: string;
  side: 'HOME' | 'AWAY';
}) {
  return (
    <span
      className={cn(
        'mono absolute bottom-2 rounded-full border border-line bg-raised/90 px-2.5 py-1',
        'text-[0.5625rem] tracking-[0.06em] text-secondary',
        side === 'HOME' ? 'left-2' : 'right-2',
      )}
    >
      {short} · {formation}
    </span>
  );
}

/**
 * The name on the back of the shirt. A full name does not fit on a phone at
 * this size, and the surname is what a commentator says anyway.
 */
function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
}

/** Fallback for a shirt with no number: two letters beat an empty disc. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * The bench, under the pitch.
 *
 * Substitutes are on the team sheet and can score or be booked, so they need a
 * place to be shown — but not on the grass, where they are not standing. A
 * strip of smaller marks says "named, not playing" without inventing a position
 * for them.
 */
export function Bench({
  lineup,
  className,
}: {
  lineup: TeamLineup | null;
  className?: string;
}) {
  if (!lineup || lineup.substitutes.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <span className="eyebrow shrink-0">Bench</span>

      {lineup.substitutes.map((player) => (
        <span
          key={player.id}
          className={cn(
            'flex items-center gap-1.5 text-[0.75rem]',
            player.wentOffAt && 'bench-arrive',
            player.isSentOff || player.wentOffAt ? 'text-muted' : 'text-secondary',
            player.isSentOff && 'line-through',
          )}
        >
          <FootballAvatar
            seed={player.id}
            name={player.name}
            color={lineup.team.primaryColor}
            size="xs"
          />
          {player.name}
          {/* Why they are not on the pitch, in the words a team sheet uses. */}
          {player.wentOffAt ? (
            <span className="mono text-[0.625rem] text-muted">↓{player.wentOffAt}</span>
          ) : null}
          {player.goals > 0 ? (
            <span className="mono text-accent">
              {player.goals > 1 ? `${player.goals}⚬` : '⚬'}
            </span>
          ) : null}
          {player.redCards > 0 || player.yellowCards > 0 ? (
            <span
              aria-hidden
              className={cn(
                'h-2.5 w-[0.4rem] rounded-[1px] ring-1 ring-black/25',
                player.redCards > 0 ? 'bg-[#c8332a]' : 'bg-[#e0b23c]',
              )}
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}
