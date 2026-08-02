import type { Sport } from '@howzat/shared';
import { cn } from '@/lib/cn';

/*
 * The sport, drawn.
 *
 * This replaces an emoji in a coloured pill, which was wrong twice over. An
 * emoji is somebody else's illustration — it arrives at a different weight on
 * every platform, ignores the type colour, and reads as decoration stuck on
 * rather than as part of the page. And a saturated pill broke the system's one
 * rule about colour: the accent marks the live thing and the active thing, so
 * spending it on a label that never changes leaves nothing to mark what does.
 *
 * What is here instead is a hairline glyph at the same stroke weight as the
 * rules and borders around it, in `currentColor`, so it inherits whatever the
 * text beside it is doing. A cricket ball is a circle and its seam; a football
 * is a circle and the top of its panelling. Both read at 12px, which is the
 * only size that matters.
 */

export function SportMark({
  sport,
  className,
}: {
  sport: Sport;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-3.5 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" />

      {sport === 'CRICKET' ? (
        // The seam, and the stitching either side of it — what tells a cricket
        // ball from any other circle.
        <>
          <path d="M5.1 3.1C6.4 5 6.4 11 5.1 12.9" />
          <path d="M3.3 5.2l1.4.9M2.6 8h1.6M3.3 10.8l1.4-.9" strokeWidth={0.9} />
        </>
      ) : (
        // The centre panel and the three seams running off it.
        <>
          <path d="M8 5.2l2.1 1.5-.8 2.4H6.7l-.8-2.4z" strokeLinejoin="round" />
          <path d="M8 5.2V2M10.1 6.7l2.6-1M9.3 9.1l1.6 2.6M6.7 9.1l-1.6 2.6M5.9 6.7l-2.6-1" strokeWidth={0.9} />
        </>
      )}
    </svg>
  );
}

/**
 * The line above a tournament's name: what game, what format, at the same
 * weight as every other eyebrow in the product.
 *
 * Set as text rather than as a badge because that is what it is — a caption,
 * not a status. The things that earn a filled pill here are the ones that
 * change while you are looking at them, and a tournament's sport is fixed at
 * the moment it is created.
 */
export function SportEyebrow({
  sport,
  detail,
  className,
}: {
  sport: Sport;
  /** What follows the sport, e.g. "League · home and away". */
  detail?: string;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2 text-muted', className)}>
      <SportMark sport={sport} />
      <span className="eyebrow">
        {sport === 'FOOTBALL' ? 'Football' : 'Cricket'}
        {detail ? <span className="text-line-strong"> · </span> : null}
        {detail}
      </span>
    </span>
  );
}
