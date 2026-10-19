import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  DashboardMatchDto,
  PlayerDashboardDto,
  SquadMembershipDto,
  TournamentDto,
} from '@howzat/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { Pill, StatusPill, TeamMark } from '@/components/ui/Pill';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';

type MatchTab = 'live' | 'upcoming' | 'recent';

export function DashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<MatchTab | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: () => api.get<PlayerDashboardDto>('/me/dashboard'),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const active: MatchTab = tab ?? (data?.live.length ? 'live' : 'upcoming');
  const matches = data ? data[active] : [];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="serif text-[2.75rem] leading-[1.05]">{greeting(user?.name)}</h1>
        <Link to="/tournaments?new=1">
          <Button>New tournament</Button>
        </Link>
      </header>

      {error ? <ErrorText error={error} /> : null}

      {isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-72" />
        </div>
      ) : data ? (
        <>
          <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised sm:grid-cols-4">
            {[
              { label: 'Matches', value: data.career.matches },
              { label: 'Runs', value: data.career.batting.runs },
              { label: 'Wickets', value: data.career.bowling.wickets },
              { label: 'To score', value: data.matchesToScore, accent: data.matchesToScore > 0 },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={cn(
                  'flex flex-col gap-0.5 px-4 py-3',
                  index > 0 && 'sm:border-l sm:border-line',
                  index % 2 === 1 && 'border-l border-line',
                  index > 1 && 'max-sm:border-t max-sm:border-line',
                )}
              >
                <dt className="eyebrow">{stat.label}</dt>
                <dd
                  className={cn(
                    'tabular text-xl font-semibold tracking-[-0.03em]',
                    stat.accent && 'text-accent',
                  )}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
              <Tabs
                className="px-2"
                value={active}
                onChange={setTab}
                items={[
                  { value: 'live', label: 'Live', meta: data.live.length },
                  { value: 'upcoming', label: 'Upcoming', meta: data.upcoming.length },
                  { value: 'recent', label: 'Results', meta: data.recent.length },
                ]}
              />
              {matches.length === 0 ? (
                <p className="px-4 py-12 text-center text-[0.8125rem] text-muted">
                  {active === 'live'
                    ? 'Nothing live'
                    : active === 'upcoming'
                      ? data.squads.length === 0
                        ? 'Not in a squad yet'
                        : 'No fixtures yet'
                      : 'No results yet'}
                </p>
              ) : (
                <ul>
                  {matches.map((match) => (
                    <MatchRow key={match.id} match={match} />
                  ))}
                </ul>
              )}
            </section>

            <aside className="flex min-w-0 flex-col gap-6">
              <SideList
                title="Running"
                to="/tournaments"
                empty="No tournaments"
                items={data.organizing.map((tournament) => (
                  <TournamentRow key={tournament.id} tournament={tournament} />
                ))}
              />
              <SideList
                title="Squads"
                to={`/players/${data.user.username}`}
                empty="No squads"
                items={data.squads.map((squad) => (
                  <SquadRow key={squad.playerId} squad={squad} />
                ))}
              />
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SideList({
  title,
  to,
  empty,
  items,
}: {
  title: string;
  to: string;
  empty: string;
  items: ReactNode[];
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[0.8125rem] font-semibold">{title}</h2>
        <Link to={to} className="text-xs text-muted hover:text-primary">
          View all
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong px-3 py-5 text-center text-xs text-muted">
          {empty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
          {items}
        </ul>
      )}
    </section>
  );
}

function MatchRow({ match }: { match: DashboardMatchDto }) {
  const isLive = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const finished = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const destination = isLive || finished ? `/live/${match.publicSlug}` : null;

  const body = (
    <div className="ledger-row flex items-center gap-3 px-4 py-3">
      {match.myTeam ? (
        <TeamMark shortName={match.myTeam.shortName} color={match.myTeam.primaryColor} size="sm" />
      ) : (
        <span className="size-6 shrink-0 rounded-[var(--radius-sm)] bg-sunken" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.8125rem] font-medium">
          {match.myTeam?.name ?? match.opponent?.name ?? 'TBC'}
          {match.opponent && match.myTeam ? (
            <span className="text-muted"> v {match.opponent.name}</span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted">
          {match.resultText ??
            [
              match.tournament.name,
              formatWhen(match.scheduledAt),
              match.sport === 'FOOTBALL' ? 'Football' : `${match.oversPerInnings} ov`,
            ].join(' · ')}
        </p>
      </div>
      {match.isScorer ? <Pill tone="accent">Scorer</Pill> : null}
      <StatusPill status={match.status} />
    </div>
  );

  return (
    <li className="border-b border-line last:border-0">
      {destination ? (
        <Link to={destination} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

function TournamentRow({ tournament }: { tournament: TournamentDto }) {
  const registered = tournament.registeredTeams ?? 0;
  return (
    <li className="border-b border-line last:border-0">
      <Link
        to={`/tournaments/${tournament.id}`}
        className="ledger-row flex items-center justify-between gap-3 px-3 py-2.5"
      >
        <span className="min-w-0">
          <span className="block truncate text-[0.8125rem] font-medium">{tournament.name}</span>
          <span className="block text-xs text-muted">{FORMAT_LABELS[tournament.format]}</span>
        </span>
        <span className="tabular shrink-0 text-xs text-secondary">
          {registered}/{tournament.teamsCount}
        </span>
      </Link>
    </li>
  );
}

function SquadRow({ squad }: { squad: SquadMembershipDto }) {
  return (
    <li className="flex items-center gap-2.5 border-b border-line px-3 py-2.5 last:border-0">
      <TeamMark shortName={squad.team.shortName} color={squad.team.primaryColor} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium">{squad.team.name}</span>
        <span className="block truncate text-xs text-muted">{squad.tournament.name}</span>
      </span>
      <span className="shrink-0 text-xs text-muted">{ROLE_LABELS[squad.role]}</span>
    </li>
  );
}

const FORMAT_LABELS = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_PLAYOFFS: 'League + playoffs',
} as const;

const ROLE_LABELS = {
  BATSMAN: 'Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
  KEEPER: 'Keeper',
} as const;

function greeting(name?: string): string {
  const first = name?.trim().split(/\s+/)[0];
  if (!first) return 'Overview';
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  return `${part}, ${first}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Date TBC';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
