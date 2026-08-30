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
import {
  BallIcon,
  ClockIcon,
  StumpsIcon,
  TrendIcon,
  TrophyIcon,
  UndoIcon,
} from '@/components/ui/Icons';
import { PdfButton } from '@/components/ui/PdfButton';
import {
  BallChip,
  LeaderRow,
  Panel,
  RunsPerOver,
  Scoreboard,
  type Readout,
} from '@/components/ui/Score';
import { Sheet } from '@/components/ui/Sheet';
import { ShareLink } from '@/components/ui/ShareLink';
import { Table, Td, Th } from '@/components/ui/Table';
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
          {state && context ? (
            <Board state={state} context={context} par={dls.data?.par ?? null} />
          ) : null}

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
    <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
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
        par={par}
        status={
          <SyncStatus
            isSaving={isSaving}
            isOnline={isOnline}
            syncState={syncState}
            hasQueuedBalls={queueItems.length > 0}
          />
        }
      />

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
        onOverride={(next) => setOverride((current) => ({ ...current, ...next }))}
        onExtra={(value) => setExtraType((current) => (current === value ? null : value))}
        onRuns={(runs) => void handleRuns(runs)}
        onWicket={() => setWicketOpen(true)}
        onUndo={() => void onUndo()}
      />

      {localError ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--alert)] bg-alert-soft px-4 py-3.5 text-sm text-primary"
        >
          {localError}
        </p>
      ) : null}
      {saveError ? <ErrorText error={saveError} /> : null}

      <QueueBanner
        queueItems={queueItems}
        isOnline={isOnline}
        syncState={syncState}
        onRetryQueue={onRetryQueue}
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <CreaseCard
          state={displayState}
          context={context}
          crease={crease}
          onSwap={() => setOverride({ striker: crease.nonStriker, nonStriker: crease.striker })}
          onChangeBowler={() => setOverride((current) => ({ ...current, bowler: null }))}
        />
        <Momentum state={displayState} context={context} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <InningsCard state={displayState} par={par} />
        <EventsCard state={displayState} />
      </div>

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

/* ── The board ───────────────────────────────────────────────────────────── */

function Board({
  state,
  context,
  par,
  status,
}: {
  state: MatchState;
  context: InningsContext;
  par: DlsParPosition | null;
  status?: React.ReactNode;
}) {
  const quota = quotaBalls(context);
  const ballsLeft = Math.max(0, quota - state.legalBalls);
  const crr = state.legalBalls > 0 ? (state.runs * 6) / state.legalBalls : 0;
  const needed = context.targetRuns !== null ? context.targetRuns - state.runs : null;
  const rrr = needed !== null && ballsLeft > 0 ? (needed * 6) / ballsLeft : null;

  const readouts: Readout[] = [
    { label: 'Run rate', value: crr.toFixed(2) },
    needed !== null && needed > 0
      ? { label: 'Need', value: needed, tone: 'live' as const }
      : { label: 'Extras', value: state.extras.total },
    rrr !== null
      ? {
          label: 'Req. rate',
          value: rrr.toFixed(2),
          tone: rrr > crr ? ('live' as const) : ('accent' as const),
        }
      : { label: 'Wickets left', value: Math.max(0, 10 - state.wickets) },
    par
      ? { label: 'DLS par', value: par.parScore, tone: 'accent' as const }
      : { label: 'Balls left', value: ballsLeft },
  ];

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
      readouts={readouts}
    >
      {needed !== null && needed > 0 && context.targetRuns ? (
        <div className="px-5 py-5 sm:px-7">
          <div className="chase-track">
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
  onOverride,
  onExtra,
  onRuns,
  onWicket,
  onUndo,
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
  onOverride: (next: Partial<Crease>) => void;
  onExtra: (value: ExtraType) => void;
  onRuns: (runs: number) => void;
  onWicket: () => void;
  onUndo: () => void;
}) {
  const legal = state.thisOver.filter((ball) => ball.isLegalDelivery).length;

  return (
    <Panel
      title={`Over ${state.currentOverNumber + 1}`}
      icon={<ClockIcon />}
      meta={
        <div className="flex items-center gap-3">
          <span className="mono text-[0.6875rem] text-muted">{legal} of 6</span>
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="console-key key-row h-9 gap-1.5 px-3 text-[0.8125rem] font-medium"
          >
            <UndoIcon />
            Undo
          </button>
        </div>
      }
      bodyClassName="flex flex-col gap-5 p-5"
    >
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {state.thisOver.length === 0 ? (
          <p className="text-sm text-muted">No balls bowled yet this over.</p>
        ) : (
          state.thisOver.map((ball) => (
            <span key={ball.seq} className="ball-land">
              <BallChip display={ball.display} isWicket={ball.isWicket} />
            </span>
          ))
        )}
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

      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-4 gap-2.5">
          {EXTRAS.map((option) => (
            <button
              key={option.value}
              type="button"
              data-armed={extraType === option.value}
              onClick={() => onExtra(option.value)}
              className="console-key relative h-12 text-[0.8125rem] font-medium"
            >
              <span aria-hidden className="key-legend uppercase">
                {option.key}
              </span>
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
          {RUNS.map((runs) => (
            <button
              key={runs}
              type="button"
              disabled={!ready || isSaving || (byeLike && runs === 0)}
              onClick={() => onRuns(runs)}
              data-tone={runs === 4 || runs === 6 ? 'boundary' : undefined}
              className="console-key tabular h-[4.25rem] text-[1.75rem] font-medium"
            >
              {runs}
            </button>
          ))}

          <button
            type="button"
            disabled={!ready || isSaving}
            onClick={onWicket}
            data-tone="wicket"
            className="console-key relative col-span-4 h-14 text-[0.9375rem] font-semibold tracking-[0.14em] uppercase sm:col-span-7"
          >
            <span aria-hidden className="key-legend">
              W
            </span>
            Wicket
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-[0.8125rem] text-muted">
          {!ready
            ? 'Name both batters and the bowler to start scoring.'
            : extraType
              ? `The next tap is scored as a ${extraType.replace('_', ' ').toLowerCase()}.`
              : 'Tap the runs off the bat.'}
        </p>
        <p className="mono hidden text-[0.625rem] text-muted lg:block">
          0–6 · W wicket · D wide · N no ball · B bye · L leg bye · ⌫ undo
        </p>
      </div>
    </Panel>
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
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-dashed border-line-strong p-4">
      <p data-tone="accent" className="eyebrow">
        {label}
      </p>

      {players.length === 0 ? (
        <p className="text-sm text-muted">Nobody is available.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onPick(player.id)}
              className="console-key h-10 px-4 text-[0.8125rem] font-medium"
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

function CreaseCard({
  state,
  context,
  crease,
  onSwap,
  onChangeBowler,
}: {
  state: MatchState;
  context: InningsContext;
  crease: Crease;
  onSwap: () => void;
  onChangeBowler: () => void;
}) {
  const bowler = crease.bowler ? state.bowlers[crease.bowler] : null;
  const batters = [crease.striker, crease.nonStriker].filter((id): id is string => Boolean(id));

  const nameOf = (playerId: string, side: 'bat' | 'bowl') =>
    (side === 'bat' ? state.batsmen[playerId]?.name : state.bowlers[playerId]?.name) ??
    (side === 'bat' ? context.battingXI : context.bowlingXI).find(
      (player) => player.id === playerId,
    )?.name ??
    'Player';

  return (
    <Panel
      title="At the crease"
      icon={<BallIcon />}
      meta={
        batters.length === 2 ? (
          <button
            type="button"
            onClick={onSwap}
            className="text-[0.8125rem] text-muted transition-colors hover:text-primary"
          >
            Swap
          </button>
        ) : null
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table density="compact" className="min-w-[18rem]">
          <thead>
            <tr className="border-b border-line">
              <Th align="left" className="pl-5">
                Batter
              </Th>
              <Th align="right">R</Th>
              <Th align="right">B</Th>
              <Th align="right">4s</Th>
              <Th align="right" className="pr-5 sm:pr-3">
                6s
              </Th>
              <Th align="right" className="hidden pr-5 sm:table-cell">
                SR
              </Th>
            </tr>
          </thead>
          <tbody>
            {batters.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-5 text-sm text-muted">
                  Nobody at the crease yet.
                </td>
              </tr>
            ) : (
              batters.map((playerId) => {
                const batsman = state.batsmen[playerId];
                const runs = batsman?.runs ?? 0;
                const balls = batsman?.balls ?? 0;
                const onStrike = playerId === crease.striker;

                return (
                  <tr key={playerId} className="border-b border-line last:border-b-0">
                    <td className="py-3 pl-5">
                      <span
                        className={cn(
                          'flex items-center gap-2 text-sm',
                          onStrike ? 'font-medium text-primary' : 'text-secondary',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'size-1.5 rounded-full',
                            onStrike ? 'bg-accent' : 'bg-transparent',
                          )}
                        />
                        {nameOf(playerId, 'bat')}
                      </span>
                    </td>
                    <Td align="right" emphasis>
                      {runs}
                    </Td>
                    <Td align="right">{balls}</Td>
                    <Td align="right">{batsman?.fours ?? 0}</Td>
                    <Td align="right" className="pr-5 sm:pr-3">
                      {batsman?.sixes ?? 0}
                    </Td>
                    <Td align="right" className="hidden pr-5 sm:table-cell">
                      {balls > 0 ? ((runs / balls) * 100).toFixed(1) : '—'}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </div>

      <div className="dot-rule mx-5" />

      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">Bowling</p>
          <p className="mt-2 truncate text-sm font-medium text-primary">
            {crease.bowler ? nameOf(crease.bowler, 'bowl') : 'Not named'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <p className="mono text-sm text-secondary">
            {bowler
              ? `${formatOvers(bowler.balls)}–${bowler.maidens}–${bowler.runs}–${bowler.wickets}`
              : '0.0–0–0–0'}
          </p>
          {crease.bowler ? (
            <button
              type="button"
              onClick={onChangeBowler}
              className="text-[0.8125rem] text-muted transition-colors hover:text-primary"
            >
              Change
            </button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function Momentum({ state, context }: { state: MatchState; context: InningsContext }) {
  const window = recentWindow(state.recentBalls);
  const crr = state.legalBalls > 0 ? (state.runs * 6) / state.legalBalls : 0;
  const partnership = state.partnerships.find((entry) => entry.isCurrent);
  const quota = quotaBalls(context);

  return (
    <Panel
      title="Momentum"
      icon={<TrendIcon />}
      meta={<span className="mono text-[0.6875rem] text-muted">runs per over</span>}
      bodyClassName="flex flex-col gap-5 p-5"
    >
      <RunsPerOver balls={state.recentBalls} />

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        <LeaderRow label="Run rate" value={crr.toFixed(2)} emphasis />
        <LeaderRow
          label={`Last ${window.balls} balls`}
          value={`${window.runs} runs · ${window.wickets}w`}
        />
        <LeaderRow
          label="Dot balls"
          value={window.balls > 0 ? `${Math.round((window.dots / window.balls) * 100)}%` : '—'}
        />
        <LeaderRow label="Boundaries" value={`${window.fours}×4 · ${window.sixes}×6`} />
        {partnership ? (
          <LeaderRow label="Partnership" value={`${partnership.runs} (${partnership.balls})`} />
        ) : null}
        <LeaderRow label="Balls left" value={Math.max(0, quota - state.legalBalls)} />
      </div>
    </Panel>
  );
}

function InningsCard({ state, par }: { state: MatchState; par: DlsParPosition | null }) {
  return (
    <Panel title="Innings" icon={<StumpsIcon />} bodyClassName="flex flex-col gap-5 p-5">
      <dl className="grid grid-cols-5 gap-2 text-center">
        <Figure label="Wd" value={state.extras.wides} />
        <Figure label="Nb" value={state.extras.noBalls} />
        <Figure label="B" value={state.extras.byes} />
        <Figure label="Lb" value={state.extras.legByes} />
        <Figure label="Extras" value={state.extras.total} emphasis />
      </dl>

      {par ? (
        <p className="mono border-t border-line pt-4 text-[0.8125rem] text-accent">
          DLS par {par.parScore} ·{' '}
          {par.difference === 0
            ? 'level'
            : par.difference > 0
              ? `${par.difference} ahead`
              : `${Math.abs(par.difference)} behind`}
        </p>
      ) : null}

      {state.fallOfWickets.length > 0 ? (
        <div className="flex flex-col gap-2.5 border-t border-line pt-4">
          <p className="eyebrow">Fall of wickets</p>
          {state.fallOfWickets
            .slice()
            .reverse()
            .map((wicket) => (
              <LeaderRow
                key={wicket.wicket}
                label={`${wicket.wicket}. ${wicket.name}`}
                value={`${wicket.teamRuns} (${wicket.overs})`}
              />
            ))}
        </div>
      ) : null}
    </Panel>
  );
}

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dd className={cn('mono text-lg font-medium', emphasis ? 'text-primary' : 'text-secondary')}>
        {value}
      </dd>
      <dt className="eyebrow mt-1.5">{label}</dt>
    </div>
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

function QueueBanner({
  queueItems,
  isOnline,
  syncState,
  onRetryQueue,
}: {
  queueItems: ConsoleProps['queueItems'];
  isOnline: boolean;
  syncState: ConsoleProps['syncState'];
  onRetryQueue: () => Promise<void>;
}) {
  if (queueItems.length === 0) return null;

  const failed = queueItems.some((item) => item.status === 'failed');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-raised px-4 py-3">
      <p className="text-[0.8125rem] text-secondary">
        {!isOnline ? 'Offline. Deliveries are safely stored on this device.' : null}
        {isOnline && syncState !== 'failed' ? 'Syncing deliveries…' : null}
        {failed ? ' A delivery needs a retry.' : null}
      </p>
      {failed ? (
        <Button variant="secondary" size="sm" onClick={() => void onRetryQueue()}>
          Retry queue
        </Button>
      ) : null}
    </div>
  );
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
