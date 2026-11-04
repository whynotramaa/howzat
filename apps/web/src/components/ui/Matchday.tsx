import { cn } from '@/lib/cn';

export function SportField({
  sport = 'FOOTBALL',
  className,
}: {
  sport?: 'CRICKET' | 'FOOTBALL';
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 360 220"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className={cn('field-art', className)}
      aria-hidden="true"
    >
      {sport === 'FOOTBALL' ? (
        <>
          <rect x="10" y="10" width="340" height="200" rx="3" />
          <path d="M180 10v200M10 50h65v120H10m340-120h-65v120h65M10 80h25v60H10m340-60h-25v60h25" />
          <circle cx="180" cy="110" r="40" />
          <circle cx="180" cy="110" r="2" />
          <path d="M75 80a40 40 0 0 1 0 60m210-60a40 40 0 0 0 0 60" />
          <path
            data-accent="true"
            d="m105 155 50-35 32 12 57-65m-16 1 16-1-1 16"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          <circle data-accent="true" cx="105" cy="155" r="5" />
        </>
      ) : (
        <>
          <ellipse cx="180" cy="110" rx="166" ry="99" />
          <ellipse cx="180" cy="110" rx="105" ry="68" strokeDasharray="4 5" />
          <rect x="163" y="61" width="34" height="98" rx="2" />
          <path d="M152 73h56m-56 74h56M173 66h14m-14 88h14" />
          <path data-accent="true" d="m180 85 77-49m-16 0h16l-6 15" strokeWidth="2" />
          <circle data-accent="true" cx="180" cy="85" r="5" />
        </>
      )}
    </svg>
  );
}
