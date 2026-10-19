import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { TeamDto } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ErrorText, Skeleton, SkeletonCard } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { useFixtures, useGenerateFixtures } from '@/features/matches/queries';
import { cn } from '@/lib/cn';
import { StandingsTable } from './StandingsTable';
import { TournamentStatsPanel } from './TournamentStatsPanel';
import { QualificationPanel } from './QualificationPanel';
import { SportMark } from '@/components/ui/SportMark';

const FORMAT_LABELS = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_PLAYOFFS: 'League + playoffs',
} as const;
import {
  useCreateTeam,
  useDeleteTeam,
  useDeleteTournament,
  useTeams,
  useTournament,
} from './queries';

export function TournamentDetailPage() {
  const { tournamentId = '' } = useParams();
  const navigate = useNavigate();

  const tournament = useTournament(tournamentId);
  const teams = useTeams(tournamentId);
  const fixtures = useFixtures(tournamentId);
  const deleteTeam = useDeleteTeam(tournamentId);
  const deleteTournament = useDeleteTournament();
  const generate = useGenerateFixtures(tournamentId);

  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<TeamDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (tournament.isPending) return <SkeletonCard rows={4} />;
  if (tournament.error) return <ErrorText error={tournament.error} />;
  if (!tournament.data) return null;

  const registered = teams.data?.total ?? 0;
  const eligible = teams.data?.eligibleCount ?? 0;
  const full = registered >= tournament.data.teamsCount;
  const readyForFixtures = full && eligible === registered;
  const fixtureCount = fixtures.data?.total ?? 0;
  const played = fixtures.data?.items.filter((match) => match.status === 'COMPLETED').length ?? 0;
  const started =
    fixtures.data?.items.filter((match) =>
      ['LIVE', 'INNINGS_BREAK', 'COMPLETED'].includes(match.status),
    ).length ?? 0;

  const isSingleMatch = tournament.data.teamsCount === 2 && !tournament.data.doubleRoundRobin;
  const soleMatch = isSingleMatch ? fixtures.data?.items[0] : undefined;

  async function startTheMatch() {
    const result = await generate.mutateAsync(false);
    const match = result.items[0];
    if (match) void navigate(`/matches/${match.id}`);
  }

  const nextStep = readyForFixtures
    ? isSingleMatch
      ? 'Ready to start'
      : 'Ready for fixtures'
    : !full
      ? `${tournament.data.teamsCount - registered} to register`
      : `${registered - eligible} squad${registered - eligible === 1 ? '' : 's'} short`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <BackLink to="/tournaments">Tournaments</BackLink>

        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <h1 className="serif text-[2.75rem] leading-[1.05]">{tournament.data.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <SportMark sport={tournament.data.sport} />
              <span>{FORMAT_LABELS[tournament.data.format]}</span>
              <span className="text-line-strong">/</span>
              <span>
                {tournament.data.sport === 'FOOTBALL'
                  ? `${tournament.data.periods} × ${tournament.data.periodMinutes} min`
                  : `${tournament.data.oversPerInnings} overs`}
              </span>
              <span className="text-line-strong">/</span>
              <span>{tournament.data.playersPerTeam} a side</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ShareLink
              slug={tournamentId}
              url={`${window.location.origin}/tournament/${tournamentId}`}
              label="Share"
              matchLabel={tournament.data.name}
              variant="quiet"
            />
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={full}>
              Add team
            </Button>
            {isSingleMatch ? (
              soleMatch ? (
                <Link to={`/matches/${soleMatch.id}`}>
                  <Button size="sm">Open match</Button>
                </Link>
              ) : (
                <Button
                  size="sm"
                  disabled={!readyForFixtures}
                  isLoading={generate.isPending}
                  onClick={() => void startTheMatch()}
                >
                  Start match
                </Button>
              )
            ) : (
              <Link to={`/tournaments/${tournamentId}/fixtures`}>
                <Button size="sm" disabled={!readyForFixtures && fixtureCount === 0}>
                  {fixtureCount > 0 ? 'Fixtures' : 'Generate fixtures'}
                </Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="quiet"
              onClick={() => setDeleting(true)}
              aria-label="Delete tournament"
              title="Delete tournament"
            >
              <svg
                viewBox="0 0 16 16"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
              </svg>
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised sm:grid-cols-4">
          {[
            { label: 'Teams', value: `${registered}/${tournament.data.teamsCount}` },
            { label: 'Full squads', value: `${eligible}/${registered}` },
            { label: 'Played', value: `${played}/${fixtureCount}` },
            { label: 'Next', value: nextStep, tone: readyForFixtures },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                'flex min-w-0 flex-col gap-0.5 px-4 py-3',
                index % 2 === 1 && 'border-l border-line',
                index === 2 && 'sm:border-l sm:border-line',
                index > 1 && 'max-sm:border-t max-sm:border-line',
              )}
            >
              <dt className="eyebrow">{stat.label}</dt>
              <dd
                className={cn(
                  'tabular truncate font-semibold',
                  index < 3 ? 'text-lg tracking-[-0.03em]' : 'pt-1 text-[0.8125rem]',
                  stat.tone && 'text-success',
                )}
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        {generate.error ? <ErrorText error={generate.error} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="text-[0.8125rem] font-semibold">Teams</h2>
          {teams.isPending ? (
            <Skeleton className="h-40" />
          ) : teams.data && teams.data.items.length > 0 ? (
            <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
              {teams.data.items.map((team) => (
                <li
                  key={team.id}
                  className="ledger-row flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0"
                >
                  <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" />
                  <Link
                    to={`/teams/${team.id}`}
                    className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium hover:underline"
                  >
                    {team.name}
                  </Link>
                  <span
                    className={cn(
                      'tabular text-xs',
                      team.isEligible ? 'text-secondary' : 'text-warning',
                    )}
                  >
                    {team.playerCount}/{team.squadSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemoving(team)}
                    aria-label={`Remove ${team.name}`}
                    className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-hover hover:text-alert"
                  >
                    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor">
                      <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No teams"
              description={`${tournament.data.teamsCount} slots open`}
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  Add team
                </Button>
              }
            />
          )}
          {deleteTeam.error ? <ErrorText error={deleteTeam.error} /> : null}
        </section>

        {played > 0 ? (
          <section className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[0.8125rem] font-semibold">Table</h2>
              <PdfButton
                size="sm"
                variant="quiet"
                build={() =>
                  import('@/lib/pdf').then((pdf) => pdf.buildTournamentPdf(tournamentId))
                }
              />
            </div>
            <StandingsTable tournamentId={tournamentId} sport={tournament.data?.sport} />
          </section>
        ) : null}
      </div>

      {started > 0 ? <TournamentStatsPanel tournamentId={tournamentId} /> : null}
      {played > 0 && teams.data ? (
        <QualificationPanel
          tournamentId={tournamentId}
          teams={teams.data.items.map((team) => ({ id: team.id, name: team.name }))}
        />
      ) : null}

      <AddTeamSheet tournamentId={tournamentId} open={adding} onClose={() => setAdding(false)} />

      <Sheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${tournament.data.name}?`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={tournament.data.status === 'IN_PROGRESS'}
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
        {tournament.data.status === 'IN_PROGRESS' ? (
          <p className="text-secondary">Matches are under way. Finish or abandon them first.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-secondary">
              {registered} side{registered === 1 ? '' : 's'} and {fixtureCount} fixture
              {fixtureCount === 1 ? '' : 's'} will be removed.
            </p>
            {deleteTournament.error ? <ErrorText error={deleteTournament.error} /> : null}
          </div>
        )}
      </Sheet>

      <Sheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? 'this side'}?`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteTeam.isPending}
              onClick={() => {
                if (removing) deleteTeam.mutate(removing.id);
                setRemoving(null);
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-secondary">
          Deletes the team and its players. Regenerate fixtures after.
        </p>
      </Sheet>
    </div>
  );
}

function AddTeamSheet({
  tournamentId,
  open,
  onClose,
}: {
  tournamentId: string;
  open: boolean;
  onClose: () => void;
}) {
  const createTeam = useCreateTeam(tournamentId);

  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#171717');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await createTeam.mutateAsync({ name, shortName, primaryColor });
    setName('');
    setShortName('');
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add team"
      footer={
        <>
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-team" isLoading={createTeam.isPending}>
            Add
          </Button>
        </>
      }
    >
      <form id="add-team" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          autoFocus
          required
          placeholder="Riverside XI"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (!shortName && name.trim()) {
              setShortName(
                name
                  .trim()
                  .split(/\s+/)
                  .map((word) => word[0] ?? '')
                  .join('')
                  .toUpperCase()
                  .slice(0, 4),
              );
            }
          }}
        />

        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <Input
            label="Short name"
            required
            maxLength={5}
            placeholder="RIV"
            value={shortName}
            onChange={(event) => setShortName(event.target.value.toUpperCase())}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="team-color" className="text-xs font-medium text-secondary">
              Colour
            </label>
            <div className="flex items-center gap-2">
              <input
                id="team-color"
                type="color"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                className="h-9 w-11 cursor-pointer rounded-[var(--radius-md)] border border-line bg-raised p-1"
              />
              <TeamMark shortName={shortName || '···'} color={primaryColor} />
            </div>
          </div>
        </div>

        {createTeam.error ? <ErrorText error={createTeam.error} /> : null}
      </form>
    </Sheet>
  );
}
