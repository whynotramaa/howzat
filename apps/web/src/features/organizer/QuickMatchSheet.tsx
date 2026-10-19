import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DEFAULT_OVERS_PER_INNINGS,
  DEFAULT_PERIODS,
  DEFAULT_PERIOD_MINUTES,
  MAX_PLAYERS_PER_TEAM,
  MIN_PLAYERS_PER_TEAM,
  PLAYERS_PER_TEAM,
  formationsFor,
  type Sport,
} from '@howzat/shared';
import { PeriodDesigner } from '@/features/football/PeriodDesigner';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ErrorText } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { SportGlyph } from '@/components/ui/Sketch';
import { cn } from '@/lib/cn';
import { useCreateTournament } from './queries';

export function QuickMatchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTournament = useCreateTournament();
  const navigate = useNavigate();

  const [sport, setSport] = useState<Sport>('CRICKET');
  const [oversPerInnings, setOversPerInnings] = useState(DEFAULT_OVERS_PER_INNINGS);
  const [playersPerTeam, setPlayersPerTeam] = useState(PLAYERS_PER_TEAM);
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  const [periodMinutes, setPeriodMinutes] = useState(DEFAULT_PERIOD_MINUTES);

  const [home, setHome] = useState({ name: '', shortName: '', primaryColor: '#2563eb' });
  const [away, setAway] = useState({ name: '', shortName: '', primaryColor: '#171717' });

  const isFootball = sport === 'FOOTBALL';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const tournament = await createTournament.mutateAsync({
      name: `${home.name.trim()} v ${away.name.trim()}`,
      sport,
      format: 'LEAGUE',
      teamsCount: 2,
      playersPerTeam: isFootball ? playersPerTeam : PLAYERS_PER_TEAM,
      oversPerInnings,
      doubleRoundRobin: false,
      periods,
      periodMinutes,
      teams: [home, away],
    });

    onClose();
    void navigate(`/tournaments/${tournament.id}`);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title="Quick match"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="quick-match" isLoading={createTournament.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="quick-match" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          {(['CRICKET', 'FOOTBALL'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSport(option)}
              aria-pressed={sport === option}
              className={cn(
                'flex h-20 items-center justify-center gap-3 rounded-[var(--radius-xl)] border',
                'transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]',
                sport === option
                  ? 'border-primary bg-raised text-primary'
                  : 'border-line text-muted hover:border-line-strong hover:text-primary',
              )}
            >
              <SportGlyph sport={option} className="size-10" />
              <span className="serif text-[1.5rem]">{option === 'CRICKET' ? 'Cricket' : 'Football'}</span>
            </button>
          ))}
        </div>

        {isFootball ? (
          <Select
            label="Players a side"
            hint={
              formationsFor(playersPerTeam).length > 0
                ? formationsFor(playersPerTeam).slice(0, 3).join(', ')
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

        <SideFields label="Home" placeholder="Riverside XI" side={home} onChange={setHome} />
        <SideFields label="Away" placeholder="Northgate CC" side={away} onChange={setAway} />

        {isFootball ? (
          <div className="border-t border-line pt-4 sm:col-span-2">
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

interface Side {
  name: string;
  shortName: string;
  primaryColor: string;
}

function SideFields({
  label,
  placeholder,
  side,
  onChange,
}: {
  label: string;
  placeholder: string;
  side: Side;
  onChange: (side: Side) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-line bg-raised p-4">
      <div className="flex items-center gap-3.5">
        <TeamMark shortName={side.shortName || '?'} color={side.primaryColor} size="lg" />
        <div className="min-w-0">
          <p className="eyebrow">{label}</p>
          <p className="serif mt-1 truncate text-[1.375rem]">{side.name.trim() || placeholder}</p>
        </div>
      </div>

      <Input
        label="Name"
        required
        placeholder={placeholder}
        value={side.name}
        onChange={(event) => onChange({ ...side, name: event.target.value })}
        onBlur={() => {
          if (!side.shortName && side.name.trim()) {
            onChange({ ...side, shortName: initials(side.name) });
          }
        }}
      />

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Input
          label="Short"
          required
          maxLength={5}
          placeholder="RIV"
          value={side.shortName}
          onChange={(event) => onChange({ ...side, shortName: event.target.value.toUpperCase() })}
        />

        <input
          type="color"
          aria-label={`${label} colour`}
          value={side.primaryColor}
          onChange={(event) => onChange({ ...side, primaryColor: event.target.value })}
          className="h-9 w-11 cursor-pointer rounded-full border border-line bg-raised p-1"
        />
      </div>
    </div>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);

  const guess = words.length > 1 ? words.map((word) => word[0] ?? '').join('') : (words[0] ?? '');

  return guess
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}
