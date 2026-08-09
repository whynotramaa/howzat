import { cn } from '@/lib/cn';

type Pattern = 'plain' | 'halves' | 'stripes' | 'hoops' | 'sash';

const PATTERNS: Pattern[] = ['plain', 'halves', 'stripes', 'hoops', 'sash'];

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

          {pattern === 'sash' ? <path d="M-6 34L34 -6l10 10L4 44z" fill={light} /> : null}

          <path
            d="M13 3.5a7.5 7.5 0 0 0 14 0"
            fill="none"
            stroke="rgba(255,255,255,.55)"
            strokeWidth="2.5"
          />
        </g>
      </svg>

      <span className="relative grid size-full place-items-center bg-black/25 font-semibold tracking-[0.02em] text-white">
        {initials(name)}
      </span>
    </span>
  );
}
