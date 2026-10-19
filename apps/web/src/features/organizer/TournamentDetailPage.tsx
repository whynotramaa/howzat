import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { TeamDto } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader, SectionHeading, StatStrip } from '@/components/ui/Card';
import { SportGlyph } from '@/components/ui/Sketch';
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

import {
  useCreateTeam,
  useDeleteTeam,
  useDeleteTournament,
  useTeams,
  useTournament,
} from './queries';

const FORMAT_LABELS = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_PLAYOFFS: 'League + playoffs',
} as const;

const TEAM_COLORS = ['#2f63d8', '#d0533c', '#4d8a57', '#d99a2b', '#7a58c9', '#1f8a8a', '#b8336a', '#191917'];

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

  const steps = [
    {
      label: 'Register teams',
      detail: full ? 'Every slot filled' : `${tournament.data.teamsCount - registered} slots still open`,
      done: full,
    },
    {
      label: 'Fill the squads',
      detail:
        registered === 0
          ? 'Waiting on teams'
          : eligible === registered
            ? 'Every squad is ready'
            : `${registered - eligible} squad${registered - eligible === 1 ? '' : 's'} short of players`,
      done: registered > 0 && eligible === registered,
    },
    {
      label: isSingleMatch ? 'Start the match' : 'Draw the fixtures',
      detail:
        fixtureCount > 0
          ? `${played} of ${fixtureCount} played`
          : readyForFixtures
            ? 'Good to go'
            : 'Unlocks when squads are full',
      done: fixtureCount > 0,
    },
  ];
  const current = steps.findIndex((step) => !step.done);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        back={<BackLink to="/tournaments">Tournaments</BackLink>}
        eyebrow={
          <>
            <span>{tournament.data.sport === 'FOOTBALL' ? 'Football' : 'Cricket'}</span>
            <span aria-hidden>·</span>
            <span>{FORMAT_LABELS[tournament.data.format]}</span>
            <span aria-hidden>·</span>
            <span>
              {tournament.data.sport === 'FOOTBALL'
                ? `${tournament.data.periods} × ${tournament.data.periodMinutes} min`
                : `${tournament.data.oversPerInnings} overs`}
            </span>
            <span aria-hidden>·</span>
            <span>{tournament.data.playersPerTeam} a side</span>
          </>
        }
        title={tournament.data.name}
        description={readyForFixtures
          ? `Every squad is in. ${isSingleMatch ? 'Start the match whenever the teams walk out.' : 'Draw the fixtures and the season begins.'}`
          : `${nextStep}. ${tournament.data.teamsCount} teams play this ${FORMAT_LABELS[tournament.data.format].toLowerCase()}${tournament.data.doubleRoundRobin ? ' home and away' : ''}.`}
        art={<SportGlyph sport={tournament.data.sport} className="ml-auto size-36" />}
        actions={
          <>
            {isSingleMatch ? (
              soleMatch ? (
                <Link to={`/matches/${soleMatch.id}`}>
                  <Button>Open match</Button>
                </Link>
              ) : (
                <Button
                  disabled={!readyForFixtures}
                  isLoading={generate.isPending}
                  onClick={() => void startTheMatch()}
                >
                  Start match
                </Button>
              )
            ) : (
              <Link to={`/tournaments/${tournamentId}/fixtures`}>
                <Button disabled={!readyForFixtures && fixtureCount === 0}>
                  {fixtureCount > 0 ? 'Fixtures' : 'Generate fixtures'}
                </Button>
              </Link>
            )}
            <Button variant="secondary" onClick={() => setAdding(true)} disabled={full}>
              Add team
            </Button>
            <ShareLink
              slug={tournamentId}
              url={`${window.location.origin}/tournament/${tournamentId}`}
              label="Share"
              matchLabel={tournament.data.name}
              variant="quiet"
            />
            <Button
              variant="quiet"
              onClick={() => setDeleting(true)}
              aria-label="Delete tournament"
              title="Delete tournament"
            >
              <svg
                viewBox="0 0 16 16"
                className="size-4"
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
          </>
        }
      />

      {generate.error ? <ErrorText error={generate.error} /> : null}

      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={cn(
              'flex items-center gap-4 rounded-[var(--radius-xl)] border bg-raised p-4',
              index === current ? 'border-primary' : 'border-line',
            )}
          >
            <span
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-full border font-serif text-[1.25rem] leading-none',
                step.done
                  ? 'border-success bg-success text-[var(--surface-raised)]'
                  : index === current
                    ? 'border-primary text-primary'
                    : 'border-line-strong text-muted',
              )}
            >
              {step.done ? (
                <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-primary">{step.label}</span>
              <span className="block truncate text-xs text-muted">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <StatStrip
        items={[
          { label: 'Teams in', value: `${registered}/${tournament.data.teamsCount}` },
          { label: 'Squads ready', value: `${eligible}/${registered}`, tone: registered > 0 && eligible === registered ? 'success' : 'default' },
          { label: 'Matches played', value: `${played}/${fixtureCount}` },
        ]}
      />

      <section className="flex min-w-0 flex-col gap-5">
        <SectionHeading
          eyebrow="The field"
          title="Teams"
          description="Open a team to pick its squad. A team is ready once its squad is full."
          action={
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={full}>
              Add team
            </Button>
          }
        />
        {teams.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-44" />
            ))}
          </div>
        ) : teams.data && teams.data.items.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {teams.data.items.map((team, index) => (
              <li
                key={team.id}
                className="reveal relative"
                style={{ '--delay': `${index * 50}ms` } as CSSProperties}
              >
                <Link
                  to={`/teams/${team.id}`}
                  className="card-lift flex h-full flex-col items-center rounded-[var(--radius-xl)] border border-line bg-raised px-4 pt-6 pb-4 text-center"
                >
                  <TeamMark shortName={team.shortName} color={team.primaryColor} size="xl" />
                  <span className="mt-4 line-clamp-1 text-[0.9375rem] font-semibold text-primary">
                    {team.name}
                  </span>
                  <span className={cn('mt-1 text-xs', team.isEligible ? 'text-success' : 'text-warning')}>
                    {team.isEligible ? 'Squad ready' : `${team.squadSize - team.playerCount} more to pick`}
                  </span>
                  <span className="mt-4 flex w-full items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-sunken">
                      <span
                        className={cn('block h-full rounded-full', team.isEligible ? 'bg-success' : 'bg-[var(--ink-amber)]')}
                        style={{ width: `${Math.min(100, (team.playerCount / Math.max(1, team.squadSize)) * 100)}%` }}
                      />
                    </span>
                    <span className="tabular text-xs text-muted">
                      {team.playerCount}/{team.squadSize}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setRemoving(team)}
                  aria-label={`Remove ${team.name}`}
                  className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-alert"
                >
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" aria-hidden>
                    <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
            {!full
              ? Array.from({ length: Math.min(4, tournament.data.teamsCount - registered) }, (_, index) => (
                  <li key={`open-${index}`}>
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      className="grid h-full min-h-44 w-full place-content-center justify-items-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-line-strong text-muted transition-colors hover:border-primary hover:text-primary"
                    >
                      <span className="grid size-12 place-items-center rounded-full border border-dashed border-current text-xl leading-none">
                        +
                      </span>
                      <span className="text-xs font-medium">Open slot</span>
                    </button>
                  </li>
                ))
              : null}
          </ul>
        ) : (
          <EmptyState
            scene="squad"
            title="No teams yet"
            description={`${tournament.data.teamsCount} slots are open. Add the first team and give it a colour.`}
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
        <section className="flex min-w-0 flex-col gap-5">
          <SectionHeading
            eyebrow="Standings"
            title="The table"
            description="Updated the moment a result goes in."
            action={
              <PdfButton
                size="sm"
                variant="quiet"
                build={() => import('@/lib/pdf').then((pdf) => pdf.buildTournamentPdf(tournamentId))}
              />
            }
          />
          <StandingsTable tournamentId={tournamentId} sport={tournament.data?.sport} />
        </section>
      ) : null}

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
  const [primaryColor, setPrimaryColor] = useState(TEAM_COLORS[0]!);

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

        <Input
          label="Short name"
          required
          maxLength={5}
          placeholder="RIV"
          value={shortName}
          onChange={(event) => setShortName(event.target.value.toUpperCase())}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-xs font-medium text-secondary">Colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {TEAM_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use ${swatch}`}
                aria-pressed={primaryColor === swatch}
                onClick={() => setPrimaryColor(swatch)}
                className={cn(
                  'size-8 rounded-full border-2 transition-transform',
                  primaryColor === swatch ? 'scale-110 border-primary' : 'border-transparent',
                )}
                style={{ background: swatch }}
              />
            ))}
            <label className="relative grid size-8 cursor-pointer place-items-center rounded-full border border-dashed border-line-strong text-xs text-muted">
              +
              <input
                id="team-color"
                type="color"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                aria-label="Custom colour"
              />
            </label>
          </div>
        </fieldset>

        <div className="paper-grain flex items-center gap-5 rounded-[var(--radius-xl)] border border-line p-5">
          <TeamMark shortName={shortName || '···'} color={primaryColor} size="xl" />
          <div className="min-w-0">
            <p className="eyebrow">Crest preview</p>
            <p className="serif mt-2 truncate text-[1.75rem]">{name || 'Your team'}</p>
          </div>
        </div>

        {createTeam.error ? <ErrorText error={createTeam.error} /> : null}
      </form>
    </Sheet>
  );
}
