import { useEffect, useSyncExternalStore } from 'react';

type Notice = { id: number; message: string; tone: 'success' | 'error' | 'info' };
let notices: Notice[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
function emit() {
  listeners.forEach((listener) => listener());
}
function dismiss(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  notices = notices.filter((notice) => notice.id !== id);
  emit();
}
export function toast(message: string, tone: Notice['tone'] = 'success'): void {
  if (notices.some((notice) => notice.message === message)) return;
  const id = ++nextId;
  if (notices.length >= 3) dismiss(notices[0]!.id);
  notices = [...notices, { id, message, tone }];
  emit();
  timers.set(
    id,
    setTimeout(() => dismiss(id), tone === 'error' ? 8_000 : 4_500),
  );
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => notices);
  useEffect(
    () => () => {
      timers.forEach(clearTimeout);
      timers.clear();
      notices = [];
    },
    [],
  );
  return (
    <div
      className="fixed right-4 bottom-24 left-4 z-[100] flex flex-col gap-2 sm:left-auto sm:w-[340px] md:bottom-5"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="sheet-in flex items-center gap-2.5 rounded-[var(--radius-md)] border border-line bg-raised py-2 pr-1.5 pl-3 shadow-[var(--shadow-md)]"
          role={item.tone === 'error' ? 'alert' : 'status'}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{
              background:
                item.tone === 'error'
                  ? 'var(--alert)'
                  : item.tone === 'success'
                    ? 'var(--success)'
                    : 'var(--accent-fill)',
            }}
          />
          <p className="min-w-0 flex-1 text-[0.8125rem] text-primary">{item.message}</p>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted hover:bg-hover hover:text-primary"
            aria-label="Dismiss notification"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="m3 3 8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
