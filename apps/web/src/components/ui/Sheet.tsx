import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

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

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab' || !panel) return;
      const targets = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ].filter((element) => element.getClientRects().length);
      const first = targets[0],
        last = targets.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    panel?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKey);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div aria-hidden onClick={onClose} className="scrim-in absolute inset-0 bg-[var(--scrim)]" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'sheet-in relative flex max-h-[92dvh] w-full flex-col outline-none',
          'border border-line bg-raised shadow-[var(--shadow-lg)]',
          'rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-[26rem]',
        )}
      >
        <header className="flex items-start gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.9375rem] font-semibold text-primary">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-0.5 -mr-2 grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-hover hover:text-primary"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor">
              <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <footer
            className={cn(
              'flex flex-wrap items-center justify-end gap-2 border-t border-line bg-sunken/60 px-5 py-3',
              'rounded-b-[var(--radius-xl)] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3',
            )}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
