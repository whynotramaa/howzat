import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { BallSummary, FallOfWicket, MatchSnapshot } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { EmptyState } from '@/components/ui/Card';
import { SketchDefs } from '@/components/ui/Sketch';
import { TeamMark } from '@/components/ui/Pill';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { Tabs } from '@/components/ui/Tabs';
import { Table, Td, Th } from '@/components/ui/Table';
import { Wordmark } from '@/components/Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { EyeIcon, TrendIcon, TrophyIcon } from '@/components/ui/Icons';
import {
  BallChip,
  LeaderRow,
  OverStrip,
  Panel,
  RunsPerOver,
  Scoreboard,
} from '@/components/ui/Score';
import { cn } from '@/lib/cn';
import { MomentOverlay, useMoment } from './Moment';
import { useLiveMatch, type ConnectionState } from './useLiveMatch';

type View = 'live' | 'scorecard' | 'commentary';

const VIEWS = [
  { value: 'live' as const, label: 'Live' },
  { value: 'scorecard' as const, label: 'Scorecard' },
  { value: 'commentary' as const, label: 'Ball by ball' },
];

export function LiveMatchPage() {
  const { slug = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { snapshot, connection, viewers, error, isLoading, notStarted } = useLiveMatch(slug);
  const requested = searchParams.get('view');
  const view: View = VIEWS.some((item) => item.value === requested) ? (requested as View) : 'live';
  const setView = (next: View) => setSearchParams({ view: next }, { replace: true });
  const condensed = useCondensedHeader();
  const moment = useMoment(snapshot?.lastEventSeq ?? 0, snapshot?.recentBalls ?? EMPTY_BALLS);

  const matchLabel = snapshot ? `${snapshot.batting.short} v ${snapshot.bowling.short}` : undefined;

  useEffect(() => {
    if (!snapshot) return;
    document.title = `${matchLabel} · ${snapshot.batting.runs}/${snapshot.batting.wickets} · Howzat`;
  }, [matchLabel, snapshot]);

  return (
    <div className="live-page flex min-h-dvh flex-col" data-view={view}>
      <MomentOverlay moment={moment} />
      <SketchDefs />

      <header className="app-topbar border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-[64rem] items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <Link
            to="/"
            className={cn(
              'shrink-0 transition-opacity hover:opacity-70',
              condensed && 'max-sm:hidden',
            )}
          >
            <Wordmark size="sm" className="max-sm:[&>span]:hidden" />
          </Link>

          {snapshot ? (
            <div
              aria-hidden={!condensed}
              data-shown={condensed}
              className="live-condensed flex min-w-0 items-center gap-2"
            >
              <span aria-hidden className="h-5 w-px bg-line" />
              <TeamMark
                shortName={snapshot.batting.short}
                color={snapshot.batting.color}
                size="sm"
              />
              <p className="score-figure text-lg text-primary">
                {snapshot.batting.runs}-{snapshot.batting.wickets}
                <span className="tabular ml-2 text-[0.8125rem] font-medium text-muted">
                  ({snapshot.batting.overs})
                </span>
              </p>
            </div>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {viewers > 0 ? (
              <span
                title={`${viewers} watching now`}
                className="hidden items-center gap-1.5 text-xs text-muted sm:flex"
              >
                <EyeIcon />
                <span key={viewers} className="figure-in tabular text-secondary">
                  {viewers.toLocaleString()}
                </span>
              </span>
            ) : null}
            <ConnectionBadge state={connection} />
            {snapshot ? (
              <ShareLink slug={slug} variant="quiet" matchLabel={matchLabel} label="Share" />
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[64rem] flex-1 px-4 py-5 sm:px-6 sm:py-8">
        {isLoading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-72" />
            <Skeleton className="h-40" />
          </div>
        ) : error && !snapshot ? (
          <EmptyState
            scene="scorebook"
            title="This match could not be loaded"
            description={error}
            action={
              <button
                type="button"
                className="min-h-11 rounded-md border border-line-strong px-5 text-sm font-medium"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            }
          />
        ) : notStarted ? (
          <NotStarted />
        ) : snapshot ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 py-1">
              <h1 className="text-base font-semibold">
                {snapshot.batting.short} <span className="mx-1 font-normal text-muted">v</span>{' '}
                {snapshot.bowling.short}
              </h1>
              <span className="text-xs text-secondary">Innings {snapshot.inningsNumber}</span>
            </div>
            <Board snapshot={snapshot} slug={slug} compact={view !== 'live'} />
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
        <div className="mx-auto flex h-12 w-full max-w-[64rem] items-center justify-between gap-3 px-4 text-xs text-muted sm:px-6">
          <span>Scored on Howzat</span>
          <Link to="/" className="hover:text-primary">
            Run a tournament
          </Link>
        </div>
      </footer>
    </div>
  );
}

const EMPTY_BALLS: BallSummary[] = [];

function NotStarted() {
  return (
    <EmptyState
      scene="stumps"
      title="Not started yet"
      description="Updates begin with the first ball."
    />
  );
}

function Board({
  snapshot,
  slug,
  compact,
}: {
  snapshot: MatchSnapshot;
  slug: string;
  compact: boolean;
}) {
  const { batting, bowling, required, target } = snapshot;
  const quota = batting.quotaOvers ?? (batting.oversQuota ? String(batting.oversQuota) : null);
  const finished = Boolean(snapshot.resultText);

  return (
    <Scoreboard
      size={compact ? 'md' : 'lg'}
      team={{ name: batting.name, shortName: batting.short, primaryColor: batting.color }}
      eyebrow={`Innings ${snapshot.inningsNumber} · v ${bowling.short}`}
      status={
        finished ? (
          <span data-tone="success" className="eyebrow">
            Result
          </span>
        ) : (
          <span data-tone="live" className="eyebrow flex items-center gap-2">
            <span aria-hidden className="live-dot" />
            Live
          </span>
        )
      }
      runs={batting.runs}
      wickets={batting.wickets}
      overs={batting.overs}
      quota={quota}
      stats={[
        { label: 'CRR', value: batting.runRate.toFixed(2) },
        ...(required ? [{ label: 'RRR', value: required.rrr.toFixed(2) }] : []),
      ]}
    >
      {snapshot.resultText ? (
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-3 sm:px-6">
          <p className="flex min-w-0 items-center gap-2 text-[0.8125rem] font-semibold">
            <TrophyIcon className="size-4 shrink-0 text-accent" />
            {snapshot.resultText}
          </p>
          <PdfButton
            size="sm"
            variant="secondary"
            build={() => import('@/lib/pdf').then((pdf) => pdf.buildCricketMatchPdf(slug))}
          />
        </div>
      ) : required && target !== null ? (
        <div className="px-4 py-3 sm:px-6">
          <p className="text-sm text-secondary">
            <span className="font-semibold text-primary">{batting.short}</span> need{' '}
            <span className="font-bold text-accent">{required.runs}</span> runs from{' '}
            <span className="font-bold text-primary">{required.balls}</span>{' '}
            {required.balls === 1 ? 'ball' : 'balls'}
          </p>

          <div className="chase-track mt-2.5">
            <span
              className="chase-fill"
              style={{ width: `${Math.min(100, (batting.runs / Math.max(1, target)) * 100)}%` }}
            />
          </div>

          <div className="tabular mt-2 flex justify-between text-[0.6875rem] text-muted">
            <span>
              {batting.runs} of {target}
            </span>
            <span>{required.balls} balls left</span>
          </div>
        </div>
      ) : null}

      {!compact ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 sm:px-6">
          <p className="eyebrow">This over</p>
          <OverStrip
            size="sm"
            balls={snapshot.thisOver.map((ball, index) => ({
              key: `${index}-${ball}`,
              display: ball,
            }))}
            emptyLabel="New over"
          />
        </div>
      ) : null}
    </Scoreboard>
  );
}

function LiveView({ snapshot }: { snapshot: MatchSnapshot }) {
  const window = recentWindow(snapshot.recentBalls);
  const partnership = currentPartnership(snapshot);
  const { extras, bowler } = snapshot;
  const lastWicket = snapshot.fallOfWickets.at(-1);

  return (
    <div className="live-summary grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="scorecard-section live-crease" aria-label="At the crease">
          <Table density="compact" className="scorecard-table live-batting-table">
            <caption className="sr-only">Current batters</caption>
            <colgroup>
              <col />
              <col className="live-runs-col" />
              <col className="scorecard-number-col" />
              <col className="scorecard-number-col" />
              <col className="scorecard-rate-col" />
            </colgroup>
            <thead>
              <tr>
                <Th align="left">Batter</Th>
                <Th align="right">
                  <abbr title="Runs (balls)" className="no-underline">
                    R(B)
                  </abbr>
                </Th>
                <Th align="right">4s</Th>
                <Th align="right">6s</Th>
                <Th align="right">SR</Th>
              </tr>
            </thead>
            <tbody>
              {snapshot.batsmen.map((batter) => (
                <tr key={batter.playerId}>
                  <td className="scorecard-player">
                    <span className="font-medium text-primary">{batter.name}</span>
                    {batter.onStrike ? (
                      <span className="live-striker">
                        <span aria-hidden>●</span>
                        <span className="sr-only"> on strike</span>
                      </span>
                    ) : null}
                  </td>
                  <Td align="right">
                    <strong className="text-primary">{batter.runs}</strong>
                    <span className="live-balls"> ({batter.balls})</span>
                  </Td>
                  <Td align="right">{batter.fours}</Td>
                  <Td align="right">{batter.sixes}</Td>
                  <Td align="right">{batter.sr.toFixed(1)}</Td>
                </tr>
              ))}
              {snapshot.batsmen.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-sm text-muted">
                    No batters at the crease
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>

          <dl className="live-partnership">
            <div>
              <dt>Partnership</dt>
              <dd className="tabular">
                {partnership.runs} <span className="text-muted">({partnership.balls})</span>
              </dd>
            </div>
            {lastWicket ? (
              <div>
                <dt>Last wicket</dt>
                <dd className="tabular">
                  {lastWicket.teamRuns}/{lastWicket.wicket}{' '}
                  <span className="text-muted">({lastWicket.overs} ov)</span>
                </dd>
              </div>
            ) : null}
          </dl>

          <Table density="compact" className="scorecard-table live-bowling-table">
            <caption className="sr-only">Current bowler</caption>
            <colgroup>
              <col />
              <col className="live-runs-col" />
              <col className="live-runs-col" />
              <col className="scorecard-rate-col" />
            </colgroup>
            <thead>
              <tr>
                <Th align="left">Bowler</Th>
                <Th align="right">W-R</Th>
                <Th align="right">Overs</Th>
                <Th align="right">Econ</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="scorecard-player font-medium text-primary">
                  {bowler?.name ?? 'Not named'}
                </td>
                <Td align="right" emphasis>
                  {bowler ? `${bowler.wickets}-${bowler.runs}` : '—'}
                </Td>
                <Td align="right">{bowler?.overs ?? '—'}</Td>
                <Td align="right">{bowler?.econ != null ? bowler.econ.toFixed(2) : '—'}</Td>
              </tr>
            </tbody>
          </Table>
          <div className="live-extras">
            <span>Extras</span>
            <span className="tabular">
              <strong className="text-primary">{extras.total}</strong>
              <span className="text-muted">
                {' '}
                (w {extras.wides}, nb {extras.noBalls}, b {extras.byes}, lb {extras.legByes})
              </span>
            </span>
          </div>
        </section>

        {snapshot.fallOfWickets.length > 0 ? (
          <details className="scorecard-section live-wicket-history">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[0.8125rem] font-medium">
              Fall of wickets{' '}
              <span aria-hidden className="live-history-arrow text-muted">
                ⌄
              </span>
            </summary>
            <ol className="scorecard-wickets">
              {snapshot.fallOfWickets.map((wicket) => (
                <li key={wicket.wicket}>
                  <span className="tabular font-bold">
                    {wicket.teamRuns}/{wicket.wicket}
                  </span>
                  <span className="min-w-0 flex-1 text-secondary">{wicket.name}</span>
                  <span className="tabular text-muted">{wicket.overs} ov</span>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>

      <Panel
        title="Runs per over"
        icon={<TrendIcon />}
        className="live-momentum"
        bodyClassName="flex flex-col gap-4"
      >
        <RunsPerOver balls={snapshot.recentBalls} />
        <div className="flex flex-col gap-2 border-t border-line pt-3">
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
    </div>
  );
}

function oversToBalls(overs: string): number {
  const [whole = '0', part = '0'] = overs.split('.');
  return Number(whole) * 6 + Number(part);
}

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
  const [selectedInnings, setSelectedInnings] = useState<number | null>(null);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['public', 'scorecard', slug],
    queryFn: () => apiFetch<ScorecardResponse>(`/public/matches/${slug}/scorecard`),
    staleTime: 10_000,
  });

  if (isPending) return <Skeleton className="h-96" />;
  if (error) return <ErrorText error={error} onRetry={() => void refetch()} />;
  const innings =
    data?.innings.find((entry) => entry.number === selectedInnings) ?? data?.innings.at(-1);
  if (!innings) return <p className="text-sm text-muted">No innings yet</p>;

  const balls = oversToBalls(innings.overs);
  const rate = balls > 0 ? ((innings.runs * 6) / balls).toFixed(2) : '0.00';

  return (
    <div className="match-scorecard flex min-w-0 flex-col gap-5">
      <div role="group" aria-label="Innings" className="flex flex-wrap gap-2">
        {data?.innings.map((entry) => (
          <button
            key={entry.number}
            type="button"
            aria-pressed={entry.number === innings.number}
            onClick={() => setSelectedInnings(entry.number)}
            className="innings-choice tabular inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-raised px-3 text-[0.8125rem] text-secondary"
          >
            <span className="font-medium">{entry.battingTeam.shortName}</span>
            <span>
              {entry.runs}/{entry.wickets}
            </span>
            <span className="innings-overs">({entry.overs})</span>
          </button>
        ))}
      </div>

      <section className="scorecard-section" aria-labelledby="batting-title">
        <h2 id="batting-title" className="scorecard-section-title">
          Batting
        </h2>
        <Table density="compact" className="scorecard-table">
          <caption className="sr-only">{innings.battingTeam.name} batting scorecard</caption>
          <colgroup>
            <col />
            <col className="scorecard-number-col" />
            <col className="scorecard-number-col" />
            <col className="scorecard-number-col" />
            <col className="scorecard-number-col" />
            <col className="scorecard-rate-col" />
          </colgroup>
          <thead>
            <tr>
              <Th align="left">Batter</Th>
              <Th align="right">R</Th>
              <Th align="right">B</Th>
              <Th align="right">4s</Th>
              <Th align="right">6s</Th>
              <Th align="right">SR</Th>
            </tr>
          </thead>
          <tbody>
            {innings.batting.map((batter) => (
              <tr key={batter.playerId}>
                <td className="scorecard-player">
                  <p className="font-medium text-primary">{batter.name}</p>
                  <p className={cn('scorecard-dismissal', !batter.isOut && 'scorecard-not-out')}>
                    {batter.isOut ? batter.dismissal : 'Not out'}
                  </p>
                </td>
                <Td align="right" emphasis>
                  {batter.runs}
                </Td>
                <Td align="right">{batter.balls}</Td>
                <Td align="right">{batter.fours}</Td>
                <Td align="right">{batter.sixes}</Td>
                <Td align="right">
                  {batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(2) : '0.00'}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <dl className="scorecard-totals">
          <div>
            <dt>Extras</dt>
            <dd>
              <strong>{innings.extras.total}</strong>
              <span className="text-muted">
                {' '}
                (w {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb{' '}
                {innings.extras.legByes})
              </span>
            </dd>
          </div>
          <div className="scorecard-total">
            <dt>Total</dt>
            <dd>
              <strong>
                {innings.runs}/{innings.wickets}
              </strong>
              <span className="text-secondary">
                {' '}
                ({innings.overs} ov) · RR {rate}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="scorecard-section" aria-labelledby="bowling-title">
        <h2 id="bowling-title" className="scorecard-section-title">
          Bowling
        </h2>
        <Table density="compact" className="scorecard-table">
          <caption className="sr-only">{innings.bowlingTeam.name} bowling scorecard</caption>
          <colgroup>
            <col />
            <col className="scorecard-number-col" />
            <col className="scorecard-number-col" />
            <col className="scorecard-number-col" />
            <col className="scorecard-number-col" />
            <col className="scorecard-rate-col" />
          </colgroup>
          <thead>
            <tr>
              <Th align="left">Bowler</Th>
              <Th align="right">O</Th>
              <Th align="right">M</Th>
              <Th align="right">R</Th>
              <Th align="right">W</Th>
              <Th align="right">ECO</Th>
            </tr>
          </thead>
          <tbody>
            {innings.bowling.map((bowler) => {
              const bowled = oversToBalls(bowler.overs);
              return (
                <tr key={bowler.playerId}>
                  <td className="scorecard-player font-medium text-primary">{bowler.name}</td>
                  <Td align="right">{bowler.overs}</Td>
                  <Td align="right">{bowler.maidens}</Td>
                  <Td align="right">{bowler.runs}</Td>
                  <Td align="right" emphasis>
                    {bowler.wickets}
                  </Td>
                  <Td align="right">
                    {bowled > 0 ? ((bowler.runs * 6) / bowled).toFixed(2) : '0.00'}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </section>

      {innings.fallOfWickets.length > 0 ? (
        <section className="scorecard-section" aria-labelledby="wickets-title">
          <h2 id="wickets-title" className="scorecard-section-title">
            Fall of wickets
          </h2>
          <ol className="scorecard-wickets">
            {innings.fallOfWickets.map((wicket) => (
              <li key={wicket.wicket}>
                <span className="tabular font-bold">
                  {wicket.teamRuns}/{wicket.wicket}
                </span>
                <span className="min-w-0 flex-1 text-secondary">{wicket.name}</span>
                <span className="tabular text-muted">{wicket.overs} ov</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function CommentaryView({ snapshot }: { snapshot: MatchSnapshot }) {
  if (snapshot.recentBalls.length === 0) {
    return <p className="text-sm text-muted">Nothing bowled yet.</p>;
  }

  return (
    <ol className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
      {snapshot.recentBalls
        .slice()
        .reverse()
        .map((ball) => {
          const big = ball.isWicket || (!ball.extraType && (ball.runs === 4 || ball.runs === 6));

          return (
            <li
              key={ball.seq}
              className={cn(
                'flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-b-0',
                ball.isWicket && 'bg-accent-soft',
              )}
            >
              <div className="flex w-10 shrink-0 flex-col items-center gap-1.5">
                <span className="tabular text-xs font-semibold text-muted">
                  {ball.overNumber}.{ball.ballNumber}
                </span>
                <BallChip display={ball.display} isWicket={ball.isWicket} size="sm" />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={cn(
                    'text-[0.8125rem] font-semibold',
                    ball.isWicket && 'text-[var(--wicket)]',
                  )}
                >
                  {eventLabel(ball)}
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-[0.8125rem] leading-snug',
                    big ? 'text-primary' : 'text-secondary',
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
    'Cracking stroke through the gap.',
    'That races away for four.',
    'Timed beautifully for a boundary.',
  ],
  six: ['That is launched into the stands!', 'Maximum. What a hit.', 'High, handsome, and six.'],
  wicket: [
    'The breakthrough arrives.',
    'Gone. The bowler wins this duel.',
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

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === 'live') return null;

  const labels: Record<Exclude<ConnectionState, 'live'>, string> = {
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    offline: 'Offline',
  };

  return (
    <span className="eyebrow flex items-center gap-2 text-muted">
      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-warning" />
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
