import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { Wordmark } from '@/components/Wordmark';
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
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
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
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="app-sidebar hidden md:flex">
        <Link
          to="/dashboard"
          aria-label="Howzat home"
          className="flex h-12 items-center border-b border-line px-4"
        >
          <Wordmark size="sm" />
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-px p-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'relative flex h-8 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[0.8125rem]',
                  'transition-colors duration-[var(--dur-fast)]',
                  isActive
                    ? 'bg-hover font-medium text-primary before:absolute before:inset-y-2 before:-left-2 before:w-0.5 before:rounded-full before:bg-accent-fill'
                    : 'text-secondary hover:bg-hover hover:text-primary',
                )
              }
            >
              <NavIcon d={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line p-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-inverse text-xs font-semibold text-on-inverse">
              {user?.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-medium">{user?.name}</p>
              <p className="truncate text-[0.6875rem] text-muted">@{user?.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex h-8 w-full items-center rounded-[var(--radius-md)] px-2.5 text-left text-[0.8125rem] text-muted transition-colors hover:bg-hover hover:text-primary"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0 md:ml-[220px]">
        <header className="app-topbar flex h-12 items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 text-[0.8125rem]">
            <Link to="/dashboard" className="md:hidden" aria-label="Howzat home">
              <Wordmark showName={false} size="sm" />
            </Link>
            <span className="hidden text-muted sm:inline">{user?.username}</span>
            <span aria-hidden className="hidden text-line-strong sm:inline">
              /
            </span>
            <span className="font-medium">{section}</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="mr-2 hidden items-center gap-1.5 text-xs text-muted sm:flex"
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
            'mx-auto w-full max-w-[1280px] pb-24 md:pb-10',
            scoring ? 'px-2 pt-4 sm:px-5' : 'px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
          )}
        >
          <Outlet />
        </main>
      </div>
      <nav
        aria-label="Main mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-raised pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem]',
                isActive ? 'font-medium text-primary' : 'text-muted',
              )
            }
          >
            <NavIcon d={item.icon} />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => void logout()}
          className="flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] text-muted"
        >
          <NavIcon d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
          Sign out
        </button>
      </nav>
    </div>
  );
}
