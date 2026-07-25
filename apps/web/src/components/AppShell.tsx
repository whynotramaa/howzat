import { Link, NavLink, Outlet } from 'react-router-dom';
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
 * Navigation is marked by a brass rule under the active item, the same indicator
 * the tabs use, so the whole product has one way of saying "you are here".
 */

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/profile', label: 'My record' },
] as const;

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-[78rem] items-center gap-8 px-5 sm:px-8 lg:px-12">
          <Link
            to="/dashboard"
            className="shrink-0 transition-opacity hover:opacity-70"
            aria-label="Howzat — home"
          >
            <Wordmark />
          </Link>

          <nav aria-label="Main" className="flex h-full items-stretch gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to === '/profile' ? `/players/${user?.username ?? ''}` : item.to}
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

          <div className="ml-auto flex items-center gap-4">
            <NotificationBell />
            <ThemeToggle />

            {/* The handle, not a role: it is what another organizer searches for
                to add this person to a squad or assign them a match. */}
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-[0.8125rem] font-medium text-primary">{user?.name}</p>
              <p className="mono text-[0.6875rem] text-muted">@{user?.username}</p>
            </div>

            <span aria-hidden className="hidden h-7 w-px bg-line sm:block" />

            <button
              type="button"
              onClick={() => void logout()}
              className="text-[0.8125rem] text-muted transition-colors hover:text-primary"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[78rem] flex-1 px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[78rem] flex-wrap items-center justify-between gap-4 px-5 py-7 sm:px-8 lg:px-12">
          <p className="text-[0.8125rem] text-muted">
            Howzat — local cricket, kept properly.
          </p>
          <p className="eyebrow">Every ball on the record</p>
        </div>
      </footer>
    </div>
  );
}
