import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { BallSummary, FallOfWicket, MatchSnapshot } from '@howzat/shared';
import { apiFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { Wordmark } from '@/components/Wordmark';
import {
  BallIcon,
  BallToken,
  BoltIcon,
  ClockIcon,
  EyeIcon,
  FlameIcon,
  LivePill,
  Meter,
  OverTrack,
  Plate,
  SectionHead,
  Spark,
  StatTile,
  TargetIcon,
  Ticket,
  TrendIcon,
  TrophyIcon,
} from '@/components/ui/Stage';
import { cn } from '@/lib/cn';
import { MomentOverlay, useMoment } from './Moment';
import { useLiveMatch, type ConnectionState } from './useLiveMatch';

type View = 'live' | 'scorecard' | 'commentary';

const VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: 'live', label: 'Live' },
  { value: 'scorecard', label: 'Scorecard' },
  { value: 'commentary', label: 'Ball by ball' },
];

export function LiveMatchPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { snapshot, connection, viewers, error, isLoading, notStarted } = useLiveMatch(slug);
  const [view, setView] = useState<View>(
    searchParams.get('view') === 'scorecard' ? 'scorecard' : 'live',
  );
  const condensed = useCondensedHeader();
  const moment = useMoment(snapshot?.lastEventSeq ?? 0, snapshot?.recentBalls ?? EMPTY_BALLS);

  const matchLabel = snapshot ? `${snapshot.batting.short} v ${snapshot.bowling.short}` : undefined;

  useEffect(() => {
    if (!snapshot) return;
    document.title = `${matchLabel} — ${snapshot.batting.runs}/${snapshot.batting.wickets} · Howzat`;
  }, [matchLabel, snapshot]);

  return (
    <div
      className="stage relative flex min-h-dvh flex-col"
      style={
        {
          '--team-a': snapshot?.batting.color ?? '#1268bd',
          '--team-b': snapshot?.bowling.color ?? '#4a515c',
        } as React.CSSProperties
      }
    >
      <MomentOverlay moment={moment} />

      <header className="live-stage-bar sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5 sm:px-8">
          <Link to="/" className="shrink-0 transition-opacity hover:opacity-70">
            <Wordmark size="sm" />
          </Link>

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
              <p className="figure text-lg text-primary">
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
              <span className="mono hidden items-center gap-1.5 text-[0.6875rem] text-muted sm:flex">
                <EyeIcon />
                {viewers}
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
            <Skeleton className="h-80 rounded-[var(--r-card)]" />
            <Skeleton className="h-40 rounded-[var(--r-card)]" />
          </div>
        ) : error ? (
          <p
            role="alert"
            className="plate-quiet px-5 py-4 text-primary"
            style={{ boxShadow: 'inset 0 0 0 1px var(--hot-line)' }}
          >
            {error}
          </p>
        ) : notStarted ? (
          <NotStarted />
        ) : snapshot ? (
          <div className="flex flex-col gap-6 sm:gap-8">
            <MatchTicket snapshot={snapshot} slug={slug} />
            <Highlights snapshot={snapshot} />

            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
              {VIEWS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={view === item.value}
                  data-active={view === item.value}
                  onClick={() => setView(item.value)}
                  className="pill-lg"
                >
                  {item.label}
                </button>
              ))}
            </div>

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
          <Link to="/" className="text-[0.8125rem] text-pos transition-opacity hover:opacity-70">
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
    <Ticket className="grid place-items-center px-6 py-20 text-center" notchY="50%">
      <div className="relative z-10 flex max-w-md flex-col items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-white/5 text-muted">
          <BallIcon className="size-6" />
        </span>
        <p className="figure text-[2rem] text-primary">Not a ball bowled yet</p>
        <p className="text-secondary">
          The score appears here the moment the first delivery is scored. Leave this open — it
          updates itself.
        </p>
      </div>
    </Ticket>
  );
}

/* --------------------------------------------------------------- the hero */

function MatchTicket({ snapshot, slug }: { snapshot: MatchSnapshot; slug: string }) {
  const { batting, bowling, required, target } = snapshot;
  const quota = batting.quotaOvers ?? (batting.oversQuota ? String(batting.oversQuota) : null);
  const finished = Boolean(snapshot.resultText);

  return (
    <Ticket notchY="calc(100% - 7.25rem)">
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-8 sm:pt-6">
          <div className="flex items-center gap-2">
            <span className="pill-lg">Innings {snapshot.inningsNumber}</span>
            {quota ? <span className="pill-lg mono">{quota} ov</span> : null}
          </div>
          <LivePill live={!finished} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8 px-5 py-8 sm:px-8 sm:py-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <TeamMark shortName={batting.short} color={batting.color} size="md" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-primary">{batting.name}</p>
                <p className="micro mt-1 text-muted">batting · v {bowling.short}</p>
              </div>
            </div>

            <p
              key={`${batting.runs}-${batting.wickets}`}
              className="figure score-hit mt-6 flex items-baseline text-[4.75rem] text-primary sm:text-[7rem]"
            >
              <span>{batting.runs}</span>
              <span aria-hidden className="mx-[0.04em] font-normal text-muted">
                /
              </span>
              <span className="text-muted">{batting.wickets}</span>
            </p>

            <p className="mono mt-3 flex items-baseline gap-2 text-lg text-secondary">
              <span key={batting.overs} className="figure-roll text-primary">
                {batting.overs}
              </span>
              {quota ? <span className="text-muted">/{quota}</span> : null}
              <span className="micro text-muted">overs</span>
            </p>
          </div>

          <dl className="grid shrink-0 grid-cols-2 gap-x-9 gap-y-6 sm:grid-cols-3">
            <HeroMetric label="Run rate" value={batting.runRate.toFixed(2)} />
            {target !== null ? <HeroMetric label="Target" value={target} /> : null}
            {required ? (
              <HeroMetric label="Req. rate" value={required.rrr.toFixed(2)} tone="hot" />
            ) : (
              <HeroMetric label="Extras" value={snapshot.extras.total} />
            )}
            {snapshot.dls?.par !== null && snapshot.dls?.par !== undefined ? (
              <HeroMetric label="DLS par" value={snapshot.dls.par} tone="analytic" />
            ) : null}
          </dl>
        </div>

        <div className="perf mx-5 sm:mx-8" />

        {snapshot.resultText ? (
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-7 sm:px-8">
            <p className="flex min-w-0 items-center gap-3 text-xl font-semibold text-pos sm:text-2xl">
              <TrophyIcon className="size-6 shrink-0" />
              {snapshot.resultText}
            </p>
            <PdfButton
              size="md"
              variant="secondary"
              build={() => import('@/lib/pdf').then((pdf) => pdf.buildCricketMatchPdf(slug))}
            />
          </div>
        ) : required && target !== null ? (
          <div className="px-5 py-7 sm:px-8">
            <p className="text-xl text-primary sm:text-[1.5rem]">
              <span className="font-semibold">{batting.short}</span> need{' '}
              <span className="figure text-pos">{required.runs}</span> from{' '}
              <span className="figure">{required.balls}</span>{' '}
              {required.balls === 1 ? 'ball' : 'balls'}
            </p>

            <Meter
              className="mt-5"
              value={batting.runs / Math.max(1, target)}
              marker={
                batting.balls + required.balls > 0
                  ? batting.balls / (batting.balls + required.balls)
                  : 0
              }
              label={`${batting.runs} of ${target} runs made, ${batting.balls} of ${batting.balls + required.balls} balls used`}
            />

            <div className="mono mt-3 flex justify-between text-[0.6875rem] text-muted">
              <span>
                {batting.runs} of {target}
              </span>
              <span>{required.balls} balls left</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-7 sm:px-8">
            <p className="micro flex items-center gap-2 text-muted">
              <ClockIcon />
              This over
            </p>
            <OverTrack
              balls={snapshot.thisOver.map((ball, index) => ({
                key: `${index}-${ball}`,
                display: ball,
              }))}
              emptyLabel="First ball of the over coming up"
            />
          </div>
        )}
      </div>
    </Ticket>
  );
}

function HeroMetric({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: string | number;
  tone?: 'plain' | 'hot' | 'analytic';
}) {
  return (
    <div>
      <dd
        className={cn(
          'figure text-[1.625rem]',
          tone === 'hot' ? 'text-hot' : tone === 'analytic' ? 'text-analytic' : 'text-primary',
        )}
      >
        {value}
      </dd>
      <dt className="micro mt-2.5 text-muted">{label}</dt>
    </div>
  );
}

/* ------------------------------------------------------------- highlights */

function Highlights({ snapshot }: { snapshot: MatchSnapshot }) {
  const partnership = currentPartnership(snapshot);
  const striker = snapshot.batsmen.find((batsman) => batsman.onStrike) ?? snapshot.batsmen[0];
  const recent = recentWindow(snapshot.recentBalls);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {striker ? (
        <StatTile
          icon={<FlameIcon />}
          tone={striker.sr >= 130 && striker.balls >= 8 ? 'hot' : 'plain'}
          label={striker.sr >= 130 && striker.balls >= 8 ? 'On fire' : 'On strike'}
          value={`${striker.runs} (${striker.balls})`}
          sub={`${striker.name} · SR ${striker.sr.toFixed(1)}`}
        />
      ) : null}

      <StatTile
        icon={<TrophyIcon />}
        tone="pos"
        label="Partnership"
        value={partnership.runs}
        sub={partnership.balls > 0 ? `${partnership.balls} balls together` : 'Just begun'}
      />

      <StatTile
        icon={<BoltIcon />}
        tone="analytic"
        label="Momentum"
        value={`${recent.runs}`}
        sub={`runs off the last ${recent.balls} balls`}
      />

      <StatTile
        icon={<TargetIcon />}
        tone={snapshot.required ? 'hot' : 'cool'}
        label={snapshot.required ? 'Required rate' : 'Boundaries'}
        value={
          snapshot.required
            ? snapshot.required.rrr.toFixed(2)
            : `${recent.fours + recent.sixes}`
        }
        sub={
          snapshot.required
            ? `current ${snapshot.batting.runRate.toFixed(2)}`
            : `${recent.fours} fours · ${recent.sixes} sixes, last ${recent.balls}`
        }
      />
    </section>
  );
}

/* ------------------------------------------------------------- live view */

function LiveView({ snapshot }: { snapshot: MatchSnapshot }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Plate className="flex flex-col gap-4 p-5 sm:p-6">
            <SectionHead title="At the crease" icon={<BallIcon />} />
            {snapshot.batsmen.length === 0 ? (
              <p className="text-sm text-muted">Nobody at the crease yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {snapshot.batsmen.map((batsman) => (
                  <BatterCard key={batsman.playerId} batsman={batsman} />
                ))}
              </div>
            )}
          </Plate>

          <Plate className="flex flex-col gap-4 p-5 sm:p-6">
            <SectionHead
              title="This over"
              icon={<ClockIcon />}
              meta={
                <span className="mono text-[0.6875rem] text-muted">
                  {snapshot.thisOver.length} of 6
                </span>
              }
            />
            <OverTrack
              size="lg"
              balls={snapshot.thisOver.map((ball, index) => ({
                key: `${index}-${ball}`,
                display: ball,
              }))}
            />
          </Plate>
        </div>

        <div className="flex flex-col gap-5">
          {snapshot.bowler ? <BowlerCard bowler={snapshot.bowler} /> : null}

          <Plate className="flex flex-col gap-4 p-5 sm:p-6">
            <SectionHead title="Extras" />
            <dl className="grid grid-cols-5 gap-2 text-center">
              <Figure label="Wd" value={snapshot.extras.wides} />
              <Figure label="Nb" value={snapshot.extras.noBalls} />
              <Figure label="B" value={snapshot.extras.byes} />
              <Figure label="Lb" value={snapshot.extras.legByes} />
              <Figure label="Total" value={snapshot.extras.total} emphasis />
            </dl>
          </Plate>

          {snapshot.fallOfWickets.length > 0 ? (
            <Plate className="flex flex-col gap-4 p-5 sm:p-6">
              <SectionHead title="Fall of wickets" />
              <ol className="flex flex-col gap-2.5">
                {snapshot.fallOfWickets
                  .slice()
                  .reverse()
                  .map((wicket) => (
                    <li key={wicket.wicket} className="flex items-center gap-3">
                      <span className="micro grid size-6 shrink-0 place-items-center rounded-full bg-hot-soft text-hot">
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
            </Plate>
          ) : null}
        </div>
      </div>

      <Analytics snapshot={snapshot} />
    </div>
  );
}

function BatterCard({ batsman }: { batsman: MatchSnapshot['batsmen'][number] }) {
  const boundaryShare =
    batsman.balls > 0 ? ((batsman.fours * 4 + batsman.sixes * 6) / Math.max(1, batsman.runs)) : 0;

  return (
    <div
      data-strike={batsman.onStrike}
      className={cn(
        'plate-quiet relative flex items-center gap-4 p-4',
        'transition-shadow duration-[var(--dur)]',
        batsman.onStrike &&
          'shadow-[inset_0_0_0_1px_var(--pos-line),0_0_26px_-14px_var(--pos)] bg-pos-soft/40',
      )}
    >
      <div className="relative shrink-0">
        <PlayerAvatar seed={batsman.playerId} name={batsman.name} size="sm" />
        {batsman.onStrike ? (
          <span
            aria-label="on strike"
            className="beacon absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-pos ring-2 ring-[var(--surface-raised)]"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-semibold text-primary">{batsman.name}</p>
        <p className="mono mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted">
          <span className="text-cool">{batsman.fours}×4</span>
          <span className="text-pos">{batsman.sixes}×6</span>
          <span>SR {batsman.sr.toFixed(1)}</span>
        </p>
        {batsman.runs > 0 ? (
          <Meter
            className="mt-2.5 h-1"
            tone="cool"
            value={Math.min(1, boundaryShare)}
            label={`${Math.round(boundaryShare * 100)}% of runs in boundaries`}
          />
        ) : null}
      </div>

      <p className="figure shrink-0 text-right text-[1.75rem] text-primary">
        {batsman.runs}
        <span className="mono ml-1 text-[0.8125rem] font-normal text-muted">({batsman.balls})</span>
      </p>
    </div>
  );
}

function BowlerCard({ bowler }: { bowler: NonNullable<MatchSnapshot['bowler']> }) {
  return (
    <Plate className="flex flex-col gap-4 p-5 sm:p-6">
      <SectionHead title="Bowling" icon={<BallIcon />} />

      <div className="flex items-center gap-4">
        <PlayerAvatar seed={bowler.playerId} name={bowler.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold text-primary">{bowler.name}</p>
          <p className="mono mt-1 text-[0.6875rem] text-muted">econ {bowler.econ.toFixed(2)}</p>
        </div>
        <p className="figure shrink-0 text-[1.75rem] text-hot">
          {bowler.wickets}
          <span className="font-normal text-muted">/{bowler.runs}</span>
        </p>
      </div>

      <dl className="grid grid-cols-4 gap-2 border-t border-line pt-4 text-center">
        <Figure label="O" value={bowler.overs} />
        <Figure label="M" value={bowler.maidens} />
        <Figure label="R" value={bowler.runs} />
        <Figure label="W" value={bowler.wickets} emphasis />
      </dl>
    </Plate>
  );
}

/* -------------------------------------------------------------- analytics */

function Analytics({ snapshot }: { snapshot: MatchSnapshot }) {
  const overs = useMemo(() => groupOvers(snapshot.recentBalls), [snapshot.recentBalls]);
  const recent = recentWindow(snapshot.recentBalls);
  const dotShare = recent.balls > 0 ? recent.dots / recent.balls : 0;

  if (overs.length === 0) return null;

  return (
    <Plate className="flex flex-col gap-6 p-5 sm:p-6">
      <SectionHead
        title="Momentum"
        icon={<TrendIcon />}
        meta={<span className="mono text-[0.6875rem] text-muted">last {overs.length} overs</span>}
      />

      <div className="flex flex-col gap-2">
        <Spark overs={overs} />
        <div className="mono flex justify-between text-[0.625rem] text-muted">
          <span>ov {overs[0]!.number + 1}</span>
          <span>ov {overs[overs.length - 1]!.number + 1}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Dot balls" value={`${Math.round(dotShare * 100)}%`} sub="of the last 30" />
        <StatTile
          label="Boundaries"
          tone="cool"
          value={recent.fours + recent.sixes}
          sub={`${recent.fours}×4 · ${recent.sixes}×6`}
        />
        <StatTile label="Runs" value={recent.runs} sub={`off ${recent.balls} balls`} />
        <StatTile
          label="Wickets"
          tone="hot"
          value={recent.wickets}
          sub={recent.wickets === 0 ? 'none lost lately' : 'in this window'}
        />
      </div>
    </Plate>
  );
}

/* ------------------------------------------------------------ derivations */

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
  const last: FallOfWicket | undefined =
    snapshot.fallOfWickets[snapshot.fallOfWickets.length - 1];

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

function groupOvers(
  balls: BallSummary[],
): Array<{ number: number; runs: number; wickets: number }> {
  const byOver = new Map<number, { runs: number; wickets: number }>();

  for (const ball of balls) {
    const entry = byOver.get(ball.overNumber) ?? { runs: 0, wickets: 0 };
    entry.runs += ball.runs;
    entry.wickets += ball.isWicket ? 1 : 0;
    byOver.set(ball.overNumber, entry);
  }

  return [...byOver.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, entry]) => ({ number, ...entry }));
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
      <dd className={cn('figure text-[1.125rem]', emphasis ? 'text-pos' : 'text-primary')}>
        {value}
      </dd>
      <dt className="micro mt-1.5 text-muted">{label}</dt>
    </div>
  );
}

/* -------------------------------------------------------------- scorecard */

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

  if (isPending) return <Skeleton className="h-96 rounded-[var(--r-card)]" />;
  if (error) {
    return (
      <p role="alert" className="text-sm text-hot">
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
        <Plate key={innings.number} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <TeamMark
                shortName={innings.battingTeam.shortName}
                color={innings.battingTeam.primaryColor}
                size="md"
              />
              <div>
                <p className="micro text-muted">Innings {innings.number}</p>
                <h3 className="mt-1.5 text-lg font-semibold text-primary">
                  {innings.battingTeam.name}
                </h3>
              </div>
            </div>

            <p className="figure text-[2rem] text-primary">
              {innings.runs}
              <span className="text-muted">/{innings.wickets}</span>
              <span className="mono ml-2.5 text-[0.8125rem] font-normal text-muted">
                ({innings.overs} ov)
              </span>
            </p>
          </div>

          <div className="perf mx-5 sm:mx-6" />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse">
              <thead>
                <tr>
                  <StatHead className="pl-5 text-left sm:pl-6">Batter</StatHead>
                  <StatHead>R</StatHead>
                  <StatHead>B</StatHead>
                  <StatHead>4s</StatHead>
                  <StatHead>6s</StatHead>
                  <StatHead className="pr-5 sm:pr-6">SR</StatHead>
                </tr>
              </thead>
              <tbody>
                {innings.batting.map((batter) => (
                  <tr
                    key={batter.playerId}
                    className="transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="py-3.5 pl-5 sm:pl-6">
                      <p className="flex items-center gap-2.5 text-primary">
                        <PlayerAvatar seed={batter.playerId} name={batter.name} size="xs" />
                        <span className="font-medium">{batter.name}</span>
                        {!batter.isOut ? (
                          <span className="micro text-pos" title="Not out">
                            ★
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 pl-8 text-[0.6875rem] text-muted">{batter.dismissal}</p>
                    </td>
                    <StatCell strong>{batter.runs}</StatCell>
                    <StatCell>{batter.balls}</StatCell>
                    <StatCell tone={batter.fours > 0 ? 'cool' : undefined}>{batter.fours}</StatCell>
                    <StatCell tone={batter.sixes > 0 ? 'pos' : undefined}>{batter.sixes}</StatCell>
                    <StatCell className="pr-5 sm:pr-6">
                      {batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : '—'}
                    </StatCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="px-5 py-4 text-[0.8125rem] text-secondary sm:px-6">
            <span className="micro mr-3 text-muted">Extras</span>
            <span className="mono text-primary">{innings.extras.total}</span>
            <span className="mono ml-2 text-muted">
              (w {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb{' '}
              {innings.extras.legByes})
            </span>
          </p>

          <div className="perf mx-5 sm:mx-6" />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse">
              <thead>
                <tr>
                  <StatHead className="pl-5 text-left sm:pl-6">Bowler</StatHead>
                  <StatHead>O</StatHead>
                  <StatHead>M</StatHead>
                  <StatHead>R</StatHead>
                  <StatHead className="pr-5 sm:pr-6">W</StatHead>
                </tr>
              </thead>
              <tbody>
                {innings.bowling.map((bowler) => (
                  <tr
                    key={bowler.playerId}
                    className="transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="py-3.5 pl-5 sm:pl-6">
                      <span className="flex items-center gap-2.5 font-medium text-primary">
                        <PlayerAvatar seed={bowler.playerId} name={bowler.name} size="xs" />
                        {bowler.name}
                      </span>
                    </td>
                    <StatCell>{bowler.overs}</StatCell>
                    <StatCell>{bowler.maidens}</StatCell>
                    <StatCell>{bowler.runs}</StatCell>
                    <StatCell strong tone="hot" className="pr-5 sm:pr-6">
                      {bowler.wickets}
                    </StatCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {innings.fallOfWickets.length > 0 ? (
            <p className="px-5 pt-2 pb-5 text-[0.8125rem] text-secondary sm:px-6">
              <span className="micro mr-3 text-muted">Fall of wickets</span>
              {innings.fallOfWickets
                .map(
                  (wicket) =>
                    `${wicket.teamRuns}-${wicket.wicket} (${wicket.name}, ${wicket.overs})`,
                )
                .join(' · ')}
            </p>
          ) : null}
        </Plate>
      ))}
    </div>
  );
}

function StatHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn('micro px-3 py-3 text-right font-semibold text-muted', className)}
    >
      {children}
    </th>
  );
}

function StatCell({
  children,
  strong = false,
  tone,
  className,
}: {
  children: React.ReactNode;
  strong?: boolean;
  tone?: 'pos' | 'cool' | 'hot';
  className?: string;
}) {
  return (
    <td
      className={cn(
        'mono px-3 py-3.5 text-right text-sm',
        strong ? 'font-semibold text-primary' : 'text-secondary',
        tone === 'pos' && 'text-pos',
        tone === 'cool' && 'text-cool',
        tone === 'hot' && 'text-hot',
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------- commentary */

function CommentaryView({ snapshot }: { snapshot: MatchSnapshot }) {
  if (snapshot.recentBalls.length === 0) {
    return <p className="text-sm text-muted">Nothing bowled yet.</p>;
  }

  return (
    <ol className="relative flex flex-col gap-3 pl-8">
      <span aria-hidden className="absolute inset-y-3 left-[1.4375rem] w-px bg-line" />

      {snapshot.recentBalls
        .slice()
        .reverse()
        .map((ball) => {
          const big = ball.isWicket || (!ball.extraType && (ball.runs === 4 || ball.runs === 6));

          return (
            <li
              key={ball.seq}
              className={cn(
                'plate-quiet relative flex items-start gap-4 p-4',
                big && 'shadow-[inset_0_0_0_1px_var(--line-strong)]',
              )}
            >
              <span
                aria-hidden
                className="absolute top-[1.75rem] -left-[1.0625rem] h-px w-4 bg-line"
              />

              <BallToken display={ball.display} isWicket={ball.isWicket} size="md" />

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2.5">
                  <span className="mono text-[0.6875rem] text-muted">
                    {ball.overNumber}.{ball.ballNumber}
                  </span>
                  <span className={cn('micro', eventTone(ball))}>{eventLabel(ball)}</span>
                </p>
                <p
                  className={cn(
                    'mt-1.5 leading-snug text-primary',
                    big ? 'text-base font-medium' : 'text-[0.9375rem]',
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

function eventTone(ball: BallSummary): string {
  if (ball.isWicket) return 'text-hot';
  if (ball.extraType) return 'text-muted';
  if (ball.runs === 6) return 'text-pos';
  if (ball.runs === 4) return 'text-cool';
  return 'text-muted';
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
    'Timed beautifully — boundary!',
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

/* ------------------------------------------------------------------ chrome */

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === 'live') return null;

  const labels: Record<Exclude<ConnectionState, 'live'>, string> = {
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    offline: 'Offline',
  };

  return (
    <span className="pill-lg h-8 px-3 text-[0.6875rem]">
      <span aria-hidden className="beacon size-1.5 rounded-full bg-current" />
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
