import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  DashboardMatchDto,
  PlayerDashboardDto,
  TournamentDto,
  MatchSnapshot,
  FootballSnapshot,
} from '@howzat/shared';
import { api } from '@/lib/api';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, PageHeader } from '@/components/ui/Card';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { SportGlyph } from '@/components/ui/Sketch';
import { cn } from '@/lib/cn';

const isLive = (match: DashboardMatchDto) =>
  match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
const isDone = (match: DashboardMatchDto) =>
  match.status === 'COMPLETED' || match.status === 'ABANDONED';

export function DashboardPage() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: () => api.get<PlayerDashboardDto>('/me/dashboard'),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const all = data ? [...data.live, ...data.upcoming] : [];
  const toScore = all.filter((match) => match.isScorer && !isDone(match));
  const live = data?.live.filter((match) => !match.isScorer) ?? [];
  const upcoming = data?.upcoming.filter((match) => !match.isScorer) ?? [];
  const recent = data?.recent.slice(0, 5) ?? [];
  const empty =
    data && !toScore.length && !live.length && !upcoming.length && !recent.length;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Matches"
        actions={
          toScore.length ? null : (
            <ButtonLink to="/tournaments?new=1" size="sm">
              New tournament
            </ButtonLink>
          )
        }
      />

      {error ? <ErrorText error={error} onRetry={() => void refetch()} /> : null}

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : empty ? (
        <EmptyState
          title="No matches yet"
          description="Matches you play in or score show up here."
          action={
            <>
              <ButtonLink to="/tournaments?new=1" size="sm">
                New tournament
              </ButtonLink>
              <ButtonLink to="/tournaments?quick=1" size="sm" variant="secondary">
                Quick match
              </ButtonLink>
            </>
          }
        />
      ) : data ? (
        <>
          <Group title="To score" items={toScore} scoring live={toScore.some(isLive)} />
          <Group title="Live" items={live} live />
          <Group title="Upcoming" items={upcoming} />
          <Group title="Results" items={recent} />
          {data.organizing.length ? (
            <section>
              <GroupTitle title="Your tournaments" to="/tournaments" />
              <ul className="border border-line bg-raised px-4">
                {data.organizing.map((tournament) => (
                  <TournamentRow key={tournament.id} tournament={tournament} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function GroupTitle({ title, count, live, to }: { title: string; count?: number; live?: boolean; to?: string }) {
  return (
    <div className="mb-2 flex h-[22px] items-center gap-2">
      {live ? <span aria-hidden className="live-square !size-2 text-live" /> : null}
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {count ? <span className="t-caption">{count}</span> : null}
      {to ? (
        <Link to={to} className="ml-auto text-[13px] font-medium text-muted hover:text-primary">
          View all
        </Link>
      ) : null}
    </div>
  );
}

function Group({
  title,
  items,
  scoring,
  live,
}: {
  title: string;
  items: DashboardMatchDto[];
  scoring?: boolean;
  live?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section>
      <GroupTitle title={title} count={items.length} live={live} />
      <ul className="border border-line bg-raised px-4">
        {items.map((match) => (
          <MatchRow key={match.id} match={match} scoring={scoring} />
        ))}
      </ul>
    </section>
  );
}

function MatchRow({ match, scoring }: { match: DashboardMatchDto; scoring?: boolean }) {
  const live = isLive(match);
  const { data: snapshot } = useQuery({
    queryKey: ['dashboard', 'score', match.publicSlug],
    queryFn: () =>
      api.get<MatchSnapshot | FootballSnapshot | { snapshot: null }>(
        `/public/matches/${match.publicSlug}/${match.sport === 'FOOTBALL' ? 'football' : 'snapshot'}`,
      ),
    enabled: live,
    refetchInterval: live ? 15_000 : false,
    staleTime: 10_000,
  });
  const score = (teamId: string | undefined): string | undefined => {
    if (!snapshot || !teamId) return undefined;
    if ('batting' in snapshot && snapshot.batting.teamId === teamId)
      return `${snapshot.batting.runs}/${snapshot.batting.wickets}`;
    if ('home' in snapshot)
      return String(snapshot.home.teamId === teamId ? snapshot.home.goals : snapshot.away.goals);
    return undefined;
  };

  const to = scoring
    ? `/matches/${match.id}/score`
    : live || isDone(match)
      ? `/live/${match.publicSlug}`
      : `/matches/${match.id}`;
  const meta =
    match.resultText ??
    [
      live ? 'Live' : formatWhen(match.scheduledAt),
      match.venue,
      match.tournament.name,
      scoring ? 'You are scoring' : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <li className="border-b border-line last:border-b-0">
      <Link to={to} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
        <div className="grid min-w-0 gap-2">
          <TeamLine team={match.myTeam} score={score(match.myTeam?.id)} won={match.winnerTeamId} />
          <TeamLine team={match.opponent} score={score(match.opponent?.id)} won={match.winnerTeamId} />
          <p
            className={cn(
              'truncate pl-10 text-xs',
              live ? 'font-semibold text-live' : 'font-medium text-muted',
            )}
          >
            {meta}
          </p>
        </div>
        {scoring ? (
          <span className="inline-flex h-9 items-center bg-[var(--accent-grad)] px-4 text-sm font-semibold text-on-accent">
            {live ? 'Resume' : 'Score'}
          </span>
        ) : (
          <svg viewBox="0 0 256 256" className="size-5 text-muted" fill="currentColor" aria-hidden>
            <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
          </svg>
        )}
      </Link>
    </li>
  );
}

function TeamLine({
  team,
  score,
  won,
}: {
  team: DashboardMatchDto['myTeam'];
  score?: ReactNode;
  won: string | null;
}) {
  if (!team) return <span className="pl-10 text-[15px] text-muted">To be decided</span>;
  const lost = Boolean(won && won !== team.id);
  return (
    <span className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3">
      <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" className="!size-7" />
      <span className={cn('truncate text-[15px]', lost ? 'text-muted' : 'font-medium')}>
        {team.name}
      </span>
      {score ? (
        <span className={cn('mono text-xl leading-6', lost && 'font-normal text-muted')}>{score}</span>
      ) : null}
    </span>
  );
}

function TournamentRow({ tournament }: { tournament: TournamentDto }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        to={`/tournaments/${tournament.id}`}
        className="flex h-[3.75rem] items-center gap-3"
      >
        <span className="grid size-8 shrink-0 place-items-center bg-sunken">
          <SportGlyph sport={tournament.sport} className="size-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{tournament.name}</span>
        <span className="mono text-xs text-muted">
          {tournament.registeredTeams ?? 0}/{tournament.teamsCount}
        </span>
      </Link>
    </li>
  );
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
