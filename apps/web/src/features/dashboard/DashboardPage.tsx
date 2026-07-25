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
import { EmptyState, SectionHeading, StatTile } from '@/components/ui/Card';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { Pill, StatusPill, TeamMark } from '@/components/ui/Pill';
import { Reveal } from '@/components/ui/Reveal';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';

/**
 * The player's home.
 *
 * Everything else in the signed-in app is addressed from the organizer's side —
 * you own a tournament, you open it, you work on it. Someone who was added to a
 * squad owns nothing, and until this screen existed the notification telling
 * them so pointed at a page that was empty for them.
 *
 * The order is deliberate: what is on right now, what is next, then who you are
 * playing for, then what you have already done. That is the order the questions
 * actually arrive in on a Saturday morning.
 */
export function DashboardPage() {
  const { user } = useAuth();

  const { data, isPending, error } = useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: () => api.get<PlayerDashboardDto>('/me/dashboard'),
    // A live match on this page should not be three minutes stale.
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-12">
      <SectionHeading
        eyebrow={`@${user?.username ?? ''}`}
        title={greeting(user?.name)}
        description="Your squads, your fixtures, and every ball of yours that is on the record."
      />

      {error ? <ErrorText error={error} /> : null}

      {isPending ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
        </div>
      ) : data ? (
        <>
          {data.live.length > 0 ? (
            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Pill tone="live">
                  <span aria-hidden className="live-pulse size-1.5 rounded-full bg-current" />
                  On now
                </Pill>
                <span aria-hidden className="h-px flex-1 bg-line" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {data.live.map((match, index) => (
                  <Reveal key={match.id} index={index} step={50}>
                    <MatchCard match={match} accent />
                  </Reveal>
                ))}
              </div>
            </section>
          ) : null}

          {/* Between what is on now and what is next, because running a
              tournament is a thing you do between matches, not instead of
              them. The full shelf is one click away rather than a tab you had
              to know about. */}
          {data.organizing.length > 0 ? (
            <section className="flex flex-col gap-5">
              <SectionHeading
                eyebrow="You are running"
                title={data.tournamentsOrganized === 1 ? 'Your tournament' : 'Your tournaments'}
                action={
                  <Link to="/tournaments">
                    <Button variant="secondary">
                      {data.tournamentsOrganized > data.organizing.length
                        ? `All ${data.tournamentsOrganized}`
                        : 'Open tournaments'}
                    </Button>
                  </Link>
                }
              />

              <div className="grid gap-4 lg:grid-cols-2">
                {data.organizing.map((tournament, index) => (
                  <Reveal key={tournament.id} index={index} step={50}>
                    <OrganizingCard tournament={tournament} />
                  </Reveal>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-5">
            <SectionHeading eyebrow="Next up" title="Your fixtures" />

            {data.upcoming.length === 0 ? (
              <EmptyState
                title="Nothing in the diary"
                description={
                  data.squads.length === 0
                    ? 'You are not in a squad yet. When an organizer adds your handle to a team, it appears here — and you will get a notification.'
                    : 'Your squads have no scheduled matches yet. Fixtures show up the moment the organizer generates them.'
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.upcoming.map((match, index) => (
                  <Reveal key={match.id} index={index} step={50}>
                    <MatchCard match={match} />
                  </Reveal>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-5">
            <SectionHeading
              eyebrow="Your teams"
              title={data.squads.length === 1 ? 'One squad' : `${data.squads.length} squads`}
              description="Every side you have been named in, across every tournament."
            />

            {data.squads.length === 0 ? (
              <EmptyState
                title="No squad yet"
                description="Give an organizer your handle and they can add you in one keystroke."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.squads.map((squad, index) => (
                  <Reveal key={squad.playerId} index={index} step={45}>
                    <SquadCard squad={squad} />
                  </Reveal>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-5">
            <SectionHeading eyebrow="Your record" title="Career so far" />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Matches" value={data.career.matches} />
              <StatTile
                label="Runs"
                value={data.career.batting.runs}
                tone="accent"
                hint={
                  data.career.batting.average !== null
                    ? `average ${data.career.batting.average.toFixed(2)}`
                    : 'not yet dismissed'
                }
              />
              <StatTile
                label="Wickets"
                value={data.career.bowling.wickets}
                hint={data.career.bowling.bestFigures ?? 'no spell yet'}
              />
              <StatTile
                label="Dismissals taken"
                value={data.career.fielding.dismissals}
                hint={`${data.career.fielding.catches} caught`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8125rem] text-muted">
              <span>
                Still to score <span className="mono text-primary">{data.matchesToScore}</span>
              </span>
              <Link
                to={`/players/${data.user.username}`}
                className="ml-auto text-accent transition-opacity hover:opacity-70"
              >
                Full record →
              </Link>
            </div>
          </section>

          {data.recent.length > 0 ? (
            <section className="flex flex-col gap-5">
              <SectionHeading eyebrow="Behind you" title="Recent results" />
              <div className="grid gap-4 lg:grid-cols-2">
                {data.recent.map((match, index) => (
                  <Reveal key={match.id} index={index} step={45}>
                    <MatchCard match={match} />
                  </Reveal>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * A fixture from the reader's side. Their team is named first and marked, which
 * is not how a fixture list is written but is how a player reads one.
 */
function MatchCard({ match, accent = false }: { match: DashboardMatchDto; accent?: boolean }) {
  const isLive = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const finished = match.status === 'COMPLETED' || match.status === 'ABANDONED';

  // Live and finished matches have something to show on the public card; a
  // fixture that has not started has nothing there yet, so it links to nothing.
  const destination = isLive || finished ? `/live/${match.publicSlug}` : null;

  const body = (
    <div
      className={cn(
        'flex h-full flex-col justify-between gap-6 rounded-[var(--radius-lg)] border bg-raised p-6',
        'transition-all duration-[var(--dur)] ease-[var(--ease)]',
        accent ? 'border-[var(--live)]/45' : 'border-line',
        destination ? 'hover:border-[var(--accent-line)]' : null,
      )}
    >
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 text-[0.8125rem] text-muted">{match.tournament.name}</p>
          <StatusPill status={match.status} />
        </div>

        <div className="mt-5 flex items-center gap-3">
          {match.myTeam ? (
            <TeamMark
              shortName={match.myTeam.shortName}
              color={match.myTeam.primaryColor}
              size="sm"
            />
          ) : null}
          <p className="serif text-xl text-primary">
            {match.myTeam?.name ?? match.opponent?.name ?? 'To be confirmed'}
            {match.opponent && match.myTeam ? (
              <>
                <span className="mx-2 text-muted">v</span>
                {match.opponent.name}
              </>
            ) : null}
          </p>
        </div>

        {match.resultText ? (
          <p className="mt-3 text-[0.9375rem] text-secondary">{match.resultText}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="mono text-[0.75rem] text-muted">
          {formatWhen(match.scheduledAt)}
          <span className="mx-2 text-line-strong">·</span>
          {match.oversPerInnings} overs
          {match.venue ? (
            <>
              <span className="mx-2 text-line-strong">·</span>
              {match.venue}
            </>
          ) : null}
        </p>

        <div className="flex items-center gap-2">
          {match.isScorer ? <Pill tone="accent">You are scoring</Pill> : null}
          {isLive ? <span className="text-[0.8125rem] text-accent">Watch →</span> : null}
        </div>
      </div>
    </div>
  );

  if (!destination) return body;

  return (
    <Link to={destination} className="block h-full">
      {body}
    </Link>
  );
}

/**
 * A tournament you run, reduced to the one thing that decides what can happen
 * next: how many sides are registered, and how many of those have a full XI.
 * Fixtures are blocked until those two agree, so the card says which of the two
 * is missing rather than making you open it to find out.
 */
function OrganizingCard({ tournament }: { tournament: TournamentDto }) {
  const registered = tournament.registeredTeams ?? 0;
  const eligible = tournament.eligibleTeams ?? 0;
  const ready = registered === tournament.teamsCount && eligible === registered;
  const shortBy = registered - eligible;

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className={cn(
        'group flex h-full flex-col justify-between gap-7 rounded-[var(--radius-lg)] border border-line bg-raised p-6 sm:p-7',
        'transition-colors duration-[var(--dur)] ease-[var(--ease)] hover:border-[var(--accent-line)]',
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-5">
          <h3 className="serif text-[1.5rem] text-primary">{tournament.name}</h3>
          <span className="mono shrink-0 pt-1.5 text-[0.6875rem] text-muted">
            {FORMAT_LABELS[tournament.format]}
          </span>
        </div>

        <p className="mono mt-2.5 text-[0.8125rem] text-muted">
          {tournament.oversPerInnings} overs
          <span className="mx-2 text-line-strong">·</span>
          {tournament.teamsCount} teams
        </p>
      </div>

      <div className="flex items-center justify-between gap-6 border-t border-line pt-5">
        <p className="tabular text-sm text-primary">
          <span className="font-semibold">{registered}</span>
          <span className="text-muted">/{tournament.teamsCount}</span>
          <span className="ml-2 text-[0.8125rem] text-muted">registered</span>
        </p>

        <p className="text-right text-[0.8125rem] text-secondary">
          {ready ? (
            <span className="text-success">Ready for fixtures</span>
          ) : registered < tournament.teamsCount ? (
            `${tournament.teamsCount - registered} more to register`
          ) : (
            `${shortBy} short of a full XI`
          )}
        </p>
      </div>
    </Link>
  );
}

const FORMAT_LABELS = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_PLAYOFFS: 'League + playoffs',
} as const;

function SquadCard({ squad }: { squad: SquadMembershipDto }) {
  return (
    <div className="flex h-full flex-col gap-5 rounded-[var(--radius-lg)] border border-line bg-raised p-6">
      <div className="flex items-start gap-3">
        <TeamMark shortName={squad.team.shortName} color={squad.team.primaryColor} size="md" />
        <div className="min-w-0">
          <p className="serif text-lg text-primary">{squad.team.name}</p>
          <p className="mt-1 truncate text-[0.8125rem] text-muted">{squad.tournament.name}</p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
        <Pill>{ROLE_LABELS[squad.role]}</Pill>
        <p className="mono text-[0.75rem] text-muted">{squad.squadSize} named</p>
      </div>
    </div>
  );
}

const ROLE_LABELS = {
  BATSMAN: 'Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
  KEEPER: 'Keeper',
} as const;

function greeting(name?: string): string {
  const first = name?.trim().split(/\s+/)[0];
  if (!first) return 'Your cricket';

  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  return `${part}, ${first}`;
}

/** An undated fixture says so; a generated fixture list has no calendar yet. */
function formatWhen(iso: string | null): string {
  if (!iso) return 'Date to be confirmed';

  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
