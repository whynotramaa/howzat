import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { TeamDto } from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { EmptyState, SectionHeading, StatTile } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ErrorText, SkeletonCard, SquadProgress } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { Reveal } from '@/components/ui/Reveal';
import { Sheet } from '@/components/ui/Sheet';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { useFixtures } from '@/features/matches/queries';
import { cn } from '@/lib/cn';
import { StandingsTable } from './StandingsTable';
import { TournamentStatsPanel } from './TournamentStatsPanel';
import { QualificationPanel } from './QualificationPanel';
import { SportEyebrow } from '@/components/ui/SportMark';
import {
  useCreateTeam,
  useDeleteTeam,
  useDeleteTournament,
  useTeams,
  useTournament,
} from './queries';

/**
 * One tournament: what is registered, what is missing, and the way through to
 * fixtures. The readiness line states the blocker in the same words the API uses
 * to refuse, so the reason a button is disabled is never a mystery.
 */
export function TournamentDetailPage() {
  const { tournamentId = '' } = useParams();
  const navigate = useNavigate();

  const tournament = useTournament(tournamentId);
  const teams = useTeams(tournamentId);
  const fixtures = useFixtures(tournamentId);
  const deleteTeam = useDeleteTeam(tournamentId);
  const deleteTournament = useDeleteTournament();

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
  // The leaders board counts anything that has kicked off, so it is offered as
  // soon as there is a match under way rather than only after a final whistle.
  const started =
    fixtures.data?.items.filter((match) =>
      ['LIVE', 'INNINGS_BREAK', 'COMPLETED'].includes(match.status),
    ).length ?? 0;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-8">
        <BackLink to="/tournaments">All tournaments</BackLink>

        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <SportEyebrow
                sport={tournament.data.sport}
                detail={tournament.data.format.replace(/_/g, ' + ').toLowerCase()}
              />
              <span aria-hidden className="h-3 w-px bg-line" />
              <p className="eyebrow">{tournament.data.status.replace(/_/g, ' ')}</p>
            </div>

            <h1 className="serif mt-4 text-[2.5rem] text-primary sm:text-[3rem]">
              {tournament.data.name}
            </h1>

            <p className="mono mt-3 text-[0.8125rem] text-muted">
              {tournament.data.sport === 'FOOTBALL'
                ? `${tournament.data.periods} × ${tournament.data.periodMinutes} minutes`
                : `${tournament.data.oversPerInnings} overs per innings`}
              <span className="mx-2 text-line-strong">·</span>
              {tournament.data.teamsCount} sides
              <span className="mx-2 text-line-strong">·</span>
              {tournament.data.playersPerTeam} a side
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <ShareLink
              slug={tournamentId}
              url={`${window.location.origin}/tournament/${tournamentId}`}
              label="Share tournament"
              matchLabel={tournament.data.name}
              variant="quiet"
            />
            <Button variant="secondary" onClick={() => setAdding(true)} disabled={full}>
              {full ? 'All sides registered' : 'Register a side'}
            </Button>

            {/* Reachable before the squads are complete, because the page it leads
                to is where the reason it is blocked gets explained. */}
            <Link to={`/tournaments/${tournamentId}/fixtures`}>
              <Button disabled={!readyForFixtures && fixtureCount === 0}>
                {fixtureCount > 0 ? `Fixtures (${fixtureCount})` : 'Generate fixtures'}
              </Button>
            </Link>

            {/* Last in the row and quiet, because it is the one action here
                that cannot be undone. The API refuses outright once matches
                are under way, so this says so rather than offering a button
                that only fails when pressed. */}
            <Button
              variant="quiet"
              onClick={() => setDeleting(true)}
              title={
                tournament.data.status === 'IN_PROGRESS'
                  ? 'Matches are under way — a live tournament cannot be deleted'
                  : undefined
              }
            >
              Delete
            </Button>
          </div>
        </div>

        <div className="rule" />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Sides registered"
            value={`${registered}/${tournament.data.teamsCount}`}
          />
          <StatTile
            label="With a full squad"
            value={`${eligible}/${registered}`}
            tone={readyForFixtures ? 'success' : 'default'}
          />
          <StatTile label="Fixtures played" value={`${played}/${fixtureCount}`} />
        </div>

        <p
          className={cn(
            'flex items-center gap-3 text-[0.9375rem]',
            readyForFixtures ? 'text-success' : 'text-secondary',
          )}
        >
          {readyForFixtures
            ? `Every side has ${tournament.data.playersPerTeam} players. You can generate the fixture list.`
            : !full
              ? `Register ${tournament.data.teamsCount - registered} more side${
                  tournament.data.teamsCount - registered === 1 ? '' : 's'
                } before generating fixtures.`
              : `${registered - eligible} side${
                  registered - eligible === 1 ? '' : 's'
                } still need a full squad of ${tournament.data.playersPerTeam} players.`}
        </p>
      </div>

      <section className="flex flex-col gap-7">
        <SectionHeading eyebrow="Squads" title="Registered sides" />

        {teams.isPending ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonCard rows={1} />
            <SkeletonCard rows={1} />
          </div>
        ) : teams.data && teams.data.items.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {teams.data.items.map((team, index) => (
              <Reveal key={team.id} index={index} step={40}>
                <article className="flex items-center gap-5 rounded-[var(--radius-lg)] border border-line bg-raised px-6 py-5 transition-colors hover:border-line-strong">
                  <TeamMark shortName={team.shortName} color={team.primaryColor} />

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/teams/${team.id}`}
                      className="block truncate font-medium text-primary underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[var(--accent-strong)]"
                    >
                      {team.name}
                    </Link>
                    <p className="mt-0.5 text-[0.8125rem] text-muted">
                      {team.isEligible
                        ? 'Full squad — can be scheduled'
                        : `${team.squadSize - team.playerCount} more player${
                            team.squadSize - team.playerCount === 1 ? '' : 's'
                          } needed`}
                    </p>
                  </div>

                  <SquadProgress count={team.playerCount} squadSize={team.squadSize} />

                  <button
                    type="button"
                    onClick={() => setRemoving(team)}
                    aria-label={`Remove ${team.name}`}
                    className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-hover hover:text-alert"
                  >
                    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor">
                      <path d="M3.5 3.5l9 9m0-9l-9 9" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </article>
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No sides registered yet"
            description={`This tournament is set up for ${tournament.data.teamsCount} sides. Register the first one to get started.`}
            action={<Button onClick={() => setAdding(true)}>Register a side</Button>}
          />
        )}

        {deleteTeam.error ? <ErrorText error={deleteTeam.error} /> : null}
      </section>

      {/* The table only exists once a match has produced a result. */}
      {played > 0 ? (
        <section className="flex flex-col gap-7">
          <SectionHeading
            eyebrow="Standings"
            title="Points table"
            description="Recomputed from the innings records every time a result lands, so it never drifts."
          />
          <StandingsTable tournamentId={tournamentId} sport={tournament.data?.sport} />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[0.9375rem] text-secondary">
              The table, every result and the fixtures still to come, as one document.
            </p>
            <PdfButton
              variant="secondary"
              build={() => import('@/lib/pdf').then((pdf) => pdf.buildTournamentPdf(tournamentId))}
            />
          </div>
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
        description="Every side, squad, fixture and score recorded in this tournament goes with it. It cannot be undone."
        footer={
          <>
            <Button
              variant="danger"
              disabled={tournament.data.status === 'IN_PROGRESS'}
              isLoading={deleteTournament.isPending}
              onClick={async () => {
                await deleteTournament.mutateAsync(tournamentId);
                setDeleting(false);
                // Nothing left to look at, so leave rather than render a 404.
                void navigate('/tournaments');
              }}
            >
              Delete it
            </Button>
            <Button variant="quiet" onClick={() => setDeleting(false)}>
              Keep it
            </Button>
          </>
        }
      >
        {tournament.data.status === 'IN_PROGRESS' ? (
          <p className="text-secondary">
            Matches are under way. A tournament being played cannot be deleted — abandon
            or finish the remaining fixtures first.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
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
        description="This deletes the side and every player registered to it. It cannot be undone."
        footer={
          <>
            <Button
              variant="danger"
              isLoading={deleteTeam.isPending}
              onClick={() => {
                if (removing) deleteTeam.mutate(removing.id);
                setRemoving(null);
              }}
            >
              Remove the side
            </Button>
            <Button variant="quiet" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
          </>
        }
      >
        <p className="text-secondary">
          Fixtures already generated for this tournament will need regenerating afterwards.
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
  // The house blue as a default, so a side that never picks a colour still
  // looks deliberate rather than unset.
  const [primaryColor, setPrimaryColor] = useState('#1268bd');

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
      title="Register a side"
      description="The abbreviation and colour are what appear on the live card."
      footer={
        <>
          <Button type="submit" form="add-team" isLoading={createTeam.isPending}>
            Register the side
          </Button>
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="add-team" onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Input
          label="Side name"
          autoFocus
          required
          placeholder="Riverside XI"
          value={name}
          onChange={(event) => setName(event.target.value)}
          // Auto-fill the abbreviation from initials; still editable.
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
            label="Abbreviation"
            required
            maxLength={5}
            placeholder="RIV"
            hint="Up to five characters, shown on the scorecard."
            value={shortName}
            onChange={(event) => setShortName(event.target.value.toUpperCase())}
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="team-color" className="eyebrow text-secondary">
              Colour
            </label>
            <div className="flex items-center gap-3">
              <input
                id="team-color"
                type="color"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                className="h-12 w-14 cursor-pointer rounded-[var(--radius-sm)] border border-line bg-raised p-1"
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
