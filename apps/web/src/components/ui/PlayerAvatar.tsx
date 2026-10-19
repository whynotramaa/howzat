import { cn } from '@/lib/cn';
import { pick, seedHash } from '@/lib/seed';

const SKIN = ['#f6d7b8', '#eac09a', '#d9a87c', '#b67a50', '#8d5a36', '#6a412a'] as const;
const HAIR = ['#1d1b17', '#3b2a1e', '#6b4423', '#a8742f', '#d9b26a', '#7a7570', '#9b3b26'] as const;
const BACKDROP = ['#dbe6f3', '#f3dcd6', '#dcefe2', '#efe6cf', '#e6def2', '#d8ecee'] as const;
const SHIRT = ['#2f63d8', '#d0533c', '#4d8a57', '#d99a2b', '#7a58c9', '#2d4f5e', '#6b2f4d'] as const;
const INK = '#1d1b17';

const MOUTHS = [
  <path key="smile" d="M21 28c1.8 1.7 4.2 1.7 6 0" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />,
  <path key="grin" d="M20.6 27.4c2 2.8 4.8 2.8 6.8 0Z" fill="#fff" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />,
  <path key="flat" d="M21.6 28.4c1.6.4 3.2.4 4.8 0" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />,
  <ellipse key="oh" cx="24" cy="28.4" rx="1.3" ry="1.5" fill={INK} />,
];

const SIZES = {
  xs: 'size-7',
  sm: 'size-9',
  md: 'size-12',
  lg: 'size-16',
  xl: 'size-24',
} as const;

export function PlayerAvatar({
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
  const key = seedHash(seed || name);
  const skin = pick(SKIN, key);
  const hair = pick(HAIR, key, 3);
  const shirt = color ?? pick(SHIRT, key, 6);
  const style = (key >>> 9) % 5;
  const beard = (key >>> 12) % 5 === 0;
  const happyEyes = (key >>> 14) % 4 === 0;
  const clip = `face-${key.toString(36)}`;

  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn('inline-block shrink-0 rounded-full', SIZES[size], className)}
    >
      <svg viewBox="0 0 48 48" className="block size-full">
        <defs>
          <clipPath id={clip}>
            <circle cx="24" cy="24" r="24" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="48" height="48" fill={pick(BACKDROP, key, 17)} />
          {style === 2 ? <path d="M14 22c0-9 4.5-14 10-14s10 5 10 14v13H14Z" fill={hair} /> : null}
          <path d="M20.5 30h7v7h-7Z" fill={skin} />
          <path d="M5 50c1.6-10.6 8.6-15.4 19-15.4S41.4 39.4 43 50Z" fill={shirt} stroke={INK} strokeWidth="1.1" />
          <path d="M19.6 35.2 24 39.6l4.4-4.4" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.4" strokeLinecap="round" />
          <ellipse cx="24" cy="22.5" rx="9" ry="10" fill={skin} stroke={INK} strokeWidth="1.1" />
          {beard ? (
            <path d="M15.4 24c.8 6.8 4 9.6 8.6 9.6s7.8-2.8 8.6-9.6c-2.2 2.8-5 3.8-8.6 3.8s-6.4-1-8.6-3.8Z" fill={hair} />
          ) : null}
          {style === 0 || style === 2 ? (
            <path d="M14.8 21c0-7.4 4-11.6 9.2-11.6s9.2 4.2 9.2 11.6c-2-3.4-5-5.2-9.2-5.2S16.8 17.6 14.8 21Z" fill={hair} />
          ) : null}
          {style === 1
            ? [
                [16, 17],
                [19.4, 12.6],
                [24, 11],
                [28.6, 12.6],
                [32, 17],
              ].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.6" fill={hair} />)
            : null}
          {style === 3 ? (
            <>
              <path d="M14.6 19c0-6.6 4-10.4 9.4-10.4s9.4 3.8 9.4 10.4Z" fill={shirt} stroke={INK} strokeWidth="1.1" />
              <path d="M24 19c5 0 10 .4 14 1.6" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            </>
          ) : null}
          {style === 4 ? (
            <path d="M15.6 18.6c1.2-5 4.2-8 8.4-8s7.2 3 8.4 8" fill="none" stroke={hair} strokeWidth="2.4" strokeLinecap="round" />
          ) : null}
          {happyEyes ? (
            <path d="M19.4 23.6c.8-1 2-1 2.8 0M25.8 23.6c.8-1 2-1 2.8 0" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
          ) : (
            <>
              <circle cx="20.6" cy="23.2" r="1.15" fill={INK} />
              <circle cx="27.4" cy="23.2" r="1.15" fill={INK} />
            </>
          )}
          <circle cx="18" cy="26.6" r="1.6" fill="#e0715c" opacity=".28" />
          <circle cx="30" cy="26.6" r="1.6" fill="#e0715c" opacity=".28" />
          {pick(MOUTHS, key, 20)}
        </g>
      </svg>
    </span>
  );
}
