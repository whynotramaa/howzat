import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { BallSummary, FallOfWicket, MatchSnapshot } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { Tabs } from '@/components/ui/Tabs';
import { Table, Td, Th } from '@/components/ui/Table';
import { Wordmark } from '@/components/Wordmark';
import { ClockIcon, EyeIcon, StumpsIcon, TrendIcon, TrophyIcon } from '@/components/ui/Icons';
import {
  BallChip,
  CreaseCard,
  LeaderRow,
  OverStrip,
  Panel,
  RunsPerOver,
  Scoreboard,
  StatLine,
} from '@/components/ui/Score';
import { cn } from '@/lib/cn';
import { MomentOverlay, SketchFilter, useMoment } from './Moment';
import { useLiveMatch, type ConnectionState } from './useLiveMatch';

/*
 * The public page.
 *
 * A spectator wants one number first and the detail second, so the board is
 * the only loud thing on the page and everything under it is a ruled sheet.
 */
type View = 'live' | 'scorecard' | 'commentary';

const VIEWS = [
  { value: 'live' as const, label: 'Live' },
  { value: 'scorecard' as const, label: 'Scorecard' },
  { value: 'commentary' as const, label: 'Ball by ball' },
];

export function LiveMatchPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { snapshot, connection, viewers, error, isLoading, notStarted } = useLiveMatch(slug);
  const requested = searchParams.get('view');
  const [view, setView] = useState<View>(
    VIEWS.some((item) => item.value === requested) ? (requested as View) : 'live',
  );
  const condensed = useCondensedHeader();
  const moment = useMoment(snapshot?.lastEventSeq ?? 0, snapshot?.recentBalls ?? EMPTY_BALLS);

  const matchLabel = snapshot ? `${snapshot.batting.short} v ${snapshot.bowling.short}` : undefined;

  useEffect(() => {
    if (!snapshot) return;
    document.title = `${matchLabel} — ${snapshot.batting.runs}/${snapshot.batting.wickets} · Howzat`;
  }, [matchLabel, snapshot]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SketchFilter />
      <MomentOverlay moment={moment} />

      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--surface)_84%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[72rem] items-center gap-4 px-5 sm:px-8">
          <Link to="/" className="shrink-0 transition-opacity hover:opacity-70">
            <Wordmark size="sm" />
          </Link>

          {snapshot ? (
            <div
              aria-hidden={!condensed}
              data-shown={condensed}
              className="live-condensed hidden min-w-0 items-center gap-3 sm:flex"
            >
              <span aria-hidden className="h-5 w-px bg-line" />
              <TeamMark
                shortName={snapshot.batting.short}
                color={snapshot.batting.color}
                size="sm"
              />
              <p className="score-figure text-lg text-primary">
                {snapshot.batting.runs}
                <span className="text-muted">/{snapshot.batting.wickets}</span>
                <span className="mono ml-2 text-[0.8125rem] font-normal text-muted">
                  ({snapshot.batting.overs})
                </span>
              </p>
            </div>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
            {viewers > 0 ? (
              <span
                title={`${viewers} watching now`}
                className="mono flex items-center gap-1.5 text-[0.6875rem] text-muted"
              >
                <EyeIcon />
                <span key={viewers} className="figure-in tabular text-secondary">
                  {viewers.toLocaleString()}
                </span>
                <span className="hidden sm:inline">watching</span>
              </span>
            ) : null}
            <ConnectionBadge state={connection} />
            {snapshot ? (
              <ShareLink slug={slug} variant="quiet" matchLabel={matchLabel} label="Share" />
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[72rem] flex-1 px-5 py-7 sm:px-8 sm:py-10">
        {isLoading ? (
          <div className="flex flex-col gap-6">
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
          <NotStarted />
        ) : snapshot ? (
          <div className="flex flex-col gap-7">
            <Board snapshot={snapshot} slug={slug} />

            <Tabs items={VIEWS} value={view} onChange={setView} />

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

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[72rem] flex-wrap items-center justify-between gap-3 px-5 py-7 sm:px-8">
          <p className="text-[0.8125rem] text-muted">
            Scored ball by ball on <span className="text-primary">Howzat</span>.
          </p>
          <Link to="/" className="text-[0.8125rem] text-accent transition-opacity hover:opacity-70">
            Run your own tournament →
          </Link>
        </div>
      </footer>
    </div>
  );
}

const EMPTY_BALLS: BallSummary[] = [];

function NotStarted() {
  return (
    <section className="crop relative flex flex-col items-center gap-5 rounded-[var(--radius-lg)] border border-line bg-raised px-6 py-20 text-center">
      <DrawnBall />
      <p className="eyebrow">Not a ball bowled yet</p>
      <p className="hand text-[2.5rem] text-primary">the first delivery lands here</p>
      <p className="max-w-md text-secondary">
        The score appears the moment the scorer records a ball. Leave this open, it updates itself.
      </p>
    </section>
  );
}

/** A ball, drawn rather than iconified. Seam first, then the shine. */
function DrawnBall() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden className="sketch size-16 text-muted">
      <circle
        cx="40"
        cy="40"
        r="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="ink-draw"
        style={{ '--len': 180 } as React.CSSProperties}
      />
      <path
        d="M26 24 C 34 38, 34 44, 26 56"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="ink-draw"
        style={{ '--len': 60, '--i': 1 } as React.CSSProperties}
      />
      <path
        d="M54 24 C 46 38, 46 44, 54 56"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="ink-draw"
        style={{ '--len': 60, '--i': 2 } as React.CSSProperties}
      />
    </svg>
  );
}

/* ── The board ───────────────────────────────────────────────────────────── */

function Board({ snapshot, slug }: { snapshot: MatchSnapshot; slug: string }) {
  const { batting, bowling, required, target } = snapshot;
  const quota = batting.quotaOvers ?? (batting.oversQuota ? String(batting.oversQuota) : null);
  const finished = Boolean(snapshot.resultText);

  return (
    <Scoreboard
      team={{ name: batting.name, shortName: batting.short, primaryColor: batting.color }}
      eyebrow={`Innings ${snapshot.inningsNumber} · v ${bowling.short}`}
      status={
        finished ? (
          <span data-tone="success" className="eyebrow">
            Result
          </span>
        ) : (
          <span data-tone="live" className="eyebrow flex items-center gap-2">
            <span aria-hidden className="live-pulse size-1.5 rounded-full bg-current" />
            Live
          </span>
        )
      }
      runs={batting.runs}
      wickets={batting.wickets}
      overs={batting.overs}
      quota={quota}
    >
      {snapshot.resultText ? (
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-6 sm:px-9">
          <p className="serif flex min-w-0 items-center gap-3 text-[1.5rem] text-primary">
            <TrophyIcon className="size-6 shrink-0 text-muted" />
            {snapshot.resultText}
          </p>
          <PdfButton
            size="md"
            variant="secondary"
            build={() => import('@/lib/pdf').then((pdf) => pdf.buildCricketMatchPdf(slug))}
          />
        </div>
      ) : required && target !== null ? (
        <div className="px-5 py-6 sm:px-9">
          <p className="text-[1.125rem] text-primary">
            <span className="font-medium">{batting.short}</span> need{' '}
            <span className="mono font-medium text-accent">{required.runs}</span> from{' '}
            <span className="mono font-medium">{required.balls}</span>{' '}
            {required.balls === 1 ? 'ball' : 'balls'}
          </p>

          <div className="chase-track mt-4">
            <span
              className="chase-fill"
              style={{ width: `${Math.min(100, (batting.runs / Math.max(1, target)) * 100)}%` }}
            />
            <span
              aria-hidden
              className="chase-marker"
              style={{
                left: `${
                  batting.balls + required.balls > 0
                    ? (batting.balls / (batting.balls + required.balls)) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="mono mt-3 flex justify-between text-[0.6875rem] text-muted">
            <span>
              {batting.runs} of {target}
            </span>
            <span>{required.balls} balls left</span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line px-5 py-4 sm:px-9">
        <p className="eyebrow flex items-center gap-2">
          <ClockIcon />
          This over
        </p>
        <OverStrip
          balls={snapshot.thisOver.map((ball, index) => ({
            key: `${index}-${ball}`,
            display: ball,
          }))}
          emptyLabel="First ball of the over coming up"
        />
      </div>
    </Scoreboard>
  );
}

/* ── Live ────────────────────────────────────────────────────────────────── */

function LiveView({ snapshot }: { snapshot: MatchSnapshot }) {
  const window = recentWindow(snapshot.recentBalls);
  const partnership = currentPartnership(snapshot);
  const { extras } = snapshot;

  return (
    <div className="flex flex-col gap-7">
      <CreaseCard
        batters={snapshot.batsmen.map((batsman) => ({
          id: batsman.playerId,
          name: batsman.name,
          runs: batsman.runs,
          balls: batsman.balls,
          fours: batsman.fours,
          sixes: batsman.sixes,
          onStrike: batsman.onStrike,
        }))}
        bowler={
          snapshot.bowler
            ? {
                name: snapshot.bowler.name,
                overs: snapshot.bowler.overs,
                maidens: snapshot.bowler.maidens,
                runs: snapshot.bowler.runs,
                wickets: snapshot.bowler.wickets,
                econ: snapshot.bowler.econ,
              }
            : null
        }
      />

      <StatLine
        items={[
          { label: 'Run rate', value: snapshot.batting.runRate.toFixed(2) },
          ...(snapshot.required
            ? [
                {
                  label: 'Required',
                  value: snapshot.required.rrr.toFixed(2),
                  tone: 'live' as const,
                },
              ]
            : []),
          { label: 'Partnership', value: `${partnership.runs} (${partnership.balls})` },
          {
            label: 'Extras',
            value: `${extras.total} · w${extras.wides} nb${extras.noBalls} b${extras.byes} lb${extras.legByes}`,
          },
        ]}
        note={`${window.fours}×4 and ${window.sixes}×6 in the last ${window.balls}`}
      />

      <Panel
        title="Momentum"
        icon={<TrendIcon />}
        meta={<span className="mono text-[0.6875rem] text-muted">runs per over</span>}
        bodyClassName="flex flex-col gap-5 p-5"
      >
        <RunsPerOver balls={snapshot.recentBalls} />

        <div className="flex flex-col gap-2.5 border-t border-line pt-4">
          <LeaderRow
            label={`Last ${window.balls} balls`}
            value={`${window.runs} runs · ${window.wickets}w`}
            emphasis
          />
          <LeaderRow
            label="Dot balls"
            value={window.balls > 0 ? `${Math.round((window.dots / window.balls) * 100)}%` : '—'}
          />
        </div>
      </Panel>

      {snapshot.fallOfWickets.length > 0 ? (
        <Panel
          title="Fall of wickets"
          icon={<StumpsIcon />}
          bodyClassName="flex flex-col gap-2.5 p-5"
        >
          {snapshot.fallOfWickets
            .slice()
            .reverse()
            .map((wicket) => (
              <LeaderRow
                key={wicket.wicket}
                label={`${wicket.wicket}. ${wicket.name}`}
                value={`${wicket.teamRuns} (${wicket.overs})`}
              />
            ))}
        </Panel>
      ) : null}
    </div>
  );
}

/* ── Derivations ─────────────────────────────────────────────────────────── */

function oversToBalls(overs: string): number {
  const [whole = '0', part = '0'] = overs.split('.');
  return Number(whole) * 6 + Number(part);
}

/**
 * The unbroken stand. Runs come exactly from the last fall of wicket; balls
 * come from the over count at that fall, which is why both are honest numbers
 * rather than a guess off the recent-ball window.
 */
function currentPartnership(snapshot: MatchSnapshot): { runs: number; balls: number } {
  const last: FallOfWicket | undefined = snapshot.fallOfWickets[snapshot.fallOfWickets.length - 1];

  return {
    runs: snapshot.batting.runs - (last?.teamRuns ?? 0),
    balls: snapshot.batting.balls - (last ? oversToBalls(last.overs) : 0),
  };
}

interface BallWindow {
  balls: number;
  runs: number;
  dots: number;
  fours: number;
  sixes: number;
  wickets: number;
}

/** Everything the snapshot can honestly say: the last 30 deliveries, no more. */
function recentWindow(recentBalls: BallSummary[]): BallWindow {
  return recentBalls.reduce<BallWindow>(
    (totals, ball) => ({
      balls: totals.balls + (ball.isLegalDelivery ? 1 : 0),
      runs: totals.runs + ball.runs,
      dots: totals.dots + (ball.isLegalDelivery && ball.runs === 0 ? 1 : 0),
      fours: totals.fours + (!ball.extraType && ball.runs === 4 ? 1 : 0),
      sixes: totals.sixes + (!ball.extraType && ball.runs === 6 ? 1 : 0),
      wickets: totals.wickets + (ball.isWicket ? 1 : 0),
    }),
    { balls: 0, runs: 0, dots: 0, fours: 0, sixes: 0, wickets: 0 },
  );
}

/* ── Scorecard ───────────────────────────────────────────────────────────── */

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

function ScorecardView({ slug }: { slug: string }) {
  const { data, isPending, error } = useQuery({
    queryKey: ['public', 'scorecard', slug],
    queryFn: () => apiFetch<ScorecardResponse>(`/public/matches/${slug}/scorecard`),
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
    <div className="flex flex-col gap-8">
      {data.innings.map((innings) => (
        <section
          key={innings.number}
          className="rounded-[var(--radius-lg)] border border-line bg-raised"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <TeamMark
                shortName={innings.battingTeam.shortName}
                color={innings.battingTeam.primaryColor}
                size="sm"
              />
              <div>
                <p className="eyebrow">Innings {innings.number}</p>
                <h3 className="mt-2 font-medium text-primary">{innings.battingTeam.name}</h3>
              </div>
            </div>

            <p className="score-figure text-[1.875rem] text-primary">
              {innings.runs}
              <span className="text-muted">/{innings.wickets}</span>
              <span className="mono ml-2.5 text-[0.8125rem] font-normal text-muted">
                ({innings.overs} ov)
              </span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[34rem]">
              <thead>
                <tr className="border-b border-line">
                  <Th align="left" className="pl-5 sm:pl-7">
                    Batter
                  </Th>
                  <Th align="right">R</Th>
                  <Th align="right">B</Th>
                  <Th align="right">4s</Th>
                  <Th align="right">6s</Th>
                  <Th align="right" className="pr-5 sm:pr-7">
                    SR
                  </Th>
                </tr>
              </thead>
              <tbody>
                {innings.batting.map((batter) => (
                  <tr key={batter.playerId} className="border-b border-line last:border-b-0">
                    <td className="py-3.5 pl-5 sm:pl-7">
                      <p className="flex items-center gap-2 text-sm text-primary">
                        <span className="font-medium">{batter.name}</span>
                        {!batter.isOut ? (
                          <span className="mono text-[0.6875rem] text-success" title="Not out">
                            not out
                          </span>
                        ) : null}
                      </p>
                      {batter.isOut ? (
                        <p className="mt-1 text-[0.6875rem] text-muted">{batter.dismissal}</p>
                      ) : null}
                    </td>
                    <Td align="right" emphasis>
                      {batter.runs}
                    </Td>
                    <Td align="right">{batter.balls}</Td>
                    <Td align="right">{batter.fours}</Td>
                    <Td align="right">{batter.sixes}</Td>
                    <Td align="right" className="pr-5 sm:pr-7">
                      {batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <p className="border-t border-line px-5 py-4 text-[0.8125rem] text-secondary sm:px-7">
            <span className="eyebrow mr-3">Extras</span>
            <span className="mono text-primary">{innings.extras.total}</span>
            <span className="mono ml-2 text-muted">
              (w {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb{' '}
              {innings.extras.legByes})
            </span>
          </p>

          <div className="overflow-x-auto border-t border-line">
            <Table className="min-w-[30rem]">
              <thead>
                <tr className="border-b border-line">
                  <Th align="left" className="pl-5 sm:pl-7">
                    Bowler
                  </Th>
                  <Th align="right">O</Th>
                  <Th align="right">M</Th>
                  <Th align="right">R</Th>
                  <Th align="right" className="pr-5 sm:pr-7">
                    W
                  </Th>
                </tr>
              </thead>
              <tbody>
                {innings.bowling.map((bowler) => (
                  <tr key={bowler.playerId} className="border-b border-line last:border-b-0">
                    <td className="py-3.5 pl-5 text-sm font-medium text-primary sm:pl-7">
                      {bowler.name}
                    </td>
                    <Td align="right">{bowler.overs}</Td>
                    <Td align="right">{bowler.maidens}</Td>
                    <Td align="right">{bowler.runs}</Td>
                    <Td align="right" emphasis className="pr-5 sm:pr-7">
                      {bowler.wickets}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {innings.fallOfWickets.length > 0 ? (
            <p className="border-t border-line px-5 py-4 text-[0.8125rem] text-secondary sm:px-7">
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

/* ── Commentary ──────────────────────────────────────────────────────────── */

function CommentaryView({ snapshot }: { snapshot: MatchSnapshot }) {
  if (snapshot.recentBalls.length === 0) {
    return <p className="text-sm text-muted">Nothing bowled yet.</p>;
  }

  return (
    <ol className="rounded-[var(--radius-lg)] border border-line bg-raised">
      {snapshot.recentBalls
        .slice()
        .reverse()
        .map((ball) => {
          const big = ball.isWicket || (!ball.extraType && (ball.runs === 4 || ball.runs === 6));

          return (
            <li
              key={ball.seq}
              className="flex items-start gap-4 border-b border-line px-5 py-4 last:border-b-0"
            >
              <BallChip display={ball.display} isWicket={ball.isWicket} />

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="mono text-[0.6875rem] text-muted">
                    {ball.overNumber}.{ball.ballNumber}
                  </span>
                  <span data-tone={ball.isWicket ? 'live' : undefined} className="eyebrow">
                    {eventLabel(ball)}
                  </span>
                </p>
                <p
                  className={cn(
                    'mt-1.5 leading-snug',
                    big ? 'text-primary' : 'text-[0.9375rem] text-secondary',
                  )}
                >
                  {commentaryLine(ball)}
                </p>
              </div>
            </li>
          );
        })}
    </ol>
  );
}

function eventLabel(ball: BallSummary): string {
  if (ball.isWicket) return 'Wicket';
  switch (ball.extraType) {
    case 'WIDE':
      return ball.runs > 1 ? `Wide, ${ball.runs}` : 'Wide';
    case 'NO_BALL':
      return ball.runs > 1 ? `No ball, ${ball.runs}` : 'No ball';
    case 'BYE':
      return `${ball.runs} bye${ball.runs === 1 ? '' : 's'}`;
    case 'LEG_BYE':
      return `${ball.runs} leg bye${ball.runs === 1 ? '' : 's'}`;
    default:
      break;
  }
  if (ball.runs === 0) return 'Dot ball';
  if (ball.runs === 4) return 'Four';
  if (ball.runs === 6) return 'Six';
  return `${ball.runs} run${ball.runs === 1 ? '' : 's'}`;
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
  four: [
    'Cracking stroke through the gap!',
    'That races away for four.',
    'Timed beautifully, boundary!',
  ],
  six: ['That is launched into the stands!', 'Maximum! What a hit.', 'High, handsome, and six.'],
  wicket: [
    'The breakthrough arrives.',
    'Gone! The bowler wins this duel.',
    'That changes the momentum.',
  ],
  extra: [
    'A gift to the batting side.',
    'The extras keep ticking over.',
    'Free runs on the board.',
  ],
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

/* ── Chrome ──────────────────────────────────────────────────────────────── */

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === 'live') return null;

  const labels: Record<Exclude<ConnectionState, 'live'>, string> = {
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    offline: 'Offline',
  };

  return (
    <span className="eyebrow flex items-center gap-2 text-muted">
      <span aria-hidden className="live-pulse size-1.5 rounded-full bg-current" />
      {labels[state]}
    </span>
  );
}

function useCondensedHeader(threshold = 260): boolean {
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
