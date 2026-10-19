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
import { Scene, SportGlyph } from '@/components/ui/Sketch';
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

  const items = data?.items ?? [];
  const live = items.filter((tournament) => tournament.status !== 'COMPLETED').length;

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow="Organiser"
        title={
          <>
            Your <em>tournaments</em>
          </>
        }
        description={
          items.length > 0
            ? `${items.length} on the books, ${live} still in play. Open one to fill squads, draw fixtures and hand out the scorer's pen.`
            : 'Set up a league, invite the squads, and the fixtures write themselves. Need just one game? Start a quick match.'
        }
        actions={
          <>
            <Button onClick={() => setCreating(true)}>New tournament</Button>
            <Button variant="secondary" onClick={() => setQuickMatch(true)}>
              Quick match
            </Button>
          </>
        }
        art={<Scene name="trophy" />}
      />

      {error ? <ErrorText error={error} /> : null}

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((tournament, index) => (
            <TournamentCard key={tournament.id} tournament={tournament} index={index} />
          ))}
          <li>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="grid h-full min-h-56 w-full place-content-center justify-items-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-line-strong text-center text-secondary transition-colors hover:border-primary hover:text-primary"
            >
              <span className="grid size-11 place-items-center rounded-full border border-current text-xl leading-none">
                +
              </span>
              <span className="serif text-[1.5rem]">Another one</span>
              <span className="text-xs text-muted">League, knockout or both</span>
            </button>
          </li>
        </ul>
      ) : (
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
  const state = ready ? 'Ready' : registered < tournament.teamsCount ? 'Registering' : 'Squads short';
  const slots = Math.min(tournament.teamsCount, 16);

  return (
    <li className="reveal" style={{ '--delay': `${index * 60}ms` } as CSSProperties}>
      <Link
        to={`/tournaments/${tournament.id}`}
        className="card-lift flex h-full min-h-56 flex-col rounded-[var(--radius-xl)] border border-line bg-raised p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-14 place-items-center rounded-[var(--radius-lg)] bg-sunken">
            <SportGlyph sport={tournament.sport} className="size-10" />
          </span>
          <Pill tone={ready ? 'success' : registered < tournament.teamsCount ? 'neutral' : 'warning'}>
            {state}
          </Pill>
        </div>
        <h2 className="serif mt-5 line-clamp-2 text-[1.75rem] text-primary">{tournament.name}</h2>
        <p className="mt-2 text-xs text-muted">
          {FORMAT_LABELS[tournament.format]}
          {tournament.doubleRoundRobin ? ', home and away' : ''} ·{' '}
          {tournament.sport === 'FOOTBALL'
            ? `${tournament.playersPerTeam} a side, ${tournament.periods} × ${tournament.periodMinutes} min`
            : `${tournament.oversPerInnings} overs a side`}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-dashed border-line pt-4">
          <span className="flex flex-wrap gap-1">
            {Array.from({ length: slots }, (_, slot) => (
              <span
                key={slot}
                className={cn(
                  'size-2.5 rounded-full border',
                  slot < Math.round((registered / tournament.teamsCount) * slots)
                    ? 'border-[var(--ink-blue)] bg-[var(--ink-blue)]'
                    : 'border-line-strong',
                )}
              />
            ))}
          </span>
          <span className="tabular shrink-0 text-xs text-secondary">
            {registered} of {tournament.teamsCount} teams
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
                  'flex h-20 items-center justify-center gap-3 rounded-[var(--radius-xl)] border text-[0.9375rem] font-semibold',
                  'transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]',
                  sport === option.value
                    ? 'border-primary bg-raised text-primary'
                    : 'border-line text-muted hover:border-line-strong hover:text-primary',
                )}
              >
                <SportGlyph sport={option.value} className="size-10" />
                <span className="serif text-[1.5rem] font-normal">{option.label}</span>
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
