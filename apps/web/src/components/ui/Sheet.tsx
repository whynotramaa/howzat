import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * The one overlay in the system.
 *
 * On a phone it is anchored to the bottom edge, in the thumb zone, because the
 * things that open it — a wicket, a dismissal type — are things a scorer taps
 * one-handed between deliveries. On a desktop it centres.
 *
 * It rises 14px into place on a soft ease and never hard-fades. Escape closes
 * it, a click on the scrim closes it, and while it is open the page behind it
 * cannot scroll.
 */

export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    // Focus moves into the panel so the keyboard is not left behind the scrim.
    panelRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        aria-hidden
        onClick={onClose}
        className="scrim-in absolute inset-0 bg-[rgb(12_10_8/0.55)] backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'sheet-in relative flex max-h-[92dvh] w-full flex-col outline-none',
          'border border-line bg-raised shadow-[var(--shadow-lg)]',
          // Rounded at the top only on a phone: it is attached to the bottom edge.
          'rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-lg)]',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <header className="flex items-start gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="serif text-xl text-primary">{title}</h2>
            {description ? (
              <p className="mt-1.5 text-[0.8125rem] text-secondary">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-hover hover:text-primary"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor">
              <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer ? (
          <footer
            className={cn(
              'flex flex-wrap items-center gap-3 border-t border-line px-6 py-4',
              // Clear of the home indicator on a phone.
              'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4',
            )}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
