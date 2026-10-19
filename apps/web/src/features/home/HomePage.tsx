import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { useAuth } from '@/features/auth/AuthProvider';
import { Label, SketchDefs, Stroke, delayed } from '@/components/ui/Sketch';

const STEPS = [
  {
    n: '01',
    title: 'Set up the tournament',
    body: 'Add teams and squads by username, pick the format, and generate the fixtures. It takes a few minutes, not an evening.',
    art: <FixturesSketch />,
  },
  {
    n: '02',
    title: 'Score from the boundary',
    body: 'Your scorer records each ball or goal on a phone. Big keys, one-tap undo, and it keeps going when the signal drops.',
    art: <PadSketch />,
  },
  {
    n: '03',
    title: 'Share one link',
    body: 'Post the live link in the group chat. Everyone follows along ball by ball, and nobody has to sign up.',
    art: <ShareSketch />,
  },
];

const INDEX = [
  ['Offline scoring', 'Balls queue on the phone and sync in order when the connection returns.'],
  ['Public live pages', 'A clean scoreboard, commentary and scorecard for every match, open to anyone with the link.'],
  ['Points table', 'Standings and net run rate update the moment a result is recorded.'],
  ['Cricket and football', 'Ball by ball for cricket. Goals, cards, substitutions and a match clock for football.'],
  ['Rain rules', 'Revise targets with Duckworth-Lewis-Stern mid-match. The chase updates for everyone.'],
  ['Scorecards to keep', 'Download match and tournament scorecards as PDF when the last ball is bowled.'],
];

const SPORTS = [
  {
    name: 'Cricket',
    title: 'Ball by ball.',
    art: <OverSketch />,
    points: [
      'Runs, extras and wickets, with every dismissal credited to the right bowler.',
      'Strike changes and the end of each over are handled for you.',
      'Duckworth-Lewis-Stern targets when the rain arrives.',
      'A points table with net run rate after every result.',
    ],
  },
  {
    name: 'Football',
    title: 'Minute by minute.',
    art: <TimelineSketch />,
    points: [
      'A running match clock with stoppage time, kept by the scorer.',
      'Goals, own goals and cards on one timeline.',
      "Substitutions checked against your league's rules.",
      'Full halves, short halves, quarters or five-a-side, set per match.',
    ],
  },
];

export function HomePage() {
  const { user } = useAuth();
  const home = user ? '/dashboard' : '/login';

  return (
    <div className="min-h-dvh bg-surface text-primary">
      <SketchDefs />

      <header className="mx-auto flex h-20 max-w-[1200px] items-center justify-between gap-6 px-6 sm:px-10">
        <Link to="/" aria-label="Howzat home">
          <Wordmark size="sm" />
        </Link>
        <nav className="hidden items-center gap-9 text-sm text-secondary md:flex">
          <a href="#sports" className="transition-colors hover:text-primary">
            Cricket and football
          </a>
          <a href="#how" className="transition-colors hover:text-primary">
            How it works
          </a>
          <a href="#index" className="transition-colors hover:text-primary">
            What's included
          </a>
          <Link to="/engineering" className="transition-colors hover:text-primary">
            Engineering
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {user ? null : (
            <Link
              to="/login"
              className="hidden text-sm text-secondary transition-colors hover:text-primary sm:inline"
            >
              Sign in
            </Link>
          )}
          <Link to={home}>
            <Button size="sm">{user ? 'Dashboard' : 'Get started'}</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-6 pt-20 pb-24 sm:px-10 lg:pt-32 lg:pb-32">
        <p className="eyebrow reveal">Live scoring for local cricket and football</p>
        <div className="mt-8 grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <h1 className="hero-title serif reveal max-w-[11ch] [--delay:80ms]">
            Every ball, <em>live</em> for everyone.
          </h1>
          <HeroStage />
        </div>
        <div className="reveal mt-14 grid gap-10 border-t border-line pt-10 [--delay:160ms] md:grid-cols-[1fr_auto] md:items-end">
          <p className="max-w-[34rem] text-lg leading-relaxed text-secondary">
            Howzat runs your cricket or football tournament from a phone on the touchline. The
            scorer taps in each ball, goal and card, and the whole club follows from one shared
            link.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to={home}>
              <Button size="lg">{user ? 'Open dashboard' : 'Start a tournament'}</Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="secondary">
                See how it works
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section id="sports" className="mx-auto max-w-[1200px] scroll-mt-8 px-6 pb-24 sm:px-10 lg:pb-32">
        <SectionTitle eyebrow="Two sports">
          One scorebook, <em>two</em> games.
        </SectionTitle>
        <div className="mt-16 grid border-t border-line md:grid-cols-2">
          {SPORTS.map((sport, index) => (
            <ScrollReveal
              key={sport.name}
              index={index}
              step={160}
              className="flex flex-col border-line pt-12 md:odd:pr-12 md:even:border-l md:even:pl-12 max-md:not-first:mt-16 max-md:not-first:border-t"
            >
              <p className="eyebrow">{sport.name}</p>
              <h3 className="serif mt-4 text-[clamp(2.25rem,4vw,3.25rem)] leading-none">
                {sport.title}
              </h3>
              <div className="mt-10 h-40">{sport.art}</div>
              <ul className="mt-10 border-t border-line">
                {sport.points.map((point) => (
                  <li
                    key={point}
                    className="border-b border-line py-4 text-[0.9375rem] leading-relaxed text-secondary"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-raised">
        <div className="mx-auto max-w-[1200px] px-6 py-20 sm:px-10 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="serif max-w-[18ch] text-[clamp(2.25rem,4.5vw,3.75rem)]">
              What happens when the bowler runs in.
            </h2>
            <p className="max-w-sm text-[0.9375rem] leading-relaxed text-secondary">
              One tap at the ground becomes an update on every phone that is watching.
            </p>
          </div>
          <ScrollReveal className="mt-16">
            <BallJourney />
          </ScrollReveal>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1200px] scroll-mt-8 px-6 py-24 sm:px-10 lg:py-32">
        <SectionTitle eyebrow="How it works">
          From fixtures to the final in <em>three</em> steps.
        </SectionTitle>
        <ol className="mt-20 grid gap-y-16 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <ScrollReveal
              as="li"
              key={step.n}
              index={index}
              step={140}
              className="flex flex-col border-line md:px-8 md:first:pl-0 md:last:pr-0 md:not-first:border-l"
            >
              <div className="h-40">{step.art}</div>
              <span className="tabular mt-10 text-sm text-muted">{step.n}</span>
              <h3 className="serif mt-3 text-[2rem]">{step.title}</h3>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-secondary">{step.body}</p>
            </ScrollReveal>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-raised">
        <div className="mx-auto grid max-w-[1200px] items-center gap-16 px-6 py-24 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:py-32">
          <div>
            <p className="eyebrow">No signal at the ground</p>
            <h2 className="serif mt-6 text-[clamp(2.25rem,4.5vw,3.75rem)]">
              The scoring <em>never</em> stops.
            </h2>
            <p className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-secondary">
              Most grounds have a dead corner. When the connection drops, each ball is saved on the
              scorer's phone in order. When it returns, the queue syncs and the live page catches up
              on its own.
            </p>
          </div>
          <ScrollReveal>
            <OfflineSketch />
          </ScrollReveal>
        </div>
      </section>

      <section id="index" className="mx-auto max-w-[1200px] scroll-mt-8 px-6 py-24 sm:px-10 lg:py-32">
        <SectionTitle eyebrow="What's included">
          Everything match night needs, and <em>nothing</em> it doesn't.
        </SectionTitle>
        <dl className="mt-16 grid border-t border-line md:grid-cols-2">
          {INDEX.map(([title, body], index) => (
            <div
              key={title}
              className="grid grid-cols-[3rem_1fr] gap-x-4 border-b border-line py-8 md:odd:pr-10 md:even:border-l md:even:pl-10"
            >
              <span className="tabular pt-1 text-sm text-muted">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <dt className="serif text-[1.75rem]">{title}</dt>
                <dd className="mt-2 text-[0.9375rem] leading-relaxed text-secondary">{body}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-10 px-6 py-24 sm:px-10 lg:py-32">
          <h2 className="serif max-w-[16ch] text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.95]">
            Your next match deserves a <em>proper</em> scoreboard.
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            <Link to={home}>
              <Button size="lg">{user ? 'Open dashboard' : 'Create your tournament'}</Button>
            </Link>
            <span className="text-sm text-muted">
              Free to set up. Spectators never need an account.
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-muted sm:px-10">
          <Wordmark size="sm" />
          <div className="flex items-center gap-8">
            <Link to="/engineering" className="hover:text-primary">
              Engineering
            </Link>
            <Link to="/login" className="hover:text-primary">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="serif mt-6 max-w-[20ch] text-[clamp(2.5rem,5vw,4.25rem)]">{children}</h2>
    </div>
  );
}

function HeroStage() {
  const [sport, setSport] = useState<'cricket' | 'football'>('cricket');
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const id = window.setInterval(
      () => setSport((current) => (current === 'cricket' ? 'football' : 'cricket')),
      6500,
    );
    return () => window.clearInterval(id);
  }, [held]);

  return (
    <div className="flex flex-col items-center gap-6">
      {sport === 'cricket' ? <HeroSketch key="cricket" /> : <GoalSketch key="football" />}
      <div className="flex gap-8 text-sm" role="group" aria-label="Choose a sport">
        {(['cricket', 'football'] as const).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={sport === name}
            onClick={() => {
              setHeld(true);
              setSport(name);
            }}
            className={
              sport === name
                ? 'text-primary capitalize'
                : 'text-muted capitalize transition-colors hover:text-primary'
            }
          >
            {sport === name ? <span className="scribble">{name}</span> : name}
          </button>
        ))}
      </div>
    </div>
  );
}

const CURL = 'M70 330C150 316 226 150 384 214';

function GoalSketch() {
  return (
    <svg
      viewBox="0 0 440 380"
      role="img"
      aria-label="A sketch. A late shot curls into the top corner of the net."
      className="reveal mx-auto h-auto w-full max-w-[420px] text-primary"
    >
      <Stroke d="M18 344c130-5 280-5 404 0" width={1.4} />
      <Stroke d="M296 344c-1-50 0-100 2-146 38-3 80-3 118 0 2 46 2 96 1 146" delay={200} />
      <Stroke
        d="M318 202v142M340 201v143M362 201v143M384 202v142M404 203v141M298 232c40-2 80-2 118 0M298 264c40-2 80-2 118 0M298 296c40-2 80-2 118 0"
        width={0.9}
        delay={600}
      />
      <Stroke d="M40 344c-1-20 0-40 1-58" width={1.5} delay={400} />
      <Stroke d="M41 286c10 2 18 6 24 12-8 2-16 2-24-1" color="var(--ink-amber)" delay={700} />
      <Stroke d={CURL} color="var(--ink-blue)" dashed delay={1000} />
      <Label x={208} y={130} delay={1500}>
        into the top corner
      </Label>
      <Label x={96} y={306} delay={1300} size={20}>
        88'
      </Label>
      <Label x={250} y={300} delay={2000} size={34}>
        goal
      </Label>
      <Stroke d="M220 312c8-4 15 4 23 0s15 4 23 0 15 4 23 0" color="var(--ink-green)" width={1.6} delay={2200} />
      <g>
        <circle r="9" fill="var(--surface-raised)" stroke="currentColor" strokeWidth="1.6" />
        <path d="M0-3.6l3.4 2.5-1.3 4H-2.1l-1.3-4Z" fill="currentColor" />
        <animateMotion dur="3.2s" repeatCount="indefinite" path={CURL} rotate="auto" />
      </g>
    </svg>
  );
}

function OverSketch() {
  const balls = [
    ['1', 'currentColor'],
    ['·', 'currentColor'],
    ['4', 'var(--ink-blue)'],
    ['W', 'var(--ink-red)'],
    ['6', 'var(--ink-green)'],
    ['2', 'currentColor'],
  ] as const;
  return (
    <svg viewBox="0 0 380 160" role="img" aria-label="A sketch of one over, six balls in a row." className="h-full w-full text-primary">
      {balls.map(([mark, color], index) => {
        const x = 32 + index * 63;
        return (
          <g key={index}>
            <Stroke
              d={`M${x - 22} 70a22 22 0 1 0 44 0a22 22 0 1 0-44 0`}
              color={color}
              width={color === 'currentColor' ? 1.4 : 2}
              delay={index * 160}
            />
            <Label x={x} y={78} delay={200 + index * 160} size={22}>
              {mark}
            </Label>
          </g>
        );
      })}
      <Stroke d="M14 128c110-4 240-4 352 0" width={1.2} dashed delay={1100} />
      <Label x={190} y={152} delay={1300} size={16}>
        one over, thirteen runs
      </Label>
    </svg>
  );
}

function TimelineSketch() {
  const at = (minute: number) => 20 + (minute * 320) / 90;
  return (
    <svg viewBox="0 0 380 160" role="img" aria-label="A sketch of a football match timeline from kick-off to full time." className="h-full w-full text-primary">
      <Stroke d="M20 92c108-3 214-3 330 0" width={1.6} />
      <Stroke d="M20 82v20M350 82v20" width={1.4} delay={300} />
      <Stroke d={`M${at(45)} 84v16`} width={1.2} delay={400} />
      <Label x={at(45)} y={126} delay={500} size={15}>
        HT
      </Label>
      <Label x={20} y={126} delay={500} size={15}>
        0'
      </Label>
      <Label x={350} y={126} delay={500} size={15}>
        90+3
      </Label>
      {[23, 88].map((minute, index) => (
        <g key={minute}>
          <circle
            cx={at(minute)}
            cy={60}
            r="9"
            fill="var(--ink-green)"
            className="sketch-fade"
            style={delayed(800 + index * 700)}
          />
          <Stroke d={`M${at(minute)} 70v18`} width={1} delay={850 + index * 700} />
          <Label x={at(minute)} y={34} delay={900 + index * 700} size={15}>
            {`goal ${minute}'`}
          </Label>
        </g>
      ))}
      <rect
        x={at(34) - 5}
        y={50}
        width="10"
        height="14"
        rx="1.5"
        fill="var(--ink-amber)"
        className="sketch-fade"
        style={delayed(1100)}
      />
      <Label x={at(34)} y={126} delay={1150} size={15}>
        34'
      </Label>
      <Stroke
        d={`M${at(67) - 6} 72v-22l-5 6M${at(67) - 6} 50l5 6M${at(67) + 6} 50v22l-5-6M${at(67) + 6} 72l5-6`}
        color="var(--ink-blue)"
        width={1.6}
        delay={1300}
      />
      <Label x={at(67)} y={126} delay={1400} size={15}>
        sub 67'
      </Label>
    </svg>
  );
}

const LOFT = 'M120 214C176 70 318 40 392 300';

function HeroSketch() {
  return (
    <svg
      viewBox="0 0 440 380"
      role="img"
      aria-label="A sketch. The batter lofts the ball over the boundary rope for six."
      className="reveal mx-auto h-auto w-full max-w-[420px] text-primary [--delay:240ms]"
    >
      <Stroke d="M18 344c130-5 280-5 404 0" width={1.4} />
      <Stroke d="M54 256c1 30 0 60-1 88M66 254c1 30 1 61 0 90M78 256c0 30 1 60 0 88" delay={200} />
      <Stroke d="M50 250c10-2 22-2 32 0" width={1.5} delay={450} />
      <Stroke d="M84 240c6-5 12-9 19-11" width={1.5} delay={550} />
      <Stroke d="M112 212l18-32" width={2.2} delay={500} />
      <Stroke d="M106 208c6-1 11 1 14 5l-32 66c-3 5-9 6-13 3-4-2-5-7-3-11Z" delay={650} />
      <Stroke d={LOFT} color="var(--ink-blue)" dashed delay={1000} />
      <Stroke d="M318 344c8-7 16 7 24 0s16 7 24 0 16 7 24 0 16 7 24 0" color="var(--ink-amber)" delay={1300} />
      <Stroke d="M402 344v-52" width={1.5} delay={1500} />
      <Stroke d="M402 292c10 1 18 5 26 11-8 3-17 3-26 0" color="var(--ink-red)" delay={1700} />
      <Label x={250} y={40} delay={1600}>
        over long-on
      </Label>
      <Label x={352} y={250} delay={2000} size={34}>
        six
      </Label>
      <Stroke d="M330 262c8-4 14 4 22 0s14 4 22 0" color="var(--ink-red)" width={1.6} delay={2200} />
      <circle r="6.5" fill="var(--ink-red)">
        <animateMotion dur="3.2s" repeatCount="indefinite" path={LOFT} />
      </circle>
    </svg>
  );
}

const JOURNEY = 'M196 168c70-26 148-30 222-6M560 162c76-30 150-32 226-4';

function BallJourney() {
  return (
    <svg
      viewBox="0 0 980 330"
      role="img"
      aria-label="A diagram. The scorer taps a ball on their phone, Howzat records it, and every spectator's phone updates."
      className="h-auto w-full text-primary"
    >
      <Stroke d="M92 72c22-2 46-1 70 1 4 34 4 120-1 172-24 3-48 3-70 0-4-52-4-120 1-173Z" />
      <Stroke d="M100 96h55M100 228h55" width={1.2} delay={200} />
      <g className="sketch-fade" style={delayed(500)}>
        {[0, 1, 2].map((row) =>
          [0, 1].map((col) => {
            const hit = row === 1 && col === 1;
            return (
              <rect
                key={`${row}-${col}`}
                x={106 + col * 24}
                y={112 + row * 34}
                width="18"
                height="24"
                rx="4"
                fill={hit ? 'var(--ink-blue)' : 'none'}
                stroke={hit ? 'var(--ink-blue)' : 'currentColor'}
                strokeWidth="1.2"
                filter="url(#sketch-rough)"
              />
            );
          }),
        )}
        <text x="139" y="164" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="700">
          4
        </text>
      </g>
      <Label x={126} y={290} delay={700}>
        the scorer taps four
      </Label>

      <Stroke d="M196 168c70-26 148-30 222-6" color="var(--ink-blue)" delay={700} />
      <Stroke d="M406 150l14 12-16 9" color="var(--ink-blue)" delay={1100} />

      <Stroke
        d="M490 82c48-2 86 34 88 80 2 48-38 86-86 86-48 0-88-38-86-86 0-46 38-80 84-80Z"
        delay={900}
      />
      <Stroke
        d="M470 128c1 22 1 44-1 70M490 126c1 24 0 48 0 72M510 128c0 22 1 46 0 70"
        delay={1200}
        width={1.6}
      />
      <Stroke d="M466 120c9-2 18-2 28 0M500 112c6-5 13-8 22-9" delay={1400} width={1.6} />
      <Label x={490} y={290} delay={1500}>
        saved, in order, in one place
      </Label>

      <Stroke d="M560 162c76-30 150-32 226-4" color="var(--ink-blue)" delay={1500} />
      <Stroke d="M774 146l14 12-16 9" color="var(--ink-blue)" delay={1900} />

      {(
        [
          [808, 60, 'var(--ink-green)'],
          [880, 118, 'var(--ink-amber)'],
          [818, 188, 'var(--ink-violet)'],
        ] as const
      ).map(([x, y, color], index) => (
        <g key={index}>
          <Stroke
            d={`M${x} ${y}c14-1 30-1 44 1 2 22 2 52-1 70-14 2-30 2-44 0-2-22-2-48 1-71Z`}
            delay={1900 + index * 180}
          />
          <rect
            x={x + 8}
            y={y + 12}
            width="28"
            height="20"
            rx="3"
            fill={color}
            className="sketch-fade"
            style={delayed(2300 + index * 180)}
          />
          <Stroke
            d={`M${x + 9} ${y + 44}h24M${x + 9} ${y + 52}h16`}
            width={1.2}
            delay={2400 + index * 180}
          />
        </g>
      ))}
      <Label x={860} y={290} delay={2600}>
        everyone sees it land
      </Label>

      <circle r="7" fill="var(--ink-red)">
        <animateMotion dur="3.6s" repeatCount="indefinite" path={JOURNEY} />
      </circle>
      <circle r="7" fill="var(--ink-red)" opacity="0.25">
        <animateMotion dur="3.6s" begin="0.12s" repeatCount="indefinite" path={JOURNEY} />
      </circle>
    </svg>
  );
}

function FixturesSketch() {
  const dots = ['var(--ink-blue)', 'var(--ink-red)', 'var(--ink-green)', 'var(--ink-amber)'];
  return (
    <svg viewBox="0 0 260 160" aria-hidden className="h-full w-auto text-primary">
      {[18, 58, 98, 138].map((y, index) => (
        <g key={y}>
          <Stroke d={`M14 ${y}c26-1 52-1 78 0`} delay={index * 120} />
          <circle
            cx="22"
            cy={y - 10}
            r="5"
            fill={dots[index]}
            className="sketch-fade"
            style={delayed(300 + index * 120)}
          />
        </g>
      ))}
      <Stroke d="M92 18c12 0 16 4 16 20s4 20 16 20M92 58h32" delay={600} />
      <Stroke d="M92 98c12 0 16 4 16 20s4 20 16 20M92 138h32" delay={700} />
      <Stroke d="M124 38c30-1 54-1 60 0M124 118c30 0 54 0 60 0" delay={900} />
      <Stroke d="M184 38c14 0 18 6 18 40s4 40 18 40M184 118c18 0 26-40 36-40" delay={1100} />
      <Stroke d="M220 78h30" delay={1300} width={2.4} />
      <Label x={236} y={66} delay={1400} size={15}>
        final
      </Label>
    </svg>
  );
}

function PadSketch() {
  const keys = ['0', '1', '2', '3', '4', '6', 'W', 'nb'];
  return (
    <svg viewBox="0 0 260 160" aria-hidden className="h-full w-auto text-primary">
      {keys.map((key, index) => {
        const x = 14 + (index % 4) * 60;
        const y = 22 + Math.floor(index / 4) * 66;
        const tone = key === '4' ? 'var(--ink-blue)' : key === 'W' ? 'var(--ink-red)' : null;
        return (
          <g key={key}>
            {tone ? (
              <rect
                x={x}
                y={y}
                width="50"
                height="52"
                rx="8"
                fill={tone}
                className="sketch-fade"
                style={delayed(600 + index * 60)}
              />
            ) : null}
            <Stroke
              d={`M${x + 8} ${y}c12-1 26-1 36 1 6 1 7 4 7 10 1 10 1 22 0 32-1 7-3 9-9 9-12 1-24 1-34 0-6 0-8-3-8-9-1-10-1-22 0-32 0-7 3-10 8-11Z`}
              delay={index * 70}
              width={1.4}
            />
            <text
              x={x + 25}
              y={y + 33}
              textAnchor="middle"
              fontSize="18"
              fill={tone ? '#fff' : 'currentColor'}
              className="sketch-fade"
              style={delayed(700 + index * 60, { fontFamily: 'var(--font-serif)' })}
            >
              {key}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ShareSketch() {
  return (
    <svg viewBox="0 0 260 160" aria-hidden className="h-full w-auto text-primary">
      <Stroke d="M22 74c0-10 8-18 18-18h20c10 0 18 8 18 18s-8 18-18 18H48" />
      <Stroke d="M62 86c0 10 8 18 18 18h20c10 0 18-8 18-18s-8-18-18-18H92" delay={250} />
      <Stroke d="M128 80c24-30 50-44 80-50" color="var(--ink-blue)" delay={600} dashed />
      <Stroke d="M128 80c28-2 52-1 80 2" color="var(--ink-blue)" delay={700} dashed />
      <Stroke d="M128 80c24 26 50 40 80 46" color="var(--ink-blue)" delay={800} dashed />
      {[22, 74, 122].map((y, index) => (
        <g key={y}>
          <Stroke
            d={`M214 ${y - 4}c10-1 20-1 30 0 1 12 1 26 0 36-10 1-20 1-30 0-1-12-1-24 0-36Z`}
            delay={900 + index * 150}
            width={1.4}
          />
          <circle
            cx="229"
            cy={y + 10}
            r="4"
            fill="var(--ink-red)"
            className="sketch-fade"
            style={delayed(1300 + index * 150)}
          />
        </g>
      ))}
    </svg>
  );
}

function OfflineSketch() {
  const queue = [
    'var(--ink-blue)',
    'var(--ink-green)',
    'var(--ink-red)',
    'var(--ink-amber)',
    'var(--ink-violet)',
  ];
  return (
    <svg
      viewBox="0 0 620 300"
      role="img"
      aria-label="A diagram. While the signal is down, balls queue on the scorer's phone. When it returns, they sync to the live page in order."
      className="h-auto w-full text-primary"
    >
      <Stroke d="M20 210c60-2 120-1 170 0" />
      <Stroke d="M190 210c50 1 160 0 230 0" dashed delay={400} />
      <Stroke d="M420 210c60-1 120 0 180-1" delay={800} />
      <Label x={105} y={240} delay={300}>
        signal
      </Label>
      <Label x={305} y={240} delay={700}>
        no signal, still scoring
      </Label>
      <Label x={510} y={240} delay={1100}>
        back online
      </Label>

      {(
        [
          [86, 186, 'currentColor', 300],
          [536, 96, 'var(--ink-green)', 2300],
        ] as const
      ).map(([x, y, color, delay]) => (
        <Stroke
          key={x}
          d={`M${x} ${y}v-12M${x + 14} ${y}v-24M${x + 28} ${y}v-36M${x + 42} ${y}v-48`}
          color={color}
          width={5}
          delay={delay}
        />
      ))}
      <Stroke d="M190 186v-12M204 186v-24M218 186v-36M232 186v-48" width={5} dashed delay={500} />
      <Stroke d="M186 136c18 16 34 34 52 54M238 136c-18 16-34 34-52 54" color="var(--ink-red)" width={2.4} delay={900} />

      <Stroke
        d="M276 48c22-2 46-1 66 1 3 30 3 92-1 126-22 3-44 3-66 0-3-36-3-96 1-127Z"
        delay={300}
      />
      {queue.map((color, index) => (
        <circle
          key={color}
          cx="309"
          cy={156 - index * 22}
          r="8"
          fill={color}
          className="ink-pop"
          style={{ '--i': index + 8 } as CSSProperties}
        />
      ))}
      <Label x={392} y={84} anchor="start" delay={1200} size={15}>
        each ball saved in order
      </Label>
      <Stroke d="M386 80c-12 2-22 8-30 18" width={1.3} delay={1300} />

      <Stroke d="M346 120c60-40 120-44 176-8" color="var(--ink-blue)" delay={1700} />
      <Stroke d="M510 100l14 13-18 6" color="var(--ink-blue)" delay={2100} />
      <Stroke
        d="M530 128c18-1 38-1 56 1 2 18 2 40 0 56-18 2-38 2-56 0-2-18-2-38 0-57Z"
        delay={2100}
      />
      <Stroke d="M540 150c10 6 20 10 34-6" color="var(--ink-green)" delay={2500} width={2.2} />
    </svg>
  );
}
