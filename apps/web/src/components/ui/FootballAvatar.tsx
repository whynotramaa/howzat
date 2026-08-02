import { cn } from '@/lib/cn';

/*
 * The football player's mark: a kit, not a face.
 *
 * The cricket avatar is a photographic sprite picked from four PNGs. That works
 * there because a cricket squad is eleven people and four faces cycling around
 * reads as illustration. It does not survive a football squad of twenty-four,
 * where the same four faces would repeat six times down one list and stop
 * meaning anything at all.
 *
 * So this is drawn instead, and drawn as the thing football actually identifies
 * people by: the shirt. Everything about it is a pure function of the player's
 * id — the pattern, the two colours, the initials — which gives a squad of
 * twenty-four twenty-four distinguishable marks with no assets to load, no
 * network request, and no face that looks nothing like the person.
 *
 * Five patterns, because they are the five that exist on real kit: plain,
 * halves, stripes, hoops, and a sash. They are drawn inside a circle at hairline
 * weight so the avatar sits in the same visual register as everything else here
 * rather than becoming the loudest thing in a list.
 */

type Pattern = 'plain' | 'halves' | 'stripes' | 'hoops' | 'sash';

const PATTERNS: Pattern[] = ['plain', 'halves', 'stripes', 'hoops', 'sash'];

/**
 * Kit colours, chosen to stay legible against both the light and the dark
 * ground and to hold white lettering at 4.5:1. These are deliberately not the
 * theme's accent: an avatar is an identifier, and if it borrowed the accent
 * then a list of players would look like a list of active things.
 */
const KITS: Array<[string, string]> = [
  ['#1f4e79', '#dce6f1'],
  ['#7a2f2a', '#f2ded9'],
  ['#2c5f4a', '#dceee5'],
  ['#4a3670', '#e6dff2'],
  ['#8a5a1c', '#f6e8d2'],
  ['#2d4f5e', '#daeaf0'],
  ['#6b2f4d', '#f3dee9'],
  ['#3f5320', '#e6eed6'],
];

/**
 * A stable 32-bit hash of the id.
 *
 * The pattern and the kit are drawn from *different* bit ranges of it rather
 * than from the same modulo, so two players do not end up sharing both — which
 * is the failure that makes a generated avatar set look repetitive.
 */
function hash(value: string): number {
  let out = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 16777619);
  }
  return Math.abs(out);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

const SIZES = {
  xs: 'size-7 text-[0.5rem]',
  sm: 'size-9 text-[0.625rem]',
  md: 'size-12 text-[0.8125rem]',
} as const;

export function FootballAvatar({
  seed,
  name,
  size = 'sm',
  /** The team's colour, when the avatar is shown somewhere a side is implied. */
  color,
  className,
}: {
  seed: string;
  name: string;
  size?: keyof typeof SIZES;
  color?: string;
  className?: string;
}) {
  const key = hash(seed);
  const pattern = PATTERNS[key % PATTERNS.length]!;
  // A different slice of the hash, so pattern and colour vary independently.
  const [base, light] = KITS[(key >> 5) % KITS.length]!;
  const primary = color ?? base;

  return (
    <span
      role="img"
      aria-label={`${name} avatar`}
      title={name}
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full',
        'border border-line-strong',
        SIZES[size],
        className,
      )}
      style={{ background: primary }}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <clipPath id={`kit-${key}`}>
            <circle cx="20" cy="20" r="20" />
          </clipPath>
        </defs>

        <g clipPath={`url(#kit-${key})`}>
          {pattern === 'halves' ? <rect x="20" y="0" width="20" height="40" fill={light} /> : null}

          {pattern === 'stripes'
            ? [6, 18, 30].map((x) => (
                <rect key={x} x={x} y="0" width="6" height="40" fill={light} />
              ))
            : null}

          {pattern === 'hoops'
            ? [6, 18, 30].map((y) => (
                <rect key={y} x="0" y={y} width="40" height="6" fill={light} />
              ))
            : null}

          {pattern === 'sash' ? (
            <path d="M-6 34L34 -6l10 10L4 44z" fill={light} />
          ) : null}

          {/* The collar. One stroke, and the thing that makes a patterned
              circle read as a shirt rather than as a beach ball. */}
          <path
            d="M13 3.5a7.5 7.5 0 0 0 14 0"
            fill="none"
            stroke="rgba(255,255,255,.55)"
            strokeWidth="2.5"
          />
        </g>
      </svg>

      {/* The initials sit above the kit on their own scrim, because a sash or a
          stripe can land directly behind them and two letters at this size have
          no room to lose contrast. */}
      <span className="relative grid size-full place-items-center bg-black/25 font-semibold tracking-[0.02em] text-white">
        {initials(name)}
      </span>
    </span>
  );
}
