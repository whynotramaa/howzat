import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * A parallax tilt for the hero card, and nowhere else.
 *
 * Three conditions, all of which must hold: a fine pointer (so never a phone), a
 * device that reports hover, and a user who has not asked for reduced motion. If
 * any fails, the listener is never attached and the card is simply a card — not a
 * disabled animation, no animation at all.
 *
 * The rotation ceiling is 4 degrees. Past that it stops reading as a physical
 * sheet catching the light and starts looking like a toy.
 */

const MAX_DEGREES = 4;

function tiltAllowed(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node || !tiltAllowed()) return;

    const bounds = node.getBoundingClientRect();
    // −0.5 … 0.5 from the centre of the card, on both axes.
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    // Y movement tips the card away from the cursor, which is the direction a
    // sheet of paper would actually go if you pressed that corner.
    node.style.setProperty('--tilt-x', `${-y * MAX_DEGREES * 2}deg`);
    node.style.setProperty('--tilt-y', `${x * MAX_DEGREES * 2}deg`);
  }

  function handleLeave() {
    const node = ref.current;
    if (!node) return;

    node.style.setProperty('--tilt-x', '0deg');
    node.style.setProperty('--tilt-y', '0deg');
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={cn('tilt', className)}
    >
      {children}
    </div>
  );
}
