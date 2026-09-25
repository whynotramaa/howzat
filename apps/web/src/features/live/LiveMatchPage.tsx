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
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { EyeIcon, StumpsIcon, TrendIcon, TrophyIcon } from '@/components/ui/Icons';
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
import { MomentOverlay, useMoment } from './Moment';
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
      <MomentOverlay moment={moment} />

      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--surface)_84%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[60rem] items-center gap-4 px-4 sm:px-6">
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
                {snapshot.batting.runs}-{snapshot.batting.wickets}
                <span className="tabular ml-2 text-[0.8125rem] font-medium text-muted">
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
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[60rem] flex-1 px-4 py-5 sm:px-6 sm:py-8">
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
          <div className="flex flex-col gap-4">
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
        <div className="mx-auto flex w-full max-w-[60rem] flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
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
    <section className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-raised px-6 py-16 text-center">
      <StumpsIcon className="size-7 text-muted" />
      <p className="eyebrow">Not a ball bowled yet</p>
      <p className="serif text-[2rem] text-primary">Match yet to begin</p>
      <p className="max-w-md text-sm text-secondary">
        The score updates here automatically once the first ball is recorded.
      </p>
    </section>
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
      stats={[
        { label: 'CRR', value: batting.runRate.toFixed(2) },
        ...(required ? [{ label: 'RRR', value: required.rrr.toFixed(2) }] : []),
      ]}
    >
      {snapshot.resultText ? (
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-3 sm:px-6">
          <p className="serif flex min-w-0 items-center gap-2.5 text-[1.375rem] text-primary">
            <TrophyIcon className="size-5 shrink-0" />
            {snapshot.resultText}
          </p>
          <PdfButton
            size="md"
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

          <div className="tabular mt-2 flex justify-between text-[0.6875rem] text-muted">
            <span>
              {batting.runs} of {target}
            </span>
            <span>{required.balls} balls left</span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 sm:px-6">
        <p className="eyebrow">This over</p>
        <OverStrip
          size="sm"
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
  const lastWicket = snapshot.fallOfWickets[snapshot.fallOfWickets.length - 1];

  return (
    <div className="flex flex-col gap-4">
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
          { label: 'Partnership', value: `${partnership.runs} (${partnership.balls})` },
          {
            label: 'Extras',
            value: `${extras.total} (w ${extras.wides}, nb ${extras.noBalls}, b ${extras.byes}, lb ${extras.legByes})`,
          },
          {
            label: 'Last wicket',
            value: lastWicket ? `${lastWicket.name} at ${lastWicket.teamRuns}-${lastWicket.wicket}` : 'None',
          },
        ]}
        note={`Last ${window.balls} balls: ${window.runs} runs, ${window.fours} fours, ${window.sixes} sixes`}
      />

      <Panel
        title="Momentum"
        icon={<TrendIcon />}
        meta={<span className="mono text-[0.6875rem] text-muted">runs per over</span>}
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

      {snapshot.fallOfWickets.length > 0 ? (
        <Panel
          title="Fall of wickets"
          icon={<StumpsIcon />}
          bodyClassName="flex flex-col gap-2.5"
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
    <div className="flex flex-col gap-4">
      {data.innings.map((innings) => {
        const balls = oversToBalls(innings.overs);
        const rate = balls > 0 ? ((innings.runs * 6) / balls).toFixed(2) : '0.00';

        return (
          <section
            key={innings.number}
            className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised"
          >
            <div className="flex items-center justify-between gap-4 bg-inverse px-4 py-3 text-on-inverse sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <TeamMark
                  shortName={innings.battingTeam.shortName}
                  color={innings.battingTeam.primaryColor}
                  size="sm"
                />
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{innings.battingTeam.name}</h3>
                  <p className="text-[0.6875rem] text-muted-on-inverse">Innings {innings.number}</p>
                </div>
              </div>

              <p className="score-figure shrink-0 text-xl">
                {innings.runs}-{innings.wickets}
                <span className="tabular ml-1.5 text-[0.8125rem] font-medium text-muted-on-inverse">
                  ({innings.overs})
                </span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <Table density="compact" className="min-w-[32rem]">
                <thead>
                  <tr className="border-b border-line bg-sunken">
                    <Th align="left" className="pl-4 sm:pl-5">
                      Batter
                    </Th>
                    <Th align="right">R</Th>
                    <Th align="right">B</Th>
                    <Th align="right">4s</Th>
                    <Th align="right">6s</Th>
                    <Th align="right" className="pr-4 sm:pr-5">
                      SR
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {innings.batting.map((batter) => (
                    <tr key={batter.playerId} className="border-b border-line">
                      <td className="py-2.5 pl-4 sm:pl-5">
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            batter.isOut ? 'text-primary' : 'text-accent',
                          )}
                        >
                          {batter.name}
                          {!batter.isOut ? <span className="font-normal"> *</span> : null}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {batter.isOut ? batter.dismissal : 'not out'}
                        </p>
                      </td>
                      <Td align="right" emphasis className="font-bold">
                        {batter.runs}
                      </Td>
                      <Td align="right">{batter.balls}</Td>
                      <Td align="right">{batter.fours}</Td>
                      <Td align="right">{batter.sixes}</Td>
                      <Td align="right" className="pr-4 sm:pr-5">
                        {batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(2) : '0.00'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5 text-sm sm:px-5">
              <span className="font-semibold text-primary">Extras</span>
              <span className="tabular text-secondary">
                <span className="font-bold text-primary">{innings.extras.total}</span> (w{' '}
                {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb{' '}
                {innings.extras.legByes})
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 bg-sunken px-4 py-2.5 text-sm sm:px-5">
              <span className="font-semibold text-primary">Total</span>
              <span className="tabular text-secondary">
                <span className="font-bold text-primary">
                  {innings.runs}-{innings.wickets}
                </span>{' '}
                ({innings.overs} Ov, RR {rate})
              </span>
            </div>

            <div className="overflow-x-auto border-t border-line">
              <Table density="compact" className="min-w-[30rem]">
                <thead>
                  <tr className="border-b border-line bg-sunken">
                    <Th align="left" className="pl-4 sm:pl-5">
                      Bowler
                    </Th>
                    <Th align="right">O</Th>
                    <Th align="right">M</Th>
                    <Th align="right">R</Th>
                    <Th align="right">W</Th>
                    <Th align="right" className="pr-4 sm:pr-5">
                      ECO
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {innings.bowling.map((bowler) => {
                    const bowled = oversToBalls(bowler.overs);
                    return (
                      <tr key={bowler.playerId} className="border-b border-line last:border-b-0">
                        <td className="py-2.5 pl-4 text-sm font-semibold text-primary sm:pl-5">
                          {bowler.name}
                        </td>
                        <Td align="right">{bowler.overs}</Td>
                        <Td align="right">{bowler.maidens}</Td>
                        <Td align="right">{bowler.runs}</Td>
                        <Td align="right" emphasis className="font-bold">
                          {bowler.wickets}
                        </Td>
                        <Td align="right" className="pr-4 sm:pr-5">
                          {bowled > 0 ? ((bowler.runs * 6) / bowled).toFixed(2) : '0.00'}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {innings.fallOfWickets.length > 0 ? (
              <div className="border-t border-line">
                <p className="bg-sunken px-4 py-2 text-[0.6875rem] font-semibold text-muted uppercase sm:px-5">
                  Fall of wickets
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3 text-[0.8125rem] sm:px-5">
                  {innings.fallOfWickets.map((wicket) => (
                    <span key={wicket.wicket} className="tabular text-secondary">
                      <span className="font-bold text-primary">
                        {wicket.teamRuns}-{wicket.wicket}
                      </span>{' '}
                      ({wicket.name}, {wicket.overs})
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/* ── Commentary ──────────────────────────────────────────────────────────── */

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
                'flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0',
                ball.isWicket && 'bg-live-soft',
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
                    'text-sm font-semibold',
                    ball.isWicket ? 'text-live' : 'text-primary',
                  )}
                >
                  {eventLabel(ball)}
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-sm leading-snug',
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
