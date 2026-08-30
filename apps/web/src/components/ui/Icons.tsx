import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * Cricket needs its own vocabulary and emoji will not carry it: a flame in
 * Segoe UI and a flame on iOS are different drawings. These are 20px, stroke
 * 1.4, rounded joins, and they inherit colour like text.
 */

type IconProps = { className?: string };

function svg(path: ReactNode, extra?: ReactNode) {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={cn('size-[1.125em] shrink-0', className)}
      >
        {path}
        {extra}
      </svg>
    );
  };
}

export const FlameIcon = svg(
  <path d="M10 18c2.9 0 5-2 5-4.7 0-3.4-3.2-4.6-2.6-8.3C10.4 6.2 9 8 9 9.6c0 .9-.6 1.2-1.1.7-.5-.5-.7-1.3-.7-2C6 9.6 5 11.3 5 13.3 5 16 7.1 18 10 18Z" />,
);

export const TrophyIcon = svg(
  <>
    <path d="M6.5 2.8h7v4a3.5 3.5 0 0 1-7 0v-4Z" />
    <path d="M6.5 4.2H4.4v1.1a2.6 2.6 0 0 0 2.1 2.5M13.5 4.2h2.1v1.1a2.6 2.6 0 0 1-2.1 2.5" />
    <path d="M10 10.3v3.1M7 17.2h6M8 13.4h4l.6 3.8H7.4l.6-3.8Z" />
  </>,
);

export const TargetIcon = svg(
  <>
    <circle cx="10" cy="10" r="7" />
    <circle cx="10" cy="10" r="3.4" />
    <circle cx="10" cy="10" r="0.9" fill="currentColor" stroke="none" />
  </>,
);

export const BoltIcon = svg(<path d="M11 2.5 4.8 11.2h4.4L9 17.5l6.2-8.7h-4.4l.2-6.3Z" />);

export const BallIcon = svg(
  <>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M6.4 4.1c1.6 1.4 2.6 3.6 2.6 5.9s-1 4.5-2.6 5.9M13.6 4.1c-1.6 1.4-2.6 3.6-2.6 5.9s1 4.5 2.6 5.9" />
  </>,
);

export const EyeIcon = svg(
  <>
    <path d="M1.8 10S4.9 4.8 10 4.8 18.2 10 18.2 10 15.1 15.2 10 15.2 1.8 10 1.8 10Z" />
    <circle cx="10" cy="10" r="2.4" />
  </>,
);

export const TrendIcon = svg(
  <>
    <path d="M2.5 13.5 7.5 8.5l3 3 6-6.5" />
    <path d="M12.4 5h4.1v4.1" />
  </>,
);

export const StumpsIcon = svg(
  <>
    <path d="M6 6.5v11M10 6.5v11M14 6.5v11" />
    <path d="M4.6 5.4h10.8" />
  </>,
);

export const UndoIcon = svg(
  <>
    <path d="M4 8.5h8.2a3.8 3.8 0 0 1 0 7.6H8" />
    <path d="m7 5-3 3.5L7 12" />
  </>,
);

export const ClockIcon = svg(
  <>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M10 5.8V10l2.8 1.8" />
  </>,
);
