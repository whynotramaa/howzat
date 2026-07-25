import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { BallSummary, MatchSnapshot } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { EmptyState } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Feedback';
import { Pill, TeamMark } from '@/components/ui/Pill';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { BallChip } from '@/components/ui/Score';
import { ShareLink } from '@/components/ui/ShareLink';
import { Table, Td, Th } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/cn';
import { useLiveMatch, type ConnectionState } from './useLiveMatch';

/**
 * The public share link — the most-seen screen in the product and the only one
 * most people will ever see.
 *
 * It is built as a broadcast graphic rather than as a page of the app: no login,
 * no navigation, both teams' colours in the light behind it, and the score set
 * large enough to read at arm's length in daylight. Snapshot first, then
 * subscribe, so a viewer who joins at 12.3 overs sees 12.3 overs immediately.
 *
 * The theme toggle is deliberately absent. Every scoreboard anyone has looked at
 * — at the ground, on television — is light on dark, and a scoreboard that
 * follows the reader's OS preference is a scoreboard that sometimes looks like a
 * spreadsheet.
 */

type View = 'live' | 'scorecard' | 'commentary';

export function LiveMatchPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { snapshot, connection, viewers, error, isLoading, notStarted } = useLiveMatch(slug);
  const [view, setView] = useState<View>(
    searchParams.get('view') === 'scorecard' ? 'scorecard' : 'live',
  );
  const condensed = useCondensedHeader();

  const matchLabel = snapshot ? `${snapshot.batting.short} v ${snapshot.bowling.short}` : undefined;

  return (
    <div
      className="live-stage relative flex min-h-dvh flex-col"
      style={
        {
          '--team-a': snapshot?.batting.color ?? '#7a5c22',
          '--team-b': snapshot?.bowling.color ?? '#3d372c',
        } as React.CSSProperties
      }
    >
      <header className="live-stage-bar sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5 sm:px-8">
          <Link to="/" className="shrink-0 transition-opacity hover:opacity-70">
            <Wordmark size="sm" />
          </Link>

          {/* The score follows you down the page once the scoreboard itself has
              scrolled away — the one thing worth keeping pinned. */}
          {snapshot ? (
            <div
              aria-hidden={!condensed}
              data-shown={condensed}
              className="live-condensed hidden min-w-0 items-center gap-2.5 sm:flex"
            >
              <span aria-hidden className="h-5 w-px bg-line" />
              <TeamMark
                shortName={snapshot.batting.short}
                color={snapshot.batting.color}
                size="sm"
              />
              <p className="mono text-sm font-medium text-primary">
                {snapshot.batting.runs}/{snapshot.batting.wickets}
                <span className="ml-2 text-muted">({snapshot.batting.overs})</span>
              </p>
            </div>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
            {viewers > 0 ? (
              <span className="mono hidden text-[0.6875rem] text-muted sm:block">
                {viewers} watching
              </span>
            ) : null}
            <ConnectionBadge state={connection} />
            {snapshot ? (
              <ShareLink slug={slug} variant="quiet" matchLabel={matchLabel} label="Share" />
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
        {isLoading ? (
          <div className="flex flex-col gap-5">
            <Skeleton className="h-72" />
            <Skeleton className="h-40" />
          </div>
        ) : error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-[var(--alert)] bg-alert-soft px-5 py-4 text-primary"
          >
            {error}
          </p>
        ) : notStarted ? (
          <EmptyState
            title="Not a ball bowled yet"
            description="The score appears here the moment the first delivery is scored. Leave this open — it updates itself."
          />
        ) : snapshot ? (
          <div className="flex flex-col gap-6 sm:gap-8">
            <Scoreboard snapshot={snapshot} />

            <Tabs
              items={[
                { value: 'live', label: 'Live' },
                { value: 'scorecard', label: 'Scorecard' },
                { value: 'commentary', label: 'Ball by ball' },
              ]}
              value={view}
              onChange={setView}
            />

            {view === 'live' ? (
              <LiveView snapshot={snapshot} />
            ) : view === 'scorecard' ? (
              <ScorecardView slug={slug} />
            ) : (
              <CommentaryView snapshot={snapshot} />
            )}
          </div>
        ) : null}
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-7 sm:px-8">
          <p className="text-[0.8125rem] text-muted">
            Scored ball by ball on <span className="text-primary">Howzat</span>.
          </p>
          <Link
            to="/"
            className="text-[0.8125rem] text-accent transition-opacity hover:opacity-70"
          >
            Run your own tournament →
          </Link>
        </div>
      </footer>
    </div>
  );
}

// ───────────────────────────────────────────────────────────  scoreboard ──

/**
 * The scoreboard.
 *
 * Both sides are named, not just the one batting. A spectator arriving cold
 * needs to know who is playing before they can read a score, and the older
 * layout — which put the batting side alone above a large figure — made the
 * second team something you had to go looking for.
 */
function Scoreboard({ snapshot }: { snapshot: MatchSnapshot }) {
  const { batting, bowling, required, target } = snapshot;
  const quota = batting.oversQuota;
  const finished = Boolean(snapshot.resultText);

  return (
    <section className="live-panel overflow-hidden">
      <span aria-hidden className="live-stage-seam block" />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-7">
        <div className="flex items-center gap-2.5">
          <span className="eyebrow">Innings {snapshot.inningsNumber}</span>
          {quota ? (
            <>
              <span aria-hidden className="text-line-strong">
                ·
              </span>
              <span className="mono text-[0.6875rem] text-muted">{quota} overs</span>
            </>
          ) : null}
        </div>

        {/* A word and a dot, not a filled badge — the same mark the specimen on
            the front page uses, so the two read as one product. */}
        {finished ? (
          <span className="text-[0.6875rem] tracking-[0.16em] text-success uppercase">
            Result
          </span>
        ) : (
          <span className="flex items-center gap-2 text-[0.6875rem] tracking-[0.16em] text-live uppercase">
            <span aria-hidden className="live-pulse size-1.5 rounded-full bg-current" />
            Live
          </span>
        )}
      </div>

      <div className="px-5 py-7 sm:px-9 sm:py-9">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-7">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <TeamMark shortName={batting.short} color={batting.color} size="sm" />
              <p className="truncate text-[0.9375rem] text-secondary">{batting.name}</p>
            </div>

            {/* The one figure the page exists for. Everything else on this
                surface is sized in relation to it. */}
            <p className="score-figure mt-4 flex items-baseline text-[4.5rem] text-primary sm:text-[6.5rem]">
              <span key={batting.runs} className="figure-in">
                {batting.runs}
              </span>
              <span aria-hidden className="mx-[0.05em] font-normal text-muted">
                /
              </span>
              <span key={batting.wickets} className="figure-in text-muted">
                {batting.wickets}
              </span>
            </p>

            <p className="mono mt-2 text-[0.9375rem] text-secondary">
              <span key={batting.overs} className="figure-in inline-block text-primary">
                {batting.overs}
              </span>
              {quota ? <span className="text-muted">/{quota}</span> : null} overs
              <span className="mx-2.5 text-line-strong">·</span>
              <span className="text-muted">v {bowling.short}</span>
            </p>
          </div>

          <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
            <Metric label="Run rate" value={batting.runRate.toFixed(2)} />
            {target !== null ? <Metric label="Target" value={target} /> : null}
            {required ? (
              <Metric label="Req. rate" value={required.rrr.toFixed(2)} />
            ) : (
              <Metric label="Extras" value={snapshot.extras.total} />
            )}
          </dl>
        </div>

        {required && target !== null ? (
          <ChaseStrip
            runs={batting.runs}
            target={target}
            required={required}
            ballsBowled={batting.balls}
          />
        ) : null}

        {snapshot.resultText ? (
          <div className="mt-8 border-t border-line pt-6">
            <p className="serif text-[1.75rem] leading-tight text-primary sm:text-[2.25rem]">
              {snapshot.resultText}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dd className="mono text-[1.375rem] leading-none font-medium text-primary">{value}</dd>
      <dt className="eyebrow mt-2.5">{label}</dt>
    </div>
  );
}

/**
 * The chase, as one line and one bar.
 *
 * The bar carries two facts at once: the brass fill is runs made against the
 * target, and the pale marker is balls used against the allotment. A chase is
 * entirely a question of which of those reaches the end first, and drawing them
 * on the same track is what makes that legible without arithmetic.
 */
function ChaseStrip({
  runs,
  target,
  required,
  ballsBowled,
}: {
  runs: number;
  target: number;
  required: { runs: number; balls: number; rrr: number };
  ballsBowled: number;
}) {
  const runFraction = Math.min(1, runs / Math.max(1, target));
  const totalBalls = ballsBowled + required.balls;
  const ballFraction = totalBalls > 0 ? Math.min(1, ballsBowled / totalBalls) : 0;

  return (
    <div className="mt-8 border-t border-line pt-6">
      <p className="text-[1.0625rem] text-primary sm:text-xl">
        Need <span className="mono font-medium">{required.runs}</span> from{' '}
        <span className="mono font-medium">{required.balls}</span>{' '}
        {required.balls === 1 ? 'ball' : 'balls'}
      </p>

      <div
        className="chase-track mt-4"
        role="img"
        aria-label={`${runs} of ${target} runs made, ${ballsBowled} of ${totalBalls} balls used`}
      >
        <span className="chase-fill" style={{ width: `${runFraction * 100}%` }} />
        <span aria-hidden className="chase-marker" style={{ left: `${ballFraction * 100}%` }} />
      </div>

      <div className="mono mt-3 flex justify-between text-[0.6875rem] text-muted">
        <span>
          {runs} of {target}
        </span>
        <span>{required.balls} balls left</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────  live view ──

function LiveView({ snapshot }: { snapshot: MatchSnapshot }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <div className="flex flex-col gap-5">
        <Panel title="At the crease">
          {snapshot.batsmen.length === 0 ? (
            <p className="text-sm text-muted">Nobody at the crease yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {snapshot.batsmen.map((batsman) => (
                <div
                  key={batsman.playerId}
                  className={cn(
                    'flex items-center gap-3.5 rounded-[var(--radius-md)] border px-4 py-3.5',
                    'transition-colors duration-[var(--dur)]',
                    // The striker is marked by a stronger hairline and the word
                    // itself, not by a coloured fill.
                    batsman.onStrike ? 'border-line-strong bg-hover' : 'border-line bg-sunken',
                  )}
                >
                  <PlayerAvatar seed={batsman.playerId} name={batsman.name} size="sm" />

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[0.9375rem] font-medium text-primary">
                      {batsman.name}
                      {batsman.onStrike ? (
                        <span
                          aria-label="on strike"
                          className="mono text-[0.625rem] text-accent"
                          title="On strike"
                        >
                          ● striker
                        </span>
                      ) : null}
                    </p>
                    <p className="mono mt-1 text-[0.6875rem] text-muted">
                      {batsman.fours}×4 · {batsman.sixes}×6 · SR {batsman.sr.toFixed(1)}
                    </p>
                  </div>

                  <p className="mono shrink-0 text-right text-xl font-medium text-primary">
                    {batsman.runs}
                    <span className="ml-1 text-[0.8125rem] text-muted">({batsman.balls})</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="This over">
          {snapshot.thisOver.length === 0 ? (
            <p className="text-sm text-muted">No balls bowled yet this over.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              {snapshot.thisOver.map((ball, index) => (
                <span
                  key={`${index}-${ball}`}
                  // Only the newest chip lands; the rest are already there and
                  // re-animating the whole over on every ball would be noise.
                  className={index === snapshot.thisOver.length - 1 ? 'ball-land' : undefined}
                >
                  <BallChip display={ball} isWicket={ball.includes('W')} />
                </span>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="flex flex-col gap-5">
        {snapshot.bowler ? (
          <Panel title="Bowling">
            <div className="flex items-center gap-3.5">
              <PlayerAvatar
                seed={snapshot.bowler.playerId}
                name={snapshot.bowler.name}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-medium text-primary">
                  {snapshot.bowler.name}
                </p>
                <p className="mono mt-1 text-[0.6875rem] text-muted">
                  econ {snapshot.bowler.econ.toFixed(2)}
                </p>
              </div>
              <p className="mono shrink-0 text-lg font-medium text-primary">
                {snapshot.bowler.wickets}
                <span className="text-muted">/</span>
                {snapshot.bowler.runs}
              </p>
            </div>

            <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-line pt-4 text-center">
              <Figure label="O" value={snapshot.bowler.overs} />
              <Figure label="M" value={snapshot.bowler.maidens} />
              <Figure label="R" value={snapshot.bowler.runs} />
              <Figure label="W" value={snapshot.bowler.wickets} />
            </dl>
          </Panel>
        ) : null}

        <Panel title="Extras">
          <dl className="grid grid-cols-5 gap-2 text-center">
            <Figure label="Wd" value={snapshot.extras.wides} />
            <Figure label="Nb" value={snapshot.extras.noBalls} />
            <Figure label="B" value={snapshot.extras.byes} />
            <Figure label="Lb" value={snapshot.extras.legByes} />
            <Figure label="Total" value={snapshot.extras.total} emphasis />
          </dl>
        </Panel>

        {snapshot.fallOfWickets.length > 0 ? (
          <Panel title="Fall of wickets">
            <ol className="flex flex-col gap-2.5">
              {snapshot.fallOfWickets.map((wicket) => (
                <li key={wicket.wicket} className="flex items-baseline gap-3">
                  <span className="mono w-5 shrink-0 text-[0.6875rem] text-muted">
                    {wicket.wicket}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-secondary">
                    {wicket.name}
                  </span>
                  <span className="mono shrink-0 text-sm text-primary">
                    {wicket.teamRuns}
                    <span className="ml-1.5 text-[0.6875rem] text-muted">({wicket.overs})</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="live-panel px-5 py-5 sm:px-6">
      <p className="eyebrow mb-4">{title}</p>
      {children}
    </section>
  );
}

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dd
        className={cn(
          'mono text-[0.9375rem]',
          emphasis ? 'font-medium text-accent' : 'text-primary',
        )}
      >
        {value}
      </dd>
      <dt className="eyebrow mt-1.5 text-[0.625rem]">{label}</dt>
    </div>
  );
}

// ────────────────────────────────────────────────────────────  scorecard ──

interface ScorecardResponse {
  matchId: string;
  innings: Array<{
    number: number;
    battingTeam: { id: string; name: string; shortName: string; primaryColor: string };
    bowlingTeam: { id: string; name: string; shortName: string; primaryColor: string };
    runs: number;
    wickets: number;
    overs: string;
    extras: { wides: number; noBalls: number; byes: number; legByes: number; total: number };
    batting: Array<{
      playerId: string;
      name: string;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      isOut: boolean;
      dismissal: string;
    }>;
    bowling: Array<{
      playerId: string;
      name: string;
      overs: string;
      maidens: number;
      runs: number;
      wickets: number;
      figures: string;
    }>;
    fallOfWickets: Array<{ wicket: number; name: string; teamRuns: number; overs: string }>;
  }>;
}

/**
 * The full card, both innings, as a printed scorecard: ruled rows, no fills, the
 * dismissal spelled out under each batter's name the way a book records it.
 */
function ScorecardView({ slug }: { slug: string }) {
  const { data, isPending, error } = useQuery({
    queryKey: ['public', 'scorecard', slug],
    queryFn: () => apiFetch<ScorecardResponse>(`/public/matches/${slug}/scorecard`),
    // A viewer flicking to this tab mid-over wants the current card, not a cached
    // one from three overs ago.
    staleTime: 10_000,
  });

  if (isPending) return <Skeleton className="h-96" />;
  if (error) {
    return (
      <p role="alert" className="text-sm text-alert">
        The scorecard could not be loaded. The live score above is unaffected.
      </p>
    );
  }
  if (!data || data.innings.length === 0) {
    return <p className="text-sm text-muted">No innings have been played yet.</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      {data.innings.map((innings) => (
        <section key={innings.number} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TeamMark
                shortName={innings.battingTeam.shortName}
                color={innings.battingTeam.primaryColor}
                size="sm"
              />
              <div>
                <p className="eyebrow mb-1.5">Innings {innings.number}</p>
                <h3 className="serif text-xl text-primary">{innings.battingTeam.name}</h3>
              </div>
            </div>

            <p className="mono text-xl font-medium text-primary">
              {innings.runs}/{innings.wickets}
              <span className="ml-2 text-[0.8125rem] text-muted">({innings.overs} ov)</span>
            </p>
          </div>

          <div className="live-panel overflow-x-auto">
            <Table density="compact" className="min-w-[34rem]">
              <thead>
                <tr className="border-b border-line bg-sunken">
                  <th scope="col" className="eyebrow px-5 py-3.5 text-left font-medium">
                    Batter
                  </th>
                  <Th>R</Th>
                  <Th>B</Th>
                  <Th>4s</Th>
                  <Th>6s</Th>
                  <Th align="right" className="pr-5">SR</Th>
                </tr>
              </thead>

              <tbody>
                {innings.batting.map((batter) => (
                  <tr
                    key={batter.playerId}
                    className="border-b border-line transition-colors last:border-0 hover:bg-hover"
                  >
                    <td className="px-5 py-3.5">
                      <p className="flex items-center gap-2 text-primary">
                        <PlayerAvatar seed={batter.playerId} name={batter.name} size="xs" />
                        <span>{batter.name}</span>
                        {!batter.isOut ? <span className="text-accent">*</span> : null}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem] text-muted italic">
                        {batter.dismissal}
                      </p>
                    </td>
                    <Td emphasis>{batter.runs}</Td>
                    <Td>{batter.balls}</Td>
                    <Td>{batter.fours}</Td>
                    <Td>{batter.sixes}</Td>
                    <Td align="right" className="pr-5">
                      {batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : '—'}
                    </Td>
                  </tr>
                ))}

                <tr className="border-t border-line-strong bg-sunken">
                  <td className="px-5 py-3.5 text-[0.8125rem] text-secondary" colSpan={6}>
                    Extras {innings.extras.total}
                    <span className="mono ml-2 text-muted">
                      (w {innings.extras.wides}, nb {innings.extras.noBalls}, b{' '}
                      {innings.extras.byes}, lb {innings.extras.legByes})
                    </span>
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>

          <div className="live-panel overflow-x-auto">
            <Table density="compact" className="min-w-[30rem]">
              <thead>
                <tr className="border-b border-line bg-sunken">
                  <th scope="col" className="eyebrow px-5 py-3.5 text-left font-medium">
                    Bowler
                  </th>
                  <Th>O</Th>
                  <Th>M</Th>
                  <Th>R</Th>
                  <Th align="right" className="pr-5">W</Th>
                </tr>
              </thead>
              <tbody>
                {innings.bowling.map((bowler) => (
                  <tr
                    key={bowler.playerId}
                    className="border-b border-line transition-colors last:border-0 hover:bg-hover"
                  >
                    <td className="px-5 py-3.5 text-primary">
                      <span className="flex items-center gap-2">
                        <PlayerAvatar seed={bowler.playerId} name={bowler.name} size="xs" />
                        <span>{bowler.name}</span>
                      </span>
                    </td>
                    <Td>{bowler.overs}</Td>
                    <Td>{bowler.maidens}</Td>
                    <Td>{bowler.runs}</Td>
                    <Td align="right" emphasis className="pr-5">
                      {bowler.wickets}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {innings.fallOfWickets.length > 0 ? (
            <p className="text-[0.8125rem] text-secondary">
              <span className="eyebrow mr-3">Fall of wickets</span>
              {innings.fallOfWickets
                .map(
                  (wicket) =>
                    `${wicket.teamRuns}-${wicket.wicket} (${wicket.name}, ${wicket.overs})`,
                )
                .join(' · ')}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────  commentary ──

/**
 * Ball by ball, newest first, as a timeline: the over marks run down a rule so
 * an over reads as a block rather than as six unrelated rows.
 */
function CommentaryView({ snapshot }: { snapshot: MatchSnapshot }) {
  if (snapshot.recentBalls.length === 0) {
    return <p className="text-sm text-muted">Nothing bowled yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-2 border-l border-line pl-6">
      {snapshot.recentBalls
        .slice()
        .reverse()
        .map((ball) => (
          <li
            key={ball.seq}
            className="relative flex items-start gap-3.5 rounded-[var(--radius-md)] border border-line bg-raised px-4 py-3.5"
          >
            {/* The tick onto the timeline rule to the left. */}
            <span aria-hidden className="absolute top-1/2 -left-6 h-px w-5 bg-line" />

            <span className="mono w-9 shrink-0 pt-2 text-[0.6875rem] text-muted">
              {ball.overNumber}.{ball.ballNumber}
            </span>

            <BallChip display={ball.display} isWicket={ball.isWicket} />

            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] leading-snug font-medium text-primary">
                {commentaryLine(ball)}
              </p>
              <p className="mt-0.5 text-[0.75rem] text-muted">{describe(ball)}</p>
            </div>
          </li>
        ))}
    </ol>
  );
}

const commentary = {
  dot: ['A tidy leave.', 'Good defence.', 'Beaten for pace.', 'Dot ball, pressure builds.'],
  one: [
    'Nudged into the gap.',
    'They keep the scoreboard moving.',
    'Quick single taken.',
    'Smart cricket, just one.',
  ],
  two: [
    'Good running between the wickets.',
    'They come back for two.',
    'Placed perfectly for a couple.',
    'Two more added to the total.',
  ],
  three: [
    'They turn one into three.',
    'Excellent running out there.',
    'A busy three for the batting side.',
  ],
  four: ['Cracking stroke through the gap!', 'That races away for four.', 'Timed beautifully — boundary!'],
  six: ['That is launched into the stands!', 'Maximum! What a hit.', 'High, handsome, and six.'],
  wicket: ['The breakthrough arrives.', 'Gone! The bowler wins this duel.', 'That changes the momentum.'],
  extra: ['A gift to the batting side.', 'The extras keep ticking over.', 'Free runs on the board.'],
} as const;

function commentaryLine(ball: BallSummary): string {
  const key = ball.isWicket
    ? 'wicket'
    : ball.extraType
      ? 'extra'
      : ball.runs === 6
        ? 'six'
        : ball.runs === 4
          ? 'four'
          : ball.runs === 3
            ? 'three'
            : ball.runs === 2
              ? 'two'
              : ball.runs === 1
                ? 'one'
                : 'dot';
  const lines = commentary[key];
  return lines[ball.seq % lines.length] ?? lines[0];
}

function describe(ball: BallSummary): string {
  if (ball.isWicket) return 'Wicket falls.';

  switch (ball.extraType) {
    case 'WIDE':
      return ball.runs > 1 ? `Wide, ${ball.runs} runs.` : 'Wide.';
    case 'NO_BALL':
      return ball.runs > 1 ? `No ball, ${ball.runs} runs.` : 'No ball.';
    case 'BYE':
      return `${ball.runs} bye${ball.runs === 1 ? '' : 's'}.`;
    case 'LEG_BYE':
      return `${ball.runs} leg bye${ball.runs === 1 ? '' : 's'}.`;
    default:
      break;
  }

  if (ball.runs === 0) return 'No run.';
  if (ball.runs === 4) return 'Four.';
  if (ball.runs === 6) return 'Six.';
  return `${ball.runs} run${ball.runs === 1 ? '' : 's'}.`;
}

/**
 * Connection state, shown only when there is something wrong with it.
 *
 * A healthy socket is silent here: the scoreboard already says "Live", and a
 * second badge saying the same word in the same eyeline was the page telling
 * you twice. What a viewer actually needs to know is the opposite — that the
 * number in front of them may have stopped moving.
 */
function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === 'live') return null;

  const config: Record<Exclude<ConnectionState, 'live'>, { label: string; tone: 'warning' | 'neutral' }> = {
    connecting: { label: 'Connecting', tone: 'neutral' },
    reconnecting: { label: 'Reconnecting', tone: 'warning' },
    offline: { label: 'Offline', tone: 'neutral' },
  };

  const { label, tone } = config[state];

  return <Pill tone={tone}>{label}</Pill>;
}

/**
 * True once the scoreboard has scrolled out of the way. A plain threshold on
 * scrollY rather than an observer: there is one element, the number is fixed,
 * and state only flips twice per page.
 */
function useCondensedHeader(threshold = 220): boolean {
  const [condensed, setCondensed] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    const update = () => {
      frame.current = 0;
      setCondensed(window.scrollY > threshold);
    };

    const onScroll = () => {
      if (frame.current === 0) frame.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (frame.current !== 0) window.cancelAnimationFrame(frame.current);
      window.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);

  return condensed;
}
