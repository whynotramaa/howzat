import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  DashboardMatchDto,
  PlayerDashboardDto,
  SquadMembershipDto,
  TournamentDto,
  MatchSnapshot,
  FootballSnapshot,
} from '@howzat/shared';
import { api } from '@/lib/api';
import { stageLabel } from '@/lib/pdf/sources';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, PageHeader, SectionHeading, StatStrip } from '@/components/ui/Card';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { MatchCard, type MatchSide } from '@/components/ui/MatchCard';
import { Pill, TeamMark } from '@/components/ui/Pill';
import { SportGlyph } from '@/components/ui/Sketch';
import { Tabs } from '@/components/ui/Tabs';

type MatchTab = 'live' | 'upcoming' | 'recent';

export function DashboardPage() {
  const [tab, setTab] = useState<MatchTab | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: () => api.get<PlayerDashboardDto>('/me/dashboard'),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const active: MatchTab = tab ?? (data?.live.length ? 'live' : 'upcoming');
  const matches = data ? data[active] : [];
  const scoringMatch =
    data?.live.find((match) => match.isScorer) ?? data?.upcoming.find((match) => match.isScorer);

  return (
    <div className="dashboard flex flex-col gap-7">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title="Your matchday"
        actions={
          <>
            {scoringMatch ? (
              <ButtonLink to={`/matches/${scoringMatch.id}/score`}>
                {data?.live.includes(scoringMatch) ? 'Resume scoring' : 'Open scoring'}
              </ButtonLink>
            ) : (
              <ButtonLink to="/tournaments?new=1">New tournament</ButtonLink>
            )}
            <ButtonLink to="/tournaments" variant="secondary">
              All tournaments
            </ButtonLink>
          </>
        }
      />

      {error ? <ErrorText error={error} onRetry={() => void refetch()} /> : null}

      {isPending ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-32" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : data ? (
        <>
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_280px]">
            <section className="min-w-0">
              <SectionHeading title="Matches" />
              <Tabs
                className="mt-5"
                value={active}
                onChange={setTab}
                items={[
                  { value: 'live', label: 'Live', meta: data.live.length },
                  { value: 'upcoming', label: 'Upcoming', meta: data.upcoming.length },
                  { value: 'recent', label: 'Results', meta: data.recent.length },
                ]}
              />
              {matches.length === 0 ? (
                <div className="mt-6">
                  <EmptyState compact {...emptyCopy(active, data.squads.length)} />
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {matches.map((match) => (
                    <DashboardMatch key={match.id} match={match} />
                  ))}
                </div>
              )}
            </section>

            <aside className="dashboard-secondary flex min-w-0 flex-col gap-8 rounded-[var(--radius-2xl)] bg-[var(--tint-lilac)] p-6">
              <SideList
                title="Your tournaments"
                description=""
                to="/tournaments"
                empty="Nothing running. Start a tournament and it shows up here."
                items={data.organizing.map((tournament) => (
                  <TournamentRow key={tournament.id} tournament={tournament} />
                ))}
              />
              <SideList
                title="Squads"
                description=""
                to={`/players/${data.user.username}`}
                empty="No squad yet. An organiser adds you by your username."
                items={data.squads.map((squad) => (
                  <SquadRow key={squad.playerId} squad={squad} />
                ))}
              />
            </aside>
          </div>
          <StatStrip
            items={[
              { label: 'Matches played', value: data.career.matches },
              { label: 'Runs', value: data.career.batting.runs },
              { label: 'Wickets', value: data.career.bowling.wickets },
              {
                label: 'Waiting to score',
                value: data.matchesToScore,
                tone: data.matchesToScore > 0 ? 'accent' : 'default',
              },
            ]}
          />
        </>
      ) : null}
    </div>
  );
}

function DashboardMatch({ match }: { match: DashboardMatchDto }) {
  const live = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const finished = match.status === 'COMPLETED' || match.status === 'ABANDONED';
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
  const currentScore = (teamId: string): string | undefined => {
    if (!snapshot) return undefined;
    if ('batting' in snapshot && snapshot.batting.teamId === teamId)
      return `${snapshot.batting.runs}/${snapshot.batting.wickets}`;
    if ('home' in snapshot)
      return String(snapshot.home.teamId === teamId ? snapshot.home.goals : snapshot.away.goals);
    return undefined;
  };
  const side = (team: DashboardMatchDto['myTeam']): MatchSide | null =>
    team
      ? {
          name: team.name,
          shortName: team.shortName,
          color: team.primaryColor,
          score: currentScore(team.id),
          winner: Boolean(match.winnerTeamId && match.winnerTeamId === team.id),
        }
      : null;

  return (
    <MatchCard
      eyebrow={`${match.tournament.name} · ${stageLabel(match.stage, match.round)}`}
      status={match.status}
      home={side(match.myTeam)}
      away={side(match.opponent)}
      result={match.resultText}
      to={live || finished ? `/live/${match.publicSlug}` : `/matches/${match.id}`}
      meta={[
        formatWhen(match.scheduledAt),
        match.venue,
        match.sport === 'FOOTBALL' ? 'Football' : `${match.oversPerInnings} overs`,
      ]
        .filter(Boolean)
        .join(' · ')}
      actions={
        match.isScorer && !finished ? (
          <ButtonLink to={`/matches/${match.id}/score`} size="sm">
            {live ? 'Keep scoring' : 'Score'}
          </ButtonLink>
        ) : match.isScorer ? (
          <Pill tone="accent">Scorer</Pill>
        ) : null
      }
    />
  );
}

function SideList({
  title,
  description,
  to,
  empty,
  items,
}: {
  title: string;
  description: string;
  to: string;
  empty: string;
  items: ReactNode[];
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="section-title">{title}</h2>
          {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
        </div>
        <Link
          to={to}
          className="text-xs font-medium text-secondary underline decoration-[var(--line-strong)] underline-offset-4 hover:text-primary"
        >
          View all
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius-xl)] border border-dashed border-line-strong px-4 py-6 text-center text-xs leading-relaxed text-muted">
          {empty}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">{items}</ul>
      )}
    </section>
  );
}

function TournamentRow({ tournament }: { tournament: TournamentDto }) {
  const registered = tournament.registeredTeams ?? 0;

  return (
    <li>
      <Link
        to={`/tournaments/${tournament.id}`}
        className="row-link flex items-center gap-3 border-b border-line py-3"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-raised">
          <SportGlyph sport={tournament.sport} className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-medium">{tournament.name}</span>
          <span className="mt-0.5 block text-xs text-muted">
            {FORMAT_LABELS[tournament.format]} · {registered}/{tournament.teamsCount} teams
          </span>
        </span>
      </Link>
    </li>
  );
}

function SquadRow({ squad }: { squad: SquadMembershipDto }) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-3">
      <TeamMark shortName={squad.team.shortName} color={squad.team.primaryColor} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium">{squad.team.name}</span>
        <span className="mt-0.5 block text-xs text-muted">{squad.tournament.name}</span>
      </span>
      <Pill>{ROLE_LABELS[squad.role]}</Pill>
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

function emptyCopy(tab: MatchTab, squads: number) {
  if (tab === 'live')
    return {
      title: 'Nothing live',
      description: 'When one of your matches starts, the scorecard lands here ball by ball.',
      scene: 'stumps' as const,
    };
  if (tab === 'upcoming')
    return squads === 0
      ? {
          title: 'Not in a squad yet',
          description: 'Share your username with an organiser, or start a tournament of your own.',
          scene: 'squad' as const,
        }
      : {
          title: 'No fixtures yet',
          description:
            'Your organiser has not drawn the fixtures. They appear here the moment they do.',
          scene: 'fixtures' as const,
        };
  return {
    title: 'No results yet',
    description: 'Finished matches collect here with the final word on who won.',
    scene: 'trophy' as const,
  };
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Date to be set';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
