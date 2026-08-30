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
import { useCreateTournament } from './queries';

/** A one-off match is a two-side league — the same machinery, none of the draw. */
export function QuickMatchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTournament = useCreateTournament();
  const navigate = useNavigate();

  const [sport, setSport] = useState<Sport>('CRICKET');
  const [oversPerInnings, setOversPerInnings] = useState(DEFAULT_OVERS_PER_INNINGS);
  const [playersPerTeam, setPlayersPerTeam] = useState(PLAYERS_PER_TEAM);
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  const [periodMinutes, setPeriodMinutes] = useState(DEFAULT_PERIOD_MINUTES);

  const [home, setHome] = useState({ name: '', shortName: '', primaryColor: '#1268bd' });
  const [away, setAway] = useState({ name: '', shortName: '', primaryColor: '#b23c17' });

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
      title="Start a match"
      description="Two sides, one fixture. Name them here, fill the squads, and it is ready to score."
      footer={
        <>
          <Button type="submit" form="quick-match" isLoading={createTournament.isPending}>
            Create the match
          </Button>
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="quick-match" onSubmit={handleSubmit} className="grid gap-7 sm:grid-cols-2">
        <Select
          label="Sport"
          value={sport}
          onChange={(event) => setSport(event.target.value as Sport)}
        >
          <option value="CRICKET">Cricket</option>
          <option value="FOOTBALL">Football</option>
        </Select>

        {isFootball ? (
          <Select
            label="Players a side"
            hint={
              formationsFor(playersPerTeam).length > 0
                ? `Formations: ${formationsFor(playersPerTeam).slice(0, 3).join(', ')}`
                : 'Both squads must hold exactly this many.'
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
            hint={`A cricket side is ${PLAYERS_PER_TEAM} players.`}
            value={oversPerInnings}
            onChange={(event) => setOversPerInnings(Number(event.target.value))}
          />
        )}

        <SideFields label="Home side" placeholder="Riverside XI" side={home} onChange={setHome} />
        <SideFields label="Away side" placeholder="Northgate CC" side={away} onChange={setAway} />

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
    <div className="flex flex-col gap-5 rounded-[var(--radius-md)] border border-line p-5">
      <div className="flex items-center justify-between gap-4">
        <span className="eyebrow text-secondary">{label}</span>
        <TeamMark shortName={side.shortName || '···'} color={side.primaryColor} />
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

      <div className="grid grid-cols-[1fr_auto] items-end gap-4">
        <Input
          label="Abbreviation"
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
          className="h-12 w-14 cursor-pointer rounded-[var(--radius-sm)] border border-line bg-raised p-1"
        />
      </div>
    </div>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);

  // One word has only one initial, and the abbreviation needs two characters.
  const guess = words.length > 1 ? words.map((word) => word[0] ?? '').join('') : (words[0] ?? '');

  return guess
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}
