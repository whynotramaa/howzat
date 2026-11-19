import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { Disclosure } from '@/components/ui/Disclosure';
import { SketchDefs } from '@/components/ui/Sketch';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { useOnline } from '@/lib/useOnline';
import { cn } from '@/lib/cn';

const ICONS = {
  house: [
    'M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z',
    'M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z',
  ],
  trophy: [
    'M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8Zm144-8.9c0,35.52-29,64.64-64,64.9a64,64,0,0,1-64-64V56H192ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z',
    'M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z',
  ],
  user: [
    'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.830,87.830,0,0,1-107.84,0ZM96,120a32,32,0,1,1,32,32A32,32,0,0,1,96,120Zm97.76,66.41a79.66,79.66,0,0,0-36.06-28.75,48,48,0,1,0-59.4,0,79.66,79.66,0,0,0-36.06,28.75,88,88,0,1,1,131.52,0Z',
    'M172,120a44,44,0,1,1-44-44A44.05,44.05,0,0,1,172,120Zm60,8A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88.09,88.09,0,0,0-91.47-87.93C77.43,41.89,39.87,81.12,40,128.25a87.65,87.65,0,0,0,22.24,58.16A79.71,79.71,0,0,1,84,165.1a4,4,0,0,1,4.83.32,59.83,59.83,0,0,0,78.28,0,4,4,0,0,1,4.83-.32,79.71,79.71,0,0,1,21.79,21.31A87.62,87.62,0,0,0,216,128Z',
  ],
} as const;

function NavIcon({ name }: { name: keyof typeof ICONS }) {
  const [line, fill] = ICONS[name];
  return (
    <>
      <svg viewBox="0 0 256 256" className="ic-line size-6" fill="currentColor" aria-hidden>
        <path d={line} />
      </svg>
      <svg viewBox="0 0 256 256" className="ic-fill size-6" fill="currentColor" aria-hidden>
        <path d={fill} />
      </svg>
    </>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const online = useOnline();
  const scoring = /\/score(\/|$)/.test(pathname);
  const nav = [
    { to: '/dashboard', label: 'Matches', icon: 'house' as const },
    { to: '/tournaments', label: 'Tournaments', icon: 'trophy' as const, also: '/teams' },
    { to: `/players/${user?.username ?? ''}`, label: 'Profile', icon: 'user' as const },
  ];
  const isActive = (item: (typeof nav)[number]) =>
    pathname.startsWith(item.to) || Boolean(item.also && pathname.startsWith(item.also));

  return (
    <div className="min-h-dvh">
      <SketchDefs />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {scoring ? null : (
        <header className="app-topbar border-b border-[var(--page-line)]">
          <div className="relative mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 md:px-6">
            <Link to="/dashboard" className="flex items-baseline gap-3">
              <b className="text-lg font-bold tracking-[-0.02em]">Howzat</b>
            </Link>
            <nav
              aria-label="Main"
              className="seg-nav absolute left-1/2 hidden -translate-x-1/2 md:inline-grid"
            >
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-current={isActive(item) ? 'page' : undefined}
                  className="press"
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              {!online ? (
                <span className="bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                  Offline
                </span>
              ) : null}
              <ThemeToggle />
              <NotificationBell />
              <Disclosure className="relative hidden md:block">
                <summary
                  aria-label="Account menu"
                  className="grid size-11 cursor-pointer list-none place-items-center hover:bg-hover"
                >
                  <PlayerAvatar seed={user?.username ?? ''} name={user?.name ?? ''} size="sm" />
                </summary>
                <div className="absolute right-0 z-50 mt-1 grid w-52 border border-line bg-raised p-1">
                  <Link
                    to={`/players/${user?.username ?? ''}`}
                    className="flex h-10 items-center px-3 text-sm font-medium hover:bg-sunken"
                  >
                    Profile
                  </Link>
                  <hr className="my-1 border-line" />
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex h-10 items-center px-3 text-left text-sm font-medium text-alert hover:bg-sunken"
                  >
                    Sign out
                  </button>
                </div>
              </Disclosure>
            </div>
          </div>
        </header>
      )}
      <main
        id="main-content"
        className={cn(
          'mx-auto w-full max-w-[1200px]',
          scoring ? '' : 'px-4 pt-6 pb-28 md:px-6 md:pt-10 md:pb-16',
        )}
      >
        <Outlet />
      </main>
      {scoring ? null : (
        <nav
          aria-label="Main mobile"
          className="tabbar nav-icons fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-line bg-raised px-2 pt-2 pb-[max(1.375rem,env(safe-area-inset-bottom))] md:hidden"
        >
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive(item) ? 'page' : undefined}
              className={cn(
                'press grid h-[3.25rem] content-center justify-items-center gap-0.5 text-[11px] leading-[14px] font-semibold',
                isActive(item) ? 'text-primary' : 'text-muted',
              )}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
