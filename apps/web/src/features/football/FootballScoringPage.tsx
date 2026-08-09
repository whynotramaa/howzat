import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FOOTBALL_EVENT_LABELS,
  type ClockCommand,
  type FootballEventKind,
  type LineupPlayer,
  type MatchClockDto,
  type PlayerRef,
  type TeamLineup,
  type TeamRef,
} from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { PushButton } from '@/components/ui/PushButton';
import { SportMark } from '@/components/ui/SportMark';
import { FootballAvatar } from '@/components/ui/FootballAvatar';
import { ShareLink } from '@/components/ui/ShareLink';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { MatchTimer } from './MatchTimer';
import { IncidentTimeline } from './IncidentTimeline';
import { IncidentFlash, type FlashPayload } from './IncidentFlash';
import { useMatchClock } from './useMatchClock';
import {
  useClockCommand,
  useFootballSquads,
  useFootballState,
  useRecordFootballEvent,
  useUndoFootballEvent,
  type FootballSquadSide,
} from './queries';

type Pending = { kind: 'GOAL' } | { kind: 'CARD' } | { kind: 'SAVE' } | { kind: 'SUB' } | null;

export function FootballScoringPage() {
  const { matchId = '' } = useParams();
  const { data, isPending, error } = useFootballState(matchId);
  const { data: squads } = useFootballSquads(matchId);

  const clockCommand = useClockCommand(matchId);
  const recordEvent = useRecordFootballEvent(matchId);
  const undoEvent = useUndoFootballEvent(matchId);

  const watch = useMatchClock(data?.clock ?? null, clockCommand.mutateAsync);

  const [pending, setPending] = useState<Pending>(null);
  const [flash, setFlash] = useState<FlashPayload | null>(null);

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-[34rem]" />
      </div>
    );
  }

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  const { snapshot, state } = data;
  const finished = watch.clock?.status === 'FINISHED' || data.status === 'COMPLETED';
  const canRecord = Boolean(watch.clock) && !finished;
  const busy = recordEvent.isPending;

  async function submit(
    kind: FootballEventKind,
    teamId: string,
    playerId: string | null,
    assistPlayerId: string | null,
    playerOffId: string | null = null,
  ) {
    await recordEvent.mutateAsync({
      clientEventId: crypto.randomUUID(),
      kind,
      teamId,
      playerId,
      assistPlayerId,
      playerOffId,
    });

    const side = teamId === data!.home.team.id ? data!.home : data!.away;
    const named =
      [...data!.home.squad, ...data!.away.squad].find((entry) => entry.id === playerId)?.name ??
      squadRosterName(squads, playerId);

    setFlash({
      kind,
      teamShort: side.team.shortName,
      teamColor: side.team.primaryColor,
      playerName: named,
      minuteLabel: watch.readNow().minuteLabel,
    });

    setPending(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink to={`/matches/${matchId}`}>Back to the match</BackLink>

        {snapshot ? (
          <ShareLink
            slug={snapshot.publicSlug}
            matchLabel={`${data.home.team.shortName} v ${data.away.team.shortName}`}
            label="Share live"
          />
        ) : null}
      </div>

      <Scoreline
        home={data.home.team}
        away={data.away.team}
        homeGoals={state.home.goals}
        awayGoals={state.away.goals}
        resultText={snapshot?.resultText ?? null}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <ClockBar
            clock={watch.clock}
            commands={watch.commands}
            isRunning={watch.isRunning}
            isPending={watch.isPending}
            onCommand={watch.run}
            error={clockCommand.error}
          />

          <div className="border-t border-line bg-sunken px-5 py-6 sm:px-8 sm:py-7">
            {watch.clock ? (
              <>
                <GoalKey
                  disabled={!canRecord || busy}
                  onPress={() => setPending({ kind: 'GOAL' })}
                />

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <MinorKey
                    label="Save"
                    disabled={!canRecord || busy}
                    onPress={() => setPending({ kind: 'SAVE' })}
                    glyph={
                      <span
                        className="grid size-[1.375rem] place-items-center rounded-full border-2"
                        style={{ borderColor: 'var(--success)' }}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: 'var(--success)' }}
                        />
                      </span>
                    }
                  />

                  <MinorKey
                    label="Card"
                    disabled={!canRecord || busy}
                    onPress={() => setPending({ kind: 'CARD' })}
                    glyph={
                      <span className="flex h-[1.375rem] items-center gap-[3px]">
                        <span className="h-[1.375rem] w-[13px] -rotate-6 rounded-[2px] bg-[#e0b23c]" />
                        <span className="h-[1.375rem] w-[13px] rotate-6 rounded-[2px] bg-[#c8332a]" />
                      </span>
                    }
                  />

                  <MinorKey
                    label="Change"
                    disabled={!canRecord || busy}
                    onPress={() => setPending({ kind: 'SUB' })}
                    glyph={
                      <svg
                        viewBox="0 0 16 16"
                        className="size-[1.375rem]"
                        fill="none"
                        stroke="var(--accent-strong)"
                        aria-hidden
                      >
                        <path
                          d="M2 5h9M9 3l2 2-2 2M14 11H5m2-2-2 2 2 2"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    }
                  />
                </div>
              </>
            ) : (
              <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong px-5 py-5 text-center text-[0.8125rem] text-secondary">
                This match has not kicked off yet.{' '}
                <Link to={`/matches/${matchId}`} className="text-accent">
                  Name the team sheets first
                </Link>
                .
              </p>
            )}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {recordEvent.error ? <ErrorText error={recordEvent.error} /> : null}
          {undoEvent.error ? <ErrorText error={undoEvent.error} /> : null}

          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Match log</p>
                <p className="mt-1.5 text-[0.8125rem] text-muted">
                  {state.incidents.length === 0
                    ? 'Nothing recorded yet'
                    : `${state.incidents.length} incident${state.incidents.length === 1 ? '' : 's'}`}
                </p>
              </div>

              <Button
                size="sm"
                variant="quiet"
                disabled={state.incidents.length === 0 || undoEvent.isPending}
                isLoading={undoEvent.isPending}
                onClick={() => void undoEvent.mutateAsync(undefined)}
              >
                Undo last
              </Button>
            </CardHeader>

            <CardBody className="min-h-0 flex-1 overflow-y-auto">
              <IncidentTimeline
                incidents={[...state.incidents].reverse()}
                homeTeamId={data.home.team.id}
                homeShort={data.home.team.shortName}
                awayShort={data.away.team.shortName}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <GoalSheet
        open={pending?.kind === 'GOAL'}
        home={data.home}
        away={data.away}
        isPending={busy}
        onClose={() => setPending(null)}
        onSubmit={submit}
      />

      <CardSheet
        open={pending?.kind === 'CARD'}
        home={data.home}
        away={data.away}
        isPending={busy}
        onClose={() => setPending(null)}
        onSubmit={submit}
      />

      <SaveSheet
        open={pending?.kind === 'SAVE'}
        home={data.home}
        away={data.away}
        isPending={busy}
        onClose={() => setPending(null)}
        onSubmit={submit}
      />

      <SubstitutionSheet
        open={pending?.kind === 'SUB'}
        home={data.home}
        away={data.away}
        lineups={snapshot?.lineups ?? { home: null, away: null }}
        rosters={{ home: squads?.home ?? null, away: squads?.away ?? null }}
        limit={snapshot?.substitutionLimit ?? null}
        used={{
          home: state.home.substitutions.length,
          away: state.away.substitutions.length,
        }}
        isPending={busy}
        onClose={() => setPending(null)}
        onSubmit={submit}
      />

      <IncidentFlash payload={flash} />
    </div>
  );
}

function squadRosterName(
  squads: { home: FootballSquadSide; away: FootballSquadSide } | undefined,
  playerId: string | null,
): string | null {
  if (!squads || !playerId) return null;

  return (
    [...squads.home.players, ...squads.away.players].find((player) => player.id === playerId)
      ?.name ?? null
  );
}

function Scoreline({
  home,
  away,
  homeGoals,
  awayGoals,
  resultText,
}: {
  home: TeamRef;
  away: TeamRef;
  homeGoals: number;
  awayGoals: number;
  resultText: string | null;
}) {
  return (
    <Card className="overflow-hidden">
      <div
        aria-hidden
        className="h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${home.primaryColor} 0 50%, ${away.primaryColor} 50% 100%)`,
        }}
      />

      <CardBody className="flex items-center justify-between gap-4 py-5">
        <TeamScore team={home} align="left" />

        <div className="flex shrink-0 flex-col items-center gap-2">
          <span
            key={`${homeGoals}-${awayGoals}`}
            className="score-bump score-figure flex items-center gap-3 text-[2.25rem] text-primary sm:text-[2.75rem]"
          >
            {homeGoals}
            <span className="text-[0.5em] text-line-strong">—</span>
            {awayGoals}
          </span>

          {resultText ? (
            <span className="text-center text-[0.75rem] font-medium text-success">
              {resultText}
            </span>
          ) : null}
        </div>

        <TeamScore team={away} align="right" />
      </CardBody>
    </Card>
  );
}

function TeamScore({ team, align }: { team: TeamRef; align: 'left' | 'right' }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      <TeamMark shortName={team.shortName} color={team.primaryColor} />

      <div className={cn('min-w-0', align === 'right' && 'text-right')}>
        <p className="truncate text-sm font-medium text-primary sm:text-base">{team.name}</p>
        <p className="mono mt-0.5 text-[0.6875rem] text-muted">{team.shortName}</p>
      </div>
    </div>
  );
}

function GoalKey({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <PushButton
      tone="var(--accent-strong)"
      depth={10}
      radius="var(--radius-xl)"
      disabled={disabled}
      onClick={onPress}
      className="w-full"
      faceClassName="h-[7rem] gap-1.5 text-white"
      ariaLabel="Record a goal"
    >
      <SportMark sport="FOOTBALL" className="size-7 opacity-95" />
      <span className="text-[1.5rem] leading-none font-semibold tracking-[-0.01em]">Goal</span>
      <span className="text-[0.75rem] text-white/75">Name the scorer</span>
    </PushButton>
  );
}

function MinorKey({
  label,
  glyph,
  disabled,
  onPress,
}: {
  label: string;
  glyph: ReactNode;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className="console-key h-[4.75rem] w-full"
      disabled={disabled}
      onClick={onPress}
    >
      <span aria-hidden className="flex items-center">
        {glyph}
      </span>
      <span className="text-[0.8125rem] font-medium">{label}</span>
    </button>
  );
}

const COMMAND_LABELS: Record<ClockCommand, string> = {
  START: 'Start the clock',
  PAUSE: 'Pause',
  RESUME: 'Resume',
  END_PERIOD: 'End period',
  START_NEXT_PERIOD: 'Start next period',
  FULL_TIME: 'Full time',
};

function ClockBar({
  clock,
  commands,
  isRunning,
  isPending,
  onCommand,
  error,
}: {
  clock: MatchClockDto | null;
  commands: ClockCommand[];
  isRunning: boolean;
  isPending: boolean;
  onCommand: (command: ClockCommand) => void;
  error: unknown;
}) {
  const primary = commands[0] ?? null;
  const rest = commands.slice(1);

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-7">
      <div className="flex items-center justify-between gap-5 sm:gap-8">
        <MatchTimer clock={clock} size="lg" className="min-w-0 flex-1" />

        {primary ? (
          <div className="flex shrink-0 flex-col items-center gap-2">
            <button
              type="button"
              className={cn(
                'transport size-[3.75rem] sm:size-[4.25rem]',
                isRunning
                  ? 'border border-line bg-raised text-primary hover:bg-hover'
                  : 'bg-[var(--accent-strong)] text-white',
              )}
              disabled={isPending}
              aria-label={COMMAND_LABELS[primary]}
              onClick={() => onCommand(primary)}
            >
              {isRunning ? (
                <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
                  <rect x="7" y="5" width="4" height="14" rx="1.4" />
                  <rect x="13" y="5" width="4" height="14" rx="1.4" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="size-6 translate-x-[2px]"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              )}
            </button>

            <span className="max-w-[7rem] text-center text-[0.75rem] leading-tight text-secondary">
              {COMMAND_LABELS[primary]}
            </span>
          </div>
        ) : null}
      </div>

      {rest.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          {rest.map((command) => (
            <Button
              key={command}
              size="sm"
              variant={command === 'FULL_TIME' ? 'danger' : 'quiet'}
              disabled={isPending}
              onClick={() => onCommand(command)}
            >
              {COMMAND_LABELS[command]}
            </Button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <ErrorText error={error} />
        </div>
      ) : null}
    </div>
  );
}

interface SideData {
  team: TeamRef;
  squad: PlayerRef[];
}

interface Choice {
  id: string;
  name: string;
  note?: string | null;
}

function SubstitutionSheet({
  open,
  home,
  away,
  lineups,
  rosters,
  limit,
  used,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  home: SideData;
  away: SideData;
  lineups: { home: TeamLineup | null; away: TeamLineup | null };
  rosters: { home: FootballSquadSide | null; away: FootballSquadSide | null };
  limit: number | null;
  used: { home: number; away: number };
  isPending: boolean;
  onClose: () => void;
  onSubmit: (
    kind: FootballEventKind,
    teamId: string,
    playerId: string | null,
    assistPlayerId: string | null,
    playerOffId?: string | null,
  ) => Promise<void>;
}) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [offId, setOffId] = useState<string | null>(null);
  const [onId, setOnId] = useState<string | null>(null);

  function reset() {
    setTeamId(null);
    setOffId(null);
    setOnId(null);
  }

  const isHome = teamId === home.team.id;
  const lineup = teamId === null ? null : isHome ? lineups.home : lineups.away;
  const roster = teamId === null ? null : isHome ? rosters.home : rosters.away;

  const canComeOff: Choice[] = (lineup?.players ?? [])
    .filter((player) => !player.isSentOff)
    .map((player) => ({
      id: player.id,
      name: player.name,
      note: player.shirtNumber === null ? null : `#${player.shirtNumber}`,
    }));

  const canComeOn = availableToComeOn(lineup, roster, home, away, teamId);

  const spent = teamId === null ? 0 : isHome ? used.home : used.away;
  const remaining = limit === null ? null : Math.max(0, limit - spent);
  const exhausted = remaining === 0;

  const ready = Boolean(teamId && offId && onId) && !exhausted;

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      size="lg"
      title="Substitution"
      description={
        limit === null
          ? 'Rolling substitutions — anyone off the pitch can come on, as often as you like.'
          : `Who is coming off, and who is taking their place. ${limit} changes a side.`
      }
      footer={
        <>
          <Button
            disabled={!ready}
            isLoading={isPending}
            onClick={() => void onSubmit('SUBSTITUTION', teamId!, onId, null, offId).then(reset)}
          >
            Make the change
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <TeamChoice
          home={home.team}
          away={away.team}
          value={teamId}
          onChange={(next) => {
            setTeamId(next);
            setOffId(null);
            setOnId(null);
          }}
        />

        {teamId ? (
          exhausted ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong px-5 py-4 text-[0.8125rem] text-secondary">
              This side has used all {limit} of its substitutions.
            </p>
          ) : canComeOn.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong px-5 py-4 text-[0.8125rem] text-secondary">
              Everybody in this squad is either on the pitch or sent off.
            </p>
          ) : (
            <>
              <p className="text-[0.8125rem] text-muted">
                {remaining === null
                  ? `${spent} change${spent === 1 ? '' : 's'} so far — no limit`
                  : `${remaining} of ${limit} change${limit === 1 ? '' : 's'} left`}
              </p>

              <PlayerChoice
                label="Coming off"
                players={canComeOff}
                value={offId}
                onChange={setOffId}
              />
              <PlayerChoice
                label="Coming on"
                players={canComeOn}
                value={onId}
                onChange={setOnId}
                caption="Anyone in the squad, including a player already taken off. A player who was not named is added to the team sheet when the change is recorded."
              />
            </>
          )
        ) : null}
      </div>
    </Sheet>
  );
}

function availableToComeOn(
  lineup: TeamLineup | null,
  roster: FootballSquadSide | null,
  home: SideData,
  away: SideData,
  teamId: string | null,
): Choice[] {
  if (!teamId) return [];

  const onPitch = new Set((lineup?.players ?? []).map((player) => player.id));
  const named = new Map<string, LineupPlayer>();
  for (const player of [...(lineup?.players ?? []), ...(lineup?.substitutes ?? [])]) {
    named.set(player.id, player);
  }

  // Substitutions roll: anyone off the pitch and not sent off can come on, including
  // a player who has already been taken off once.
  const usable = (id: string) => {
    if (onPitch.has(id)) return false;
    const entry = named.get(id);
    if (!entry) return true;
    return !entry.isSentOff;
  };

  const bench: Choice[] = (lineup?.substitutes ?? [])
    .filter((player) => usable(player.id))
    .map((player) => ({
      id: player.id,
      name: player.name,
      note: player.wentOffAt
        ? `Off ${player.wentOffAt}`
        : player.shirtNumber === null
          ? 'Bench'
          : `#${player.shirtNumber}`,
    }));

  const all =
    roster?.players.map((player) => ({ id: player.id, name: player.name })) ??
    (teamId === home.team.id ? home.squad : away.squad);

  const seen = new Set(bench.map((player) => player.id));

  const rest: Choice[] = all
    .filter((player) => !seen.has(player.id) && usable(player.id))
    .map((player) => ({
      id: player.id,
      name: player.name,
      note: named.has(player.id) ? null : 'Call-up',
    }));

  return [...bench, ...rest];
}

function SaveSheet({
  open,
  home,
  away,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  home: SideData;
  away: SideData;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (
    kind: FootballEventKind,
    teamId: string,
    playerId: string | null,
    assistPlayerId: string | null,
  ) => Promise<void>;
}) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  function reset() {
    setTeamId(null);
    setPlayerId(null);
  }

  const side = teamId === home.team.id ? home : teamId === away.team.id ? away : null;

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      size="lg"
      title="Save"
      description="A shot kept out — credited to the side that defended it."
      footer={
        <>
          <Button
            disabled={!teamId}
            isLoading={isPending}
            onClick={() => void onSubmit('SAVE', teamId!, playerId, null).then(reset)}
          >
            Record save
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <TeamChoice
          home={home.team}
          away={away.team}
          value={teamId}
          onChange={(next) => {
            setTeamId(next);
            setPlayerId(null);
          }}
        />

        {side ? (
          <PlayerChoice
            label="Who saved it"
            players={side.squad}
            value={playerId}
            onChange={setPlayerId}
            allowUnknown
          />
        ) : null}
      </div>
    </Sheet>
  );
}

function GoalSheet({
  open,
  home,
  away,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  home: SideData;
  away: SideData;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (
    kind: FootballEventKind,
    teamId: string,
    playerId: string | null,
    assistPlayerId: string | null,
  ) => Promise<void>;
}) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isOwnGoal, setOwnGoal] = useState(false);
  const [scorerId, setScorerId] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);

  function reset() {
    setTeamId(null);
    setOwnGoal(false);
    setScorerId(null);
    setAssistId(null);
  }

  const scoringSide = teamId === home.team.id ? home : teamId === away.team.id ? away : null;
  const playerSide = isOwnGoal ? (scoringSide === home ? away : home) : scoringSide;

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      size="lg"
      title="Goal"
      description="Which side scored, and who put it in."
      footer={
        <>
          <Button
            disabled={!teamId}
            isLoading={isPending}
            onClick={() =>
              void onSubmit(
                isOwnGoal ? 'OWN_GOAL' : 'GOAL',
                teamId!,
                scorerId,
                isOwnGoal ? null : assistId,
              ).then(reset)
            }
          >
            Record goal
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <TeamChoice
          home={home.team}
          away={away.team}
          value={teamId}
          onChange={(next) => {
            setTeamId(next);
            setScorerId(null);
            setAssistId(null);
          }}
        />

        {teamId ? (
          <>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isOwnGoal}
                onChange={(event) => {
                  setOwnGoal(event.target.checked);
                  setScorerId(null);
                  setAssistId(null);
                }}
                className="size-4 accent-[var(--accent-strong)]"
              />
              <span className="text-sm text-primary">
                Own goal
                <span className="ml-2 text-[0.8125rem] text-muted">put in by the other side</span>
              </span>
            </label>

            {playerSide ? (
              <PlayerChoice
                label={isOwnGoal ? 'Put in by' : 'Scorer'}
                players={playerSide.squad}
                value={scorerId}
                onChange={setScorerId}
                allowUnknown
              />
            ) : null}

            {!isOwnGoal && scoringSide ? (
              <PlayerChoice
                label="Assist"
                players={scoringSide.squad.filter((player) => player.id !== scorerId)}
                value={assistId}
                onChange={setAssistId}
                allowUnknown
                unknownLabel="No assist"
              />
            ) : null}
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

function CardSheet({
  open,
  home,
  away,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  home: SideData;
  away: SideData;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (
    kind: FootballEventKind,
    teamId: string,
    playerId: string | null,
    assistPlayerId: string | null,
  ) => Promise<void>;
}) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [kind, setKind] = useState<FootballEventKind>('YELLOW_CARD');
  const [playerId, setPlayerId] = useState<string | null>(null);

  function reset() {
    setTeamId(null);
    setKind('YELLOW_CARD');
    setPlayerId(null);
  }

  const side = teamId === home.team.id ? home : teamId === away.team.id ? away : null;

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      size="lg"
      title="Card"
      description="A booking, against the side that committed the foul."
      footer={
        <>
          <Button
            disabled={!teamId}
            isLoading={isPending}
            onClick={() => void onSubmit(kind, teamId!, playerId, null).then(reset)}
          >
            Record {FOOTBALL_EVENT_LABELS[kind].toLowerCase()}
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <TeamChoice
          home={home.team}
          away={away.team}
          value={teamId}
          onChange={(next) => {
            setTeamId(next);
            setPlayerId(null);
          }}
        />

        <div className="flex flex-col gap-2">
          <p className="eyebrow">Card</p>

          <div className="grid grid-cols-2 gap-2.5">
            {(['YELLOW_CARD', 'RED_CARD'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                aria-pressed={kind === option}
                className={cn(
                  'flex items-center justify-center gap-2.5 rounded-[var(--radius-sm)] border py-3.5',
                  'text-sm font-medium transition-all duration-[var(--dur-fast)]',
                  kind === option
                    ? 'border-[var(--accent-strong)] bg-accent-soft text-accent'
                    : 'border-line bg-raised text-primary hover:bg-hover',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'h-5 w-3.5 rounded-[1px] ring-1 ring-black/25',
                    option === 'RED_CARD' ? 'bg-[#c8332a]' : 'bg-[#e0b23c]',
                  )}
                />
                {option === 'RED_CARD' ? 'Red' : 'Yellow'}
              </button>
            ))}
          </div>
        </div>

        {side ? (
          <PlayerChoice
            label="Player"
            players={side.squad}
            value={playerId}
            onChange={setPlayerId}
            allowUnknown
          />
        ) : null}
      </div>
    </Sheet>
  );
}

function TeamChoice({
  home,
  away,
  value,
  onChange,
}: {
  home: TeamRef;
  away: TeamRef;
  value: string | null;
  onChange: (teamId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">Team</p>

      <div className="grid grid-cols-2 gap-2.5">
        {[home, away].map((team) => (
          <button
            key={team.id}
            type="button"
            onClick={() => onChange(team.id)}
            aria-pressed={value === team.id}
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius-sm)] border px-3.5 py-3',
              'transition-all duration-[var(--dur-fast)]',
              value === team.id
                ? 'border-[var(--accent-strong)] bg-accent-soft'
                : 'border-line bg-raised hover:bg-hover',
            )}
          >
            <TeamMark shortName={team.shortName} color={team.primaryColor} size="sm" />
            <span className="min-w-0 truncate text-sm font-medium text-primary">{team.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerChoice({
  label,
  caption,
  players,
  value,
  onChange,
  allowUnknown,
  unknownLabel = 'Not sure',
}: {
  label: string;
  caption?: string;
  players: Choice[];
  value: string | null;
  onChange: (playerId: string | null) => void;
  allowUnknown?: boolean;
  unknownLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">{label}</p>
      {caption ? <p className="-mt-0.5 mb-1 text-[0.75rem] text-muted">{caption}</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onChange(value === player.id ? null : player.id)}
            aria-pressed={value === player.id}
            className={cn(
              'flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5',
              'text-[0.8125rem] transition-all duration-[var(--dur-fast)]',
              value === player.id
                ? 'border-[var(--accent-strong)] bg-accent-soft text-accent'
                : 'border-line bg-raised text-primary hover:bg-hover',
            )}
          >
            <FootballAvatar seed={player.id} name={player.name} size="xs" />
            {player.name}
            {player.note ? (
              <span className="mono text-[0.6875rem] text-muted">{player.note}</span>
            ) : null}
          </button>
        ))}

        {allowUnknown ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-pressed={value === null}
            className={cn(
              'rounded-full border border-dashed px-3.5 py-2 text-[0.8125rem] transition-all',
              value === null
                ? 'border-line-strong bg-sunken text-secondary'
                : 'border-line text-muted hover:bg-hover',
            )}
          >
            {unknownLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
