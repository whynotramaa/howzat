import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  defaultFormation,
  formationSpots,
  formationsFor,
  type MatchWithInningsDto,
  type TeamLineup,
} from '@howzat/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, SectionHeading } from '@/components/ui/Card';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { Pill, StatusPill, TeamMark } from '@/components/ui/Pill';
import { ShareLink } from '@/components/ui/ShareLink';
import { PdfButton } from '@/components/ui/PdfButton';
import { cn } from '@/lib/cn';
import { MatchScorersCard } from '@/features/matches/MatchScorersCard';
import { Bench, Pitch } from './Pitch';
import { PeriodDesigner } from './PeriodDesigner';
import { SubstitutionRule } from './SubstitutionRule';
import {
  useFootballSquads,
  useKickOff,
  useSetFootballLineups,
  type FootballSquadSide,
} from './queries';

type Side = 'HOME' | 'AWAY';

interface Selection {
  bySlot: Record<number, string>;
  substitutes: string[];
  formation: string;
  captainId: string | null;
}

export function FootballMatchPage({ match }: { match: MatchWithInningsDto }) {
  const navigate = useNavigate();
  const { data, isPending, error } = useFootballSquads(match.id);

  const saveLineups = useSetFootballLineups(match.id);
  const kickOff = useKickOff(match.id);

  const [home, setHome] = useState<Selection | null>(null);
  const [away, setAway] = useState<Selection | null>(null);
  const [activeSide, setActiveSide] = useState<Side>('HOME');
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const [clock, setClock] = useState<{ periods: number; periodMinutes: number } | null>(null);
  const [subLimit, setSubLimit] = useState<{ value: number | null } | null>(null);

  const squadSize = data?.playersPerTeam ?? 11;
  const maxSubs = Math.max(
    0,
    ((activeSide === 'HOME' ? data?.home : data?.away)?.players.length ?? 0) - squadSize,
  );
  const clockSetting =
    clock ?? (data ? { periods: data.periods, periodMinutes: data.periodMinutes } : null);

  // Null is a choice of its own — unlimited — so an untouched picker is its own state.
  const substitutionLimit = subLimit ? subLimit.value : (data?.substitutionLimit ?? null);

  const homeSelection = home ?? (data ? seed(data.home, squadSize) : null);
  const awaySelection = away ?? (data ? seed(data.away, squadSize) : null);

  const homeComplete = homeSelection ? countNamed(homeSelection) === squadSize : false;
  const awayComplete = awaySelection ? countNamed(awaySelection) === squadSize : false;
  const bothComplete = homeComplete && awayComplete;

  const started = match.status !== 'SCHEDULED' && match.status !== 'TOSS';
  const finished = match.status === 'COMPLETED' || match.status === 'ABANDONED';

  const lineups = useMemo(() => {
    if (!data || !homeSelection || !awaySelection) return { home: null, away: null };

    return {
      home: previewLineup(data.home, homeSelection, squadSize),
      away: previewLineup(data.away, awaySelection, squadSize),
    };
  }, [data, homeSelection, awaySelection, squadSize]);

  const setActiveSelection = activeSide === 'HOME' ? setHome : setAway;
  const activeSelection = activeSide === 'HOME' ? homeSelection : awaySelection;
  const activeSquad = activeSide === 'HOME' ? data?.home : data?.away;

  async function handleSaveAndKickOff() {
    if (!data || !homeSelection || !awaySelection) return;

    await saveLineups.mutateAsync({
      teams: [toPayload(data.home.id, homeSelection), toPayload(data.away.id, awaySelection)],
    });

    await kickOff.mutateAsync({ ...(clockSetting ?? {}), substitutionLimit });
    navigate(`/matches/${match.id}/score`);
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-9">
      <SectionHeading
        eyebrow={`Round ${match.round} · ${data.periods} × ${data.periodMinutes} minutes · ${
          substitutionLimit === null ? 'rolling subs' : `${substitutionLimit} subs a side`
        }`}
        title={`${data.home.name} v ${data.away.name}`}
        description="Pick a shape for each side, fill it from the squad, and kick off. The clock starts the moment you do."
        action={
          <>
            <StatusPill status={match.status} />
            <ShareLink
              slug={match.publicSlug}
              matchLabel={`${data.home.shortName} v ${data.away.shortName}`}
            />
            {finished ? (
              <PdfButton
                build={() =>
                  import('@/lib/pdf').then((pdf) => pdf.buildFootballMatchPdf(match.publicSlug))
                }
              />
            ) : null}
          </>
        }
      />

      {started ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-secondary">
              This match is already under way — the team sheets are locked.
            </p>
            <Link to={`/matches/${match.id}/score`}>
              <Button>Open the console</Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-4">
          <Pitch
            home={lineups.home}
            away={lineups.away}
            selectedPlayerId={
              activeSlot !== null ? (activeSelection?.bySlot[activeSlot] ?? null) : null
            }
          />

          <div className="flex flex-col gap-2">
            <Bench lineup={lineups.home} />
            <Bench lineup={lineups.away} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['HOME', 'AWAY'] as const).map((side) => {
              const squad = side === 'HOME' ? data.home : data.away;
              const complete = side === 'HOME' ? homeComplete : awayComplete;

              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => {
                    setActiveSide(side);
                    setActiveSlot(null);
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[var(--radius-sm)] border px-3.5 py-2.5',
                    'transition-all duration-[var(--dur-fast)]',
                    activeSide === side
                      ? 'border-[var(--accent-strong)] bg-accent-soft'
                      : 'border-line bg-raised hover:bg-hover',
                  )}
                >
                  <TeamMark shortName={squad.shortName} color={squad.primaryColor} size="sm" />
                  <span className="text-sm font-medium text-primary">{squad.name}</span>
                  <Pill tone={complete ? 'success' : 'neutral'}>
                    {side === 'HOME' ? countNamed(homeSelection) : countNamed(awaySelection)}/
                    {squadSize}
                  </Pill>
                </button>
              );
            })}
          </div>
        </div>

        {activeSquad && activeSelection ? (
          <TeamSheetEditor
            squad={activeSquad}
            selection={activeSelection}
            squadSize={squadSize}
            maxSubs={maxSubs}
            activeSlot={activeSlot}
            disabled={started}
            onSlotFocus={setActiveSlot}
            onChange={setActiveSelection}
          />
        ) : null}
      </div>

      <MatchScorersCard
        tournamentId={match.tournamentId}
        matchId={match.id}
        scorers={match.scorers}
      />

      {saveLineups.error ? <ErrorText error={saveLineups.error} /> : null}
      {kickOff.error ? <ErrorText error={kickOff.error} /> : null}

      {!started && clockSetting ? (
        <Card>
          <CardHeader>
            <p className="eyebrow mb-1.5">This match</p>
            <p className="serif text-xl text-primary">How long are we playing?</p>
            <p className="mt-1.5 max-w-2xl text-[0.8125rem] text-secondary">
              Set for this fixture alone. The tournament&rsquo;s setting is only ever the starting
              point — a league that plays two forty-fives still plays two thirties when the pitch is
              booked until four.
            </p>
          </CardHeader>

          <CardBody className="flex flex-col gap-8">
            <PeriodDesigner
              periods={clockSetting.periods}
              periodMinutes={clockSetting.periodMinutes}
              onChange={setClock}
            />

            <SubstitutionRule
              value={substitutionLimit}
              onChange={(value) => setSubLimit({ value })}
            />

            <div className="flex flex-wrap items-center justify-between gap-5 border-t border-line pt-7">
              <p className="text-[0.8125rem] text-secondary">
                {bothComplete
                  ? 'The clock starts the moment you kick off, and can be paused at any time.'
                  : 'Both starting sides must be named before the whistle.'}
              </p>

              <Button
                size="lg"
                disabled={!bothComplete}
                isLoading={saveLineups.isPending || kickOff.isPending}
                onClick={() => void handleSaveAndKickOff()}
              >
                Kick off
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function TeamSheetEditor({
  squad,
  selection,
  squadSize,
  maxSubs,
  activeSlot,
  disabled,
  onSlotFocus,
  onChange,
}: {
  squad: FootballSquadSide;
  selection: Selection;
  squadSize: number;
  maxSubs: number;
  activeSlot: number | null;
  disabled: boolean;
  onSlotFocus: (slot: number | null) => void;
  onChange: (next: Selection) => void;
}) {
  const spots = formationSpots(selection.formation, squadSize);
  const options = formationsFor(squadSize);

  const nextEmptySlot = spots.find((spot) => !selection.bySlot[spot.slot])?.slot ?? null;
  const slot = activeSlot ?? nextEmptySlot;

  function assign(playerId: string) {
    if (slot === null) return;

    const bySlot = { ...selection.bySlot };

    for (const [key, value] of Object.entries(bySlot)) {
      if (value === playerId) delete bySlot[Number(key)];
    }

    bySlot[slot] = playerId;
    onChange({
      ...selection,
      bySlot,
      substitutes: selection.substitutes.filter((id) => id !== playerId),
    });
    onSlotFocus(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">Team sheet</p>
          <p className="serif text-xl text-primary">{squad.name}</p>
        </div>

        <select
          value={selection.formation}
          disabled={disabled}
          onChange={(event) => onChange({ ...selection, formation: event.target.value })}
          className={cn(
            'mono h-10 rounded-[var(--radius-sm)] border border-line bg-raised px-3 text-sm text-primary',
            'hover:border-line-strong focus:border-[var(--accent-strong)]',
            'disabled:opacity-40',
          )}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </CardHeader>

      <CardBody className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">Positions</p>

          <div className="flex flex-wrap gap-1.5">
            {spots.map((spot) => {
              const playerId = selection.bySlot[spot.slot];
              const player = squad.players.find((entry) => entry.id === playerId);

              return (
                <button
                  key={spot.slot}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSlotFocus(spot.slot === activeSlot ? null : spot.slot)}
                  className={cn(
                    'flex min-w-[5.5rem] flex-col items-start gap-0.5 rounded-[var(--radius-sm)] border px-2.5 py-2',
                    'text-left transition-all duration-[var(--dur-fast)] disabled:opacity-50',
                    spot.slot === slot
                      ? 'border-[var(--accent-strong)] bg-accent-soft'
                      : player
                        ? 'border-line bg-raised hover:bg-hover'
                        : 'border-dashed border-line-strong bg-raised/40 hover:bg-hover',
                  )}
                >
                  <span className="mono text-[0.5625rem] tracking-[0.08em] text-muted">
                    {spot.line}
                  </span>
                  <span
                    className={cn(
                      'truncate text-[0.8125rem]',
                      player ? 'text-primary' : 'text-muted',
                    )}
                  >
                    {player?.name ?? 'Empty'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rule" />

        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">
            {slot !== null
              ? `Tap a player for ${spots.find((spot) => spot.slot === slot)?.line ?? 'this'} position`
              : 'Squad'}
          </p>

          <div className="flex flex-col gap-1">
            {squad.players.map((player) => {
              const startingSlot = startingSlotOf(selection, player.id);
              const isStarting = startingSlot !== null;
              const isSub = selection.substitutes.includes(player.id);
              const isCaptain = selection.captainId === player.id;

              return (
                <div
                  key={player.id}
                  className={cn(
                    'flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2',
                    isStarting ? 'bg-sunken' : 'hover:bg-hover',
                  )}
                >
                  <button
                    type="button"
                    disabled={disabled || slot === null}
                    onClick={() => assign(player.id)}
                    className="min-w-0 flex-1 text-left disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        'block truncate text-sm',
                        isStarting ? 'text-secondary' : 'text-primary',
                      )}
                    >
                      {player.name}
                    </span>
                    <span className="eyebrow">
                      {isStarting
                        ? (spots.find((spot) => spot.slot === startingSlot)?.line ?? 'Starting')
                        : isSub
                          ? 'Substitute'
                          : 'Not named'}
                    </span>
                  </button>

                  {isStarting ? (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={isCaptain}
                      onClick={() =>
                        onChange({
                          ...selection,
                          captainId: isCaptain ? null : player.id,
                        })
                      }
                      className={cn(
                        'mono grid size-7 shrink-0 place-items-center rounded-full border text-[0.625rem]',
                        'transition-colors disabled:opacity-40',
                        isCaptain
                          ? 'border-[var(--accent-strong)] bg-accent-soft text-accent'
                          : 'border-line text-muted hover:border-line-strong',
                      )}
                      title="Captain"
                    >
                      C
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled || (!isSub && selection.substitutes.length >= maxSubs)}
                      aria-pressed={isSub}
                      onClick={() =>
                        onChange({
                          ...selection,
                          substitutes: isSub
                            ? selection.substitutes.filter((id) => id !== player.id)
                            : [...selection.substitutes, player.id],
                        })
                      }
                      className={cn(
                        'shrink-0 rounded-full border px-2.5 py-1 text-[0.625rem] tracking-[0.06em] uppercase',
                        'transition-colors disabled:pointer-events-none disabled:opacity-35',
                        isSub
                          ? 'border-[var(--accent-strong)] bg-accent-soft text-accent'
                          : 'border-line text-muted hover:border-line-strong',
                      )}
                      title={isSub ? 'On the bench' : 'Add to the bench'}
                    >
                      Sub
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function seed(squad: FootballSquadSide, squadSize: number): Selection {
  const bySlot: Record<number, string> = {};
  const substitutes: string[] = [];
  let captainId: string | null = null;

  for (const player of squad.players) {
    if (!player.selected) continue;
    if (player.slot !== null) bySlot[player.slot] = player.id;
    else substitutes.push(player.id);
    if (player.isCaptain) captainId = player.id;
  }

  return {
    bySlot,
    substitutes,
    formation: squad.formation ?? defaultFormation(squadSize),
    captainId,
  };
}

function countNamed(selection: Selection | null): number {
  return selection ? Object.keys(selection.bySlot).length : 0;
}

function startingSlotOf(selection: Selection, playerId: string): number | null {
  const found = Object.entries(selection.bySlot).find(([, id]) => id === playerId);
  return found ? Number(found[0]) : null;
}

function previewLineup(
  squad: FootballSquadSide,
  selection: Selection,
  squadSize: number,
): TeamLineup {
  const spots = formationSpots(selection.formation, squadSize);

  return {
    team: {
      id: squad.id,
      name: squad.name,
      shortName: squad.shortName,
      primaryColor: squad.primaryColor,
    },
    formation: selection.formation,
    substitutes: selection.substitutes.flatMap((playerId) => {
      const player = squad.players.find((entry) => entry.id === playerId);
      if (!player) return [];

      return [
        {
          id: player.id,
          name: player.name,
          slot: null,
          shirtNumber: player.shirtNumber,
          isCaptain: false,
          x: 0,
          y: 0,
          goals: 0,
          saves: 0,
          yellowCards: 0,
          redCards: 0,
          isSentOff: false,
          isOnPitch: false,
          cameOnAt: null,
          wentOffAt: null,
        },
      ];
    }),
    players: spots.flatMap((spot) => {
      const playerId = selection.bySlot[spot.slot];
      const player = squad.players.find((entry) => entry.id === playerId);
      if (!player) return [];

      return [
        {
          id: player.id,
          name: player.name,
          slot: spot.slot,
          shirtNumber: player.shirtNumber,
          isCaptain: selection.captainId === player.id,
          x: spot.x,
          y: spot.y,
          goals: 0,
          saves: 0,
          yellowCards: 0,
          redCards: 0,
          isSentOff: false,
          isOnPitch: false,
          cameOnAt: null,
          wentOffAt: null,
        },
      ];
    }),
  };
}

function toPayload(teamId: string, selection: Selection) {
  return {
    teamId,
    formation: selection.formation,
    players: Object.entries(selection.bySlot).map(([slot, playerId]) => ({
      playerId,
      slot: Number(slot),
      shirtNumber: null,
      isCaptain: selection.captainId === playerId,
    })),
    substitutes: selection.substitutes,
  };
}
