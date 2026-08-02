import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FOOTBALL_EVENT_LABELS,
  allowedCommands,
  periodName,
  type ClockCommand,
  type FootballEventKind,
  type PlayerRef,
  type TeamRef,
} from '@howzat/shared';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorText, Skeleton } from '@/components/ui/Feedback';
import { TeamMark } from '@/components/ui/Pill';
import { SportMark } from '@/components/ui/SportMark';
import { FootballAvatar } from '@/components/ui/FootballAvatar';
import { ShareLink } from '@/components/ui/ShareLink';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { MatchTimer } from './MatchTimer';
import { IncidentTimeline } from './IncidentTimeline';
import {
  useClockCommand,
  useFootballState,
  useRecordFootballEvent,
  useUndoFootballEvent,
} from './queries';

/**
 * The touchline console.
 *
 * Everything on this screen is sized for one hand, in daylight, while watching
 * something else. That constraint decides the whole layout: the clock is the
 * largest object because it is glanced at constantly, and beneath it there are
 * exactly two primary actions — a goal and a card — because those are the only
 * two things that happen. Anything a scorer has to hunt for is a thing that
 * gets recorded a minute late or not at all.
 *
 * Both actions open a sheet rather than firing immediately. A mis-tap that puts
 * a goal on the board is worse than one extra tap, and the sheet is where the
 * player is named — which is the part that makes the scorecard worth reading
 * afterwards.
 */

type Pending =
  | { kind: 'GOAL' }
  | { kind: 'CARD' }
  | null;

export function FootballScoringPage() {
  const { matchId = '' } = useParams();
  const { data, isPending, error } = useFootballState(matchId);

  const clockCommand = useClockCommand(matchId);
  const recordEvent = useRecordFootballEvent(matchId);
  const undoEvent = useUndoFootballEvent(matchId);

  const [pending, setPending] = useState<Pending>(null);

  if (isPending) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-24" />
        <Skeleton className="h-[28rem]" />
      </div>
    );
  }

  if (error) return <ErrorText error={error} />;
  if (!data) return null;

  const { clock, snapshot, state } = data;
  const isLastPeriod = clock ? clock.currentPeriod >= clock.periods : false;
  const commands = clock ? allowedCommands(clock.status, isLastPeriod) : [];
  const finished = clock?.status === 'FINISHED' || data.status === 'COMPLETED';

  const canRecord = Boolean(clock) && !finished;

  async function submit(
    kind: FootballEventKind,
    teamId: string,
    playerId: string | null,
    assistPlayerId: string | null,
  ) {
    await recordEvent.mutateAsync({
      clientEventId: crypto.randomUUID(),
      kind,
      teamId,
      playerId,
      assistPlayerId,
    });
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink to={`/matches/${matchId}`}>Back to the match</BackLink>

        <div className="flex items-center gap-2.5">
          {snapshot ? (
            <ShareLink
              slug={snapshot.publicSlug}
              matchLabel={`${data.home.team.shortName} v ${data.away.team.shortName}`}
              label="Share live"
            />
          ) : null}
        </div>
      </div>

      <Scoreline
        home={data.home.team}
        away={data.away.team}
        homeGoals={state.home.goals}
        awayGoals={state.away.goals}
        resultText={snapshot?.resultText ?? null}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardBody className="flex flex-col items-center gap-7 py-8">
            <MatchTimer clock={clock} size="lg" />

            <ClockControls
              commands={commands}
              periods={clock?.periods ?? 0}
              currentPeriod={clock?.currentPeriod ?? 1}
              isPending={clockCommand.isPending}
              onCommand={(command) => void clockCommand.mutateAsync(command)}
            />

            {clockCommand.error ? <ErrorText error={clockCommand.error} /> : null}
          </CardBody>
        </Card>

        <div className="flex flex-col gap-5">
          {/* The two buttons. Deliberately enormous, deliberately the only
              two things on this half of the screen with any weight. */}
          <div className="grid grid-cols-2 gap-4">
            <ActionSlab
              tone="goal"
              label="Goal"
              hint="Name the scorer"
              disabled={!canRecord || recordEvent.isPending}
              onClick={() => setPending({ kind: 'GOAL' })}
            />
            <ActionSlab
              tone="card"
              label="Card"
              hint="Yellow or red"
              disabled={!canRecord || recordEvent.isPending}
              onClick={() => setPending({ kind: 'CARD' })}
            />
          </div>

          {!clock ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong px-5 py-4 text-[0.8125rem] text-secondary">
              This match has not kicked off yet.{' '}
              <Link to={`/matches/${matchId}`} className="text-accent">
                Name the team sheets first
              </Link>
              .
            </p>
          ) : null}

          {recordEvent.error ? <ErrorText error={recordEvent.error} /> : null}
          {undoEvent.error ? <ErrorText error={undoEvent.error} /> : null}

          <Card className="min-h-0 flex-1">
            <CardHeader className="flex items-center justify-between gap-3">
              <p className="eyebrow">Match log</p>

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

            <CardBody>
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
        isPending={recordEvent.isPending}
        onClose={() => setPending(null)}
        onSubmit={submit}
      />

      <CardSheet
        open={pending?.kind === 'CARD'}
        home={data.home}
        away={data.away}
        isPending={recordEvent.isPending}
        onClose={() => setPending(null)}
        onSubmit={submit}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────  scoreline ──

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
    <Card>
      <CardBody className="flex items-center justify-between gap-4 py-6">
        <TeamScore team={home} goals={homeGoals} align="left" />

        <div className="flex flex-col items-center gap-1.5">
          <span className="score-figure text-[2.5rem] text-primary sm:text-[3.25rem]">
            {homeGoals}–{awayGoals}
          </span>
          {resultText ? (
            <span className="text-center text-[0.75rem] text-success">{resultText}</span>
          ) : null}
        </div>

        <TeamScore team={away} goals={awayGoals} align="right" />
      </CardBody>
    </Card>
  );
}

function TeamScore({
  team,
  align,
}: {
  team: TeamRef;
  goals: number;
  align: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      <TeamMark shortName={team.shortName} color={team.primaryColor} />
      <p
        className={cn(
          'min-w-0 truncate text-sm font-medium text-primary sm:text-base',
          align === 'right' && 'text-right',
        )}
      >
        {team.name}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────  controls ──

const COMMAND_LABELS: Record<ClockCommand, string> = {
  START: 'Start the clock',
  PAUSE: 'Pause',
  RESUME: 'Resume',
  END_PERIOD: 'End period',
  START_NEXT_PERIOD: 'Start next period',
  FULL_TIME: 'Full time',
};

/**
 * What the watch will accept right now, and nothing else.
 *
 * The list comes from the same table the server refuses commands with, so the
 * button that is missing here is exactly the command that would have been
 * rejected. There is no client-side guess to drift out of step.
 */
function ClockControls({
  commands,
  periods,
  currentPeriod,
  isPending,
  onCommand,
}: {
  commands: ClockCommand[];
  periods: number;
  currentPeriod: number;
  isPending: boolean;
  onCommand: (command: ClockCommand) => void;
}) {
  if (commands.length === 0) {
    return <p className="text-[0.8125rem] text-muted">Full time — the clock is stopped.</p>;
  }

  const primary = commands[0]!;
  const rest = commands.slice(1);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Button
        size="lg"
        fullWidth
        isLoading={isPending}
        onClick={() => onCommand(primary)}
        className="max-w-xs"
      >
        {COMMAND_LABELS[primary]}
      </Button>

      {rest.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {rest.map((command) => (
            <Button
              key={command}
              size="sm"
              variant={command === 'FULL_TIME' ? 'danger' : 'secondary'}
              disabled={isPending}
              onClick={() => onCommand(command)}
            >
              {COMMAND_LABELS[command]}
            </Button>
          ))}
        </div>
      ) : null}

      {periods > 1 ? (
        <p className="eyebrow">{periodName(currentPeriod, periods)}</p>
      ) : null}
    </div>
  );
}

/**
 * A goal or a card button.
 *
 * These are the one place in the product where a saturated fill is allowed.
 * The system's rule is that colour means state rather than decoration — and
 * here it does: the whole point of the console is that a scorer's thumb finds
 * the right slab without their eyes leaving the pitch, and shape alone does not
 * carry that at arm's length.
 */
function ActionSlab({
  tone,
  label,
  hint,
  disabled,
  onClick,
}: {
  tone: 'goal' | 'card';
  label: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)]',
        'border transition-all duration-[var(--dur-fast)] ease-[var(--ease)]',
        'active:translate-y-px disabled:pointer-events-none disabled:opacity-35',
        tone === 'goal'
          ? 'border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white hover:brightness-110'
          : 'border-line-strong bg-raised text-primary hover:border-[var(--warning)] hover:bg-warning-soft',
      )}
    >
      {/* Drawn, not an emoji: these are the two largest marks on the console
          and an emoji arrives at a different weight on every platform, ignores
          the label colour underneath it, and reads as decoration stuck on. */}
      {tone === 'goal' ? (
        <SportMark sport="FOOTBALL" className="size-7" />
      ) : (
        <span
          aria-hidden
          className="h-7 w-5 rounded-[2px] bg-[#e0b23c] ring-1 ring-black/25"
        />
      )}
      <span className="text-lg font-semibold tracking-[0.01em]">{label}</span>
      <span
        className={cn(
          'text-[0.75rem]',
          tone === 'goal' ? 'text-white/75' : 'text-muted',
        )}
      >
        {hint}
      </span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────  sheets ──

interface SideData {
  team: TeamRef;
  squad: PlayerRef[];
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
  // An own goal is credited to one side and scored by a player from the other,
  // so the player list has to come from the opposite team sheet.
  const playerSide = isOwnGoal
    ? scoringSide === home
      ? away
      : home
    : scoringSide;

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
                <span className="ml-2 text-[0.8125rem] text-muted">
                  put in by the other side
                </span>
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
                    'h-4 w-3 rounded-[1px] ring-1 ring-black/25',
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

/**
 * Naming the player.
 *
 * "Unknown" is a first-class answer rather than an omission. At this level
 * nobody always knows who got the final touch, and a console that insists is a
 * console where the goal gets recorded against the wrong person — or, worse,
 * not recorded while somebody works it out.
 */
function PlayerChoice({
  label,
  players,
  value,
  onChange,
  allowUnknown,
  unknownLabel = 'Not sure',
}: {
  label: string;
  players: PlayerRef[];
  value: string | null;
  onChange: (playerId: string | null) => void;
  allowUnknown?: boolean;
  unknownLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">{label}</p>

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
