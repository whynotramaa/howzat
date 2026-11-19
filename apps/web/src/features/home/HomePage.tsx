import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '@/components/Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { TeamMark } from '@/components/ui/Pill';
import { useAuth } from '@/features/auth/AuthProvider';
import { HeroStage, TABS, TournamentPhone } from './HomeDemos';
import { OfflineDrawing, OneLinkDrawing, PlayoffDrawing } from './HomeDrawings';
import './home.css';

const TICKER: Array<[string, string, string, string, string]> = [
  ['HAR', 'Harbour CC', '164/7', 'Oakley Town', '152/9'],
  ['STA', 'St Albans Rd', '122/4', 'Westbury', '121'],
  ['RVF', 'Riverside FC', '2', 'Parkside FC', '1'],
  ['NOR', 'Northgate XI', '180/6', 'Eastfield', '141'],
  ['MIL', 'Millbrook', '3', 'Harbour Utd', '3'],
  ['EAS', 'Eastfield', '98/2', 'Millbrook', '97'],
];

const FEATURES = [
  {
    title: 'One link, one score',
    body: 'Share the match link once. The rope, the clubhouse and the away end see the same ball the moment it’s scored. No app, no sign-up.',
    Drawing: OneLinkDrawing,
  },
  {
    title: 'The signal can wait',
    body: 'Lost bars at the far end of the ground? Cricket balls save on the scorer’s phone and sync in the order they were bowled.',
    Drawing: OfflineDrawing,
  },
  {
    title: 'The table sets the bracket',
    body: 'Every result moves points and net run rate. When the league ends, the top four drop straight into the playoffs.',
    Drawing: PlayoffDrawing,
  },
];

const TAB_COPY: Record<(typeof TABS)[number][0], [string, string]> = {
  matches: ['Fixtures and results', 'Live games up top, today’s next, results below. Assign a scorer in one tap.'],
  table: ['Standings that keep themselves', 'Points, net run rate and the playoff line, updated after every result.'],
  teams: ['Squads, sorted', 'Rosters for every side, with a nudge when a team is short for Saturday.'],
};

const STEPS = [
  ['Set up the league', 'Add teams, pick overs or halves, choose league, knockout or both.'],
  ['Score from the boundary', 'Big keys, one thumb. Runs, extras, wickets, goals and cards.'],
  ['Share one link', 'Fans follow live. Scorecards export to PDF when the day is done.'],
];

const QUESTIONS = [
  ['Do spectators need an account?', 'No. Share the match link and anyone can follow the game in a browser.'],
  ['Can I score cricket offline?', 'Yes. Deliveries save on your phone and sync in order when the connection returns.'],
  ['Which sports are supported?', 'Cricket and football, with fixtures, live scores, standings and PDF scorecards.'],
  ['What about rain?', 'Revised targets use DLS, so a shortened chase still has a fair number to aim at.'],
  ['What does it cost?', 'Nothing. Howzat is free for local clubs and leagues.'],
];

export function HomePage() {
  const { user } = useAuth();
  const destination = user ? '/dashboard' : '/login?mode=register&next=tournament';
  const cta = user ? 'Open dashboard' : 'Start a tournament';

  return (
    <div className="hz">
      <a className="skip-link" href="#hz-main">
        Skip to content
      </a>
      <header className="hz-nav">
        <div className="hz-wrap hz-nav-in">
          <Link to="/" aria-label="Howzat home">
            <Wordmark size="sm" />
          </Link>
          <nav aria-label="Homepage">
            <a href="#live">Live</a>
            <a href="#toolkit">Toolkit</a>
            <a href="#league">League</a>
            <a href="#faq">Questions</a>
          </nav>
          <div className="hz-nav-end">
            <ThemeToggle />
            <Link to={user ? '/dashboard' : '/login'} className="hz-btn hz-btn-quiet">
              {user ? 'Dashboard' : 'Sign in'}
            </Link>
          </div>
        </div>
      </header>

      <main id="hz-main">
        <section className="hz-hero" aria-labelledby="hz-title">
          <div className="hz-wrap hz-hero-grid">
            <div className="hz-kicker">
              <span className="hz-live-dot" />
              Cricket and football scoring for local leagues
            </div>
            <h1 id="hz-title" className="hz-title">
              <span className="hz-line">
                <span style={{ '--d': 0 } as React.CSSProperties}>Every</span>{' '}
                <span style={{ '--d': 1 } as React.CSSProperties}>ball,</span>
              </span>
              <span className="hz-line hz-title-quiet">
                <span style={{ '--d': 2 } as React.CSSProperties}>on</span>{' '}
                <span style={{ '--d': 3 } as React.CSSProperties}>the</span>{' '}
                <span style={{ '--d': 4 } as React.CSSProperties}>record.</span>
              </span>
            </h1>
            <div className="hz-hero-aside">
              <p>
                Score from the boundary on one phone. Everyone else follows on one link, a beat
                later, ball by ball.
              </p>
              <div className="hz-actions">
                <Link to={destination} className="hz-btn hz-btn-primary">
                  {cta}
                  <span className="hz-arrow" aria-hidden>
                    →
                  </span>
                </Link>
                <a href="#live" className="hz-btn hz-btn-ghost">
                  Try the scorer
                </a>
              </div>
            </div>
          </div>
          <div id="live" className="hz-wrap hz-stage-wrap">
            <div className="hz-stage-legend" aria-hidden>
              <span>Spectator view</span>
              <span>Scorer’s phone</span>
            </div>
            <HeroStage />
          </div>
        </section>

        <div className="hz-ticker" aria-label="Recent results">
          <div className="hz-ticker-track">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1}>
                {TICKER.map(([k, a, sa, b, sb]) => (
                  <li key={a + b}>
                    <TeamMark shortName={k} color="#8c8984" size="sm" />
                    <b>{a}</b>
                    <span className="hz-tick-score">{sa}</span>
                    <span className="hz-tick-v">v</span>
                    <span>{b}</span>
                    <span className="hz-tick-score">{sb}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>

        <section id="toolkit" className="hz-section" aria-labelledby="hz-toolkit">
          <div className="hz-wrap">
            <SectionHead index="01" label="Toolkit" id="hz-toolkit">
              The quiet work
              <br />
              behind a match.
            </SectionHead>
            <div className="hz-plates">
              {FEATURES.map(({ title, body, Drawing }, i) => (
                <ScrollReveal key={title} index={i} as="article" className="hz-plate">
                  <div className="hz-plate-art">
                    <Drawing />
                  </div>
                  <div className="hz-plate-copy">
                    <span className="hz-plate-n">0{i + 1}</span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <LeagueSection />

        <section className="hz-section hz-steps-section" aria-labelledby="hz-steps">
          <div className="hz-wrap">
            <SectionHead index="03" label="How it works" id="hz-steps">
              Toss to table
              <br />
              in three steps.
            </SectionHead>
            <ol className="hz-steps">
              {STEPS.map(([title, body], i) => (
                <ScrollReveal key={title} index={i} as="li">
                  <span className="hz-step-n">{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </ScrollReveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="faq" className="hz-section" aria-labelledby="hz-faq">
          <div className="hz-wrap hz-faq">
            <SectionHead index="04" label="Questions" id="hz-faq">
              Before
              <br />
              the toss.
            </SectionHead>
            <div className="hz-questions">
              {QUESTIONS.map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <span className="hz-plus" aria-hidden />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="hz-finale" aria-labelledby="hz-finale">
          <div className="hz-wrap">
            <h2 id="hz-finale" className="hz-finale-word" aria-label="Howzat?">
              {'Howzat?'.split('').map((c, i) => (
                <span key={i} style={{ '--d': i } as React.CSSProperties} aria-hidden>
                  {c}
                </span>
              ))}
            </h2>
            <div className="hz-finale-row">
              <p>Good games deserve a proper record. Set up your league in a few minutes.</p>
              <Link to={destination} className="hz-btn hz-btn-primary hz-btn-lg">
                {cta}
                <span className="hz-arrow" aria-hidden>
                  →
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="hz-footer">
        <div className="hz-wrap hz-footer-in">
          <Wordmark size="sm" />
          <span>howzat.ramaa.tech</span>
          <nav aria-label="Footer">
            <Link to="/engineering">Under the hood</Link>
            <Link to={user ? '/dashboard' : '/login'}>{user ? 'Dashboard' : 'Sign in'}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({
  index,
  label,
  id,
  children,
}: {
  index: string;
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hz-head">
      <span className="hz-head-meta">
        <span className="hz-head-n">{index}</span>
        {label}
      </span>
      <h2 id={id}>{children}</h2>
    </div>
  );
}

function LeagueSection() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('matches');
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || touched || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      window.clearInterval(timer);
      if (!e.isIntersecting) return;
      timer = window.setInterval(() => {
        setTab((t) => TABS[(TABS.findIndex(([k]) => k === t) + 1) % TABS.length][0]);
      }, 4200);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [touched]);

  const pick = (t: typeof tab) => {
    setTouched(true);
    setTab(t);
  };

  return (
    <section id="league" ref={ref} className="hz-section hz-league" aria-labelledby="hz-league">
      <div className="hz-wrap hz-league-grid">
        <div>
          <SectionHead index="02" label="League" id="hz-league">
            Fixtures to finals,
            <br />
            in one place.
          </SectionHead>
          <ul className="hz-tablist">
            {TABS.map(([t]) => (
              <li key={t}>
                <button
                  type="button"
                  aria-pressed={tab === t}
                  onClick={() => pick(t)}
                  onMouseEnter={() => pick(t)}
                  onFocus={() => pick(t)}
                >
                  <span className="hz-tablist-bar" aria-hidden />
                  <b>{TAB_COPY[t][0]}</b>
                  <span>{TAB_COPY[t][1]}</span>
                </button>
              </li>
            ))}
          </ul>
          <ul className="hz-extras-list">
            <li>PDF scorecards</li>
            <li>DLS targets</li>
            <li>Football timelines</li>
            <li>Player profiles</li>
          </ul>
        </div>
        <div className="hz-league-stage">
          <TournamentPhone tab={tab} onTab={pick} />
        </div>
      </div>
    </section>
  );
}
