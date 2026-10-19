import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { Wordmark } from '@/components/Wordmark';
import { SketchDefs } from '@/components/ui/Sketch';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { cn } from '@/lib/cn';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

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
      label: 'Overview',
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
      <aside className="app-sidebar hidden md:flex">
        <Link to="/dashboard" aria-label="Howzat home" className="flex h-20 items-center px-7">
          <Wordmark size="sm" />
        </Link>
        <nav aria-label="Main" className="mt-8 flex flex-col gap-1 px-7">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'serif flex h-11 items-center text-[1.625rem] transition-colors duration-[var(--dur-fast)]',
                  isActive ? 'text-primary' : 'text-muted hover:text-primary',
                )
              }
            >
              {({ isActive }) => <span className={cn(isActive && 'squiggle')}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-7 py-6">
          <Link
            to={`/players/${user?.username ?? ''}`}
            className="flex min-w-0 items-center gap-3 rounded-[var(--radius-lg)] transition-opacity hover:opacity-80"
          >
            <PlayerAvatar seed={user?.username ?? ''} name={user?.name ?? ''} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-primary">{user?.name}</span>
              <span className="block truncate text-xs text-muted">@{user?.username}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-5 text-[0.8125rem] font-medium text-secondary underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:text-primary hover:decoration-current"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0 md:ml-[248px]">
        <header className="app-topbar flex h-16 items-center justify-between gap-3 border-b border-line px-4 sm:px-10">
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <Link to="/dashboard" className="md:hidden" aria-label="Howzat home">
              <Wordmark showName={false} size="sm" />
            </Link>
            <span className="hidden text-muted sm:inline">@{user?.username}</span>
            <span aria-hidden className="hidden text-line-strong sm:inline">
              /
            </span>
            <span className="serif text-[1.375rem] leading-none">{section}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'mr-3 hidden items-center gap-2 text-xs font-medium sm:flex',
                online ? 'text-muted' : 'text-warning',
              )}
              title={online ? 'Connected' : 'Offline'}
            >
              <span className={cn('size-1.5 rounded-full', online ? 'bg-success' : 'bg-warning')} />
              {online ? 'Online' : 'Offline'}
            </span>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main
          id="main-content"
          className={cn(
            'mx-auto w-full max-w-[1320px] pb-28 md:pb-12',
            scoring ? 'px-2 pt-4 sm:px-5' : 'px-5 py-10 sm:px-10 lg:px-14 lg:py-14',
          )}
        >
          <Outlet />
        </main>
      </div>
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
            {({ isActive }) => (
              <>
                <NavIcon d={item.icon} />
                <span className={cn(isActive && 'squiggle')}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => void logout()}
          className="grid h-16 flex-1 place-content-center justify-items-center gap-1 text-[0.6875rem] font-medium text-muted"
        >
          <NavIcon d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
          Sign out
        </button>
      </nav>
    </div>
  );
}
