import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '@/components/Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { BallChip } from '@/components/ui/Score';
import { TeamMark } from '@/components/ui/Pill';
import { useAuth } from '@/features/auth/AuthProvider';
import './home.css';

const QUESTIONS = [
  ['Do spectators need an account?', 'No. Share the match link and anyone can follow the game.'],
  [
    'Can I score cricket offline?',
    'Deliveries save on your phone and sync in order when the connection returns.',
  ],
  [
    'Which sports are supported?',
    'Cricket and football, with fixtures, live scores, standings and PDF scorecards.',
  ],
];

export function HomePage() {
  const { user } = useAuth();
  const destination = user ? '/dashboard' : '/login?mode=register&next=tournament';
  return (
    <div className="landing">
      <a className="skip-link" href="#landing-main">
        Skip to content
      </a>
      <div className="landing-header-shell">
        <header className="landing-nav">
          <Link to="/" aria-label="Howzat home">
            <Wordmark tone="inverse" />
          </Link>
          <nav aria-label="Homepage">
            <a href="#the-game">The game</a>
            <a href="#features">The toolkit</a>
            <a href="#how">How it works</a>
          </nav>
          <div className="landing-nav-actions">
            <ThemeToggle tone="inverse" />
            <Link to={user ? '/dashboard' : '/login'} className="landing-signin">
              {user ? 'Dashboard' : 'Sign in'} <span aria-hidden>↗</span>
            </Link>
          </div>
        </header>
      </div>
      <main id="landing-main">
        <div className="landing-hero-shell">
          <section className="landing-hero" aria-labelledby="landing-title">
            <div className="landing-hero-copy">
              <span className="landing-kicker">
                <span />
                For the love of the local game
              </span>
              <h1 id="landing-title" className="landing-title">
                Your game.
                <br />
                <span>On the record.</span>
              </h1>
              <p className="landing-hero-note">Cricket. Football. Every moment counts.</p>
              <div className="landing-actions">
                <Link to={destination} className="landing-button landing-button-purple">
                  {user ? 'Open dashboard' : 'Start a tournament'} <span aria-hidden>↗</span>
                </Link>
                <a href="#the-game" className="landing-text-link">
                  Take a look <span aria-hidden>↓</span>
                </a>
              </div>
              <div className="landing-hero-tags">
                <span>Free to play</span>
                <span>Made for matchday</span>
              </div>
            </div>
            <HeroArtwork />
          </section>
          <ul className="landing-capabilities">
            <li>
              <BrandIcon kind="cricket" />
              Cricket & football
            </li>
            <li>
              <BrandIcon kind="link" />
              One link for every fan
            </li>
            <li>
              <BrandIcon kind="bolt" />
              Offline cricket scoring
            </li>
          </ul>
        </div>

        <section
          id="the-game"
          className="landing-section landing-demo-section"
          aria-labelledby="demo-title"
        >
          <div className="landing-section-copy">
            <span className="landing-label">Front row. From anywhere.</span>
            <h2 id="demo-title">
              A proper view
              <br />
              of the game.
            </h2>
            <p>Live scores. The players at the crease. Every ball, on one link.</p>
            <a href="#features" className="landing-text-link">
              Meet your matchday toolkit <span aria-hidden>↗</span>
            </a>
          </div>
          <MatchPreview />
        </section>

        <section
          id="features"
          className="landing-section landing-features"
          aria-labelledby="features-title"
        >
          <div className="landing-section-heading">
            <span className="landing-label">Small effort. Big matchday.</span>
            <h2 id="features-title">
              Everything around
              <br />
              the game, sorted.
            </h2>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature landing-feature-fixtures">
              <div className="landing-feature-top">
                <span className="landing-number">01 / ORGANISE</span>
                <BrandIcon kind="trophy" />
              </div>
              <h3>Fixtures to finals.</h3>
              <p>Teams, schedules and standings. Together.</p>
              <div className="fixture-preview" aria-label="Example tournament fixtures">
                <div className="fixture-preview-head">
                  <span>Sunday League</span>
                  <span>Fixtures</span>
                </div>
                {[
                  ['Riverside', 'Parkside', 'SAT 10:00'],
                  ['North End', 'Westfield', 'SAT 14:00'],
                  ['Riverside', 'North End', 'SUN 10:00'],
                ].map(([a, b, time]) => (
                  <div className="fixture-preview-row" key={`${a}-${b}`}>
                    <span className="fixture-preview-time">{time}</span>
                    <strong>
                      {a}
                      <span>v</span>
                      {b}
                    </strong>
                    <span aria-hidden>↗</span>
                  </div>
                ))}
              </div>
              <div className="landing-feature-foot">
                <span>Leagues & playoffs</span>
                <span aria-hidden>↗</span>
              </div>
            </article>
            <article className="landing-feature landing-feature-share">
              <BrandIcon kind="link" />
              <span className="landing-number">02 / FOLLOW</span>
              <h3>
                One link.
                <br />
                Everyone’s in.
              </h3>
              <p>No spectator sign-up.</p>
              <div className="share-preview" aria-hidden>
                <span>howzat / matchday</span>
                <span>↗</span>
              </div>
            </article>
            <article className="landing-feature landing-feature-offline">
              <BrandIcon kind="bolt" />
              <span className="landing-number">03 / KEEP SCORING</span>
              <h3>The signal can wait.</h3>
              <p>Cricket balls save locally. Sync comes next.</p>
              <span className="offline-preview">
                <span aria-hidden>✓</span> Saved on your phone
              </span>
            </article>
          </div>
          <ul className="landing-tools">
            <li>Live scorecards</li>
            <li>Automatic standings</li>
            <li>PDF exports</li>
            <li>DLS targets</li>
          </ul>
        </section>

        <section id="how" className="landing-how-band" aria-labelledby="how-title">
          <div className="landing-section">
            <div className="landing-section-heading">
              <span className="landing-label">Less admin. More game.</span>
              <h2 id="how-title">Three steps to the first whistle.</h2>
            </div>
            <ol className="landing-steps">
              {[
                ['Pick your game', 'Add teams. Choose your format.'],
                ['Make it count', 'Record balls, goals and big moments.'],
                ['Bring everyone along', 'Share the live link. That’s it.'],
              ].map(([title, body], i) => (
                <li key={title}>
                  <span className="landing-step-number">0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-section landing-faq" aria-labelledby="faq-title">
          <div>
            <span className="landing-label">Before the toss</span>
            <h2 id="faq-title">A few quick answers.</h2>
            <BrandIcon kind="football" className="landing-faq-icon" />
          </div>
          <div className="landing-questions">
            {QUESTIONS.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-finale" aria-labelledby="finale-title">
          <BrandIcon kind="trophy" />
          <h2 id="finale-title">
            Good games deserve
            <br />
            <span>a proper record.</span>
          </h2>
          <Link to={destination} className="landing-button landing-button-ink">
            {user ? 'Open dashboard' : 'Start your tournament'} <span aria-hidden>↗</span>
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Link to="/" aria-label="Howzat home">
          <Wordmark />
        </Link>
        <span>For the game. For everyone.</span>
        <div>
          <Link to="/engineering">Under the hood</Link>
          <Link to={user ? '/dashboard' : '/login'}>
            {user ? 'Dashboard' : 'Sign in'} <span aria-hidden>↗</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}

function MatchPreview() {
  const [sport, setSport] = useState<'cricket' | 'football'>('cricket');
  const cricket = sport === 'cricket';
  return (
    <div className="landing-match-preview">
      <div className="landing-preview-top">
        <div role="group" aria-label="Preview sport">
          {(['cricket', 'football'] as const).map((s) => (
            <button type="button" key={s} aria-pressed={sport === s} onClick={() => setSport(s)}>
              {s}
            </button>
          ))}
        </div>
        <span>Example match</span>
      </div>
      <div className="landing-demo-match">
        <div className="landing-demo-league">
          <span>Sunday League</span>
          <span className="landing-demo-live">
            <span />
            {cricket ? '17.2 overs' : '64′'}
          </span>
        </div>
        <div className="landing-demo-team">
          <TeamMark shortName={cricket ? 'RCC' : 'RFC'} color="#7a5bc7" size="md" />
          <span>Riverside {cricket ? 'CC' : 'FC'}</span>
          <strong>{cricket ? '146/3' : '2'}</strong>
        </div>
        <div className="landing-demo-team landing-demo-opponent">
          <TeamMark shortName={cricket ? 'PCC' : 'PFC'} color="#d17c52" size="md" />
          <span>Parkside {cricket ? 'CC' : 'FC'}</span>
          <span>{cricket ? 'Yet to bat' : '1'}</span>
        </div>
        {cricket ? (
          <>
            <div className="landing-demo-batters">
              <div>
                <span>
                  A. Sharma <span className="landing-demo-striker">●</span>
                </span>
                <strong>
                  62 <span>(41)</span>
                </strong>
              </div>
              <div>
                <span>R. Patel</span>
                <strong>
                  28 <span>(19)</span>
                </strong>
              </div>
            </div>
            <div className="landing-demo-over">
              <span>This over</span>
              {['1', '0', '4', '1', '6', '2'].map((display, i) => (
                <BallChip key={i} display={display} size="sm" />
              ))}
            </div>
          </>
        ) : (
          <div className="landing-demo-goals">
            <div>
              <span className="tabular">52′</span>
              <strong>A. Morgan</strong>
              <span>Goal</span>
            </div>
            <div>
              <span className="tabular">64′</span>
              <strong>S. Carter</strong>
              <span>Goal</span>
            </div>
          </div>
        )}
      </div>
      <div className="landing-preview-caption">
        <span aria-hidden>↗</span> A view for every fan.
      </div>
    </div>
  );
}

function HeroArtwork() {
  return (
    <div className="landing-art">
      <svg
        viewBox="0 0 560 460"
        fill="none"
        role="img"
        aria-label="A colourful cricket scoreboard, bat and ball"
      >
        <ellipse cx="310" cy="406" rx="222" ry="29" fill="#151519" />
        <path
          d="M111 118c0-17 14-31 31-31h305c17 0 31 14 31 31v197c0 17-14 31-31 31H142c-17 0-31-14-31-31Z"
          fill="#504279"
          transform="rotate(-7 294 216) translate(12 14)"
        />
        <g transform="rotate(-7 294 216)">
          <rect x="111" y="87" width="367" height="259" rx="29" fill="#c6b5fa" />
          <rect x="130" y="106" width="329" height="221" rx="19" fill="#b29ae9" />
          <path d="M147 155h295" stroke="#8e70cc" strokeWidth="2" />
          <text
            x="149"
            y="139"
            fill="#392c56"
            fontFamily="var(--font-sans)"
            fontSize="13"
            fontWeight="700"
            letterSpacing="2"
          >
            SUNDAY LEAGUE
          </text>
          <rect x="372" y="119" width="68" height="24" rx="12" fill="#daf48b" />
          <text
            x="406"
            y="135"
            fill="#354122"
            fontFamily="var(--font-sans)"
            fontSize="11"
            fontWeight="700"
            textAnchor="middle"
          >
            LIVE
          </text>
          <text
            x="149"
            y="249"
            fill="#2f2349"
            fontFamily="var(--font-sans)"
            fontSize="81"
            fontWeight="700"
            letterSpacing="-5"
          >
            146/3
          </text>
          <text x="214" y="293" fill="#49366c" fontFamily="var(--font-sans)" fontSize="15">
            RIVERSIDE CC
          </text>
        </g>
        <g transform="rotate(28 442 277)">
          <rect x="427" y="84" width="24" height="123" rx="12" fill="#66528e" />
          <path d="M431 107h16m-16 16h16m-16 16h16m-16 16h16" stroke="#a58bc8" strokeWidth="3" />
          <rect x="403" y="187" width="72" height="224" rx="33" fill="#e7ca87" />
          <path d="M438 206v177" stroke="#f9e5b3" strokeWidth="8" strokeLinecap="round" />
          <path d="M458 216v160" stroke="#caab69" strokeWidth="6" strokeLinecap="round" />
        </g>
        <circle cx="126" cy="350" r="72" fill="#e48065" />
        <path d="M127 278a72 72 0 0 1 0 144c31-47 28-99 0-144Z" fill="#c56754" />
        <path d="M108 281c45 41 52 86 21 139" stroke="#f8cfb8" strokeWidth="7" />
        <path
          d="M98 288c41 39 47 83 18 128"
          stroke="#f8cfb8"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
        <path d="m465 40 5 16 16 5-16 5-5 16-5-16-16-5 16-5Z" fill="#dcf39c" />
        <path d="m85 190 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="#d6c5ff" />
        <circle cx="505" cy="338" r="8" fill="#e9a681" />
      </svg>
    </div>
  );
}
