import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { MatchDto, TeamDto } from '@howzat/shared';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { Disclosure } from '@/components/ui/Disclosure';
import { ErrorText, Skeleton, SkeletonCard } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { PdfButton } from '@/components/ui/PdfButton';
import { Tabs } from '@/components/ui/Tabs';
import { stageLabel } from '@/lib/pdf/sources';
import { useFixtures, useGenerateFixtures } from '@/features/matches/queries';
import { cn } from '@/lib/cn';
import { StandingsTable } from './StandingsTable';
import { TournamentStatsPanel } from './TournamentStatsPanel';
import { QualificationPanel } from './QualificationPanel';
import {
  useCreateTeam,
  useDeleteTournament,
  useTeams,
  useTournament,
} from './queries';

const FORMAT_LABELS = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_PLAYOFFS: 'League + playoffs',
} as const;

const TEAM_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0d9488',
  '#db2777',
  '#18181b',
];

type Tab = 'fixtures' | 'teams' | 'table';

export function TournamentDetailPage() {
  const { tournamentId = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const tournament = useTournament(tournamentId);
  const teams = useTeams(tournamentId);
  const fixtures = useFixtures(tournamentId);
  const deleteTournament = useDeleteTournament();
  const generate = useGenerateFixtures(tournamentId);

  const [deleting, setDeleting] = useState(false);

  if (tournament.isPending) return <SkeletonCard rows={4} />;
  if (tournament.error)
    return <ErrorText error={tournament.error} onRetry={() => void tournament.refetch()} />;
  if (!tournament.data) return null;

  const t = tournament.data;
  const registered = teams.data?.total ?? 0;
  const eligible = teams.data?.eligibleCount ?? 0;
  const full = registered >= t.teamsCount;
  const ready = full && eligible === registered;
  const matches = fixtures.data?.items ?? [];
  const played = matches.filter((match) => match.status === 'COMPLETED').length;
  const started = matches.filter((match) =>
    ['LIVE', 'INNINGS_BREAK', 'COMPLETED'].includes(match.status),
  ).length;
  const isSingleMatch = t.teamsCount === 2 && !t.doubleRoundRobin;

  const tabs: Array<{ value: Tab; label: string; meta?: number }> = [
    { value: 'fixtures', label: 'Matches', meta: matches.length || undefined },
    { value: 'table', label: 'Table' },
    { value: 'teams', label: 'Teams', meta: registered },
  ];
  const requested = params.get('tab') as Tab | null;
  const tab: Tab =
    requested && tabs.some((item) => item.value === requested)
      ? requested
      : matches.length
        ? 'fixtures'
        : 'teams';

  async function handleGenerate() {
    const result = await generate.mutateAsync(false);
    if (isSingleMatch && result.items[0]) {
      void navigate(`/matches/${result.items[0].id}/score`);
      return;
    }
    setParams({ tab: 'fixtures' }, { replace: true });
  }

  const shareUrl = `${window.location.origin}/tournament/${tournamentId}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="-mx-2 -mt-2 flex items-center justify-between">
        <Link
          to="/tournaments"
          aria-label="Back to tournaments"
          className="press grid size-11 place-items-center hover:bg-hover"
        >
          <svg viewBox="0 0 256 256" className="size-[22px]" fill="currentColor" aria-hidden>
            <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
          </svg>
        </Link>
        <Disclosure className="relative">
          <summary
            aria-label="Tournament menu"
            className="press grid size-11 cursor-pointer list-none place-items-center hover:bg-hover"
          >
            <svg viewBox="0 0 256 256" className="size-[22px]" fill="currentColor" aria-hidden>
              <path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z" />
            </svg>
          </summary>
          <div className="absolute right-0 z-40 mt-1 grid w-52 border border-line bg-raised p-1">
            <button
              type="button"
              onClick={() => void shareTournament(shareUrl, t.name)}
              className="flex h-10 items-center px-3 text-left text-sm font-medium hover:bg-sunken"
            >
              Share link
            </button>
            {played ? (
              <PdfButton
                variant="quiet"
                label="Download PDF"
                className="h-10 justify-start px-3"
                build={() => import('@/lib/pdf').then((pdf) => pdf.buildTournamentPdf(tournamentId))}
              />
            ) : null}
            <hr className="my-1 border-line" />
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="flex h-10 items-center px-3 text-left text-sm font-medium text-alert hover:bg-sunken"
            >
              Delete tournament
            </button>
          </div>
        </Disclosure>
      </div>

      <header className="grid gap-1">
        <h1 className="page-title truncate">{t.name}</h1>
        <p className="truncate text-[13px] text-secondary">
          {[
            t.sport === 'FOOTBALL' ? 'Football' : 'Cricket',
            FORMAT_LABELS[t.format],
            `${t.teamsCount} teams`,
            t.sport === 'FOOTBALL' ? `${t.periods} × ${t.periodMinutes} min` : `${t.oversPerInnings} ov`,
          ].join(' · ')}
        </p>
      </header>

      <Tabs
        value={tab}
        onChange={(value) => setParams({ tab: value }, { replace: true })}
        items={tabs}
      />

      {generate.error ? <ErrorText error={generate.error} /> : null}

      {tab === 'fixtures' ? (
        matches.length ? (
          <FixturesTab tournamentId={tournamentId} matches={matches} />
        ) : (
          <EmptyState
            title={ready ? 'Ready to draw' : 'No matches yet'}
            description={
              ready ? undefined : `Fill ${t.teamsCount} teams with full squads first`
            }
            action={
              ready ? (
                <Button isLoading={generate.isPending} onClick={() => void handleGenerate()}>
                  {isSingleMatch ? 'Start match' : 'Generate fixtures'}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setParams({ tab: 'teams' }, { replace: true })}
                >
                  Go to teams
                </Button>
              )
            }
          />
        )
      ) : null}

      {tab === 'teams' ? (
        <TeamsTab
          tournamentId={tournamentId}
          teams={teams.data?.items}
          isPending={teams.isPending}
          slotsLeft={Math.max(0, t.teamsCount - registered)}
          canDraw={ready && matches.length === 0}
          isSingleMatch={isSingleMatch}
          drawing={generate.isPending}
          onDraw={() => void handleGenerate()}
        />
      ) : null}

      {tab === 'table' ? (
        played ? (
          <div className="flex flex-col gap-8">
            <StandingsTable tournamentId={tournamentId} sport={t.sport} />
            {teams.data ? (
              <QualificationPanel
                tournamentId={tournamentId}
                teams={teams.data.items.map((team) => ({ id: team.id, name: team.name }))}
              />
            ) : null}
            {started ? <TournamentStatsPanel tournamentId={tournamentId} /> : null}
          </div>
        ) : (
          <EmptyState compact title="The table fills after the first result" />
        )
      ) : null}

      <Sheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${t.name}?`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={t.status === 'IN_PROGRESS'}
              isLoading={deleteTournament.isPending}
              onClick={async () => {
                await deleteTournament.mutateAsync(tournamentId);
                setDeleting(false);
                void navigate('/tournaments');
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-secondary">
          {t.status === 'IN_PROGRESS'
            ? 'Matches are under way. Finish or abandon them first.'
            : `Removes ${registered} team${registered === 1 ? '' : 's'} and ${matches.length} match${matches.length === 1 ? '' : 'es'}.`}
        </p>
        {deleteTournament.error ? <ErrorText error={deleteTournament.error} /> : null}
      </Sheet>
    </div>
  );
}

async function shareTournament(url: string, name: string) {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: name, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    window.prompt('Copy this link', url);
  }
}

function TeamsTab({
  tournamentId,
  teams,
  isPending,
  slotsLeft,
  canDraw,
  isSingleMatch,
  drawing,
  onDraw,
}: {
  tournamentId: string;
  teams: TeamDto[] | undefined;
  isPending: boolean;
  slotsLeft: number;
  canDraw: boolean;
  isSingleMatch: boolean;
  drawing: boolean;
  onDraw: () => void;
}) {
  const createTeam = useCreateTeam(tournamentId);
  const [name, setName] = useState('');

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const words = trimmed.split(/\s+/);
    const shortName = (
      words.length > 1 ? words.map((word) => word[0] ?? '').join('') : trimmed.slice(0, 3)
    )
      .toUpperCase()
      .slice(0, 4);
    await createTeam.mutateAsync({
      name: trimmed,
      shortName,
      primaryColor: TEAM_COLORS[(teams?.length ?? 0) % TEAM_COLORS.length]!,
    });
    setName('');
  }

  if (isPending) return <Skeleton className="h-40" />;

  return (
    <div className="grid gap-3">
      {teams?.length ? (
        <ul className="border border-line bg-raised px-4">
          {teams.map((team) => {
            const short = !team.isEligible;
            return (
              <li key={team.id} className="border-b border-line last:border-b-0">
                <Link
                  to={`/teams/${team.id}`}
                  className="grid h-[3.75rem] grid-cols-[2rem_minmax(0,1fr)_auto_1.25rem] items-center gap-3"
                >
                  <TeamMark shortName={team.shortName} color={team.primaryColor} size="md" />
                  <span className="truncate text-[15px] font-medium">{team.name}</span>
                  <span
                    className={cn(
                      'text-[13px] whitespace-nowrap',
                      short ? 'bg-warning-soft px-2 py-0.5 font-semibold text-warning' : 'text-muted',
                    )}
                  >
                    {short ? `${team.playerCount} of ${team.squadSize}` : `${team.playerCount} players`}
                  </span>
                  <Chevron />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {slotsLeft > 0 ? (
        <form onSubmit={handleAdd} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            aria-label="Team name"
            placeholder="Team name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 border border-line-strong bg-raised px-4 text-[15px] outline-none placeholder:text-muted focus:border-[var(--text-primary)]"
          />
          <Button type="submit" isLoading={createTeam.isPending} disabled={!name.trim()}>
            <svg viewBox="0 0 256 256" className="size-[18px]" fill="currentColor" aria-hidden>
              <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
            </svg>
            Add
          </Button>
        </form>
      ) : null}
      {createTeam.error ? <ErrorText error={createTeam.error} /> : null}
      {slotsLeft > 0 ? (
        <p className="t-caption">
          {slotsLeft} slot{slotsLeft === 1 ? '' : 's'} open
        </p>
      ) : null}

      {canDraw ? (
        <Button size="lg" isLoading={drawing} onClick={onDraw}>
          {isSingleMatch ? 'Start match' : 'Generate fixtures'}
        </Button>
      ) : null}
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 256 256" className="size-5 text-muted" fill="currentColor" aria-hidden>
      <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
    </svg>
  );
}

function FixturesTab({ tournamentId, matches }: { tournamentId: string; matches: MatchDto[] }) {
  const generate = useGenerateFixtures(tournamentId);
  const [confirm, setConfirm] = useState(false);
  const anyStarted = matches.some((match) => match.status !== 'SCHEDULED');
  const groups = [
    {
      title: 'Live',
      live: true,
      items: matches.filter((match) => ['LIVE', 'INNINGS_BREAK', 'TOSS'].includes(match.status)),
    },
    { title: 'Upcoming', live: false, items: matches.filter((match) => match.status === 'SCHEDULED') },
    {
      title: 'Results',
      live: false,
      items: matches
        .filter((match) => match.status === 'COMPLETED' || match.status === 'ABANDONED')
        .reverse(),
    },
  ];

  return (
    <div className="grid gap-7">
      {groups
        .filter((group) => group.items.length)
        .map((group) => (
          <section key={group.title} className="grid gap-2">
            <div className="flex h-[22px] items-center gap-2">
              {group.live ? <span aria-hidden className="live-square text-live !size-2" /> : null}
              <b className="text-[15px] font-semibold">{group.title}</b>
              <span className="t-caption">{group.items.length}</span>
            </div>
            <ul className="border border-line bg-raised px-4">
              {group.items.map((match) => (
                <FixtureRow key={match.id} match={match} />
              ))}
            </ul>
          </section>
        ))}

      {!anyStarted ? (
        <div>
          <Button size="sm" variant="quiet" onClick={() => setConfirm(true)}>
            Regenerate fixtures
          </Button>
        </div>
      ) : null}

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Regenerate fixtures?"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={generate.isPending}
              onClick={async () => {
                await generate.mutateAsync(true);
                setConfirm(false);
              }}
            >
              Regenerate
            </Button>
          </>
        }
      >
        <p className="text-sm text-secondary">Replaces every fixture and clears scorers.</p>
        {generate.error ? <ErrorText error={generate.error} /> : null}
      </Sheet>
    </div>
  );
}

function FixtureRow({ match }: { match: MatchDto }) {
  const live = ['LIVE', 'INNINGS_BREAK', 'TOSS'].includes(match.status);
  const done = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const meta = done
    ? (match.resultText ?? 'No result')
    : [
        stageLabel(match.stage, match.round),
        match.scheduledAt
          ? new Date(match.scheduledAt).toLocaleString(undefined, {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })
          : null,
        match.venue,
        match.scorers.length ? null : 'No scorer yet',
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-4 last:border-b-0">
      <Link to={done ? `/live/${match.publicSlug}?view=scorecard` : `/matches/${match.id}`} className="grid min-w-0 gap-2">
        <Side team={match.team1} winner={match.winnerTeamId} />
        <Side team={match.team2} winner={match.winnerTeamId} />
        <p className={cn('truncate pl-10 text-xs font-medium', live ? 'font-semibold text-live' : 'text-muted')}>
          {meta}
        </p>
      </Link>
      {done ? (
        <Chevron />
      ) : live || match.scorers.length ? (
        <ButtonLink to={`/matches/${match.id}/score`} size="sm">
          Score
        </ButtonLink>
      ) : (
        <ButtonLink to={`/matches/${match.id}`} size="sm" variant="secondary">
          Assign
        </ButtonLink>
      )}
    </li>
  );
}

function Side({ team, winner }: { team: MatchDto['team1']; winner: string | null }) {
  if (!team) return <span className="pl-10 text-[15px] text-muted">To be decided</span>;
  const lost = Boolean(winner && winner !== team.id);
  return (
    <span className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-3">
      <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" className="!size-7" />
      <span className={cn('truncate text-[15px]', lost ? 'text-muted' : 'font-medium')}>{team.name}</span>
    </span>
  );
}

