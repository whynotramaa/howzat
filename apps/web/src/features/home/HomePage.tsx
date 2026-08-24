import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Sport } from '@howzat/shared';
import { Button } from '@/components/ui/Button';
import { FootballAvatar } from '@/components/ui/FootballAvatar';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { TeamMark } from '@/components/ui/Pill';
import { Reveal } from '@/components/ui/Reveal';
import { BallChip } from '@/components/ui/Score';
import { ScrollProgress, ScrollReveal } from '@/components/ui/ScrollReveal';
import { SportMark } from '@/components/ui/SportMark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Wordmark } from '@/components/Wordmark';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';

/*
 * The front page.
 *
 * One idea carries it: the product scores two sports, so the page is built
 * around a single working scoreboard that switches between them. Everything
 * below is a ledger — hairlines and figures, no cards floating over cards.
 */
export function HomePage() {
  const { user } = useAuth();
  const [sport, setSport] = useState<Sport>('CRICKET');
  const home = user ? '/dashboard' : '/login';

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden">
      <ScrollProgress />

      <TopRail signedIn={Boolean(user)} home={home} />

      <main className="flex-1">
        <Opening sport={sport} onSport={setSport} home={home} signedIn={Boolean(user)} />
        <FiguresRail />
        <TwoSports sport={sport} onSport={setSport} />
        <ShareBand />
        <Flow />
        <Laws />
        <Closing home={home} signedIn={Boolean(user)} />
      </main>

      <SiteFooter />
    </div>
  );
}

const SECTIONS = [
  { href: '#sports', label: 'Two sports' },
  { href: '#link', label: 'The link' },
  { href: '#flow', label: 'The flow' },
  { href: '#laws', label: 'The laws' },
] as const;

function TopRail({ signedIn, home }: { signedIn: boolean; home: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--surface)_84%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[76rem] items-center gap-4 px-5 sm:px-8 lg:px-12">
        <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-70">
          <Wordmark size="sm" />
          <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
          <span className="eyebrow hidden sm:block">Cricket &amp; football</span>
        </Link>

        <nav aria-label="Sections" className="ml-auto hidden items-center gap-7 md:flex">
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

        <div className="ml-auto flex items-center gap-3 md:ml-7">
          <ThemeToggle />
          <Link to={home}>
            <Button size="sm" variant={signedIn ? 'primary' : 'secondary'}>
              {signedIn ? 'Dashboard' : 'Sign in'}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ── The opening ─────────────────────────────────────────────────────────── */

function Opening({
  sport,
  onSport,
  home,
  signedIn,
}: {
  sport: Sport;
  onSport: (sport: Sport) => void;
  home: string;
  signedIn: boolean;
}) {
  const cricket = sport === 'CRICKET';

  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <span aria-hidden className="field-rules" />

      <div className="relative mx-auto w-full max-w-[76rem] px-5 pt-16 pb-14 sm:px-8 sm:pt-24 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal index={0}>
            <p className="eyebrow">Local leagues, scored properly</p>
          </Reveal>

          <Reveal index={1}>
            <h1 className="serif mt-6 text-[3rem] text-primary sm:text-[4.25rem] lg:text-[5rem]">
              {cricket ? 'Every ball' : 'Every minute'}
              <span className="italic">, on the record.</span>
            </h1>
          </Reveal>

          <Reveal index={2}>
            <p className="mx-auto mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-secondary sm:text-lg">
              Run the tournament, score the match from your phone at the ground, and share one link
              anyone can open — no account, no app, the live score the moment it loads.
            </p>
          </Reveal>

          <Reveal index={3}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to={home}>
                <Button size="lg">{signedIn ? 'Open your dashboard' : 'Start a tournament'}</Button>
              </Link>
              <a href="#sports">
                <Button size="lg" variant="secondary">
                  See both sports
                </Button>
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal index={4}>
          <div className="mt-14 flex justify-center">
            <SportSwitch sport={sport} onSport={onSport} />
          </div>
        </Reveal>

        <Reveal index={5}>
          <div className="mt-6">{cricket ? <CricketBoard /> : <FootballBoard />}</div>
        </Reveal>

        <Reveal index={6}>
          <p className="mt-5 text-center text-[0.8125rem] text-muted">
            A live share link, as a spectator sees it.{' '}
            {cricket
              ? 'Watch the wide: the chips grow, the over does not.'
              : 'The clock carries its own stoppage time.'}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function SportSwitch({ sport, onSport }: { sport: Sport; onSport: (sport: Sport) => void }) {
  const options: ReadonlyArray<{ value: Sport; label: string }> = [
    { value: 'CRICKET', label: 'Cricket' },
    { value: 'FOOTBALL', label: 'Football' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Sport shown on the scoreboard"
      className="inline-flex items-center gap-1 rounded-full border border-line bg-raised p-1"
    >
      {options.map((option) => {
        const active = sport === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSport(option.value)}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-[0.8125rem] font-medium',
              'transition-colors duration-[var(--dur-fast)]',
              active
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:bg-hover hover:text-secondary',
            )}
          >
            <SportMark sport={option.value} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── The demo board ──────────────────────────────────────────────────────── */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Steps through a scripted sequence of scoreboard frames. Reduced motion holds
 * the last frame, so the board is still a finished scoreboard and never blank.
 */
function useFrame(length: number, everyMs: number): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setIndex(length - 1);
      return;
    }

    const id = window.setInterval(() => setIndex((current) => (current + 1) % length), everyMs);
    return () => window.clearInterval(id);
  }, [length, everyMs]);

  return index;
}

function BoardFrame({
  label,
  teamA,
  teamB,
  ariaLabel,
  children,
}: {
  label: string;
  teamA: string;
  teamB: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="live-stage mx-auto w-full max-w-[64rem] overflow-hidden rounded-[var(--radius-xl)] border border-line"
      style={{ '--team-a': teamA, '--team-b': teamB } as React.CSSProperties}
    >
      <span aria-hidden className="live-stage-seam block" />

      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 sm:px-7">
        <p className="eyebrow truncate">{label}</p>
        <div className="flex shrink-0 items-center gap-4">
          <span className="mono hidden text-[0.6875rem] text-muted sm:block">1,284 watching</span>
          <span className="flex items-center gap-2 text-[0.6875rem] tracking-[0.16em] text-live uppercase">
            <span aria-hidden className="live-pulse size-1.5 rounded-full bg-current" />
            Live
          </span>
        </div>
      </div>

      {children}
    </div>
  );
}

const CHASE_TARGET = 188;

interface CricketFrame {
  runs: number;
  overs: string;
  over: string[];
  need: { runs: number; balls: number };
  bat: ReadonlyArray<{ runs: number; balls: number }>;
  striker: 0 | 1;
}

const CRICKET_FRAMES: readonly CricketFrame[] = [
  {
    runs: 174,
    overs: '19.0',
    over: [],
    need: { runs: 14, balls: 6 },
    bat: [
      { runs: 88, balls: 52 },
      { runs: 41, balls: 34 },
    ],
    striker: 0,
  },
  {
    runs: 178,
    overs: '19.1',
    over: ['4'],
    need: { runs: 10, balls: 5 },
    bat: [
      { runs: 92, balls: 53 },
      { runs: 41, balls: 34 },
    ],
    striker: 0,
  },
  {
    // A single rotates the strike, so the other batter is on for the next ball.
    runs: 179,
    overs: '19.2',
    over: ['4', '1'],
    need: { runs: 9, balls: 4 },
    bat: [
      { runs: 93, balls: 54 },
      { runs: 41, balls: 34 },
    ],
    striker: 1,
  },
  {
    // The wide: a run is added, the over does not advance, nobody faced a ball.
    runs: 180,
    overs: '19.2',
    over: ['4', '1', 'wd'],
    need: { runs: 8, balls: 4 },
    bat: [
      { runs: 93, balls: 54 },
      { runs: 41, balls: 34 },
    ],
    striker: 1,
  },
  {
    runs: 186,
    overs: '19.3',
    over: ['4', '1', 'wd', '6'],
    need: { runs: 2, balls: 3 },
    bat: [
      { runs: 93, balls: 54 },
      { runs: 47, balls: 35 },
    ],
    striker: 1,
  },
  {
    runs: 187,
    overs: '19.4',
    over: ['4', '1', 'wd', '6', '1'],
    need: { runs: 1, balls: 2 },
    bat: [
      { runs: 93, balls: 54 },
      { runs: 48, balls: 36 },
    ],
    striker: 0,
  },
];

const CRICKET_BATTERS = [
  { seed: 'a-rane', name: 'S. Srivastava' },
  { seed: 'k-mistry', name: 'Umang' },
] as const;

function CricketBoard() {
  const index = useFrame(CRICKET_FRAMES.length, 2200);
  const frame = CRICKET_FRAMES[index]!;

  const ballsBowled = 114 + frame.over.filter((ball) => !/[a-z]/.test(ball)).length;
  const runFraction = Math.min(1, frame.runs / CHASE_TARGET);
  const ballFraction = Math.min(1, ballsBowled / (ballsBowled + frame.need.balls));

  return (
    <BoardFrame
      label="Kohli XI v Srivastava XI · Final"
      teamA="#1e5fae"
      teamB="#0f7a4a"
      ariaLabel={`Example cricket scoreboard: Kohli XI ${frame.runs} for 6 after ${frame.overs} overs, chasing ${CHASE_TARGET}`}
    >
      <div className="grid sm:grid-cols-[1.25fr_1fr]">
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex items-center gap-2.5">
            <TeamMark shortName="SPX" color="#1e5fae" size="sm" />
            <p className="text-[0.9375rem] text-secondary">Kohli XI</p>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
            <p className="score-figure flex items-baseline text-[3.5rem] text-primary sm:text-[4.5rem]">
              <span key={frame.runs} className="figure-in">
                {frame.runs}
              </span>
              <span aria-hidden className="mx-[0.05em] font-normal text-muted">
                /
              </span>
              <span className="text-muted">6</span>
            </p>

            <div className="pb-2">
              <p className="mono text-lg font-medium text-primary">
                <span key={frame.overs} className="figure-in inline-block">
                  {frame.overs}
                </span>
                <span className="text-[0.875rem] text-muted">/20</span>
              </p>
              <p className="eyebrow mt-2">Overs</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2.5 border-t border-line pt-4">
            <TeamMark shortName="DDU" color="#0f7a4a" size="sm" />
            <p className="text-[0.9375rem] text-secondary">Srivastava XI</p>
            <span aria-hidden className="h-px flex-1 bg-line" />
            <p className="mono text-[0.9375rem] text-muted">187/5 (20)</p>
          </div>

          <div className="mt-6">
            <p className="text-[1.0625rem] text-primary">
              Need <span className="mono font-medium">{frame.need.runs}</span> from{' '}
              <span className="mono font-medium">{frame.need.balls}</span>{' '}
              {frame.need.balls === 1 ? 'ball' : 'balls'}
            </p>

            <div className="chase-track mt-3.5">
              <span className="chase-fill" style={{ width: `${runFraction * 100}%` }} />
              <span
                aria-hidden
                className="chase-marker"
                style={{ left: `${ballFraction * 100}%` }}
              />
            </div>

            <div className="mono mt-2.5 flex justify-between text-[0.6875rem] text-muted">
              <span>
                {frame.runs} of {CHASE_TARGET}
              </span>
              <span>RRR {((frame.need.runs / frame.need.balls) * 6).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 border-t border-line px-5 py-6 sm:border-t-0 sm:border-l sm:px-7 sm:py-7">
          <p className="eyebrow">At the crease</p>

          {CRICKET_BATTERS.map((batter, seat) => (
            <div key={batter.seed} className="flex items-center gap-3">
              <PlayerAvatar seed={batter.seed} name={batter.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-primary">
                  {batter.name}
                  {frame.striker === seat ? (
                    <span className="mono text-[0.625rem] text-accent">● striker</span>
                  ) : null}
                </p>
              </div>
              <p className="mono shrink-0 text-sm text-primary">
                {frame.bat[seat]!.runs}
                <span className="ml-1 text-[0.75rem] text-muted">({frame.bat[seat]!.balls})</span>
              </p>
            </div>
          ))}

          <div className="flex items-center gap-3 border-t border-line pt-5">
            <PlayerAvatar seed="d-fernandes" name="D. Fernandes" size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary">M.S. Dhoni</p>
              <p className="text-[0.75rem] text-muted">Bowling</p>
            </div>
            <p className="mono shrink-0 text-sm text-primary">
              2/34
              <span className="ml-1 text-[0.75rem] text-muted">(3.4)</span>
            </p>
          </div>

          <div className="mt-auto border-t border-line pt-5">
            <p className="eyebrow mb-3">This over</p>
            <div className="flex min-h-9 flex-wrap items-center gap-2">
              {frame.over.length === 0 ? (
                <p className="text-sm text-muted">New over.</p>
              ) : (
                frame.over.map((ball, ballIndex) => (
                  <span
                    key={ballIndex}
                    className={cn(ballIndex === frame.over.length - 1 && 'chip-in')}
                  >
                    <BallChip display={ball} />
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </BoardFrame>
  );
}

type IncidentKind = 'GOAL' | 'YELLOW' | 'RED' | 'SAVE' | 'SUB';

interface Incident {
  minute: string;
  kind: IncidentKind;
  player: string;
  detail: string;
  side: 'HOME' | 'AWAY';
}

const INCIDENTS: readonly Incident[] = [
  { minute: "12'", kind: 'GOAL', player: 'T. Okafor', detail: 'assist D. Mehra', side: 'HOME' },
  { minute: "41'", kind: 'YELLOW', player: 'R. Banik', detail: 'dissent', side: 'AWAY' },
  { minute: "55'", kind: 'GOAL', player: 'M. Silva', detail: 'assist R. Banik', side: 'AWAY' },
  { minute: "71'", kind: 'GOAL', player: 'T. Okafor', detail: 'assist J. Adeyemi', side: 'HOME' },
  { minute: "79'", kind: 'SUB', player: 'J. Adeyemi', detail: 'off for S. Kapadia', side: 'HOME' },
  { minute: "81'", kind: 'SAVE', player: 'V. Nair', detail: 'one on one', side: 'AWAY' },
  { minute: "84'", kind: 'GOAL', player: 'S. Kapadia', detail: 'assist T. Okafor', side: 'HOME' },
  { minute: "88'", kind: 'RED', player: 'R. Banik', detail: 'second yellow', side: 'AWAY' },
];

interface FootballFrame {
  clock: string;
  minute: number;
  home: number;
  away: number;
  through: number;
  stoppage?: string;
}

const FOOTBALL_FRAMES: readonly FootballFrame[] = [
  { clock: '76:12', minute: 76, home: 2, away: 1, through: 4 },
  { clock: '79:08', minute: 79, home: 2, away: 1, through: 5 },
  { clock: '81:44', minute: 81, home: 2, away: 1, through: 6 },
  { clock: '84:26', minute: 84, home: 3, away: 1, through: 7 },
  { clock: '88:03', minute: 88, home: 3, away: 1, through: 8 },
  { clock: '90:00', minute: 90, home: 3, away: 1, through: 8, stoppage: '+4 added' },
];

const INCIDENT_TONE: Record<IncidentKind, string> = {
  GOAL: 'bg-[var(--accent-strong)]',
  YELLOW: 'bg-[var(--warning)]',
  RED: 'bg-[var(--live)]',
  SAVE: 'bg-[var(--success)]',
  SUB: 'bg-[var(--line-strong)]',
};

const INCIDENT_LABEL: Record<IncidentKind, string> = {
  GOAL: 'Goal',
  YELLOW: 'Yellow card',
  RED: 'Red card',
  SAVE: 'Save',
  SUB: 'Substitution',
};

function FootballBoard() {
  const index = useFrame(FOOTBALL_FRAMES.length, 2200);
  const frame = FOOTBALL_FRAMES[index]!;
  const shown = INCIDENTS.slice(0, frame.through).slice(-4);

  return (
    <BoardFrame
      label="Man Utd. v Man City · Semi-final"
      teamA="#7a2f2a"
      teamB="#2c5f4a"
      ariaLabel={`Example football scoreboard: Man Utd. ${frame.home}, Dock Road ${frame.away}, ${frame.clock} played`}
    >
      <div className="grid sm:grid-cols-[1.25fr_1fr]">
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex min-w-0 flex-col items-start gap-2.5">
              <TeamMark shortName="HIL" color="#7a2f2a" size="sm" />
              <p className="truncate text-[0.9375rem] text-secondary">Man Utd.</p>
            </div>

            <p className="score-figure flex shrink-0 items-baseline text-[3.5rem] text-primary sm:text-[4.5rem]">
              <span key={`h-${frame.home}`} className="figure-in">
                {frame.home}
              </span>
              <span aria-hidden className="mx-[0.12em] font-normal text-muted">
                –
              </span>
              <span key={`a-${frame.away}`} className="figure-in">
                {frame.away}
              </span>
            </p>

            <div className="flex min-w-0 flex-col items-end gap-2.5">
              <TeamMark shortName="DRF" color="#2c5f4a" size="sm" />
              <p className="truncate text-[0.9375rem] text-secondary">Man City</p>
            </div>
          </div>

          <div className="mt-7 border-t border-line pt-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="clock-digits text-[2rem] text-primary">
                {frame.clock.split(':')[0]}
                <span className="clock-colon mx-0.5">:</span>
                {frame.clock.split(':')[1]}
              </p>
              <p className="mono text-[0.6875rem] text-muted">
                {frame.stoppage ?? 'Second half · 90 minutes'}
              </p>
            </div>

            <div className="clock-track mt-4">
              <span
                className="clock-fill"
                style={{
                  width: `${Math.min(100, (frame.minute / 90) * 100)}%`,
                  transition: 'width var(--dur-gauge) var(--ease)',
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col border-t border-line px-5 py-6 sm:border-t-0 sm:border-l sm:px-7 sm:py-7">
          <p className="eyebrow mb-4">Timeline</p>

          <ul className="flex flex-col gap-3.5">
            {shown.map((incident, position) => (
              <li
                key={incident.minute}
                className={cn(
                  'flex items-center gap-3',
                  position === shown.length - 1 && 'chip-in',
                )}
              >
                <FootballAvatar
                  seed={incident.player}
                  name={incident.player}
                  size="xs"
                  color={incident.side === 'HOME' ? '#7a2f2a' : '#2c5f4a'}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{incident.player}</p>
                  <p className="truncate text-[0.75rem] text-muted">
                    {INCIDENT_LABEL[incident.kind]} · {incident.detail}
                  </p>
                </div>

                <span className="flex shrink-0 items-center gap-2">
                  <span
                    aria-hidden
                    className={cn('size-2 rounded-[1px]', INCIDENT_TONE[incident.kind])}
                  />
                  <span className="mono text-[0.75rem] text-secondary">{incident.minute}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </BoardFrame>
  );
}

/* ── The rail of figures ─────────────────────────────────────────────────── */

const FIGURES = [
  { value: '2', label: 'Sports, one event log' },
  { value: '0', label: 'Logins to watch' },
  { value: '6', label: 'Legal balls an over' },
  { value: '90+', label: 'Minutes, stoppage carried' },
] as const;

function FiguresRail() {
  return (
    <section className="border-b border-line bg-sunken/40">
      <dl className="mx-auto grid w-full max-w-[76rem] grid-cols-2 sm:grid-cols-4">
        {FIGURES.map((figure, index) => (
          <ScrollReveal
            key={figure.label}
            index={index}
            step={50}
            className={cn(
              'px-5 py-8 sm:px-8 lg:px-12',
              index % 2 === 0 && 'border-r border-line',
              index < 2 && 'border-b border-line sm:border-b-0',
              index === 1 && 'sm:border-r sm:border-line',
            )}
          >
            <dt className="mono text-[2rem] leading-none font-medium text-primary">
              {figure.value}
            </dt>
            <dd className="eyebrow mt-3 leading-[1.5]">{figure.label}</dd>
          </ScrollReveal>
        ))}
      </dl>
    </section>
  );
}

/* ── The two sports ──────────────────────────────────────────────────────── */

const SPORT_COLUMNS: ReadonlyArray<{
  sport: Sport;
  title: string;
  summary: string;
  items: readonly string[];
}> = [
    {
      sport: 'CRICKET',
      title: 'Cricket, ball by ball',
      summary:
        'The console the scorer holds at the ground, and the engine that keeps the book honest behind it.',
      items: [
        'Runs, extras, wickets and corrections — one tap each',
        'Strike rotation, over ends and innings ends without being asked',
        'DLS par and revised targets when the rain arrives',
        'A points table rebuilt from the log, net run rate included',
        'Fixtures by the circle method, with playoff slots that fill themselves',
      ],
    },
    {
      sport: 'FOOTBALL',
      title: 'Football, minute by minute',
      summary:
        'The same event log, a different set of laws — and a clock that a scorer can actually run from the touchline.',
      items: [
        'Goals, own goals, assists, saves, yellows and reds',
        'A match clock with your own periods, breaks and stoppage',
        'Substitutions capped by the limit set at kick off',
        'Lineups on the pitch, with the bench beside them',
        'A minute-by-minute timeline, and a PDF when it is over',
      ],
    },
  ];

function TwoSports({ sport, onSport }: { sport: Sport; onSport: (sport: Sport) => void }) {
  return (
    <section
      id="sports"
      className="mx-auto w-full max-w-[76rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
    >
      <ScrollReveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Two sports</p>
            <h2 className="serif mt-5 max-w-2xl text-[2.25rem] text-primary sm:text-[3rem]">
              One append-only log. Two sets of laws on top of it.
            </h2>
          </div>
          <p className="max-w-sm text-[0.9375rem] text-secondary">
            Nothing is stored twice. A match is a stream of events, and each sport is the rules that
            decide which events are legal.
          </p>
        </div>
      </ScrollReveal>

      <div className="mt-14 grid gap-4 lg:grid-cols-2">
        {SPORT_COLUMNS.map((column, index) => {
          const selected = sport === column.sport;

          return (
            <ScrollReveal key={column.sport} index={index}>
              <button
                type="button"
                onClick={() => onSport(column.sport)}
                data-selected={selected}
                aria-pressed={selected}
                className={cn(
                  'sport-column flex h-full w-full flex-col rounded-[var(--radius-lg)] border p-8 text-left sm:p-10',
                  selected
                    ? 'border-[var(--accent-line)] bg-raised'
                    : 'border-line bg-[var(--surface)]',
                )}
              >
                <span className="flex items-center gap-2.5 text-accent">
                  <SportMark sport={column.sport} />
                  <span className="mono text-[0.6875rem] tracking-[0.16em] uppercase">
                    {column.sport === 'CRICKET' ? 'Cricket' : 'Football'}
                  </span>
                  <span className="ml-auto text-[0.6875rem] tracking-[0.16em] text-muted uppercase">
                    {selected ? 'On the board' : 'Show on the board'}
                  </span>
                </span>

                <h3 className="serif mt-5 text-[1.75rem] text-primary">{column.title}</h3>
                <p className="mt-3.5 text-secondary">{column.summary}</p>

                <ul className="mt-8 flex flex-col border-t border-line">
                  {column.items.map((item) => (
                    <li
                      key={item}
                      className="ledger-row border-b border-line py-3.5 text-[0.9375rem] text-secondary last:border-0"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </button>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}

/* ── The share link ──────────────────────────────────────────────────────── */

const LINK_NOTES = [
  {
    title: 'Opens on the current score',
    body: 'Mid-over, mid-half, whenever it is tapped. There is no loading screen to sit through and nothing to catch up on.',
  },
  {
    title: 'Keeps itself up to date',
    body: 'Every change arrives over a websocket carrying the whole score, so a dropped message repairs itself on the next one.',
  },
  {
    title: 'Ends as a scorecard',
    body: 'When the result lands the same link becomes the full card — and a PDF, if somebody wants it on paper.',
  },
] as const;

function ShareBand() {
  return (
    <section id="link" className="border-y border-line bg-sunken/40">
      <div className="mx-auto grid w-full max-w-[76rem] gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.9fr_1fr] lg:gap-20 lg:px-12">
        <ScrollReveal>
          <p className="eyebrow">The share link</p>
          <h2 className="serif mt-5 text-[2.25rem] text-primary sm:text-[3rem]">
            One URL. No account, no install.
          </h2>
          <p className="mt-6 max-w-lg text-secondary">
            The people who actually want the score are a parent at work or a teammate on a bus.
            Anything between them and the number loses them, so there is nothing between them and
            the number.
          </p>

          <div className="mt-8 flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-raised px-4 py-3">
            <span aria-hidden className="live-pulse size-1.5 shrink-0 rounded-full bg-live" />
            <p className="mono truncate text-[0.8125rem] text-secondary">
              howzat.app/live/<span className="text-accent">k3n8-qv2p</span>
            </p>
            <span className="mono ml-auto shrink-0 text-[0.6875rem] text-muted">no login</span>
          </div>
        </ScrollReveal>

        <ul className="flex flex-col">
          {LINK_NOTES.map((note, index) => (
            <ScrollReveal
              key={note.title}
              index={index}
              step={60}
              as="li"
              className="ledger-row border-t border-line py-7 first:border-t-0 first:pt-0"
            >
              <p className="mono text-[0.6875rem] text-accent">
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="mt-3 text-[1.0625rem] font-medium text-primary">{note.title}</p>
              <p className="mt-2 max-w-md text-secondary">{note.body}</p>
            </ScrollReveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── The flow ────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    number: '01',
    title: 'Register the sides',
    body: 'Name the teams, fill the squads, pick cricket or football. Anyone with a Howzat handle is added by handle and told about it.',
  },
  {
    number: '02',
    title: 'Generate the fixtures',
    body: 'Every pair meets once, or twice home and away. Playoff slots stay empty until their feeder matches finish, then fill themselves.',
  },
  {
    number: '03',
    title: 'Hand a scorer the console',
    body: 'They score from the touchline on a phone. When the signal at the ground goes, the balls queue on the device and go up in order.',
  },
  {
    number: '04',
    title: 'Share the link, forget the table',
    body: 'Spectators watch live with no account. The points table and every career profile recompute themselves when the result lands.',
  },
] as const;

function Flow() {
  return (
    <section
      id="flow"
      className="mx-auto w-full max-w-[76rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
    >
      <ScrollReveal>
        <p className="eyebrow">The flow</p>
        <h2 className="serif mt-5 max-w-2xl text-[2.25rem] text-primary sm:text-[3rem]">
          A season, from a team sheet to a trophy.
        </h2>
      </ScrollReveal>

      <ol className="flow-rail mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {STEPS.map((step, index) => (
          <ScrollReveal key={step.number} index={index} as="li" className="relative">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-3.5 shrink-0 rounded-full border border-[var(--accent-line)] bg-[var(--surface)]"
              />
              <span className="mono text-sm text-accent">{step.number}</span>
            </div>

            <h3 className="serif mt-6 text-xl text-primary">{step.title}</h3>
            <p className="mt-3 text-[0.9375rem] text-secondary">{step.body}</p>
          </ScrollReveal>
        ))}
      </ol>
    </section>
  );
}

/* ── The laws ────────────────────────────────────────────────────────────── */

const LAWS: ReadonlyArray<{ sport: Sport; title: string; body: string }> = [
  {
    sport: 'CRICKET',
    title: 'A wide is not a ball',
    body: 'Wides and no-balls add a run and do not advance the over. Byes and leg byes advance it, and go to the side rather than the batter.',
  },
  {
    sport: 'CRICKET',
    title: 'Net run rate with the bowled-out rule',
    body: 'A side dismissed inside its quota is charged the full quota. A successful chase is charged only the overs it actually faced.',
  },
  {
    sport: 'FOOTBALL',
    title: 'Two yellows is a red',
    body: 'The second caution sends the player off, the side plays on with ten, and nobody can be substituted on in their place.',
  },
  {
    sport: 'FOOTBALL',
    title: 'A substitution is capped, not counted afterwards',
    body: 'The limit is set at kick off. The console refuses the one that would break it rather than letting the sheet disagree later.',
  },
  {
    sport: 'CRICKET',
    title: 'Corrections never rewrite history',
    body: 'A mistaken ball is superseded, not deleted. The original entry stays in the log and every change can be audited afterwards.',
  },
  {
    sport: 'FOOTBALL',
    title: 'Nobody assists their own goal',
    body: 'An own goal credits the other side, an assist needs a second player, and a player off the pitch cannot be involved at all.',
  },
];

function Laws() {
  return (
    <section id="laws" className="border-t border-line">
      <div className="mx-auto w-full max-w-[76rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <ScrollReveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Correctness</p>
              <h2 className="serif mt-5 max-w-2xl text-[2.25rem] text-primary sm:text-[3rem]">
                The rules a spreadsheet quietly gets wrong.
              </h2>
            </div>
            <p className="max-w-sm text-[0.9375rem] text-muted">
              Every one of these is covered by a test, not by good intentions — and enforced on the
              server, inside the lock, before the event is written.
            </p>
          </div>
        </ScrollReveal>

        <dl className="mt-14 grid border-t border-line md:grid-cols-2">
          {LAWS.map((law, index) => (
            <ScrollReveal
              key={law.title}
              index={index % 2}
              step={60}
              className={cn(
                'ledger-row border-b border-line py-8',
                index % 2 === 0 ? 'md:border-r md:pr-10' : 'md:pl-10',
              )}
            >
              <span className="flex items-center gap-2 text-muted">
                <SportMark sport={law.sport} />
                <span className="eyebrow">{law.sport === 'CRICKET' ? 'Cricket' : 'Football'}</span>
              </span>
              <dt className="mt-4 text-[1.0625rem] font-medium text-primary">{law.title}</dt>
              <dd className="mt-2 max-w-md text-secondary">{law.body}</dd>
            </ScrollReveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── Closing ─────────────────────────────────────────────────────────────── */

function Closing({ home, signedIn }: { home: string; signedIn: boolean }) {
  return (
    <section className="bg-inverse">
      <ScrollReveal shift={24}>
        <div className="mx-auto w-full max-w-[76rem] px-5 py-24 text-center sm:px-8 sm:py-32 lg:px-12">
          <p className="eyebrow text-muted-on-inverse">Open a scorebook</p>

          <h2 className="serif mx-auto mt-6 max-w-2xl text-[2.5rem] text-on-inverse sm:text-[3.5rem]">
            Your league deserves a proper record of itself.
          </h2>

          <p className="mx-auto mt-6 max-w-md text-muted-on-inverse">
            Register the teams, generate the fixtures, hand a scorer the link. About ten minutes,
            for cricket or football.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to={home}>
              <span className="inline-flex h-[3.25rem] items-center rounded-[var(--radius-sm)] bg-[var(--surface)] px-8 text-[0.9375rem] font-medium text-primary transition-opacity hover:opacity-90">
                {signedIn ? 'Open your dashboard' : 'Create your account'} →
              </span>
            </Link>
            <a href="#flow">
              <span className="inline-flex h-[3.25rem] items-center rounded-[var(--radius-sm)] border border-[var(--line-inverse)] px-8 text-[0.9375rem] font-medium text-on-inverse transition-colors hover:bg-white/5">
                See the flow
              </span>
            </a>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

const FOOTER_COLUMNS = [
  {
    title: 'The product',
    items: [
      { label: 'Two sports', href: '#sports' },
      { label: 'The share link', href: '#link' },
      { label: 'The flow', href: '#flow' },
      { label: 'The laws it enforces', href: '#laws' },
      { label: 'How it is engineered', href: '/engineering' },
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

function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-[76rem] px-5 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-[0.9375rem] text-secondary">
              Cricket and football, kept properly. Built for grounds with bad signal and long
              memories.
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
          <p className="eyebrow">Every ball, every minute, on the record</p>
        </div>
      </div>
    </footer>
  );
}
