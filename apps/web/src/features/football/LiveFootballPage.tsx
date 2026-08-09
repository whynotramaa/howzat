import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clockStatusLabel, type FootballSnapshot } from '@howzat/shared';
import { EmptyState } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Feedback';
import { Pill, TeamMark } from '@/components/ui/Pill';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { Tabs } from '@/components/ui/Tabs';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/cn';
import type { ConnectionState } from '@/features/live/useLiveMatch';
import { InlineClock, MatchTimer } from './MatchTimer';
import { IncidentTimeline } from './IncidentTimeline';
import { Bench, Pitch } from './Pitch';
import { useLiveFootball } from './useLiveFootball';

type View = 'live' | 'lineups' | 'timeline';

export function LiveFootballPage({ slug }: { slug: string }) {
  const { snapshot, connection, viewers, error, isLoading, notStarted } = useLiveFootball(slug);
  const [view, setView] = useState<View>('live');

  const matchLabel = snapshot ? `${snapshot.home.short} v ${snapshot.away.short}` : undefined;

  return (
    <div
      className="live-stage relative flex min-h-dvh flex-col"
      style={
        {
          '--team-a': snapshot?.home.color ?? '#1268bd',
          '--team-b': snapshot?.away.color ?? '#363c44',
        } as React.CSSProperties
      }
    >
      <header className="live-stage-bar sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5 sm:px-8">
          <Link to="/" className="shrink-0 transition-opacity hover:opacity-70">
            <Wordmark size="sm" />
          </Link>

          {snapshot ? (
            <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
              <span aria-hidden className="h-5 w-px bg-line" />
              <p className="mono text-sm font-medium text-primary">
                {snapshot.home.short} {snapshot.home.goals}–{snapshot.away.goals}{' '}
                {snapshot.away.short}
              </p>
              <InlineClock clock={snapshot.clock} className="text-[0.8125rem] text-secondary" />
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
            title="Not kicked off yet"
            description="The clock and the score appear here the moment the whistle goes. Leave this open — it updates itself."
          />
        ) : snapshot ? (
          <div className="flex flex-col gap-6 sm:gap-8">
            <Scoreboard snapshot={snapshot} slug={slug} />

            <Tabs
              items={[
                { value: 'live', label: 'Live' },
                { value: 'lineups', label: 'Line-ups' },
                { value: 'timeline', label: 'Timeline', meta: snapshot.incidents.length },
              ]}
              value={view}
              onChange={setView}
            />

            {view === 'live' ? (
              <LiveView snapshot={snapshot} />
            ) : view === 'lineups' ? (
              <div className="flex flex-col gap-5">
                <Pitch home={snapshot.lineups.home} away={snapshot.lineups.away} />
                <div className="flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-line bg-raised px-5 py-4 sm:px-7">
                  <Bench lineup={snapshot.lineups.home} />
                  <Bench lineup={snapshot.lineups.away} />
                </div>
              </div>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-line bg-raised px-5 py-3 sm:px-7">
                <IncidentTimeline
                  incidents={snapshot.incidents}
                  homeTeamId={snapshot.home.teamId}
                  homeShort={snapshot.home.short}
                  awayShort={snapshot.away.short}
                />
              </div>
            )}
          </div>
        ) : null}
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-7 sm:px-8">
          <p className="text-[0.8125rem] text-muted">
            Scored minute by minute on <span className="text-primary">Howzat</span>.
          </p>
          <Link to="/" className="text-[0.8125rem] text-accent transition-opacity hover:opacity-70">
            Run your own tournament →
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Scoreboard({ snapshot, slug }: { snapshot: FootballSnapshot; slug: string }) {
  const finished = snapshot.status === 'COMPLETED' || snapshot.status === 'ABANDONED';

  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-raised px-5 py-7 sm:px-9 sm:py-9">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{snapshot.tournamentName}</p>
        {snapshot.status === 'LIVE' ? (
          <Pill tone="live">
            <span aria-hidden className="live-pulse size-1.5 rounded-full bg-current" />
            Live
          </Pill>
        ) : snapshot.status === 'COMPLETED' ? (
          <Pill tone="success">Full time</Pill>
        ) : snapshot.status === 'INNINGS_BREAK' ? (
          <Pill tone="accent">{clockStatusLabel(snapshot.clock)}</Pill>
        ) : null}
      </div>

      <div className="mt-7 grid items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
        <TeamBlock side={snapshot.home} align="left" />

        <div className="flex flex-col items-center gap-4 sm:gap-5">
          <p
            key={`${snapshot.home.goals}-${snapshot.away.goals}`}
            className="score-bump score-figure text-[3.5rem] text-primary sm:text-[4.5rem]"
          >
            {snapshot.home.goals}
            <span className="mx-2 text-line-strong sm:mx-3">–</span>
            {snapshot.away.goals}
          </p>

          <MatchTimer
            clock={snapshot.clock}
            size="sm"
            align="center"
            className="w-full max-w-[11rem]"
          />
        </div>

        <TeamBlock side={snapshot.away} align="right" />
      </div>

      {snapshot.resultText || finished ? (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 border-t border-line pt-5">
          {snapshot.resultText ? (
            <p className="text-sm text-success">{snapshot.resultText}</p>
          ) : null}

          {finished ? (
            <PdfButton
              variant="secondary"
              build={() => import('@/lib/pdf').then((pdf) => pdf.buildFootballMatchPdf(slug))}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function TeamBlock({ side, align }: { side: FootballSnapshot['home']; align: 'left' | 'right' }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4',
        align === 'right' ? 'sm:flex-row-reverse sm:text-right' : '',
      )}
    >
      <TeamMark shortName={side.short} color={side.color} size="lg" />

      <div className="min-w-0">
        <p className="serif truncate text-xl text-primary sm:text-2xl">{side.name}</p>

        {side.yellowCards > 0 || side.redCards > 0 ? (
          <div
            className={cn('mt-2 flex items-center gap-2', align === 'right' && 'sm:justify-end')}
          >
            {side.yellowCards > 0 ? <CardTally tone="yellow" count={side.yellowCards} /> : null}
            {side.redCards > 0 ? <CardTally tone="red" count={side.redCards} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CardTally({ tone, count }: { tone: 'yellow' | 'red'; count: number }) {
  return (
    <span className="mono flex items-center gap-1 text-[0.6875rem] text-secondary">
      <span
        aria-hidden
        className={cn(
          'h-3 w-2 rounded-[1px] ring-1 ring-black/25',
          tone === 'red' ? 'bg-[#c8332a]' : 'bg-[#e0b23c]',
        )}
      />
      {count}
    </span>
  );
}

function LiveView({ snapshot }: { snapshot: FootballSnapshot }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Pitch home={snapshot.lineups.home} away={snapshot.lineups.away} />

      <div className="rounded-[var(--radius-lg)] border border-line bg-raised px-5 py-4 sm:px-7">
        <p className="eyebrow mb-2">Latest</p>
        <IncidentTimeline
          incidents={snapshot.incidents.slice(0, 8)}
          homeTeamId={snapshot.home.teamId}
          homeShort={snapshot.home.short}
          awayShort={snapshot.away.short}
          emptyMessage="No goals or cards yet."
        />
      </div>
    </div>
  );
}

const CONNECTION: Record<ConnectionState, { label: string; tone: 'live' | 'neutral' | 'warning' }> =
  {
    connecting: { label: 'Connecting', tone: 'neutral' },
    live: { label: 'Live', tone: 'live' },
    reconnecting: { label: 'Reconnecting', tone: 'warning' },
    offline: { label: 'Offline', tone: 'warning' },
  };

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const { label, tone } = CONNECTION[state];

  return (
    <Pill tone={tone}>
      {state === 'live' ? (
        <span aria-hidden className="live-pulse size-1.5 rounded-full bg-current" />
      ) : null}
      {label}
    </Pill>
  );
}
