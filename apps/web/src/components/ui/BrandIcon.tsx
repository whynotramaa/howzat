import { cn } from '@/lib/cn';

type Kind = 'cricket' | 'football' | 'trophy' | 'link' | 'bolt';

export function BrandIcon({ kind, className }: { kind: Kind; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className ?? 'size-12')}
    >
      {kind === 'cricket' ? (
        <>
          <g transform="rotate(38 30 30)">
            <rect x="25" y="3" width="10" height="24" rx="5" fill="#6350b4" />
            <rect x="19" y="20" width="22" height="38" rx="10" fill="#c9b8fb" />
            <path d="M30 25v26" stroke="#9a7fdd" strokeWidth="4" strokeLinecap="round" />
          </g>
          <circle cx="49" cy="47" r="12" fill="#f18e6b" />
          <path d="M46 36c7 7 8 14 5 22" stroke="#ffe2cc" strokeWidth="3" />
        </>
      ) : kind === 'football' ? (
        <>
          <circle cx="32" cy="32" r="27" fill="#b8d7fa" />
          <path d="m32 20 12 9-5 14H25l-5-14Z" fill="#4978b5" />
          <path
            d="m32 20-1-14M44 29l14-3M39 43l8 11M25 43l-9 11M20 29 6 25"
            stroke="#4978b5"
            strokeWidth="5"
            strokeLinejoin="round"
          />
        </>
      ) : kind === 'trophy' ? (
        <>
          <path
            d="M17 13H8v9c0 10 9 15 17 15m22-24h9v9c0 10-9 15-17 15"
            stroke="#e7a742"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M16 7h32v14c0 15-9 21-16 21S16 36 16 21Z" fill="#ffd07a" />
          <path d="M32 7h16v14c0 15-9 21-16 21Z" fill="#efb754" />
          <rect x="28" y="39" width="8" height="14" rx="4" fill="#c28a35" />
          <rect x="16" y="51" width="32" height="9" rx="4.5" fill="#ffd07a" />
        </>
      ) : kind === 'link' ? (
        <>
          <g transform="rotate(-35 32 32)">
            <rect x="5" y="19" width="34" height="26" rx="13" fill="#adddc9" />
            <rect x="25" y="19" width="34" height="26" rx="13" fill="#4a9d82" />
            <path d="M24 32h16" stroke="#e0f4e9" strokeWidth="8" strokeLinecap="round" />
          </g>
        </>
      ) : (
        <>
          <path d="M36 3 10 35c-2 3-1 6 3 6h16l-3 20 28-34c2-3 1-6-3-6H35Z" fill="#f1b451" />
          <path d="m36 3-4 28H15L36 3Zm-7 38h12L26 61Z" fill="#ffe0a0" />
        </>
      )}
    </svg>
  );
}
