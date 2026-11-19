import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { SportGlyph } from '@/components/ui/Sketch';
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
  const { data, isPending, error, refetch } = useTournaments();
  const [params, setParams] = useSearchParams();
  const creating = params.get('new') === '1';
  const quickMatch = params.get('quick') === '1';
  const setCreating = (open: boolean) => setParams(open ? { new: '1' } : {}, { replace: true });
  const setQuickMatch = (open: boolean) =>
    setParams(open ? { quick: '1' } : {}, { replace: true });

  const items = data?.items ?? [];
  const sections = [
    { title: 'In progress', items: items.filter((item) => item.status === 'IN_PROGRESS') },
    {
      title: 'Setting up',
      items: items.filter((item) => item.status !== 'IN_PROGRESS' && item.status !== 'COMPLETED'),
    },
    { title: 'Completed', items: items.filter((item) => item.status === 'COMPLETED') },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Tournaments"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setQuickMatch(true)}>
              Quick match
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              New tournament
            </Button>
          </>
        }
      />

      {error ? <ErrorText error={error} onRetry={() => void refetch()} /> : null}

      {isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : items.length > 0 ? (
        sections
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <section key={section.title} aria-label={section.title}>
              <h2 className="mb-2 text-[0.8125rem] font-medium text-muted">
                {section.title} <span className="mono ml-1">{section.items.length}</span>
              </h2>
              <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised">
                {section.items.map((tournament) => (
                  <TournamentRow key={tournament.id} tournament={tournament} />
                ))}
              </ul>
            </section>
          ))
      ) : error ? null : (
        <EmptyState
          title="No tournaments yet"
          action={
            <>
              <Button size="sm" onClick={() => setCreating(true)}>
                New tournament
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setQuickMatch(true)}>
                Quick match
              </Button>
            </>
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
  const state =
    tournament.status === 'COMPLETED'
      ? null
      : tournament.status === 'IN_PROGRESS'
        ? { label: 'Live', tone: 'success' as const }
        : ready
          ? { label: 'Ready', tone: 'success' as const }
          : registered < tournament.teamsCount
            ? { label: `${registered}/${tournament.teamsCount} teams`, tone: 'neutral' as const }
            : { label: 'Squads short', tone: 'warning' as const };

  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        to={`/tournaments/${tournament.id}`}
        className="row-link flex items-center gap-3 px-3 py-3 sm:px-4"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] border border-line bg-sunken">
          <SportGlyph sport={tournament.sport} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{tournament.name}</span>
          <span className="block truncate text-xs text-muted">
            {FORMAT_LABELS[tournament.format]} ·{' '}
            {tournament.sport === 'FOOTBALL'
              ? `${tournament.playersPerTeam} a side`
              : `${tournament.oversPerInnings} overs`}
          </span>
        </span>
        {state ? <Pill tone={state.tone}>{state.label}</Pill> : null}
      </Link>
    </li>
  );
}

function CreateTournamentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTournament = useCreateTournament();
  const navigate = useNavigate();

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

    const created = await createTournament.mutateAsync({
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

    void navigate(`/tournaments/${created.id}`);
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

          <div className="grid grid-cols-2 gap-2">
            {SPORTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSport(option.value)}
                aria-pressed={sport === option.value}
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border text-sm font-medium',
                  'transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]',
                  sport === option.value
                    ? 'border-[var(--text-primary)] bg-raised text-primary'
                    : 'border-line text-muted hover:border-line-strong hover:text-primary',
                )}
              >
                <SportGlyph sport={option.value} className="size-5" />
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
