import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
import { SportEyebrow, SportMark } from '@/components/ui/SportMark';
import { Button } from '@/components/ui/Button';
import { EmptyState, SectionHeading } from '@/components/ui/Card';
import { Checkbox, Input, Select } from '@/components/ui/Input';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { Reveal } from '@/components/ui/Reveal';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { QuickMatchSheet } from './QuickMatchSheet';
import { useCreateTournament, useTournaments } from './queries';

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  LEAGUE: 'League',
  KNOCKOUT: 'Knockout',
  LEAGUE_PLAYOFFS: 'League + playoffs',
};

const SPORTS: Array<{ value: Sport; label: string; blurb: string }> = [
  {
    value: 'CRICKET',
    label: 'Cricket',
    blurb: 'Ball by ball, with a full scorecard and net run rate.',
  },
  {
    value: 'FOOTBALL',
    label: 'Football',
    blurb: 'Goals, cards and a live clock, on a pitch with both formations.',
  },
];

export function TournamentsPage() {
  const { data, isPending, error } = useTournaments();
  const [creating, setCreating] = useState(false);
  const [quickMatch, setQuickMatch] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <SectionHeading
        eyebrow="Your competitions"
        title="Tournaments"
        description="Pick a sport, register your sides, fill each squad, then generate the fixtures. For a one-off, start a match between two sides instead."
        action={
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" onClick={() => setQuickMatch(true)}>
              Start a match
            </Button>
            <Button onClick={() => setCreating(true)}>New tournament</Button>
          </div>
        }
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
          description="Open your first one, register the sides, and the fixture list will write itself. Just two teams? Start a match instead."
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button onClick={() => setCreating(true)}>New tournament</Button>
              <Button variant="secondary" onClick={() => setQuickMatch(true)}>
                Start a match
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
        <SportEyebrow sport={tournament.sport} detail={FORMAT_LABELS[tournament.format]} />

        <h3 className="serif mt-3 text-[1.625rem] text-primary">{tournament.name}</h3>

        <p className="mono mt-2.5 text-[0.8125rem] text-muted">
          {tournament.sport === 'FOOTBALL'
            ? `${tournament.periods} × ${tournament.periodMinutes} min`
            : `${tournament.oversPerInnings} overs`}
          <span className="mx-2 text-line-strong">·</span>
          {tournament.teamsCount} teams
          <span className="mx-2 text-line-strong">·</span>
          {tournament.playersPerTeam} a side
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
            `${shortBy} side${shortBy === 1 ? '' : 's'} short of a full squad`
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
  const [sport, setSport] = useState<Sport>('CRICKET');
  const [format, setFormat] = useState<TournamentFormat>('LEAGUE');
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
      description="Pick the sport first — it decides everything below it. These settings shape the fixture list."
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
      <form id="create-tournament" onSubmit={handleSubmit} className="grid gap-7 sm:grid-cols-2">
        <div className="flex flex-col gap-2.5 sm:col-span-2">
          <span className="eyebrow text-secondary">Sport</span>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {SPORTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSport(option.value)}
                aria-pressed={sport === option.value}
                className={cn(
                  'flex items-start gap-3.5 rounded-[var(--radius-md)] border px-4 py-3.5 text-left',
                  'transition-all duration-[var(--dur-fast)] ease-[var(--ease)]',
                  sport === option.value
                    ? 'border-[var(--accent-strong)] bg-accent-soft'
                    : 'border-line bg-raised hover:border-line-strong hover:bg-hover',
                )}
              >
                <SportMark
                  sport={option.value}
                  className={cn(
                    'mt-0.5 size-5',
                    sport === option.value ? 'text-accent' : 'text-muted',
                  )}
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      sport === option.value ? 'text-accent' : 'text-primary',
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[0.75rem] leading-snug text-muted">
                    {option.blurb}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <Input
            label="Tournament name"
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

        {isFootball ? (
          <Select
            label="Players a side"
            hint={
              formationsFor(playersPerTeam).length > 0
                ? `Formations: ${formationsFor(playersPerTeam).slice(0, 3).join(', ')}`
                : 'Every squad must hold exactly this many.'
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
            label="Overs per innings"
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
            hint="Every pair meets twice, home and away."
            checked={doubleRoundRobin}
            onChange={(event) => setDoubleRoundRobin(event.target.checked)}
          />
        </div>

        {isFootball ? (
          <div className="sm:col-span-2">
            <div className="rule mb-6" />
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
