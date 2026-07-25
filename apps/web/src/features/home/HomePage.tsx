import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { BallChip } from '@/components/ui/Score';
import { TeamMark } from '@/components/ui/Pill';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Reveal } from '@/components/ui/Reveal';
import { ScrollProgress, ScrollReveal } from '@/components/ui/ScrollReveal';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Wordmark } from '@/components/Wordmark';
import { useAuth } from '@/features/auth/AuthProvider';

/*
 * The public front page.
 *
 * It is laid out as a spread rather than a funnel: a statement, a specimen of
 * the thing itself, then what it does, how it is used, and the rules the engine
 * actually enforces. The specimen card is the argument — it is the live view,
 * built from the same components against the same palette, so the page is not
 * describing the product, it is showing it.
 *
 * Motion is scroll-driven here and nowhere else in the product. On a front page
 * the reader is being shown around; on a scorecard they are trying to read.
 */

export function HomePage() {
  const { user } = useAuth();
  const home = user ? '/dashboard' : '/login';

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden">
      <ScrollProgress />

      <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-[80rem] items-center gap-6 px-5 sm:px-8 lg:px-12">
          <Wordmark />

          <nav aria-label="Sections" className="ml-8 hidden items-center gap-7 lg:flex">
            {SECTIONS.map((section) => (
              <a
                key={section.href}
                href={section.href}
                className="text-[0.8125rem] text-muted transition-colors hover:text-primary"
              >
                {section.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <ThemeToggle />
            <Link to={home}>
              <Button size="sm" variant={user ? 'primary' : 'secondary'}>
                {user ? 'Open dashboard' : 'Sign in'}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Hero home={home} signedIn={Boolean(user)} />
        <Capabilities />
        <HowItWorks />
        <Rules />
        <Closing home={home} signedIn={Boolean(user)} />
      </main>

      <SiteFooter />
    </div>
  );
}

const SECTIONS = [
  { href: '#what', label: 'What it does' },
  { href: '#how', label: 'How it works' },
  { href: '#rules', label: 'The laws' },
] as const;

// ─────────────────────────────────────────────────────────────────  hero ──

function Hero({ home, signedIn }: { home: string; signedIn: boolean }) {
  return (
    <section className="mx-auto w-full max-w-[80rem] px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28 lg:px-12">
      <div className="grid items-center gap-16 lg:grid-cols-[1.02fr_1fr] lg:gap-20">
        <div>
          <Reveal index={0}>
            <p className="eyebrow">Local cricket, kept properly</p>
          </Reveal>

          <Reveal index={1}>
            <h1 className="serif mt-7 text-[3.25rem] text-primary sm:text-[4.5rem] lg:text-[5rem]">
              Every ball,
              <br />
              <span className="italic">on the record.</span>
            </h1>
          </Reveal>

          <Reveal index={2}>
            <p className="mt-7 max-w-xl text-[1.0625rem] leading-relaxed text-secondary sm:text-lg">
              Run a tournament, score it from your phone at the ground, and share one link anyone
              can open — no login, no app, the current score the moment it loads.
            </p>
          </Reveal>

          <Reveal index={3}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to={home}>
                <Button size="lg">{signedIn ? 'Open your dashboard' : 'Start a tournament'}</Button>
              </Link>
              <a href="#what">
                <Button size="lg" variant="secondary">
                  See what it does
                </Button>
              </a>
            </div>
          </Reveal>

          <Reveal index={4}>
            <dl className="mt-14 grid max-w-lg grid-cols-3 gap-8 border-t border-line pt-8">
              {[
                { value: '11', label: 'Per side, enforced' },
                { value: '6', label: 'Legal balls an over' },
                { value: '0', label: 'Balls lost offline' },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="mono text-[1.75rem] leading-none font-medium text-primary">
                    {item.value}
                  </dt>
                  <dd className="eyebrow mt-2.5">{item.label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal index={2} step={90}>
          <SpecimenCard />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * A specimen of the live card. It is wrapped in `.live-stage`, so it inherits
 * the exact palette the real share link uses rather than approximating it — the
 * page is showing the product, and a mock that drifts from the thing it depicts
 * is worse than no mock.
 *
 * The figures are fixed and chosen to show the awkward cases at once: a chase in
 * progress, an over containing a wide and a wicket, and a bowler mid-spell.
 */
function SpecimenCard() {
  return (
    <div
      className="live-stage w-full max-w-[27rem] justify-self-end overflow-hidden rounded-[var(--radius-lg)] border border-line"
      style={{ '--team-a': '#1e40af', '--team-b': '#0f7a4a' } as React.CSSProperties}
    >
      <span aria-hidden className="live-stage-seam block" />

      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
        <p className="eyebrow">India v Pakistan · Innings 2</p>
        <span className="flex items-center gap-2 text-[0.6875rem] tracking-[0.16em] text-live uppercase">
          <span aria-hidden className="live-pulse size-1.5 rounded-full bg-current" />
          Live
        </span>
      </div>

      {/* Both sides, one above the other, the way a scoreboard at a ground
          lists them — the side batting carries the large figure. */}
      <div className="px-5 py-6 sm:px-6">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <TeamMark shortName="IND" color="#1e40af" size="sm" />
              <p className="text-[0.9375rem] text-secondary">India</p>
            </div>

            <p className="score-figure mt-3.5 flex items-baseline text-[3.75rem] text-primary">
              160
              <span aria-hidden className="mx-[0.05em] font-normal text-muted">
                /
              </span>
              <span className="text-muted">6</span>
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="mono text-xl font-medium text-primary">
              19.0<span className="text-[0.875rem] text-muted">/20</span>
            </p>
            <p className="eyebrow mt-2">Overs</p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2.5 border-t border-line pt-4">
          <TeamMark shortName="PAK" color="#0f7a4a" size="sm" />
          <p className="text-[0.9375rem] text-secondary">Pakistan</p>
          <span aria-hidden className="h-px flex-1 bg-line" />
          <p className="mono text-[0.9375rem] text-muted">187/5 (20)</p>
        </div>
      </div>

      <div className="border-t border-line px-5 py-5 sm:px-6">
        <p className="text-[1.0625rem] text-primary">
          Need <span className="mono font-medium">28</span> from{' '}
          <span className="mono font-medium">8</span> balls
        </p>
        <div className="chase-track mt-3.5">
          <span className="chase-fill" style={{ width: '85%' }} />
          <span aria-hidden className="chase-marker" style={{ left: '93%' }} />
        </div>
        <div className="mono mt-2.5 flex justify-between text-[0.6875rem] text-muted">
          <span>160 of 188</span>
          <span>RRR 21.00</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-line px-5 py-5 sm:px-6">
        {SPECIMEN_CREASE.map((batter) => (
          <div key={batter.name} className="flex items-center gap-3">
            <PlayerAvatar seed={batter.seed} name={batter.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-primary">
                {batter.name}
                {batter.onStrike ? (
                  <span className="mono text-[0.625rem] text-accent">● striker</span>
                ) : null}
              </p>
            </div>
            <p className="mono shrink-0 text-sm text-primary">
              {batter.runs}
              <span className="ml-1 text-[0.75rem] text-muted">({batter.balls})</span>
            </p>
          </div>
        ))}

        <div className="border-t border-line pt-4">
          <p className="eyebrow mb-3">This over</p>
          <div className="flex flex-wrap items-center gap-2">
            {SPECIMEN_OVER.map((ball, index) => (
              <BallChip key={index} display={ball} isWicket={ball === 'W'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const SPECIMEN_CREASE = [
  { seed: 'virat-kohli', name: 'Virat Kohli', runs: 82, balls: 53, onStrike: true },
  { seed: 'hardik-pandya', name: 'Hardik Pandya', runs: 40, balls: 37, onStrike: false },
] as const;

const SPECIMEN_OVER = ['1', '4', 'wd', '0', 'W'] as const;

// ────────────────────────────────────────────────────────  capabilities ──

/**
 * A bento grid rather than three equal cards. The blocks are different sizes
 * because the things they describe are different sizes — the scorer's console
 * is the product, and the export is a footnote.
 */
function Capabilities() {
  return (
    <section
      id="what"
      className="mx-auto w-full max-w-[80rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
    >
      <ScrollReveal>
        <p className="eyebrow">What it does</p>
        <h2 className="serif mt-5 max-w-3xl text-[2.25rem] text-primary sm:text-[3rem]">
          A season's worth of admin, done between deliveries.
        </h2>
      </ScrollReveal>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        <ScrollReveal index={0} className="md:col-span-2">
          <article className="bento-tile flex h-full flex-col justify-between gap-10 rounded-[var(--radius-lg)] border border-line bg-raised p-8 sm:p-10">
            <div>
              <p className="mono text-[0.6875rem] tracking-[0.16em] text-accent uppercase">
                The console
              </p>
              <h3 className="serif mt-4 text-[1.75rem] text-primary sm:text-[2rem]">
                Score a whole match with one thumb.
              </h3>
              <p className="mt-4 max-w-lg text-secondary">
                Runs, extras, wickets and corrections are one tap each. The engine rotates the
                strike, ends the over, ends the innings and sets the target without being asked.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {['0', '1', '2', '4', '6', 'wd', 'nb', 'W'].map((ball) => (
                <BallChip key={ball} display={ball} isWicket={ball === 'W'} />
              ))}
            </div>
          </article>
        </ScrollReveal>

        <ScrollReveal index={1}>
          <article className="bento-tile flex h-full flex-col justify-between gap-8 rounded-[var(--radius-lg)] border border-line bg-inverse p-8">
            <div>
              <p className="mono text-[0.6875rem] tracking-[0.16em] text-accent uppercase">
                The share link
              </p>
              <h3 className="serif mt-4 text-2xl text-on-inverse">One URL. No login, no app.</h3>
              <p className="mt-3.5 text-[0.9375rem] text-muted-on-inverse">
                Paste it into the group chat. It opens on the current score, mid-over, and updates
                itself from there.
              </p>
            </div>

            <p className="mono truncate text-[0.75rem] text-accent">howzat.app/live/…</p>
          </article>
        </ScrollReveal>

        {SMALL_TILES.map((tile, index) => (
          <ScrollReveal key={tile.title} index={index + 2}>
            <article className="bento-tile flex h-full flex-col gap-3.5 rounded-[var(--radius-lg)] border border-line bg-raised p-7">
              <span className="mono text-[0.6875rem] tracking-[0.16em] text-accent uppercase">
                {tile.kicker}
              </span>
              <h3 className="serif text-xl text-primary">{tile.title}</h3>
              <p className="text-[0.9375rem] text-secondary">{tile.body}</p>
            </article>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}

const SMALL_TILES = [
  {
    kicker: 'Fixtures',
    title: 'The draw writes itself',
    body: 'Every pair meets exactly once — or twice, home and away — by the circle method. Playoff slots fill as their feeder matches finish.',
  },
  {
    kicker: 'The table',
    title: 'Points and NRR, recomputed',
    body: 'The table is rebuilt from the log on every result, never incremented. Every input to the net run rate is shown alongside it.',
  },
  {
    kicker: 'Profiles',
    title: 'A career, not a spreadsheet',
    body: 'Add a player by their handle and every run, wicket and catch lands on their record — across every team they ever turn out for.',
  },
] as const;

// ──────────────────────────────────────────────────────────────  how it ──

function HowItWorks() {
  return (
    <section id="how" className="border-y border-line bg-sunken/40">
      <div className="mx-auto w-full max-w-[80rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <ScrollReveal>
          <p className="eyebrow">How it works</p>
          <h2 className="serif mt-5 max-w-2xl text-[2.25rem] text-primary sm:text-[3rem]">
            Three people, one match, no paperwork afterwards.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line md:grid-cols-3">
          {STEPS.map((step, index) => (
            <ScrollReveal key={step.title} index={index} className="bg-raised p-8 sm:p-10">
              <div className="flex items-baseline gap-3">
                <p className="mono text-sm text-accent">{step.number}</p>
                <span aria-hidden className="h-px flex-1 bg-[var(--accent-line)]" />
              </div>
              <h3 className="serif mt-6 text-2xl text-primary">{step.title}</h3>
              <p className="mt-3.5 text-secondary">{step.body}</p>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    number: '01',
    title: 'Register the teams',
    body: 'Name your sides, give each one eleven players, and generate the fixtures. Anyone with a Howzat handle is added by handle — and told about it.',
  },
  {
    number: '02',
    title: 'Score from the ground',
    body: 'Assign a scorer. They tap runs, extras and wickets on their phone between deliveries, one-handed, and it holds up when the signal does not.',
  },
  {
    number: '03',
    title: 'Share one link',
    body: 'The public card shows the current score the instant it opens, mid-match, with no login. The points table updates itself when a result lands.',
  },
] as const;

// ───────────────────────────────────────────────────────────────  rules ──

function Rules() {
  return (
    <section
      id="rules"
      className="mx-auto w-full max-w-[80rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
    >
      <div className="grid gap-14 lg:grid-cols-[0.82fr_1fr] lg:gap-24">
        <ScrollReveal>
          <div className="lg:sticky lg:top-32">
            <p className="eyebrow">Correctness</p>
            <h2 className="serif mt-5 text-[2.25rem] text-primary sm:text-[2.75rem]">
              The rules a scorebook gets wrong.
            </h2>
            <p className="mt-5 text-secondary">
              A wide is not a ball. A leg bye is not a run to the batter. A side bowled out inside
              its quota is still charged the full quota on net run rate. Every one of those is a
              place a spreadsheet quietly lies to you.
            </p>
            <p className="mt-6 text-[0.9375rem] text-muted">
              All four are covered by tests, not by good intentions.
            </p>
          </div>
        </ScrollReveal>

        <ul className="landing-ledger flex flex-col pl-8">
          {RULES.map((rule, index) => (
            <ScrollReveal
              key={rule.title}
              index={index}
              step={60}
              shift={12}
              as="li"
              className="relative border-b border-line py-7 first:pt-0 last:border-0"
            >
              <span
                aria-hidden
                className="absolute top-9 -left-8 h-px w-5 bg-[var(--accent-line)] first:top-2"
              />
              <p className="mono text-[0.6875rem] text-accent">
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="mt-3 text-[1.0625rem] font-medium text-primary">{rule.title}</p>
              <p className="mt-2 text-secondary">{rule.body}</p>
            </ScrollReveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const RULES = [
  {
    title: 'Extras counted the way the laws count them',
    body: 'Wides and no-balls do not advance the over. Byes and leg byes do, and go to the side rather than the batter.',
  },
  {
    title: 'Strike rotation you never have to think about',
    body: 'Odd runs swap the ends, the over-end swaps them back, and a new batter walks in on strike.',
  },
  {
    title: 'Net run rate with the bowled-out rule',
    body: 'A side dismissed inside its quota is charged the full quota. A successful chase is charged only the overs it faced.',
  },
  {
    title: 'Corrections that never rewrite history',
    body: 'A mistaken ball is superseded, not deleted. The original entry stays in the log, and a referee can audit every change.',
  },
] as const;

// ─────────────────────────────────────────────────────────────  closing ──

function Closing({ home, signedIn }: { home: string; signedIn: boolean }) {
  return (
    <section className="mx-auto w-full max-w-[80rem] px-5 pb-24 sm:px-8 lg:px-12">
      <ScrollReveal shift={24}>
        <div className="rounded-[var(--radius-lg)] bg-inverse px-8 py-16 sm:px-14 sm:py-20">
          <div className="flex flex-col items-start gap-9 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="serif max-w-xl text-[2.25rem] text-on-inverse sm:text-[3rem]">
                Open a scorebook for your league.
              </h2>
              <p className="mt-5 max-w-lg text-muted-on-inverse">
                Register your teams, generate the fixtures, hand a scorer the link. It takes about
                ten minutes.
              </p>
            </div>

            <Link to={home} className="shrink-0">
              {/* On ink, the primary slab would be invisible — so the button here
                  inverts with the surface it sits on. */}
              <span className="inline-flex h-[3.5rem] items-center rounded-[var(--radius-sm)] border border-[var(--accent)]/45 px-8 text-[0.9375rem] font-medium text-on-inverse transition-colors hover:bg-white/5">
                {signedIn ? 'Open your dashboard' : 'Create your account'} →
              </span>
            </Link>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-[80rem] px-5 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Wordmark />
            <p className="mt-4 max-w-xs text-[0.9375rem] text-secondary">
              Local cricket, kept properly. Built for grounds with bad signal and long memories.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="eyebrow">{column.title}</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-[0.9375rem] text-secondary transition-colors hover:text-primary"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-7">
          <p className="text-[0.8125rem] text-muted">© {new Date().getFullYear()} Howzat</p>
          <p className="eyebrow">Every ball on the record</p>
        </div>
      </div>
    </footer>
  );
}

const FOOTER_COLUMNS = [
  {
    title: 'The product',
    items: [
      { label: 'What it does', href: '#what' },
      { label: 'How it works', href: '#how' },
      { label: 'The laws it enforces', href: '#rules' },
    ],
  },
  {
    title: 'Get started',
    items: [
      { label: 'Create an account', href: '/login' },
      { label: 'Sign in', href: '/login' },
    ],
  },
] as const;
