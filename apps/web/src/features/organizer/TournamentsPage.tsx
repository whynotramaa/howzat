import { useState, type CSSProperties, type FormEvent } from 'react';
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
  const [quickMatch, setQuickMatch] = useState(false);
  const creating = params.get('new') === '1';
  const setCreating = (open: boolean) => setParams(open ? { new: '1' } : {}, { replace: true });

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
    <div className="tournaments-page flex flex-col gap-8">
      <PageHeader
        title="Tournaments"
        actions={
          <>
            <Button onClick={() => setCreating(true)}>New tournament</Button>
            <Button variant="secondary" onClick={() => setQuickMatch(true)}>
              Quick match
            </Button>
          </>
        }
      />

      {error ? <ErrorText error={error} onRetry={() => void refetch()} /> : null}

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-52" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="flex flex-col gap-9">
          {sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <section key={section.title} aria-label={section.title}>
                <div className="mb-4 flex items-center gap-2.5">
                  <h2 className="text-base font-bold">{section.title}</h2>
                  <span className="tournament-section-count tabular">{section.items.length}</span>
                </div>
                <ul className="grid gap-4 md:grid-cols-2">
                  {section.items.map((tournament, index) => (
                    <TournamentCard key={tournament.id} tournament={tournament} index={index} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      ) : error ? null : (
        <EmptyState
          scene="trophy"
          title="No tournaments yet"
          description="Create a league for the season, or score a one-off match with friends."
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

function TournamentCard({ tournament, index }: { tournament: TournamentDto; index: number }) {
  const registered = tournament.registeredTeams ?? 0;
  const eligible = tournament.eligibleTeams ?? 0;
  const ready = registered === tournament.teamsCount && eligible === registered;
  const state =
    tournament.status === 'COMPLETED'
      ? 'Completed'
      : tournament.status === 'IN_PROGRESS'
        ? 'In progress'
        : ready
          ? 'Ready'
          : registered < tournament.teamsCount
            ? 'Registering'
            : 'Squads short';
  const inProgress = tournament.status === 'IN_PROGRESS';
  const completed = tournament.status === 'COMPLETED';
  const tone = completed
    ? 'neutral'
    : inProgress || ready
      ? 'success'
      : registered < tournament.teamsCount
        ? 'neutral'
        : 'warning';

  return (
    <li className="reveal" style={{ '--delay': `${index * 60}ms` } as CSSProperties}>
      <Link
        to={`/tournaments/${tournament.id}`}
        aria-labelledby={`tournament-${tournament.id}`}
        className="tournament-card group flex h-full min-w-0 flex-col"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-xs text-secondary">
            <span className="tournament-sport-icon grid size-8 shrink-0 place-items-center rounded-md bg-sunken">
              <SportGlyph sport={tournament.sport} className="size-6" />
            </span>
            {tournament.sport === 'FOOTBALL' ? 'Football' : 'Cricket'}
          </span>
          <Pill
            tone={tone}
            className={cn(
              'tournament-status',
              tone === 'success'
                ? 'bg-success-soft'
                : tone === 'warning'
                  ? 'bg-warning-soft'
                  : 'bg-sunken',
            )}
          >
            {state}
          </Pill>
        </div>
        <div className="my-5 min-w-0">
          <h3 id={`tournament-${tournament.id}`} className="tournament-name break-words">
            {tournament.name}
          </h3>
          <p className="mt-1.5 text-xs text-muted">
            {FORMAT_LABELS[tournament.format]}
            {tournament.doubleRoundRobin ? ' · Home and away' : ''}
          </p>
        </div>
        <div className="tournament-card-footer mt-auto flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem] text-secondary">
            <span className="tabular">
              <strong className="font-medium text-primary">
                {registered}/{tournament.teamsCount}
              </strong>{' '}
              teams
            </span>
            <span>
              {tournament.sport === 'FOOTBALL'
                ? `${tournament.playersPerTeam} a side · ${tournament.periods} × ${tournament.periodMinutes} min`
                : `${tournament.oversPerInnings} overs`}
            </span>
          </div>
          <span
            aria-hidden
            className="tournament-card-arrow grid size-8 shrink-0 place-items-center rounded-full text-lg text-muted"
          >
            →
          </span>
        </div>
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

          <div className="grid grid-cols-2 gap-2">
            {SPORTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSport(option.value)}
                aria-pressed={sport === option.value}
                className={cn(
                  'flex h-16 items-center justify-center gap-2 rounded-[var(--radius-xl)] border text-[0.9375rem] font-semibold',
                  'transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]',
                  sport === option.value
                    ? 'border-primary bg-raised text-primary'
                    : 'border-line text-muted hover:border-line-strong hover:text-primary',
                )}
              >
                <SportGlyph sport={option.value} className="size-7" />
                <span className="text-base font-medium">{option.label}</span>
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
