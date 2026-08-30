import { useCallback, useEffect, useState } from 'react';
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
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ChoiceChip } from '@/components/ui/Input';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { Pill, TeamMark } from '@/components/ui/Pill';
import { PdfButton } from '@/components/ui/PdfButton';
import { BallChip, LeaderRow, OversFigure, OverStrip, ScoreFigure } from '@/components/ui/Score';
import { Sheet } from '@/components/ui/Sheet';
import { ShareLink } from '@/components/ui/ShareLink';
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

  if (scorer.isPending) return <SkeletonCard rows={6} />;
  if (scorer.error) return <ErrorText error={scorer.error} />;
  if (!scorer.data) return null;

  const { match, state, context, innings, previousOverBowlerId } = scorer.data;

  const dlsApplied = dls.data?.applied ?? false;
  const matchClosed = match.status === 'COMPLETED' || match.status === 'ABANDONED';

  const header = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <BackLink to={`/matches/${matchId}`}>Back to match</BackLink>
          <p className="serif mt-3 truncate text-[1.75rem] text-primary sm:text-[2.25rem]">
            {match.team1?.name ?? 'TBD'} <span className="text-muted">v</span>{' '}
            {match.team2?.name ?? 'TBD'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {dlsApplied ? <Pill tone="warning">DLS</Pill> : null}
          <Pill tone="accent">Scoring console</Pill>

          {matchClosed ? null : (
            <button
              type="button"
              onClick={() => setDlsOpen(true)}
              className="text-[0.6875rem] tracking-[0.08em] text-muted uppercase transition-colors hover:text-primary"
            >
              {dlsApplied ? 'Rain' : 'DLS'}
            </button>
          )}

          <ShareLink
            slug={match.publicSlug}
            variant="quiet"
            matchLabel={`${match.team1?.shortName ?? 'TBD'} v ${match.team2?.shortName ?? 'TBD'}`}
          />
        </div>
      </div>
      <div className="rule" />

      <DlsSheet
        open={dlsOpen}
        onClose={() => setDlsOpen(false)}
        matchId={matchId}
        state={state}
        context={context}
        inningsNumber={innings?.number ?? 1}
      />
    </div>
  );

  if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Card>
          <CardBody className="py-16 text-center">
            <p className="eyebrow">Match closed</p>
            <p className="serif mt-4 text-3xl text-primary">
              {match.resultText ?? 'This match is over'}
            </p>
            <p className="mt-3 text-secondary">There is nothing left to score.</p>
            <PdfButton
              label="Share PDF"
              arrow
              size="md"
              build={() =>
                import('@/lib/pdf').then((pdf) => pdf.buildCricketMatchPdf(match.publicSlug))
              }
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (match.status === 'INNINGS_BREAK' || (state?.isComplete && innings)) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        {state && context ? (
          <ScorePanel state={state} context={context} par={dls.data?.par ?? null} />
        ) : null}

        <Card>
          <CardBody className="flex flex-col items-center gap-5 py-14 text-center">
            <p className="eyebrow">
              {match.status === 'INNINGS_BREAK' ? 'Innings break' : 'Innings complete'}
            </p>
            <p className="serif text-3xl text-primary">
              {innings?.targetRuns
                ? `Chasing ${innings.targetRuns}`
                : 'The chase is set up and ready'}
            </p>

            {match.status === 'INNINGS_BREAK' && innings ? (
              <Button
                size="lg"
                isLoading={resume.isPending}
                onClick={() => resume.mutate(innings.number)}
              >
                Start innings {innings.number}
              </Button>
            ) : null}

            {resume.error ? <ErrorText error={resume.error} /> : null}
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!state || !context) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Card>
          <CardBody className="flex flex-col items-center gap-5 py-16 text-center">
            <p className="eyebrow">Not started</p>
            <p className="serif text-3xl text-primary">This match has not started yet</p>
            <p className="max-w-md text-secondary">
              Record the toss, name both XIs, then start the match.
            </p>
            <Link to={`/matches/${matchId}`}>
              <Button>Go to match setup</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const optimistic = foldQueuedBalls(state, context, previousOverBowlerId, queue.items);

  return (
    <div className="flex flex-col gap-8">
      {header}
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
    </div>
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

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)_17rem]">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <ScorePanel
          state={displayState}
          context={context}
          isSaving={isSaving}
          par={par}
          isOnline={isOnline}
          syncState={syncState}
          hasQueuedBalls={queueItems.length > 0}
        />
        <CreaseCard
          state={displayState}
          context={context}
          crease={crease}
          availableBatsmen={availableBatsmen}
          availableBowlers={availableBowlers}
          onOverride={(next) => setOverride((current) => ({ ...current, ...next }))}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardBody className="flex flex-col gap-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <p className="eyebrow">This over</p>
              <p className="mono text-[0.6875rem] text-muted">
                over {displayState.currentOverNumber + 1}
              </p>
            </div>
            <OverStrip
              balls={displayState.thisOver.map((ball) => ({
                key: ball.seq,
                display: ball.display,
                isWicket: ball.isWicket,
              }))}
              emptyLabel="No balls bowled yet this over"
            />
          </CardBody>
        </Card>

        {localError ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-[var(--alert)] bg-alert-soft px-4 py-3.5 text-sm text-primary"
          >
            {localError}
          </p>
        ) : null}
        {saveError ? <ErrorText error={saveError} /> : null}
        {queueItems.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-sunken px-4 py-3">
            <p className="text-[0.8125rem] text-secondary">
              {!isOnline ? 'Offline — deliveries are safely stored on this device.' : null}
              {isOnline && queueItems.some((item) => item.status === 'pending')
                ? 'Syncing deliveries…'
                : null}
              {queueItems.some((item) => item.status === 'failed')
                ? ' A delivery needs a retry.'
                : null}
            </p>
            {queueItems.some((item) => item.status === 'failed') ? (
              <Button variant="quiet" size="sm" onClick={() => void onRetryQueue()}>
                Retry queue
              </Button>
            ) : null}
          </div>
        ) : syncState === 'synced' ? (
          <p className="rounded-[var(--radius-md)] border border-success/30 bg-success/10 px-4 py-3 text-[0.8125rem] text-success">
            All deliveries synced.
          </p>
        ) : null}

        <div
          className={cn(
            'score-pad sticky bottom-0 z-10 -mx-5 border-t border-line px-5 pt-5 sm:-mx-8 sm:px-8',
            'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
            'lg:static lg:mx-0 lg:rounded-[var(--radius-lg)] lg:border lg:p-7 lg:pb-7',
          )}
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-accent">Scoring pad</p>
                <p className="mt-1 text-sm text-secondary">Record the next delivery</p>
              </div>
              <span className="mono text-[0.6875rem] text-muted">0–6 runs</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {EXTRAS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  selected={extraType === option.value}
                  onClick={() =>
                    setExtraType((current) => (current === option.value ? null : option.value))
                  }
                  className="h-11 px-0 text-[0.8125rem]"
                >
                  {option.label}
                </ChoiceChip>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
                <button
                  key={runs}
                  type="button"
                  disabled={!ready || isSaving || (byeLike && runs === 0)}
                  onClick={() => void handleRuns(runs)}
                  className={cn(
                    'mono grid h-16 place-items-center rounded-[var(--radius-sm)] border text-xl',
                    'transition-[transform,border-color,background-color,opacity] duration-[var(--dur-fast)] ease-[var(--ease)]',
                    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30',
                    runs === 4 || runs === 6
                      ? 'border-[var(--accent-strong)] bg-accent-soft text-accent'
                      : 'border-line bg-raised text-primary hover:border-line-strong hover:bg-hover',
                  )}
                >
                  {runs}
                </button>
              ))}

              <button
                type="button"
                disabled={!ready || isSaving}
                onClick={() => setWicketOpen(true)}
                className={cn(
                  'col-span-4 grid h-16 place-items-center rounded-[var(--radius-sm)] sm:col-span-7',
                  'border border-[var(--live)] bg-live text-base font-medium tracking-[0.08em] text-white uppercase',
                  'transition-[transform,background-color,opacity] duration-[var(--dur-fast)] active:scale-[0.98]',
                  'disabled:pointer-events-none disabled:opacity-30',
                )}
              >
                Wicket
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
              <p className="text-[0.8125rem] text-muted">
                {!ready
                  ? 'Name both batters and the bowler to start scoring.'
                  : extraType
                    ? `The next tap is scored as a ${extraType.replace('_', ' ').toLowerCase()}.`
                    : 'Tap the runs off the bat.'}
              </p>

              <Button
                variant="secondary"
                size="sm"
                disabled={displayState.lastEventSeq === 0 || isSaving}
                onClick={() => void onUndo()}
              >
                Undo last ball
              </Button>
            </div>

            <p className="mono hidden text-[0.6875rem] text-muted lg:block">
              0–6 runs · W wicket · D wide · N no ball · B bye · L leg bye · ⌫ undo
            </p>
          </div>
        </div>
      </div>

      <div className="hidden xl:block xl:sticky xl:top-6">
        <OverLog state={displayState} />
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

function ScorePanel({
  state,
  context,
  isSaving = false,
  par = null,
  isOnline = true,
  syncState = 'idle',
  hasQueuedBalls = false,
}: {
  state: MatchState;
  context: InningsContext;
  isSaving?: boolean;
  par?: DlsParPosition | null;
  isOnline?: boolean;
  syncState?: 'idle' | 'syncing' | 'synced' | 'failed';
  hasQueuedBalls?: boolean;
}) {
  const quota = quotaBalls(context);
  const ballsRemaining = quota - state.legalBalls;
  const runsNeeded = context.targetRuns !== null ? context.targetRuns - state.runs : null;
  const runRate = state.legalBalls > 0 ? (state.runs * 6) / state.legalBalls : 0;

  return (
    <div className="score-panel overflow-hidden rounded-[var(--radius-lg)] bg-inverse">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line-inverse)] px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <TeamMark
            shortName={context.battingTeam.shortName}
            color={context.battingTeam.primaryColor}
            size="sm"
          />
          <p className="truncate text-[0.8125rem] text-on-inverse">{context.battingTeam.name}</p>
        </div>

        <SyncStatus
          isSaving={isSaving}
          isOnline={isOnline}
          syncState={syncState}
          hasQueuedBalls={hasQueuedBalls}
        />
      </div>

      <div className="px-6 py-7">
        <div className="flex items-start justify-between gap-5">
          <ScoreFigure runs={state.runs} wickets={state.wickets} size="xl" tone="inverse" />

          <div className="text-right">
            <OversFigure
              overs={formatOvers(state.legalBalls)}
              quotaLabel={formatOvers(quota)}
              tone="inverse"
            />
            <p className="eyebrow mt-2 text-muted-on-inverse">Overs</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--line-inverse)] pt-5">
          <p className="mono text-[0.8125rem] text-muted-on-inverse">RR {runRate.toFixed(2)}</p>
          <p className="mono text-[0.8125rem] text-muted-on-inverse">
            v {context.bowlingTeam.shortName}
          </p>
        </div>

        {runsNeeded !== null && runsNeeded > 0 ? (
          <p className="mt-5 rounded-[var(--radius-sm)] border border-[var(--accent)]/40 px-4 py-3 text-[0.9375rem] text-on-inverse">
            Need <span className="mono">{runsNeeded}</span> from{' '}
            <span className="mono">{ballsRemaining}</span> balls
          </p>
        ) : null}

        {par ? (
          <p className="mono mt-3 text-[0.8125rem] text-muted-on-inverse">
            DLS par <span className="text-on-inverse">{par.parScore}</span> ·{' '}
            {par.difference === 0
              ? 'level'
              : par.difference > 0
                ? `${par.difference} ahead`
                : `${Math.abs(par.difference)} behind`}
          </p>
        ) : null}
      </div>
    </div>
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
    ? 'Needs retry'
    : !isOnline
      ? 'Offline'
      : syncing
        ? 'Saving'
        : syncState === 'synced'
          ? 'Synced'
          : 'Ready';

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-[0.6875rem] tracking-[0.08em] uppercase',
        failed ? 'text-alert' : syncing ? 'text-accent' : 'text-muted-on-inverse',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          failed ? 'bg-alert' : syncing ? 'bg-accent' : 'bg-success',
        )}
      />
      {label}
    </span>
  );
}

function CreaseCard({
  state,
  context,
  crease,
  availableBatsmen,
  availableBowlers,
  onOverride,
}: {
  state: MatchState;
  context: InningsContext;
  crease: Crease;
  availableBatsmen: PlayerRef[];
  availableBowlers: PlayerRef[];
  onOverride: (next: Partial<Crease>) => void;
}) {
  const bowler = crease.bowler ? state.bowlers[crease.bowler] : null;
  const partnership = state.partnerships.find((entry) => entry.isCurrent);

  return (
    <Card>
      <CardBody className="flex flex-col gap-5 py-5">
        {crease.striker === null || crease.nonStriker === null ? (
          <PickerRow
            label={state.legalBalls === 0 && !state.needsNewBatsman ? 'Openers' : 'New batter'}
            players={availableBatsmen}
            onPick={(playerId) =>
              onOverride(crease.striker === null ? { striker: playerId } : { nonStriker: playerId })
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">At the crease</p>
              <button
                type="button"
                onClick={() =>
                  onOverride({ striker: crease.nonStriker, nonStriker: crease.striker })
                }
                className="text-[0.6875rem] tracking-[0.08em] text-muted uppercase transition-colors hover:text-primary"
              >
                Swap strike
              </button>
            </div>

            <BatterLine state={state} playerId={crease.striker} onStrike />
            <BatterLine state={state} playerId={crease.nonStriker} />

            {partnership ? (
              <p className="mono text-[0.6875rem] text-muted">
                partnership {partnership.runs} ({partnership.balls})
              </p>
            ) : null}
          </div>
        )}

        <div className="border-t border-line pt-5">
          {crease.bowler === null ? (
            <PickerRow
              label={state.legalBalls === 0 ? 'Opening bowler' : 'Next bowler'}
              players={availableBowlers}
              onPick={(playerId) => onOverride({ bowler: playerId })}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">Bowling</p>
                <button
                  type="button"
                  onClick={() => onOverride({ bowler: null })}
                  className="text-[0.6875rem] tracking-[0.08em] text-muted uppercase transition-colors hover:text-primary"
                >
                  Change
                </button>
              </div>

              <LeaderRow
                label={
                  bowler?.name ??
                  context.bowlingXI.find((player) => player.id === crease.bowler)?.name ??
                  'Bowler'
                }
                value={
                  bowler
                    ? `${formatOvers(bowler.balls)}–${bowler.maidens}–${bowler.runs}–${bowler.wickets}`
                    : '—'
                }
                emphasis
              />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function BatterLine({
  state,
  playerId,
  onStrike = false,
}: {
  state: MatchState;
  playerId: string;
  onStrike?: boolean;
}) {
  const batsman = state.batsmen[playerId];

  return (
    <LeaderRow
      label={
        <span className="flex items-center gap-1.5">
          {batsman?.name ?? 'Batter'}
          {onStrike ? (
            <span aria-label="on strike" className="text-accent">
              ✳
            </span>
          ) : null}
        </span>
      }
      value={`${batsman?.runs ?? 0} (${batsman?.balls ?? 0})`}
      emphasis={onStrike}
    />
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
    <div className="flex flex-col gap-3">
      <p className="eyebrow text-accent">{label}</p>

      {players.length === 0 ? (
        <p className="text-sm text-muted">Nobody is available.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onPick(player.id)}
              className="h-10 rounded-[var(--radius-sm)] border border-line px-3.5 text-[0.8125rem] text-primary transition-colors hover:border-[var(--accent-line)] hover:bg-accent-soft"
            >
              {player.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OverLog({ state }: { state: MatchState }) {
  const overs = groupByOver(state.recentBalls);

  return (
    <Card>
      <CardBody className="flex flex-col gap-5 py-5">
        <p className="eyebrow">Recent overs</p>

        {overs.length === 0 ? (
          <p className="text-sm text-muted">Nothing bowled yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {overs.map((over) => (
              <div key={over.number} className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <span className="mono text-[0.6875rem] text-muted">ov {over.number + 1}</span>
                  <span aria-hidden className="h-px flex-1 bg-line" />
                  <span className="mono text-[0.6875rem] text-secondary">
                    {over.runs} run{over.runs === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {over.balls.map((ball) => (
                    <BallChip key={ball.seq} display={ball.display} isWicket={ball.isWicket} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {state.fallOfWickets.length > 0 ? (
          <div className="flex flex-col gap-2.5 border-t border-line pt-5">
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
      </CardBody>
    </Card>
  );
}

function groupByOver(
  balls: BallSummary[],
): Array<{ number: number; balls: BallSummary[]; runs: number }> {
  const byOver = new Map<number, BallSummary[]>();

  for (const ball of balls) {
    const existing = byOver.get(ball.overNumber);
    if (existing) existing.push(ball);
    else byOver.set(ball.overNumber, [ball]);
  }

  return [...byOver.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([number, overBalls]) => ({
      number,
      balls: overBalls,
      runs: overBalls.reduce((total, ball) => total + ball.runs, 0),
    }));
}

function allowedWicketTypes(extraType: ExtraType | null): readonly WicketType[] {
  if (extraType === 'WIDE') return ['RUN_OUT', 'STUMPED', 'OBSTRUCTING_FIELD'];
  if (extraType === 'NO_BALL') return ['RUN_OUT', 'OBSTRUCTING_FIELD'];
  return WICKET_TYPES;
}

const NEEDS_FIELDER: readonly WicketType[] = ['CAUGHT', 'RUN_OUT', 'STUMPED'];

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
          ? `Off a ${extraType.replace('_', ' ').toLowerCase()} — only some dismissals are possible.`
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
              <ChoiceChip
                key={type}
                selected={wicketType === type}
                onClick={() => setWicketType(type)}
                className="h-10 px-3 text-[0.8125rem]"
              >
                {type.replace(/_/g, ' ').toLowerCase()}
              </ChoiceChip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="eyebrow">Who is out</p>
          <div className="flex flex-wrap gap-2">
            {batters.map((id) => (
              <ChoiceChip
                key={id}
                selected={dismissedId === id}
                onClick={() => setDismissedId(id)}
                className="h-10 px-3 text-[0.8125rem]"
              >
                {state.batsmen[id]?.name ??
                  context.battingXI.find((player) => player.id === id)?.name}
              </ChoiceChip>
            ))}
          </div>
        </div>

        {needsFielder ? (
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Fielder{wicketType === 'STUMPED' ? ' — the keeper' : ''}</p>
            <div className="flex flex-wrap gap-2">
              {context.bowlingXI.map((player) => (
                <ChoiceChip
                  key={player.id}
                  selected={fielderId === player.id}
                  onClick={() => setFielderId(player.id)}
                  className="h-10 px-3 text-[0.8125rem]"
                >
                  {player.name}
                </ChoiceChip>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <p className="eyebrow">Runs completed before the dismissal</p>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((value) => (
              <ChoiceChip
                key={value}
                selected={runs === value}
                onClick={() => setRuns(value)}
                className="mono size-10 px-0"
              >
                {value}
              </ChoiceChip>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
