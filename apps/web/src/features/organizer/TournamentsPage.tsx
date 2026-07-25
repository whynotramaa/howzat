import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  DEFAULT_OVERS_PER_INNINGS,
  TOURNAMENT_FORMATS,
  type TournamentDto,
  type TournamentFormat,
} from '@howzat/shared';
import { Button } from '@/components/ui/Button';
import { EmptyState, SectionHeading } from '@/components/ui/Card';
import { Checkbox, Input, Select } from '@/components/ui/Input';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { Pill } from '@/components/ui/Pill';
import { Reveal } from '@/components/ui/Reveal';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { useCreateTournament, useTournaments } from './queries';

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_PLAYOFFS: 'League + playoffs',
};

/**
 * The organizer's shelf. Each tournament is a plate showing the one thing that
 * decides what can happen next: how many sides are registered, and how many of
 * them have a full XI. Fixtures are blocked until those two numbers agree, so
 * putting them on the card means nobody has to open a tournament to find out why.
 */
export function TournamentsPage() {
  const { data, isPending, error } = useTournaments();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <SectionHeading
        eyebrow="Your competitions"
        title="Tournaments"
        description="Register your sides, give each one eleven players, then generate the fixtures."
        action={<Button onClick={() => setCreating(true)}>New tournament</Button>}
      />

      {error ? <ErrorText error={error} /> : null}

      {isPending ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.items.map((tournament, index) => (
            <Reveal key={tournament.id} index={index} step={50}>
              <TournamentCard tournament={tournament} />
            </Reveal>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No tournaments on the board yet"
          description="Open your first one, register the sides, and the fixture list will write itself."
          action={<Button onClick={() => setCreating(true)}>New tournament</Button>}
        />
      )}

      <CreateTournamentSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function TournamentCard({ tournament }: { tournament: TournamentDto }) {
  const registered = tournament.registeredTeams ?? 0;
  const eligible = tournament.eligibleTeams ?? 0;
  const ready = registered === tournament.teamsCount && eligible === registered;
  const shortBy = registered - eligible;

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className={cn(
        'group flex h-full flex-col justify-between gap-8 rounded-[var(--radius-lg)] border border-line bg-raised p-7 sm:p-8',
        'transition-all duration-[var(--dur)] ease-[var(--ease)]',
        'hover:-translate-y-0.5 hover:border-[var(--accent-line)] hover:shadow-[var(--shadow-md)]',
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-5">
          <h3 className="serif text-[1.625rem] text-primary">{tournament.name}</h3>
          <Pill>{FORMAT_LABELS[tournament.format]}</Pill>
        </div>

        <p className="mono mt-3 text-[0.8125rem] text-muted">
          {tournament.oversPerInnings} overs
          <span className="mx-2 text-line-strong">·</span>
          {tournament.teamsCount} teams
          {tournament.doubleRoundRobin ? (
            <>
              <span className="mx-2 text-line-strong">·</span>home and away
            </>
          ) : null}
        </p>
      </div>

      <div className="flex items-center justify-between gap-6 border-t border-line pt-6">
        <div className="flex items-center gap-4">
          <ReadinessMark registered={registered} total={tournament.teamsCount} />
          <div className="leading-tight">
            <p className="tabular text-sm font-semibold text-primary">
              {registered}/{tournament.teamsCount}
            </p>
            <p className="eyebrow mt-1">Registered</p>
          </div>
        </div>

        <p className="max-w-[13rem] text-right text-[0.8125rem] text-secondary">
          {ready ? (
            <span className="text-success">Ready for fixtures</span>
          ) : registered < tournament.teamsCount ? (
            `${tournament.teamsCount - registered} more side${
              tournament.teamsCount - registered === 1 ? '' : 's'
            } to register`
          ) : (
            `${shortBy} side${shortBy === 1 ? '' : 's'} short of a full XI`
          )}
        </p>
      </div>
    </Link>
  );
}

function ReadinessMark({ registered, total }: { registered: number; total: number }) {
  const bars = Math.min(5, Math.max(1, Math.ceil((registered / Math.max(1, total)) * 5)));
  return (
    <div
      className="flex items-end gap-1"
      role="img"
      aria-label={`${registered} of ${total} teams registered`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'w-1.5 rounded-full transition-all',
            index < bars ? 'h-6 bg-[var(--accent-strong)]' : 'h-3 bg-line-strong',
          )}
        />
      ))}
    </div>
  );
}

function CreateTournamentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTournament = useCreateTournament();

  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('LEAGUE');
  const [teamsCount, setTeamsCount] = useState(4);
  const [oversPerInnings, setOversPerInnings] = useState(DEFAULT_OVERS_PER_INNINGS);
  const [doubleRoundRobin, setDoubleRoundRobin] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    await createTournament.mutateAsync({
      name,
      format,
      teamsCount,
      oversPerInnings,
      doubleRoundRobin,
    });

    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title="New tournament"
      description="These settings shape the fixture list. Overs can still be changed match by match."
      footer={
        <>
          <Button type="submit" form="create-tournament" isLoading={createTournament.isPending}>
            Create tournament
          </Button>
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="create-tournament" onSubmit={handleSubmit} className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Tournament name"
            autoFocus
            required
            placeholder="Sunday League 2026"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <Select
          label="Format"
          value={format}
          onChange={(event) => setFormat(event.target.value as TournamentFormat)}
        >
          {TOURNAMENT_FORMATS.map((option) => (
            <option key={option} value={option}>
              {FORMAT_LABELS[option]}
            </option>
          ))}
        </Select>

        <Input
          label="Number of teams"
          type="number"
          min={2}
          max={32}
          required
          value={teamsCount}
          onChange={(event) => setTeamsCount(Number(event.target.value))}
        />

        <Input
          label="Overs per innings"
          type="number"
          min={1}
          max={50}
          required
          value={oversPerInnings}
          onChange={(event) => setOversPerInnings(Number(event.target.value))}
        />

        <div className="flex items-end pb-1">
          <Checkbox
            label="Double round-robin"
            hint="Every pair meets twice, home and away."
            checked={doubleRoundRobin}
            onChange={(event) => setDoubleRoundRobin(event.target.checked)}
          />
        </div>

        {createTournament.error ? (
          <div className="sm:col-span-2">
            <ErrorText error={createTournament.error} />
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}
