import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * Scroll motion for the front page.
 *
 * Two rules hold everything here together. Content is never hidden by
 * JavaScript — the element renders in its final state and an attribute is what
 * moves it, so a failure to observe leaves a readable page rather than a blank
 * one. And every reveal fires exactly once: an element that re-animates when
 * you scroll back up turns reading into a slideshow.
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ScrollReveal({
  index = 0,
  step = 70,
  shift = 18,
  as: Component = 'div',
  className,
  children,
}: {
  /** Position within a group; multiplied by `step` for the stagger. */
  index?: number;
  step?: number;
  /** Pixels travelled. Larger for a hero block, smaller for a list row. */
  shift?: number;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  // Starts visible. The observer hides it on mount only if it is still below
  // the fold, so anything already on screen at first paint never blinks.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;

    setVisible(false);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setVisible(true);
          observer.disconnect();
        }
      },
      // A negative bottom margin means the element has to be properly on screen
      // before it moves, not merely touching the edge.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Component
      ref={ref}
      data-visible={visible}
      className={cn('scroll-reveal', className)}
      style={
        {
          '--delay': `${index * step}ms`,
          '--reveal-shift': `${shift}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </Component>
  );
}

/**
 * An accent hairline across the top showing how far down the page you are. It is
 * written straight to a CSS variable inside a rAF, so scrolling costs one style
 * write per frame and never a React render.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      element.style.setProperty('--progress', String(Math.min(1, Math.max(0, progress))));
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return <div ref={ref} aria-hidden className="scroll-progress" />;
}
