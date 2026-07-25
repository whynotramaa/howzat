import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/cn';

/*
 * The signed-in frame.
 *
 * The bar is a hairline and a measure of quiet space — no fill, no blur, no
 * shadow. It is 72px tall so the wordmark has room to breathe, and it does not
 * stick: on a scorecard, a bar that follows you down the page is a bar that
 * covers the numbers you are reading.
 *
 * Navigation is marked by an accent rule under the active item, the same indicator
 * the tabs use, so the whole product has one way of saying "you are here".
 *
 * Below `md` there is not room for three links, an identity and two controls at
 * a legible size, so everything but the bell collapses into a menu. The bell
 * stays out: an unread count is the one thing worth seeing without a tap.
 */

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/profile', label: 'My record' },
] as const;

export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  const navHref = (to: string) => (to === '/profile' ? `/players/${user?.username ?? ''}` : to);

  // Arriving somewhere new is the end of navigating: the menu has done its job.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes it, and the page behind it cannot scroll — the same contract
  // the sheet keeps, so an overlay always behaves the one way.
  useEffect(() => {
    if (!menuOpen) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  // Growing past the breakpoint reveals the real nav; a menu left open behind it
  // would trap the scroll lock on a page that no longer has a way to close it.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 48rem)');
    const handleChange = () => {
      if (query.matches) setMenuOpen(false);
    };

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative z-40 border-b border-line bg-surface">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-[78rem] items-center gap-4 px-5 sm:px-8 md:gap-8 lg:px-12">
          <Link
            to="/dashboard"
            className="shrink-0 transition-opacity hover:opacity-70"
            aria-label="Howzat — home"
          >
            <Wordmark />
          </Link>

          <nav aria-label="Main" className="hidden h-full items-stretch gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={navHref(item.to)}
                className={({ isActive }) =>
                  cn(
                    'relative inline-flex items-center px-3 text-[0.8125rem] font-medium',
                    'transition-colors duration-[var(--dur-fast)]',
                    isActive ? 'text-primary' : 'text-muted hover:text-secondary',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-x-2 bottom-0 h-[2px] transition-opacity',
                        isActive ? 'bg-[var(--accent-strong)] opacity-100' : 'opacity-0',
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <NotificationBell />

            <div className="hidden items-center gap-4 md:flex">
              <ThemeToggle />

              {/* The handle, not a role: it is what another organizer searches for
                  to add this person to a squad or assign them a match. */}
              <div className="text-right leading-tight">
                <p className="text-[0.8125rem] font-medium text-primary">{user?.name}</p>
                <p className="mono text-[0.6875rem] text-muted">@{user?.username}</p>
              </div>

              <span aria-hidden className="h-7 w-px bg-line" />

              <button
                type="button"
                onClick={() => void logout()}
                className="text-[0.8125rem] text-muted transition-colors hover:text-primary"
              >
                Sign out
              </button>
            </div>

            <MenuButton open={menuOpen} onToggle={() => setMenuOpen((value) => !value)} />
          </div>
        </div>

        {menuOpen ? (
          <div
            id="main-menu"
            className="sheet-in absolute inset-x-0 top-full border-b border-line bg-surface shadow-[var(--shadow-lg)] md:hidden"
          >
            <nav
              aria-label="Main"
              className="mx-auto flex w-full max-w-[78rem] flex-col px-5 py-2 sm:px-8"
            >
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={navHref(item.to)}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center py-3.5 pl-4 text-[0.9375rem] font-medium',
                      'transition-colors duration-[var(--dur-fast)]',
                      isActive ? 'text-primary' : 'text-muted',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* The rule turns vertical, but it is the same indicator. */}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute inset-y-2.5 left-0 w-[2px] transition-opacity',
                          isActive ? 'bg-[var(--accent-strong)] opacity-100' : 'opacity-0',
                        )}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div
              className={cn(
                'mx-auto flex w-full max-w-[78rem] flex-wrap items-center justify-between gap-4',
                'border-t border-line px-5 py-4 sm:px-8',
                'pb-[max(1rem,env(safe-area-inset-bottom))]',
              )}
            >
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[0.8125rem] font-medium text-primary">{user?.name}</p>
                <p className="mono truncate text-[0.6875rem] text-muted">@{user?.username}</p>
              </div>

              <div className="flex items-center gap-4">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="text-[0.8125rem] text-muted transition-colors hover:text-primary"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {menuOpen ? (
        <div
          aria-hidden
          onClick={() => setMenuOpen(false)}
          className="scrim-in fixed inset-0 z-30 bg-[var(--scrim)] md:hidden"
        />
      ) : null}

      <main className="mx-auto w-full max-w-[78rem] flex-1 px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[78rem] flex-wrap items-center justify-between gap-4 px-5 py-7 sm:px-8 lg:px-12">
          <p className="text-[0.8125rem] text-muted">Howzat — local cricket, kept properly.</p>
          <p className="eyebrow">Every ball on the record</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Three rules that fold into a cross.
 *
 * The bars never change their `top`/`bottom` — they are moved onto the centre
 * line by transform alone, because that is the only thing the compositor can
 * actually animate. The outer two travel 7.25px to meet in the middle and
 * rotate as they arrive, so the mark closes in one motion instead of jumping.
 *
 * The middle bar scales out from the centre rather than fading, so nothing is
 * ever left half-visible under the cross.
 */
function MenuButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const bar = 'absolute left-0 h-[1.5px] w-full rounded-full bg-current';
  const timing = 'transition-transform duration-[var(--dur)] ease-[var(--ease)]';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="main-menu"
      aria-label={open ? 'Close menu' : 'Open menu'}
      className={cn(
        'relative grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] md:hidden',
        'text-secondary transition-colors hover:bg-hover hover:text-primary',
      )}
    >
      <span aria-hidden className="relative block h-4 w-[18px]">
        <span className={cn(bar, timing, 'top-0', open && 'translate-y-[7.25px] rotate-45')} />
        <span
          className={cn(
            bar,
            'top-1/2 -translate-y-1/2 transition-transform duration-[var(--dur-fast)] ease-[var(--ease)]',
            open ? 'scale-x-0' : 'scale-x-100',
          )}
        />
        <span className={cn(bar, timing, 'bottom-0', open && '-translate-y-[7.25px] -rotate-45')} />
      </span>
    </button>
  );
}
