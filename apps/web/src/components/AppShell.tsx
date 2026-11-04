import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { Disclosure } from '@/components/ui/Disclosure';
import { Wordmark } from '@/components/Wordmark';
import { SketchDefs } from '@/components/ui/Sketch';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { useOnline } from '@/lib/useOnline';
import { cn } from '@/lib/cn';

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const online = useOnline();
  const items = [
    {
      to: '/dashboard',
      label: 'Matchday',
      icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    },
    {
      to: '/tournaments',
      label: 'Tournaments',
      icon: 'M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v6m-4 2h8',
    },
    {
      to: `/players/${user?.username ?? ''}`,
      label: 'Profile',
      icon: 'M20 21v-2a7 7 0 0 0-14 0v2M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    },
  ];
  const scoring = /\/score(\/|$)/.test(pathname);
  const section = scoring
    ? 'Scoring'
    : pathname.startsWith('/tournaments') || pathname.startsWith('/teams')
      ? 'Tournaments'
      : pathname.startsWith('/players')
        ? 'Profile'
        : pathname.startsWith('/matches')
          ? 'Match'
          : 'Overview';

  return (
    <div className="min-h-dvh">
      <SketchDefs />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-topbar border-b border-line">
        <div className="masthead mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-5 sm:h-16 sm:px-8 lg:px-10">
          <Link to="/dashboard" aria-label="Howzat home" className="shrink-0">
            <Wordmark size="sm" />
          </Link>
          {!scoring ? (
            <nav
              aria-label="Main"
              className="masthead-nav hidden h-full items-center gap-10 md:flex"
            >
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex h-full items-center border-b-2 pt-0.5 text-[1.375rem]',
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted hover:text-primary',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : (
            <span className="hidden font-sans text-xl text-muted sm:inline">{section}</span>
          )}
          <div className="flex items-center gap-1">
            {!online ? (
              <span className="hidden text-xs text-warning sm:inline">Offline</span>
            ) : null}
            <ThemeToggle />
            <NotificationBell />
            <Disclosure className="relative">
              <summary
                aria-label="Account menu"
                className="grid size-11 cursor-pointer list-none place-items-center rounded-full hover:bg-hover"
              >
                <PlayerAvatar seed={user?.username ?? ''} name={user?.name ?? ''} size="sm" />
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-56 border border-line bg-raised p-2 shadow-[var(--shadow-md)]">
                <p className="px-3 py-2 text-lg">{user?.name}</p>
                <Link
                  to={`/players/${user?.username ?? ''}`}
                  className="block min-h-11 px-3 py-2 text-sm"
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="min-h-11 w-full px-3 text-left text-sm text-alert hover:bg-hover"
                >
                  Sign out
                </button>
              </div>
            </Disclosure>
          </div>
        </div>
      </header>
      <div className="min-w-0">
        <main
          id="main-content"
          className={cn(
            'mx-auto w-full max-w-[1240px]',
            scoring
              ? 'scoring-workspace px-4 pt-4 pb-8 sm:px-8'
              : 'px-5 pt-7 pb-28 sm:px-8 lg:py-9 lg:px-10',
          )}
        >
          <Outlet />
        </main>
      </div>
      {!scoring ? (
        <nav
          aria-label="Main mobile"
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'grid h-16 flex-1 place-content-center justify-items-center gap-1 text-[0.6875rem] font-medium',
                  isActive ? 'text-primary' : 'text-muted',
                )
              }
            >
              {() => (
                <>
                  <NavIcon d={item.icon} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
