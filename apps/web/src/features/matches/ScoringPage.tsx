import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  formatOvers,
  applyBall,
  isLegalDelivery,
  quotaBalls,
  validateBall,
  WICKET_TYPES,
  type BallRequestInput,
  type BallEvent,
  type BallSummary,
  type DlsParPosition,
  type ExtraType,
  type InningsContext,
  type MatchState,
  type PlayerRef,
  type WicketType,
} from '@howzat/shared';
import { Button } from '@/components/ui/Button';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { ClockIcon, StumpsIcon, TrendIcon, TrophyIcon, UndoIcon } from '@/components/ui/Icons';
import { PdfButton } from '@/components/ui/PdfButton';
import {
  BallChip,
  CreaseCard,
  LeaderRow,
  Panel,
  RunsPerOver,
  Scoreboard,
  StatLine,
} from '@/components/ui/Score';
import { Sheet } from '@/components/ui/Sheet';
import { ShareLink } from '@/components/ui/ShareLink';
import { SketchFilter } from '@/features/live/Moment';
import { cn } from '@/lib/cn';
import { DlsSheet } from './DlsSheet';
import {
  useDlsState,
  useRecordBall,
  useResumeInnings,
  useScorerState,
  useUndoBall,
} from './queries';
import { useOfflineBallQueue } from './useOfflineBallQueue';

/*
 * The console.
 *
 * Reading order is the scorer's order: the board, the pad, then everything the
 * board cannot say. Nothing below the pad may compete with the two above it.
 */
export function ScoringPage() {
  const { matchId = '' } = useParams();

  const scorer = useScorerState(matchId);
  const recordBall = useRecordBall(matchId);
  const undo = useUndoBall(matchId);
  const resume = useResumeInnings(matchId);
  const submitBall = useCallback(
    (input: BallRequestInput) => recordBall.mutateAsync(input),
    [recordBall.mutateAsync],
  );
  const queue = useOfflineBallQueue(matchId, submitBall);
  const dls = useDlsState(matchId);
  const [dlsOpen, setDlsOpen] = useState(false);

  if (scorer.isPending) {
    return (
      <Shell>
        <SkeletonCard rows={6} />
      </Shell>
    );
  }
  if (scorer.error) {
    return (
      <Shell>
        <ErrorText error={scorer.error} />
      </Shell>
    );
  }
  if (!scorer.data) return null;

  const { match, state, context, innings, previousOverBowlerId } = scorer.data;

  const dlsApplied = dls.data?.applied ?? false;
  const matchClosed = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const optimistic =
    state && context ? foldQueuedBalls(state, context, previousOverBowlerId, queue.items) : null;

  return (
    <Shell>
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            to={`/matches/${matchId}`}
            className="text-[0.8125rem] text-muted transition-colors hover:text-primary"
          >
            ← Match
          </Link>
          <span aria-hidden className="h-5 w-px bg-line" />
          <div className="min-w-0">
            <p className="truncate font-medium text-primary">
              {match.team1?.name ?? 'TBD'} <span className="text-muted">v</span>{' '}
              {match.team2?.name ?? 'TBD'}
            </p>
            <p className="eyebrow mt-1.5">Scoring console</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {dlsApplied ? (
            <span data-tone="warning" className="eyebrow">
              DLS applied
            </span>
          ) : null}
          {matchClosed ? null : (
            <Button size="sm" variant="secondary" onClick={() => setDlsOpen(true)}>
              {dlsApplied ? 'Rain' : 'DLS'}
            </Button>
          )}
          <ShareLink
            slug={match.publicSlug}
            variant="quiet"
            matchLabel={`${match.team1?.shortName ?? 'TBD'} v ${match.team2?.shortName ?? 'TBD'}`}
          />
        </div>
      </header>

      <DlsSheet
        open={dlsOpen}
        onClose={() => setDlsOpen(false)}
        matchId={matchId}
        state={state}
        context={context}
        inningsNumber={innings?.number ?? 1}
      />

      {matchClosed ? (
        <Closed
          icon={<TrophyIcon className="size-7 text-muted" />}
          eyebrow="Match closed"
          headline={match.resultText ?? 'This match is over'}
          body="There is nothing left to score."
          action={
            <PdfButton
              label="Share PDF"
              arrow
              size="md"
              build={() =>
                import('@/lib/pdf').then((pdf) => pdf.buildCricketMatchPdf(match.publicSlug))
              }
            />
          }
        />
      ) : match.status === 'INNINGS_BREAK' || (state?.isComplete && innings) ? (
        <div className="flex flex-col gap-6">
          {state && context ? <Board state={state} context={context} /> : null}

          <Closed
            icon={<ClockIcon className="size-7 text-muted" />}
            eyebrow={match.status === 'INNINGS_BREAK' ? 'Innings break' : 'Innings complete'}
            headline={
              innings?.targetRuns
                ? `Chasing ${innings.targetRuns}`
                : 'The chase is set up and ready'
            }
            action={
              match.status === 'INNINGS_BREAK' && innings ? (
                <>
                  <Button
                    size="lg"
                    isLoading={resume.isPending}
                    onClick={() => resume.mutate(innings.number)}
                  >
                    Start innings {innings.number}
                  </Button>
                  {resume.error ? <ErrorText error={resume.error} /> : null}
                </>
              ) : null
            }
          />
        </div>
      ) : !state || !context ? (
        <Closed
          icon={<StumpsIcon className="size-7 text-muted" />}
          eyebrow="Not started"
          headline="This match has not started yet"
          body="Record the toss, name both XIs, then start the match."
          action={
            <Link to={`/matches/${matchId}`}>
              <Button>Go to match setup</Button>
            </Link>
          }
        />
      ) : optimistic ? (
        <Console
          key={context.inningsId}
          optimisticState={optimistic.state}
          context={context}
          par={dls.data?.par ?? null}
          matchStatus={match.status}
          previousOverBowlerId={optimistic.previousOverBowlerId}
          isSaving={recordBall.isPending || undo.isPending}
          saveError={recordBall.error ?? undo.error}
          queueItems={queue.items}
          isOnline={queue.isOnline}
          syncState={queue.syncState}
          onBall={queue.enqueue}
          onUndo={() => undo.mutateAsync()}
          onRetryQueue={queue.retryFailed}
        />
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[68rem] flex-col gap-6 px-5 py-8 pb-16 sm:px-8 sm:py-10">
      <SketchFilter />
      {children}
    </div>
  );
}

function Closed({
  icon,
  eyebrow,
  headline,
  body,
  action,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  headline: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="crop relative flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-line bg-raised px-6 py-20 text-center">
      {icon}
      <p className="eyebrow">{eyebrow}</p>
      <p className="serif text-[2rem] text-primary">{headline}</p>
      {body ? <p className="max-w-md text-secondary">{body}</p> : null}
      {action ? <div className="mt-3 flex flex-col items-center gap-3">{action}</div> : null}
    </section>
  );
}

interface Crease {
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
}

interface ConsoleProps {
  optimisticState: MatchState;
  context: InningsContext;
  par: DlsParPosition | null;
  matchStatus: string;
  previousOverBowlerId: string | null;
  isSaving: boolean;
  saveError: unknown;
  queueItems: Array<{ id: string; status: 'pending' | 'failed'; error: string | null }>;
  isOnline: boolean;
  syncState: 'idle' | 'syncing' | 'synced' | 'failed';
  onBall: (input: BallRequestInput) => Promise<unknown>;
  onUndo: () => Promise<unknown>;
  onRetryQueue: () => Promise<void>;
}

const EXTRAS: ReadonlyArray<{ value: ExtraType; label: string; key: string }> = [
  { value: 'WIDE', label: 'Wide', key: 'd' },
  { value: 'NO_BALL', label: 'No ball', key: 'n' },
  { value: 'BYE', label: 'Bye', key: 'b' },
  { value: 'LEG_BYE', label: 'Leg bye', key: 'l' },
];

function optimisticEvent(state: MatchState, input: BallRequestInput): BallEvent {
  const legalBalls = state.thisOver.filter((ball) => ball.isLegalDelivery).length;
  return {
    ...input,
    id: `optimistic-${input.clientEventId}`,
    inningsId: state.inningsId,
    seq: state.lastEventSeq + 1,
    overNumber: state.currentOverNumber,
    ballNumber: Math.min(legalBalls + 1, 6),
    eventType: 'BALL',
    supersedesEventId: null,
    isLegalDelivery: isLegalDelivery(input.extraType),
    createdBy: 'local-scorer',
    createdAt: new Date().toISOString(),
  };
}

function foldQueuedBalls(
  state: MatchState,
  context: InningsContext,
  serverPreviousOverBowlerId: string | null,
  queued: ReadonlyArray<{ input: BallRequestInput }>,
): { state: MatchState; previousOverBowlerId: string | null } {
  let current = state;
  let previousOverBowlerId = serverPreviousOverBowlerId;

  for (const item of queued) {
    const next = applyBall(current, optimisticEvent(current, item.input), context);
    if (next.currentOverNumber !== current.currentOverNumber) {
      previousOverBowlerId = item.input.bowlerId;
    }
    current = next;
  }

  return { state: current, previousOverBowlerId };
}

function Console({
  optimisticState,
  context,
  par,
  matchStatus,
  previousOverBowlerId,
  isSaving,
  saveError,
  queueItems,
  isOnline,
  syncState,
  onBall,
  onUndo,
  onRetryQueue,
}: ConsoleProps) {
  const displayState = optimisticState;
  const [override, setOverride] = useState<Partial<Crease>>({});
  const [appliedSeq, setAppliedSeq] = useState(displayState.lastEventSeq);
  const [extraType, setExtraType] = useState<ExtraType | null>(null);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (displayState.lastEventSeq === appliedSeq) return;
    setOverride({});
    setExtraType(null);
    setWicketOpen(false);
    setLocalError(null);
    setAppliedSeq(displayState.lastEventSeq);
  }, [displayState.lastEventSeq, appliedSeq]);

  const crease: Crease = {
    striker: override.striker !== undefined ? override.striker : displayState.strikerId,
    nonStriker: override.nonStriker !== undefined ? override.nonStriker : displayState.nonStrikerId,
    bowler:
      override.bowler !== undefined
        ? override.bowler
        : displayState.needsNewBowler
          ? null
          : displayState.bowlerId,
  };

  const atCrease = new Set([crease.striker, crease.nonStriker].filter(Boolean));

  const availableBatsmen = context.battingXI.filter(
    (player) => !displayState.batsmen[player.id]?.isOut && !atCrease.has(player.id),
  );

  const availableBowlers = context.bowlingXI.filter(
    (player) => player.id !== previousOverBowlerId || displayState.thisOver.length > 0,
  );

  const ready = Boolean(crease.striker && crease.nonStriker && crease.bowler);

  async function submit(ball: {
    runsOffBat: number;
    extraRuns: number;
    extraType: ExtraType | null;
    isWicket?: boolean;
    wicketType?: WicketType | null;
    dismissedPlayerId?: string | null;
    fielderId?: string | null;
  }) {
    if (!crease.striker || !crease.nonStriker || !crease.bowler) {
      setLocalError('Name both batters and the bowler before scoring a ball.');
      return;
    }

    const input: BallRequestInput = {
      clientEventId: crypto.randomUUID(),
      strikerId: crease.striker,
      nonStrikerId: crease.nonStriker,
      bowlerId: crease.bowler,
      runsOffBat: ball.runsOffBat,
      extraRuns: ball.extraRuns,
      extraType: ball.extraType,
      isWicket: ball.isWicket ?? false,
      wicketType: ball.wicketType ?? null,
      dismissedPlayerId: ball.dismissedPlayerId ?? null,
      fielderId: ball.fielderId ?? null,
    };

    const verdict = validateBall(displayState, input, context, {
      matchStatus,
      previousOverBowlerId,
    });

    if (!verdict.ok) {
      setLocalError(verdict.issues[0]?.message ?? 'That ball is not legal in this state.');
      return;
    }

    setLocalError(null);
    await onBall(input);
  }

  function handleRuns(runs: number) {
    switch (extraType) {
      case 'WIDE':
        return submit({ runsOffBat: 0, extraRuns: runs + 1, extraType: 'WIDE' });
      case 'NO_BALL':
        return submit({ runsOffBat: runs, extraRuns: 1, extraType: 'NO_BALL' });
      case 'BYE':
      case 'LEG_BYE':
        return submit({ runsOffBat: 0, extraRuns: runs, extraType });
      default:
        return submit({ runsOffBat: runs, extraRuns: 0, extraType: null });
    }
  }

  const byeLike = extraType === 'BYE' || extraType === 'LEG_BYE';

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (wicketOpen || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (/^[0-6]$/.test(event.key)) {
        if (byeLike && event.key === '0') return;
        event.preventDefault();
        void handleRuns(Number(event.key));
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'w') {
        event.preventDefault();
        setWicketOpen(true);
        return;
      }

      const extra = EXTRAS.find((option) => option.key === key);
      if (extra) {
        event.preventDefault();
        setExtraType((current) => (current === extra.value ? null : extra.value));
        return;
      }

      if (event.key === 'Backspace' && displayState.lastEventSeq > 0) {
        event.preventDefault();
        void onUndo();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const canUndo = displayState.lastEventSeq > 0 && !isSaving;

  return (
    <div className="flex flex-col gap-6">
      <Board
        state={displayState}
        context={context}
        status={
          <SyncStatus
            isSaving={isSaving}
            isOnline={isOnline}
            syncState={syncState}
            hasQueuedBalls={queueItems.length > 0}
          />
        }
      />

      <CreaseCard
        batters={[crease.striker, crease.nonStriker]
          .filter((id): id is string => Boolean(id))
          .map((id) => {
            const batsman = displayState.batsmen[id];
            return {
              id,
              name:
                batsman?.name ??
                context.battingXI.find((player) => player.id === id)?.name ??
                'Batter',
              runs: batsman?.runs ?? 0,
              balls: batsman?.balls ?? 0,
              fours: batsman?.fours ?? 0,
              sixes: batsman?.sixes ?? 0,
              onStrike: id === crease.striker,
            };
          })}
        bowler={bowlerFigures(displayState, context, crease.bowler)}
        emptyLabel="Name the openers on the pad above."
        action={
          crease.striker && crease.nonStriker ? (
            <button
              type="button"
              onClick={() =>
                setOverride({ striker: crease.nonStriker, nonStriker: crease.striker })
              }
              className="text-[0.8125rem] text-muted transition-colors hover:text-primary"
            >
              Swap ends
            </button>
          ) : null
        }
        bowlerAction={
          crease.bowler ? (
            <button
              type="button"
              onClick={() => setOverride((current) => ({ ...current, bowler: null }))}
              className="shrink-0 text-[0.8125rem] text-muted transition-colors hover:text-primary"
            >
              Change
            </button>
          ) : null
        }
      />

      <InningsNumbers state={displayState} context={context} par={par} />

      <Momentum state={displayState} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <EventsCard state={displayState} />
        <WicketsCard state={displayState} />
      </div>

      <Pad
        state={displayState}
        crease={crease}
        availableBatsmen={availableBatsmen}
        availableBowlers={availableBowlers}
        ready={ready}
        isSaving={isSaving}
        extraType={extraType}
        byeLike={byeLike}
        canUndo={canUndo}
        localError={localError}
        saveError={saveError}
        queueItems={queueItems}
        isOnline={isOnline}
        onOverride={(next) => setOverride((current) => ({ ...current, ...next }))}
        onExtra={(value) => setExtraType((current) => (current === value ? null : value))}
        onRuns={(runs) => void handleRuns(runs)}
        onWicket={() => setWicketOpen(true)}
        onUndo={() => void onUndo()}
        onRetryQueue={onRetryQueue}
      />

      <WicketSheet
        key={extraType ?? 'none'}
        open={wicketOpen}
        state={displayState}
        context={context}
        crease={crease}
        extraType={extraType}
        isSaving={isSaving}
        onClose={() => setWicketOpen(false)}
        onSubmit={(ball) => submit(ball)}
      />
    </div>
  );
}

function bowlerFigures(state: MatchState, context: InningsContext, bowlerId: string | null) {
  if (!bowlerId) return null;

  const bowler = state.bowlers[bowlerId];
  const name =
    bowler?.name ?? context.bowlingXI.find((player) => player.id === bowlerId)?.name ?? 'Bowler';

  return {
    name,
    overs: formatOvers(bowler?.balls ?? 0),
    maidens: bowler?.maidens ?? 0,
    runs: bowler?.runs ?? 0,
    wickets: bowler?.wickets ?? 0,
    econ: bowler && bowler.balls > 0 ? (bowler.runs * 6) / bowler.balls : null,
  };
}

/* ── The board ───────────────────────────────────────────────────────────── */

function Board({
  state,
  context,
  status,
}: {
  state: MatchState;
  context: InningsContext;
  status?: React.ReactNode;
}) {
  const quota = quotaBalls(context);
  const ballsLeft = Math.max(0, quota - state.legalBalls);
  const needed = context.targetRuns !== null ? context.targetRuns - state.runs : null;

  return (
    <Scoreboard
      size="md"
      team={context.battingTeam}
      eyebrow={`Innings ${context.number} · v ${context.bowlingTeam.shortName}`}
      status={status}
      runs={state.runs}
      wickets={state.wickets}
      overs={formatOvers(state.legalBalls)}
      quota={formatOvers(quota)}
    >
      {needed !== null && needed > 0 && context.targetRuns ? (
        <div className="px-5 py-5 sm:px-7">
          <p className="text-[1.0625rem] text-primary">
            Need <span className="mono font-medium text-accent">{needed}</span> from{' '}
            <span className="mono font-medium">{ballsLeft}</span>{' '}
            {ballsLeft === 1 ? 'ball' : 'balls'}
          </p>

          <div className="chase-track mt-3.5">
            <span
              className="chase-fill"
              style={{ width: `${Math.min(100, (state.runs / context.targetRuns) * 100)}%` }}
            />
            <span
              aria-hidden
              className="chase-marker"
              style={{
                left: `${quota > 0 ? Math.min(100, (state.legalBalls / quota) * 100) : 0}%`,
              }}
            />
          </div>

          <div className="mono mt-3 flex justify-between text-[0.6875rem] text-muted">
            <span>
              {state.runs} of {context.targetRuns}
            </span>
            <span>{ballsLeft} balls left</span>
          </div>
        </div>
      ) : null}
    </Scoreboard>
  );
}

function SyncStatus({
  isSaving,
  isOnline,
  syncState,
  hasQueuedBalls,
}: {
  isSaving: boolean;
  isOnline: boolean;
  syncState: 'idle' | 'syncing' | 'synced' | 'failed';
  hasQueuedBalls: boolean;
}) {
  const failed = syncState === 'failed';
  const syncing = isSaving || syncState === 'syncing' || hasQueuedBalls;
  const label = failed
    ? 'Retry'
    : !isOnline
      ? 'Offline'
      : syncing
        ? 'Saving'
        : syncState === 'synced'
          ? 'Synced'
          : 'Ready';

  return (
    <span
      data-tone={failed ? 'live' : syncing ? 'accent' : 'success'}
      className="eyebrow flex shrink-0 items-center gap-2"
    >
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full bg-current', !failed && !syncing && 'live-pulse')}
      />
      {label}
    </span>
  );
}

/* ── The pad ─────────────────────────────────────────────────────────────── */

/*
 * The instrument. It takes the opposite tone to the page and it never leaves
 * the screen: once you scroll past it, it pins to the bottom, so the keys are
 * always under the thumb no matter how far down the scorer has read.
 */
const RUNS = [0, 1, 2, 3, 4, 5, 6] as const;

function Pad({
  state,
  crease,
  availableBatsmen,
  availableBowlers,
  ready,
  isSaving,
  extraType,
  byeLike,
  canUndo,
  localError,
  saveError,
  queueItems,
  isOnline,
  onOverride,
  onExtra,
  onRuns,
  onWicket,
  onUndo,
  onRetryQueue,
}: {
  state: MatchState;
  crease: Crease;
  availableBatsmen: PlayerRef[];
  availableBowlers: PlayerRef[];
  ready: boolean;
  isSaving: boolean;
  extraType: ExtraType | null;
  byeLike: boolean;
  canUndo: boolean;
  localError: string | null;
  saveError: unknown;
  queueItems: ConsoleProps['queueItems'];
  isOnline: boolean;
  onOverride: (next: Partial<Crease>) => void;
  onExtra: (value: ExtraType) => void;
  onRuns: (runs: number) => void;
  onWicket: () => void;
  onUndo: () => void;
  onRetryQueue: () => Promise<void>;
}) {
  const legal = state.thisOver.filter((ball) => ball.isLegalDelivery).length;
  const failedInQueue = queueItems.some((item) => item.status === 'failed');
  const notice = padNotice({ localError, saveError, isOnline, failedInQueue, queueItems });

  return (
    <div className="pad sticky bottom-0 z-20 flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <p className="eyebrow pad-label shrink-0">Over {state.currentOverNumber + 1}</p>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {state.thisOver.length === 0 ? (
              <span className="pad-label text-[0.8125rem]">first ball</span>
            ) : (
              state.thisOver.map((ball, index) => (
                <span
                  key={ball.seq}
                  className="chip-land"
                  style={{ '--i': index } as React.CSSProperties}
                >
                  <PadChip display={ball.display} isWicket={ball.isWicket} />
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="mono pad-label hidden text-[0.6875rem] sm:block">{legal} of 6</span>
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="pad-key h-9 px-3 text-[0.8125rem] font-medium"
          >
            <UndoIcon />
            Undo
          </button>
        </div>
      </div>

      {crease.striker === null || crease.nonStriker === null ? (
        <PickerRow
          label={state.legalBalls === 0 && !state.needsNewBatsman ? 'Openers' : 'New batter'}
          players={availableBatsmen}
          onPick={(playerId) =>
            onOverride(crease.striker === null ? { striker: playerId } : { nonStriker: playerId })
          }
        />
      ) : null}

      {crease.bowler === null ? (
        <PickerRow
          label={state.legalBalls === 0 ? 'Opening bowler' : 'Next bowler'}
          players={availableBowlers}
          onPick={(playerId) => onOverride({ bowler: playerId })}
        />
      ) : null}

      <div className="grid grid-cols-4 gap-2">
        {EXTRAS.map((option) => (
          <button
            key={option.value}
            type="button"
            data-armed={extraType === option.value}
            onClick={() => onExtra(option.value)}
            className="pad-key h-11 text-[0.8125rem] font-medium"
          >
            <span aria-hidden className="key-legend uppercase">
              {option.key}
            </span>
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {RUNS.map((runs) => (
          <button
            key={runs}
            type="button"
            disabled={!ready || isSaving || (byeLike && runs === 0)}
            onClick={() => onRuns(runs)}
            data-tone={runs === 4 || runs === 6 ? 'boundary' : undefined}
            className="pad-key h-[3.5rem] text-[1.625rem] font-semibold sm:h-[4rem]"
          >
            {runs}
          </button>
        ))}

        <button
          type="button"
          disabled={!ready || isSaving}
          onClick={onWicket}
          data-tone="wicket"
          className="pad-key col-span-4 h-12 text-[0.9375rem] font-bold tracking-[0.16em] uppercase sm:col-span-7"
        >
          <span aria-hidden className="key-legend">
            W
          </span>
          Wicket
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <p
          role={notice.alert ? 'alert' : undefined}
          className={cn('text-[0.8125rem]', notice.alert ? 'text-[var(--pad-live)]' : 'pad-label')}
        >
          {notice.message}
        </p>

        <div className="flex items-center gap-4">
          {failedInQueue ? (
            <button
              type="button"
              onClick={() => void onRetryQueue()}
              className="pad-key h-8 px-3 text-[0.75rem] font-medium"
            >
              Retry queue
            </button>
          ) : null}
          <p className="mono pad-label hidden text-[0.625rem] lg:block">
            0–6 · W wicket · D wide · N no ball · B bye · L leg bye · ⌫ undo
          </p>
        </div>
      </div>
    </div>
  );
}

function padNotice({
  localError,
  saveError,
  isOnline,
  failedInQueue,
  queueItems,
}: {
  localError: string | null;
  saveError: unknown;
  isOnline: boolean;
  failedInQueue: boolean;
  queueItems: ConsoleProps['queueItems'];
}): { message: string; alert: boolean } {
  if (localError) return { message: localError, alert: true };
  if (failedInQueue) return { message: 'A delivery needs a retry.', alert: true };
  if (saveError) {
    const message = saveError instanceof Error ? saveError.message : 'That ball did not save.';
    return { message, alert: true };
  }
  if (!isOnline) {
    return { message: 'Offline. Deliveries are stored on this device.', alert: false };
  }
  if (queueItems.length > 0) return { message: 'Syncing deliveries…', alert: false };
  return { message: 'Tap the runs off the bat.', alert: false };
}

/** The over inside the pad, in the pad's own palette rather than the page's. */
function PadChip({ display, isWicket }: { display: string; isWicket?: boolean }) {
  const wicket = isWicket || display.includes('W');
  const boundary = display === '4' || display === '6';
  const extra = /[a-z]/.test(display) && !wicket;

  return (
    <span
      className={cn(
        'mono grid size-8 shrink-0 place-items-center rounded-full border text-[0.75rem]',
        wicket
          ? 'border-[var(--pad-live)] bg-[var(--pad-live)] text-[#2b0d09]'
          : boundary
            ? 'border-[var(--pad-accent)] bg-[var(--pad-accent-soft)] text-[var(--pad-accent)]'
            : extra
              ? 'border-dashed border-[var(--pad-line)] text-[var(--pad-ink-soft)]'
              : 'border-[var(--pad-line)] text-[var(--pad-ink-soft)]',
      )}
    >
      {display === '0' ? '·' : display}
    </span>
  );
}

function PickerRow({
  label,
  players,
  onPick,
}: {
  label: string;
  players: PlayerRef[];
  onPick: (playerId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-dashed border-[var(--pad-line)] p-3.5">
      <p className="eyebrow" style={{ color: 'var(--pad-accent)' }}>
        {label}
      </p>

      {players.length === 0 ? (
        <p className="pad-label text-sm">Nobody is available.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onPick(player.id)}
              className="pad-key h-10 px-3.5 text-[0.8125rem] font-medium"
            >
              {player.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Below the pad ───────────────────────────────────────────────────────── */

function InningsNumbers({
  state,
  context,
  par,
}: {
  state: MatchState;
  context: InningsContext;
  par: DlsParPosition | null;
}) {
  const quota = quotaBalls(context);
  const ballsLeft = Math.max(0, quota - state.legalBalls);
  const crr = state.legalBalls > 0 ? (state.runs * 6) / state.legalBalls : 0;
  const needed = context.targetRuns !== null ? context.targetRuns - state.runs : null;
  const rrr = needed !== null && ballsLeft > 0 ? (needed * 6) / ballsLeft : null;
  const partnership = state.partnerships.find((entry) => entry.isCurrent);
  const { extras } = state;

  return (
    <StatLine
      items={[
        { label: 'Run rate', value: crr.toFixed(2) },
        ...(rrr !== null
          ? [{ label: 'Required', value: rrr.toFixed(2), tone: 'live' as const }]
          : []),
        ...(partnership
          ? [{ label: 'Partnership', value: `${partnership.runs} (${partnership.balls})` }]
          : []),
        {
          label: 'Extras',
          value: `${extras.total} · w${extras.wides} nb${extras.noBalls} b${extras.byes} lb${extras.legByes}`,
        },
        ...(par
          ? [
              {
                label: 'DLS par',
                value: `${par.parScore} · ${
                  par.difference === 0
                    ? 'level'
                    : par.difference > 0
                      ? `${par.difference} ahead`
                      : `${Math.abs(par.difference)} behind`
                }`,
                tone: 'accent' as const,
              },
            ]
          : []),
      ]}
      note={`${ballsLeft} balls left`}
    />
  );
}

function Momentum({ state }: { state: MatchState }) {
  const window = recentWindow(state.recentBalls);

  return (
    <Panel
      title="Momentum"
      icon={<TrendIcon />}
      meta={<span className="mono text-[0.6875rem] text-muted">runs per over</span>}
      bodyClassName="flex flex-col gap-5 p-5"
    >
      <RunsPerOver balls={state.recentBalls} />

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        <LeaderRow
          label={`Last ${window.balls} balls`}
          value={`${window.runs} runs · ${window.wickets}w`}
          emphasis
        />
        <LeaderRow
          label="Dot balls"
          value={window.balls > 0 ? `${Math.round((window.dots / window.balls) * 100)}%` : '—'}
        />
        <LeaderRow label="Boundaries" value={`${window.fours}×4 · ${window.sixes}×6`} />
      </div>
    </Panel>
  );
}

function WicketsCard({ state }: { state: MatchState }) {
  return (
    <Panel title="Fall of wickets" icon={<StumpsIcon />} bodyClassName="flex flex-col gap-2.5 p-5">
      {state.fallOfWickets.length === 0 ? (
        <p className="text-sm text-muted">No wickets down.</p>
      ) : (
        state.fallOfWickets
          .slice()
          .reverse()
          .map((wicket) => (
            <LeaderRow
              key={wicket.wicket}
              label={`${wicket.wicket}. ${wicket.name}`}
              value={`${wicket.teamRuns} (${wicket.overs})`}
            />
          ))
      )}
    </Panel>
  );
}

function EventsCard({ state }: { state: MatchState }) {
  const events = useMemo(() => state.recentBalls.slice(-8).reverse(), [state.recentBalls]);

  return (
    <Panel title="Deliveries" icon={<ClockIcon />} bodyClassName="p-0">
      {events.length === 0 ? (
        <p className="p-5 text-sm text-muted">Nothing bowled yet.</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((ball) => (
            <li
              key={ball.seq}
              className="flex items-center gap-3.5 border-b border-line px-5 py-3 last:border-b-0"
            >
              <BallChip display={ball.display} isWicket={ball.isWicket} />
              <span className="mono w-10 shrink-0 text-[0.6875rem] text-muted">
                {ball.overNumber}.{ball.ballNumber}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  ball.isWicket ? 'text-live' : 'text-secondary',
                )}
              >
                {eventLabel(ball)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

interface BallWindow {
  balls: number;
  runs: number;
  dots: number;
  fours: number;
  sixes: number;
  wickets: number;
}

function recentWindow(recentBalls: ReadonlyArray<BallSummary>): BallWindow {
  return recentBalls.reduce<BallWindow>(
    (totals, ball) => ({
      balls: totals.balls + (ball.isLegalDelivery ? 1 : 0),
      runs: totals.runs + ball.runs,
      dots: totals.dots + (ball.isLegalDelivery && ball.runs === 0 ? 1 : 0),
      fours: totals.fours + (!ball.extraType && ball.runs === 4 ? 1 : 0),
      sixes: totals.sixes + (!ball.extraType && ball.runs === 6 ? 1 : 0),
      wickets: totals.wickets + (ball.isWicket ? 1 : 0),
    }),
    { balls: 0, runs: 0, dots: 0, fours: 0, sixes: 0, wickets: 0 },
  );
}

function eventLabel(ball: BallSummary): string {
  if (ball.isWicket) return 'Wicket';
  switch (ball.extraType) {
    case 'WIDE':
      return ball.runs > 1 ? `Wide, ${ball.runs}` : 'Wide';
    case 'NO_BALL':
      return ball.runs > 1 ? `No ball, ${ball.runs}` : 'No ball';
    case 'BYE':
      return `${ball.runs} bye${ball.runs === 1 ? '' : 's'}`;
    case 'LEG_BYE':
      return `${ball.runs} leg bye${ball.runs === 1 ? '' : 's'}`;
    default:
      break;
  }
  if (ball.runs === 0) return 'Dot ball';
  if (ball.runs === 4) return 'Four';
  if (ball.runs === 6) return 'Six';
  return `${ball.runs} run${ball.runs === 1 ? '' : 's'}`;
}

/* ── The wicket ──────────────────────────────────────────────────────────── */

function allowedWicketTypes(extraType: ExtraType | null): readonly WicketType[] {
  if (extraType === 'WIDE') return ['RUN_OUT', 'STUMPED', 'OBSTRUCTING_FIELD'];
  if (extraType === 'NO_BALL') return ['RUN_OUT', 'OBSTRUCTING_FIELD'];
  return WICKET_TYPES;
}

const NEEDS_FIELDER: readonly WicketType[] = ['CAUGHT', 'RUN_OUT', 'STUMPED'];

function ChoiceKey({
  selected,
  onClick,
  className,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-armed={selected}
      onClick={onClick}
      className={cn('console-key h-10 px-4 text-[0.8125rem] font-medium', className)}
    >
      {children}
    </button>
  );
}

function WicketSheet({
  open,
  state,
  context,
  crease,
  extraType,
  isSaving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  state: MatchState;
  context: InningsContext;
  crease: Crease;
  extraType: ExtraType | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (ball: {
    runsOffBat: number;
    extraRuns: number;
    extraType: ExtraType | null;
    isWicket: boolean;
    wicketType: WicketType;
    dismissedPlayerId: string;
    fielderId: string | null;
  }) => Promise<void>;
}) {
  const types = allowedWicketTypes(extraType);

  const [wicketType, setWicketType] = useState<WicketType>(types[0]!);
  const [dismissedId, setDismissedId] = useState(crease.striker ?? '');
  const [fielderId, setFielderId] = useState<string>('');
  const [runs, setRuns] = useState(0);

  const needsFielder = NEEDS_FIELDER.includes(wicketType);
  const batters = [crease.striker, crease.nonStriker].filter((id): id is string => Boolean(id));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title="How was the wicket taken?"
      description={
        extraType
          ? `Off a ${extraType.replace('_', ' ').toLowerCase()}, so only some dismissals are possible.`
          : undefined
      }
      footer={
        <>
          <Button
            variant="danger"
            isLoading={isSaving}
            disabled={!dismissedId || (needsFielder && !fielderId)}
            onClick={() =>
              void onSubmit({
                runsOffBat: extraType === null || extraType === 'NO_BALL' ? runs : 0,
                extraRuns:
                  extraType === 'WIDE'
                    ? runs + 1
                    : extraType === 'NO_BALL'
                      ? 1
                      : extraType === null
                        ? 0
                        : runs,
                extraType,
                isWicket: true,
                wicketType,
                dismissedPlayerId: dismissedId,
                fielderId: needsFielder ? fielderId : null,
              })
            }
          >
            Record the wicket
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-3">
          <p className="eyebrow">Dismissal</p>
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <ChoiceKey
                key={type}
                selected={wicketType === type}
                onClick={() => setWicketType(type)}
              >
                {type.replace(/_/g, ' ').toLowerCase()}
              </ChoiceKey>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="eyebrow">Who is out</p>
          <div className="flex flex-wrap gap-2">
            {batters.map((id) => (
              <ChoiceKey key={id} selected={dismissedId === id} onClick={() => setDismissedId(id)}>
                {state.batsmen[id]?.name ??
                  context.battingXI.find((player) => player.id === id)?.name}
              </ChoiceKey>
            ))}
          </div>
        </div>

        {needsFielder ? (
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Fielder{wicketType === 'STUMPED' ? ' — the keeper' : ''}</p>
            <div className="flex flex-wrap gap-2">
              {context.bowlingXI.map((player) => (
                <ChoiceKey
                  key={player.id}
                  selected={fielderId === player.id}
                  onClick={() => setFielderId(player.id)}
                >
                  {player.name}
                </ChoiceKey>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <p className="eyebrow">Runs completed before the dismissal</p>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((value) => (
              <ChoiceKey
                key={value}
                selected={runs === value}
                onClick={() => setRuns(value)}
                className="mono size-11 px-0 text-lg"
              >
                {value}
              </ChoiceKey>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
