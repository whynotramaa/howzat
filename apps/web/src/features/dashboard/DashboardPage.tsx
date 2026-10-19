import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  DashboardMatchDto,
  PlayerDashboardDto,
  SquadMembershipDto,
  TournamentDto,
} from '@howzat/shared';
import { api } from '@/lib/api';
import { stageLabel } from '@/lib/pdf/sources';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader, SectionHeading, StatStrip } from '@/components/ui/Card';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { MatchCard, type MatchSide } from '@/components/ui/MatchCard';
import { Pill, TeamMark } from '@/components/ui/Pill';
import { Scene, SportGlyph } from '@/components/ui/Sketch';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/features/auth/AuthProvider';

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
  const first = user?.name?.trim().split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-14">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title={
          first ? (
            <>
              {partOfDay()}, <em>{first}</em>.
            </>
          ) : (
            'Your matchday'
          )
        }
        description={data ? summary(data) : 'Pulling together your fixtures, squads and numbers.'}
        actions={
          <>
            <Link to="/tournaments?new=1">
              <Button>New tournament</Button>
            </Link>
            <Link to="/tournaments">
              <Button variant="secondary">All tournaments</Button>
            </Link>
          </>
        }
        art={<Scene name={data?.live.length ? 'stumps' : 'trophy'} />}
      />

      {error ? <ErrorText error={error} /> : null}

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
          <StatStrip
            items={[
              { label: 'Matches played', value: data.career.matches, hint: 'Across every squad' },
              { label: 'Runs', value: data.career.batting.runs, hint: 'Career, all formats' },
              { label: 'Wickets', value: data.career.bowling.wickets, hint: 'Career, all formats' },
              {
                label: 'Waiting to score',
                value: data.matchesToScore,
                hint: data.matchesToScore > 0 ? 'You hold the pen' : 'Nothing assigned',
                tone: data.matchesToScore > 0 ? 'accent' : 'default',
              },
            ]}
          />

          <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0">
              <SectionHeading
                eyebrow="Your matches"
                title="On the card"
                description="Every fixture you play in or score, with live games first."
              />
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
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {matches.map((match, index) => (
                    <DashboardMatch key={match.id} match={match} index={index} />
                  ))}
                </div>
              )}
            </section>

            <aside className="flex min-w-0 flex-col gap-10">
              <SideList
                title="Running"
                description="Tournaments you organise"
                to="/tournaments"
                empty="Nothing running. Start a tournament and it shows up here."
                items={data.organizing.map((tournament) => (
                  <TournamentRow key={tournament.id} tournament={tournament} />
                ))}
              />
              <SideList
                title="Squads"
                description="Teams you are named in"
                to={`/players/${data.user.username}`}
                empty="No squad yet. An organiser adds you by your username."
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

function DashboardMatch({ match, index }: { match: DashboardMatchDto; index: number }) {
  const live = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const finished = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const side = (team: DashboardMatchDto['myTeam']): MatchSide | null =>
    team
      ? {
          name: team.name,
          shortName: team.shortName,
          color: team.primaryColor,
          winner: Boolean(match.winnerTeamId && match.winnerTeamId === team.id),
        }
      : null;

  return (
    <MatchCard
      className="reveal"
      style={{ '--delay': `${index * 60}ms` } as CSSProperties}
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
          <Link to={`/matches/${match.id}/score`}>
            <Button size="sm">{live ? 'Keep scoring' : 'Score'}</Button>
          </Link>
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
          <h2 className="serif text-[1.75rem]">{title}</h2>
          <p className="mt-1 text-xs text-muted">{description}</p>
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
  const progress = Math.min(1, registered / Math.max(1, tournament.teamsCount));

  return (
    <li>
      <Link
        to={`/tournaments/${tournament.id}`}
        className="card-lift flex items-center gap-3.5 rounded-[var(--radius-xl)] border border-line bg-raised p-3.5"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-sunken">
          <SportGlyph sport={tournament.sport} className="size-8" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{tournament.name}</span>
          <span className="mt-0.5 block text-xs text-muted">
            {FORMAT_LABELS[tournament.format]} · {registered}/{tournament.teamsCount} teams
          </span>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-sunken">
            <span
              className="block h-full rounded-full bg-[var(--ink-blue)]"
              style={{ width: `${progress * 100}%` }}
            />
          </span>
        </span>
      </Link>
    </li>
  );
}

function SquadRow({ squad }: { squad: SquadMembershipDto }) {
  return (
    <li className="flex items-center gap-3.5 rounded-[var(--radius-xl)] border border-line bg-raised p-3.5">
      <TeamMark shortName={squad.team.shortName} color={squad.team.primaryColor} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{squad.team.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted">{squad.tournament.name}</span>
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
          description: 'Your organiser has not drawn the fixtures. They appear here the moment they do.',
          scene: 'fixtures' as const,
        };
  return {
    title: 'No results yet',
    description: 'Finished matches collect here with the final word on who won.',
    scene: 'trophy' as const,
  };
}

function summary(data: PlayerDashboardDto): string {
  if (data.live.length > 0)
    return data.live.length === 1
      ? 'One of your matches is live right now. Jump in to follow it or pick up the scoring.'
      : `${data.live.length} of your matches are live right now.`;
  const next = data.upcoming[0];
  if (next?.myTeam && next.opponent)
    return `Next up, ${next.myTeam.name} take on ${next.opponent.name}${
      next.scheduledAt ? ` on ${formatWhen(next.scheduledAt)}` : ''
    }.`;
  if (data.organizing.length > 0)
    return `You are running ${data.organizing.length} ${
      data.organizing.length === 1 ? 'tournament' : 'tournaments'
    }. Fill the squads and draw the fixtures to get going.`;
  return 'A quiet card today. Start a tournament or ask an organiser to add you to a squad.';
}

function partOfDay(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
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
