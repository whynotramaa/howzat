import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DEFAULT_OVERS_PER_INNINGS,
  DEFAULT_PERIODS,
  DEFAULT_PERIOD_MINUTES,
  MAX_PLAYERS_PER_TEAM,
  MIN_PLAYERS_PER_TEAM,
  PLAYERS_PER_TEAM,
  TOURNAMENT_FORMATS,
  formationsFor,
  type Sport,
  type TournamentDto,
  type TournamentFormat,
} from '@howzat/shared';
import { PeriodDesigner } from '@/features/football/PeriodDesigner';
import { SportMark } from '@/components/ui/SportMark';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { Checkbox, Input, Select } from '@/components/ui/Input';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { QuickMatchSheet } from './QuickMatchSheet';
import { useCreateTournament, useTournaments } from './queries';

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_PLAYOFFS: 'League + playoffs',
};

const SPORTS: Array<{ value: Sport; label: string }> = [
  { value: 'CRICKET', label: 'Cricket' },
  { value: 'FOOTBALL', label: 'Football' },
];

export function TournamentsPage() {
  const { data, isPending, error } = useTournaments();
  const [params, setParams] = useSearchParams();
  const [quickMatch, setQuickMatch] = useState(false);
  const creating = params.get('new') === '1';
  const setCreating = (open: boolean) => setParams(open ? { new: '1' } : {}, { replace: true });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Tournaments</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setQuickMatch(true)}>
            Quick match
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            New tournament
          </Button>
        </div>
      </header>

      {error ? <ErrorText error={error} /> : null}

      {isPending ? (
        <Skeleton className="h-64" />
      ) : data && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
          <div className="eyebrow hidden grid-cols-[minmax(0,1fr)_8rem_7rem_9rem] gap-4 border-b border-line bg-sunken px-4 py-2 sm:grid">
            <span>Name</span>
            <span>Format</span>
            <span>Teams</span>
            <span className="text-right">Status</span>
          </div>
          <ul>
            {data.items.map((tournament) => (
              <TournamentRow key={tournament.id} tournament={tournament} />
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          title="No tournaments yet"
          description="Create one, or score a one-off match."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => setCreating(true)}>
                New tournament
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setQuickMatch(true)}>
                Quick match
              </Button>
            </div>
          }
        />
      )}

      <CreateTournamentSheet open={creating} onClose={() => setCreating(false)} />
      <QuickMatchSheet open={quickMatch} onClose={() => setQuickMatch(false)} />
    </div>
  );
}

function TournamentRow({ tournament }: { tournament: TournamentDto }) {
  const registered = tournament.registeredTeams ?? 0;
  const eligible = tournament.eligibleTeams ?? 0;
  const ready = registered === tournament.teamsCount && eligible === registered;
  const ratio = registered / Math.max(1, tournament.teamsCount);

  return (
    <li className="border-b border-line last:border-0">
      <Link
        to={`/tournaments/${tournament.id}`}
        className="ledger-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_9rem]"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <SportMark sport={tournament.sport} className="text-muted" />
          <span className="truncate text-[0.8125rem] font-medium">{tournament.name}</span>
        </span>
        <span className="hidden text-xs text-secondary sm:block">
          {FORMAT_LABELS[tournament.format]}
          <span className="block text-muted">
            {tournament.sport === 'FOOTBALL'
              ? `${tournament.periods} × ${tournament.periodMinutes} min`
              : `${tournament.oversPerInnings} overs`}
          </span>
        </span>
        <span className="hidden items-center gap-2 sm:flex">
          <span className="h-[3px] w-10 overflow-hidden bg-sunken">
            <span className="block h-full bg-primary" style={{ width: `${ratio * 100}%` }} />
          </span>
          <span className="tabular text-xs text-secondary">
            {registered}/{tournament.teamsCount}
          </span>
        </span>
        <span className={cn('text-right text-xs', ready ? 'text-success' : 'text-muted')}>
          {ready ? 'Ready' : registered < tournament.teamsCount ? 'Registering' : 'Squads short'}
        </span>
      </Link>
    </li>
  );
}

function CreateTournamentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTournament = useCreateTournament();

  const [name, setName] = useState('');
  const [sport, setSport] = useState<Sport>('CRICKET');
  const [format, setFormat] = useState<Exclude<TournamentFormat, 'KNOCKOUT'>>('LEAGUE');
  const [teamsCount, setTeamsCount] = useState(4);
  const [oversPerInnings, setOversPerInnings] = useState(DEFAULT_OVERS_PER_INNINGS);
  const [doubleRoundRobin, setDoubleRoundRobin] = useState(false);
  const [playersPerTeam, setPlayersPerTeam] = useState(PLAYERS_PER_TEAM);
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  const [periodMinutes, setPeriodMinutes] = useState(DEFAULT_PERIOD_MINUTES);

  const isFootball = sport === 'FOOTBALL';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    await createTournament.mutateAsync({
      name,
      sport,
      format,
      teamsCount,
      playersPerTeam: isFootball ? playersPerTeam : PLAYERS_PER_TEAM,
      oversPerInnings,
      doubleRoundRobin,
      periods,
      periodMinutes,
    });

    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title="New tournament"
      footer={
        <>
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-tournament" isLoading={createTournament.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-tournament" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-secondary">Sport</span>

          <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-sunken p-1">
            {SPORTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSport(option.value)}
                aria-pressed={sport === option.value}
                className={cn(
                  'flex h-8 items-center justify-center gap-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium',
                  'transition-all duration-[var(--dur-fast)] ease-[var(--ease)]',
                  sport === option.value
                    ? 'bg-raised text-primary shadow-[var(--shadow-sm)] ring-1 ring-line'
                    : 'text-muted hover:text-primary',
                )}
              >
                <SportMark sport={option.value} />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <Input
            label="Name"
            autoFocus
            required
            placeholder={isFootball ? 'Sunday Football League 2026' : 'Sunday League 2026'}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <Select
          label="Format"
          value={format}
          onChange={(event) =>
            setFormat(event.target.value as Exclude<TournamentFormat, 'KNOCKOUT'>)
          }
        >
          {TOURNAMENT_FORMATS.filter((format) => format !== 'KNOCKOUT').map((option) => (
            <option key={option} value={option}>
              {FORMAT_LABELS[option]}
            </option>
          ))}
        </Select>

        <Input
          label="Teams"
          type="number"
          min={2}
          max={32}
          required
          value={teamsCount}
          onChange={(event) => setTeamsCount(Number(event.target.value))}
        />

        {isFootball ? (
          <Select
            label="Players a side"
            hint={
              formationsFor(playersPerTeam).length > 0
                ? `Formations: ${formationsFor(playersPerTeam).slice(0, 3).join(', ')}`
                : undefined
            }
            value={playersPerTeam}
            onChange={(event) => setPlayersPerTeam(Number(event.target.value))}
          >
            {Array.from(
              { length: MAX_PLAYERS_PER_TEAM - MIN_PLAYERS_PER_TEAM + 1 },
              (_, index) => MIN_PLAYERS_PER_TEAM + index,
            ).map((size) => (
              <option key={size} value={size}>
                {size} a side
              </option>
            ))}
          </Select>
        ) : (
          <Input
            label="Overs"
            type="number"
            min={1}
            max={50}
            required
            value={oversPerInnings}
            onChange={(event) => setOversPerInnings(Number(event.target.value))}
          />
        )}

        <div className="flex items-end pb-1">
          <Checkbox
            label="Double round-robin"
            checked={doubleRoundRobin}
            onChange={(event) => setDoubleRoundRobin(event.target.checked)}
          />
        </div>

        {isFootball ? (
          <div className="sm:col-span-2">
            <div className="mb-4 border-t border-line" />
            <PeriodDesigner
              periods={periods}
              periodMinutes={periodMinutes}
              onChange={(next) => {
                setPeriods(next.periods);
                setPeriodMinutes(next.periodMinutes);
              }}
            />
          </div>
        ) : null}

        {createTournament.error ? (
          <div className="sm:col-span-2">
            <ErrorText error={createTournament.error} />
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}
