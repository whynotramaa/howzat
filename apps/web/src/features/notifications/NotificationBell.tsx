import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NotificationDto } from '@howzat/shared';
import { cn } from '@/lib/cn';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './queries';

export function NotificationBell() {
  const { data } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function handleOpen(notification: NotificationDto) {
    if (!notification.readAt) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.link) navigate(notification.link);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className={cn(
          'relative grid size-9 place-items-center rounded-[var(--radius-sm)] border transition-colors',
          'duration-[var(--dur-fast)]',
          open
            ? 'border-[var(--accent-line)] bg-accent-soft text-accent'
            : 'border-line text-muted hover:border-line-strong hover:text-primary',
        )}
      >
        <BellGlyph ringing={unread > 0} />

        {unread > 0 ? (
          <span
            aria-hidden
            className={cn(
              'mono absolute -top-1.5 -right-1.5 grid min-w-[1.125rem] place-items-center rounded-full',
              'border border-[var(--surface)] bg-live px-1 text-[0.625rem] leading-[1.0625rem] font-medium text-white',
            )}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            'sheet-in absolute right-0 z-40 mt-2.5 w-[min(22rem,calc(100vw-2.5rem))]',
            'overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised shadow-[var(--shadow-md)]',
          )}
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
            <p className="eyebrow">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="text-[0.75rem] text-muted transition-colors hover:text-accent"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[0.8125rem] text-muted">
              Nothing yet. You will hear from us when an organizer adds you to a squad.
            </p>
          ) : (
            <ul className="max-h-[26rem] overflow-y-auto">
              {items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleOpen(notification)}
                    className={cn(
                      'flex w-full gap-3 border-b border-line px-4 py-3.5 text-left last:border-0',
                      'transition-colors duration-[var(--dur-fast)] hover:bg-hover',
                      notification.readAt ? 'opacity-70' : null,
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        notification.readAt ? 'bg-transparent' : 'bg-[var(--accent-strong)]',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-medium text-primary">
                        {notification.title}
                      </span>
                      <span className="mt-1 block text-[0.8125rem] leading-snug text-secondary">
                        {notification.body}
                      </span>
                      <span className="mono mt-1.5 block text-[0.6875rem] text-muted">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BellGlyph({ ringing }: { ringing: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-[1.125rem]', ringing && 'text-accent')}
    >
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
      <path d="M10.3 18.5a2 2 0 0 0 3.4 0" />
    </svg>
  );
}

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(seconds / 86_400);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
