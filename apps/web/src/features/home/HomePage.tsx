import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';

type Sport = 'CRICKET' | 'FOOTBALL';

const STEPS = [
  { title: 'Set up', body: 'Tournament, teams, squads, fixtures.' },
  { title: 'Score', body: 'Ball by ball or goal by goal. Works offline.' },
  { title: 'Share', body: 'One live link. No sign-in to follow.' },
];

export function HomePage() {
  const { user } = useAuth();
  const [sport, setSport] = useState<Sport>('CRICKET');
  const [balls, setBalls] = useState<number[]>([]);
  const [goals, setGoals] = useState([0, 0]);
  const home = user ? '/dashboard' : '/login';
  const runs = balls.reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-dvh">
      <header className="app-topbar border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" aria-label="Howzat home">
            <Wordmark size="sm" />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/engineering"
              className="mr-2 hidden text-[0.8125rem] text-secondary hover:text-primary sm:inline"
            >
              Engineering
            </Link>
            <ThemeToggle />
            <Link to={home} className="ml-2">
              <Button size="sm">{user ? 'Dashboard' : 'Sign in'}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="grid-canvas border-b border-line">
          <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_440px] lg:py-24">
            <div>
              <h1 className="max-w-[12ch] text-[clamp(2.75rem,6vw,4.75rem)] leading-[0.98] font-semibold tracking-[-0.05em]">
                Local sport, scored live.
              </h1>
              <p className="mt-5 max-w-sm text-[0.9375rem] text-secondary">
                Cricket and football tournaments with a scoring desk and a public live link.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <Link to={home}>
                  <Button size="lg">{user ? 'Open dashboard' : 'Get started'}</Button>
                </Link>
                <Link to="/engineering">
                  <Button size="lg" variant="secondary">
                    How it works
                  </Button>
                </Link>
              </div>
            </div>

            <div className="plate ticks rounded-[var(--radius-lg)]">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="flex items-center gap-2 text-xs text-secondary">
                  <span className="live-dot" />
                  Practice
                </span>
                <div
                  role="group"
                  aria-label="Sport"
                  className="flex rounded-[var(--radius-md)] bg-sunken p-0.5"
                >
                  {(['CRICKET', 'FOOTBALL'] as Sport[]).map((item) => (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={sport === item}
                      onClick={() => setSport(item)}
                      className={cn(
                        'h-6 rounded-[var(--radius-sm)] px-2.5 text-xs capitalize transition-colors',
                        sport === item
                          ? 'bg-raised font-medium text-primary shadow-sm'
                          : 'text-muted',
                      )}
                    >
                      {item.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 pt-6 pb-4">
                <p className="eyebrow">{sport === 'CRICKET' ? 'Riverside XI' : 'Home v Away'}</p>
                <p className="score-figure mt-1 text-[4rem] leading-none tracking-[-0.05em]">
                  {sport === 'CRICKET' ? (
                    <>
                      {runs}
                      <span className="text-muted">/0</span>
                    </>
                  ) : (
                    <>
                      {goals[0]}
                      <span className="px-2 text-muted">:</span>
                      {goals[1]}
                    </>
                  )}
                </p>
                <p className="tabular mt-2 text-xs text-muted">
                  {sport === 'CRICKET'
                    ? `${Math.floor(balls.length / 6)}.${balls.length % 6} ov`
                    : 'First half'}
                </p>
                {sport === 'CRICKET' ? (
                  <div className="mt-4 flex h-7 gap-1">
                    {balls.slice(-6).map((run, i) => (
                      <span
                        key={`${balls.length}-${i}`}
                        className={cn(
                          'tabular grid size-7 place-items-center rounded-[var(--radius-sm)] text-xs font-medium',
                          run >= 4 ? 'bg-accent-fill text-on-accent' : 'bg-sunken text-secondary',
                        )}
                      >
                        {run}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-line bg-sunken p-2">
                <div
                  className={cn('grid gap-1', sport === 'CRICKET' ? 'grid-cols-6' : 'grid-cols-2')}
                >
                  {sport === 'CRICKET'
                    ? [0, 1, 2, 3, 4, 6].map((run) => (
                        <button
                          type="button"
                          key={run}
                          onClick={() => setBalls((old) => [...old, run])}
                          aria-label={`${run} runs`}
                          className={cn(
                            'tabular h-11 rounded-[var(--radius-md)] border text-base font-medium transition-colors',
                            run >= 4
                              ? 'border-transparent bg-accent-fill text-on-accent hover:brightness-95'
                              : 'border-line bg-raised hover:bg-hover',
                          )}
                        >
                          {run}
                        </button>
                      ))
                    : ['Home', 'Away'].map((name, i) => (
                        <button
                          type="button"
                          key={name}
                          onClick={() =>
                            setGoals((old) => old.map((g, j) => g + (j === i ? 1 : 0)))
                          }
                          className="h-11 rounded-[var(--radius-md)] border border-line bg-raised text-[0.8125rem] font-medium hover:bg-hover"
                        >
                          {name} goal
                        </button>
                      ))}
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setBalls([]);
                      setGoals([0, 0]);
                    }}
                    className="h-7 px-2 text-xs text-muted hover:text-primary"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <ol className="grid border-x border-line sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="border-b border-line px-5 py-8 sm:border-b-0 sm:not-last:border-r"
              >
                <span className="tabular text-xs text-muted">0{index + 1}</span>
                <h2 className="mt-6 text-lg font-semibold tracking-[-0.02em]">{step.title}</h2>
                <p className="mt-1 text-[0.8125rem] text-secondary">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-5 text-xs text-muted sm:px-8">
          <Wordmark size="sm" />
          <span>Built by whynotramaa</span>
        </div>
      </footer>
    </div>
  );
}
