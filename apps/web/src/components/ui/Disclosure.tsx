import { useEffect, useRef, type ReactNode } from 'react';

export function Disclosure({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
