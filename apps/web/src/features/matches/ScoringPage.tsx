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
import { TeamMark } from '@/components/ui/Pill';
import { PdfButton } from '@/components/ui/PdfButton';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Sheet } from '@/components/ui/Sheet';
import { ShareLink } from '@/components/ui/ShareLink';
import {
  BallIcon,
  BallToken,
  BoltIcon,
  ClockIcon,
  Meter,
  OverTrack,
  Plate,
  SectionHead,
  StatTile,
  StumpsIcon,
  TargetIcon,
  Ticket,
  TrophyIcon,
  UndoIcon,
} from '@/components/ui/Stage';
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

  if (scorer.isPending) {
    return (
      <div className="stage min-h-[calc(100dvh-4.5rem)] px-5 py-8 sm:px-8">
        <SkeletonCard rows={6} />
      </div>
    );
  }
  if (scorer.error) {
    return (
      <div className="stage min-h-[calc(100dvh-4.5rem)] px-5 py-8 sm:px-8">
        <ErrorText error={scorer.error} />
      </div>
    );
  }
  if (!scorer.data) return null;

  const { match, state, context, innings, previousOverBowlerId } = scorer.data;

  const dlsApplied = dls.data?.applied ?? false;
  const matchClosed = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const optimistic =
    state && context ? foldQueuedBalls(state, context, previousOverBowlerId, queue.items) : null;

  return (
    <div
      className="stage min-h-[calc(100dvh-4.5rem)]"
      style={
        {
          '--team-a': context?.battingTeam.primaryColor ?? match.team1?.primaryColor ?? '#1268bd',
          '--team-b': context?.bowlingTeam.primaryColor ?? match.team2?.primaryColor ?? '#4a515c',
        } as React.CSSProperties
      }
    >
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7">
        <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={`/matches/${matchId}`}
              className="pill-lg h-9 px-3.5 text-muted transition-colors hover:text-primary"
            >
              ← Match
            </Link>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-primary">
                {match.team1?.name ?? 'TBD'} <span className="font-normal text-muted">v</span>{' '}
                {match.team2?.name ?? 'TBD'}
              </p>
              <p className="micro mt-1 text-muted">Scoring console</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dlsApplied ? <span className="pill-lg text-warning">DLS applied</span> : null}
            {matchClosed ? null : (
              <button type="button" onClick={() => setDlsOpen(true)} className="pill-lg">
                {dlsApplied ? 'Rain' : 'DLS'}
              </button>
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
          <Ticket className="grid place-items-center px-6 py-20 text-center">
            <div className="relative z-10 flex max-w-md flex-col items-center gap-4">
              <TrophyIcon className="size-8 text-pos" />
              <p className="micro text-muted">Match closed</p>
              <p className="figure text-[2rem] text-primary">
                {match.resultText ?? 'This match is over'}
              </p>
              <p className="text-secondary">There is nothing left to score.</p>
              <PdfButton
                label="Share PDF"
                arrow
                size="md"
                build={() =>
                  import('@/lib/pdf').then((pdf) => pdf.buildCricketMatchPdf(match.publicSlug))
                }
              />
            </div>
          </Ticket>
        ) : match.status === 'INNINGS_BREAK' || (state?.isComplete && innings) ? (
          <div className="flex flex-col gap-5">
            {state && context ? (
              <MatchTicket state={state} context={context} par={dls.data?.par ?? null} />
            ) : null}

            <Plate className="flex flex-col items-center gap-5 px-6 py-14 text-center">
              <p className="micro text-muted">
                {match.status === 'INNINGS_BREAK' ? 'Innings break' : 'Innings complete'}
              </p>
              <p className="figure text-[2rem] text-primary">
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
            </Plate>
          </div>
        ) : !state || !context ? (
          <Plate className="flex flex-col items-center gap-5 px-6 py-16 text-center">
            <StumpsIcon className="size-8 text-muted" />
            <p className="micro text-muted">Not started</p>
            <p className="figure text-[2rem] text-primary">This match has not started yet</p>
            <p className="max-w-md text-secondary">
              Record the toss, name both XIs, then start the match.
            </p>
            <Link to={`/matches/${matchId}`}>
              <Button>Go to match setup</Button>
            </Link>
          </Plate>
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
      </div>
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
    <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_19rem]">
      <div className="flex flex-col gap-4 lg:sticky lg:top-5">
        <MatchTicket
          state={displayState}
          context={context}
          par={par}
          isSaving={isSaving}
          isOnline={isOnline}
          syncState={syncState}
          hasQueuedBalls={queueItems.length > 0}
        />
        <CreasePanel
          state={displayState}
          context={context}
          crease={crease}
          availableBatsmen={availableBatsmen}
          availableBowlers={availableBowlers}
          onOverride={(next) => setOverride((current) => ({ ...current, ...next }))}
        />
        <div className="xl:hidden">
          <StatePanel state={displayState} context={context} par={par} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <DeliveryTimeline
          state={displayState}
          canUndo={displayState.lastEventSeq > 0 && !isSaving}
          onUndo={() => void onUndo()}
        />

        {localError ? (
          <p
            role="alert"
            className="plate-quiet px-4 py-3.5 text-sm text-primary"
            style={{ boxShadow: 'inset 0 0 0 1px var(--hot-line)' }}
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

        <ScoringPad
          ready={ready}
          isSaving={isSaving}
          extraType={extraType}
          byeLike={byeLike}
          canUndo={displayState.lastEventSeq > 0}
          onExtra={(value) => setExtraType((current) => (current === value ? null : value))}
          onRuns={(runs) => void handleRuns(runs)}
          onWicket={() => setWicketOpen(true)}
          onUndo={() => void onUndo()}
        />
      </div>

      <div className="hidden flex-col gap-4 xl:sticky xl:top-5 xl:flex">
        <StatePanel state={displayState} context={context} par={par} />
        <EventsFeed state={displayState} />
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

/* ------------------------------------------------------------- the ticket */

function MatchTicket({
  state,
  context,
  par = null,
  isSaving = false,
  isOnline = true,
  syncState = 'idle',
  hasQueuedBalls = false,
}: {
  state: MatchState;
  context: InningsContext;
  par?: DlsParPosition | null;
  isSaving?: boolean;
  isOnline?: boolean;
  syncState?: 'idle' | 'syncing' | 'synced' | 'failed';
  hasQueuedBalls?: boolean;
}) {
  const quota = quotaBalls(context);
  const runRate = state.legalBalls > 0 ? (state.runs * 6) / state.legalBalls : 0;

  return (
    <Ticket notchY="calc(100% - 4.5rem)">
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <TeamMark
              shortName={context.battingTeam.shortName}
              color={context.battingTeam.primaryColor}
              size="sm"
            />
            <p className="truncate text-sm font-semibold text-primary">
              {context.battingTeam.name}
            </p>
          </div>

          <SyncStatus
            isSaving={isSaving}
            isOnline={isOnline}
            syncState={syncState}
            hasQueuedBalls={hasQueuedBalls}
          />
        </div>

        <div className="flex items-end justify-between gap-4 px-5 py-6">
          <p className="figure flex items-baseline text-[3.5rem] text-primary">
            <span key={state.runs} className="figure-roll">
              {state.runs}
            </span>
            <span aria-hidden className="mx-[0.04em] font-normal text-muted">
              /
            </span>
            <span key={state.wickets} className="figure-roll text-muted">
              {state.wickets}
            </span>
          </p>

          <div className="text-right">
            <p className="mono text-xl font-semibold text-primary">
              {formatOvers(state.legalBalls)}
              <span className="text-sm font-normal text-muted">/{formatOvers(quota)}</span>
            </p>
            <p className="micro mt-1.5 text-muted">overs</p>
          </div>
        </div>

        <div className="perf mx-5" />

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <span className="pill-lg mono h-8 px-3 text-[0.6875rem]">CRR {runRate.toFixed(2)}</span>
          {par ? (
            <span className="pill-lg mono h-8 px-3 text-[0.6875rem] text-analytic">
              par {par.parScore} ·{' '}
              {par.difference === 0
                ? 'level'
                : par.difference > 0
                  ? `+${par.difference}`
                  : par.difference}
            </span>
          ) : (
            <span className="mono text-[0.6875rem] text-muted">v {context.bowlingTeam.shortName}</span>
          )}
        </div>
      </div>
    </Ticket>
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
      className={cn(
        'micro flex shrink-0 items-center gap-1.5',
        failed ? 'text-hot' : syncing ? 'text-cool' : 'text-pos',
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full bg-current', !failed && !syncing && 'beacon')}
      />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------- the crease */

function CreasePanel({
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
  const previousOver = state.recentBalls.filter(
    (ball) => ball.overNumber === state.currentOverNumber - 1,
  );

  return (
    <div className="flex flex-col gap-4">
      <Plate className="flex flex-col gap-4 p-5">
        {crease.striker === null || crease.nonStriker === null ? (
          <PickerRow
            label={state.legalBalls === 0 && !state.needsNewBatsman ? 'Openers' : 'New batter'}
            players={availableBatsmen}
            onPick={(playerId) =>
              onOverride(crease.striker === null ? { striker: playerId } : { nonStriker: playerId })
            }
          />
        ) : (
          <>
            <SectionHead
              title="At the crease"
              icon={<BallIcon />}
              meta={
                <button
                  type="button"
                  onClick={() =>
                    onOverride({ striker: crease.nonStriker, nonStriker: crease.striker })
                  }
                  className="pill-lg h-8 px-3 text-[0.6875rem]"
                >
                  Swap
                </button>
              }
            />

            <div className="flex flex-col gap-2.5">
              <BatterCard state={state} context={context} playerId={crease.striker} onStrike />
              <BatterCard state={state} context={context} playerId={crease.nonStriker} />
            </div>
          </>
        )}
      </Plate>

      <Plate className="flex flex-col gap-4 p-5">
        {crease.bowler === null ? (
          <PickerRow
            label={state.legalBalls === 0 ? 'Opening bowler' : 'Next bowler'}
            players={availableBowlers}
            onPick={(playerId) => onOverride({ bowler: playerId })}
          />
        ) : (
          <>
            <SectionHead
              title="Bowling"
              icon={<BallIcon />}
              meta={
                <button
                  type="button"
                  onClick={() => onOverride({ bowler: null })}
                  className="pill-lg h-8 px-3 text-[0.6875rem]"
                >
                  Change
                </button>
              }
            />

            <div className="flex items-center gap-3">
              <PlayerAvatar
                seed={crease.bowler}
                name={
                  bowler?.name ??
                  context.bowlingXI.find((player) => player.id === crease.bowler)?.name ??
                  'Bowler'
                }
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-primary">
                  {bowler?.name ??
                    context.bowlingXI.find((player) => player.id === crease.bowler)?.name ??
                    'Bowler'}
                </p>
                <p className="mono mt-1 text-[0.6875rem] text-muted">
                  {bowler
                    ? `${formatOvers(bowler.balls)}–${bowler.maidens}–${bowler.runs}–${bowler.wickets}`
                    : 'first over'}
                </p>
              </div>
              <p className="figure shrink-0 text-2xl text-hot">
                {bowler?.wickets ?? 0}
                <span className="font-normal text-muted">/{bowler?.runs ?? 0}</span>
              </p>
            </div>

            {previousOver.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <p className="micro text-muted">Last over</p>
                <OverTrack
                  size="sm"
                  animateLast={false}
                  balls={previousOver.map((ball) => ({
                    key: ball.seq,
                    display: ball.display,
                    isWicket: ball.isWicket,
                  }))}
                  emptyLabel="—"
                />
              </div>
            ) : null}
          </>
        )}
      </Plate>
    </div>
  );
}

function BatterCard({
  state,
  context,
  playerId,
  onStrike = false,
}: {
  state: MatchState;
  context: InningsContext;
  playerId: string;
  onStrike?: boolean;
}) {
  const batsman = state.batsmen[playerId];
  const name =
    batsman?.name ?? context.battingXI.find((player) => player.id === playerId)?.name ?? 'Batter';
  const runs = batsman?.runs ?? 0;
  const balls = batsman?.balls ?? 0;
  const sr = balls > 0 ? (runs / balls) * 100 : 0;

  return (
    <div
      className={cn(
        'plate-quiet flex items-center gap-3 p-3.5 transition-shadow duration-[var(--dur)]',
        onStrike && 'bg-pos-soft/40 shadow-[inset_0_0_0_1px_var(--pos-line),0_0_24px_-14px_var(--pos)]',
      )}
    >
      <div className="relative shrink-0">
        <PlayerAvatar seed={playerId} name={name} size="xs" />
        {onStrike ? (
          <span
            aria-label="on strike"
            className="beacon absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-pos ring-2 ring-[#12151b]"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary">{name}</p>
        <p className="mono mt-0.5 flex gap-2.5 text-[0.625rem] text-muted">
          <span className="text-cool">{batsman?.fours ?? 0}×4</span>
          <span className="text-pos">{batsman?.sixes ?? 0}×6</span>
          <span>SR {sr.toFixed(0)}</span>
        </p>
      </div>

      <p className="figure shrink-0 text-xl text-primary">
        {runs}
        <span className="mono ml-1 text-[0.6875rem] font-normal text-muted">({balls})</span>
      </p>
    </div>
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
      <p className="micro text-pos">{label}</p>

      {players.length === 0 ? (
        <p className="text-sm text-muted">Nobody is available.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onPick(player.id)}
              className="key h-11 px-4 text-[0.8125rem] font-medium"
            >
              {player.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- the timeline */

function DeliveryTimeline({
  state,
  canUndo,
  onUndo,
}: {
  state: MatchState;
  canUndo: boolean;
  onUndo: () => void;
}) {
  const balls = state.thisOver;
  const last = balls[balls.length - 1];

  return (
    <Plate className="flex flex-col gap-4 p-5">
      <SectionHead
        title={`Over ${state.currentOverNumber + 1}`}
        icon={<ClockIcon />}
        meta={
          <span className="mono text-[0.6875rem] text-muted">
            {balls.filter((ball) => ball.isLegalDelivery).length} of 6
          </span>
        }
      />

      {balls.length === 0 ? (
        <p className="text-sm text-muted">No balls bowled yet this over.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {balls.map((ball, index) => {
            const isLast = index === balls.length - 1;
            return (
              <span key={ball.seq} className={isLast ? 'token-in' : undefined}>
                <BallToken
                  display={ball.display}
                  isWicket={ball.isWicket}
                  size="lg"
                  onClick={isLast && canUndo ? onUndo : undefined}
                  title={
                    isLast && canUndo
                      ? 'Undo this delivery'
                      : `Ball ${ball.overNumber}.${ball.ballNumber}`
                  }
                />
              </span>
            );
          })}
        </div>
      )}

      {last && canUndo ? (
        <p className="text-[0.75rem] text-muted">
          Wrong ball? Tap the last token to take it back.
        </p>
      ) : null}
    </Plate>
  );
}

/* ---------------------------------------------------------------- the pad */

function ScoringPad({
  ready,
  isSaving,
  extraType,
  byeLike,
  canUndo,
  onExtra,
  onRuns,
  onWicket,
  onUndo,
}: {
  ready: boolean;
  isSaving: boolean;
  extraType: ExtraType | null;
  byeLike: boolean;
  canUndo: boolean;
  onExtra: (value: ExtraType) => void;
  onRuns: (runs: number) => void;
  onWicket: () => void;
  onUndo: () => void;
}) {
  return (
    <div
      className={cn(
        'stage sticky bottom-0 z-10 -mx-4 border-t border-line px-4 pt-4 sm:-mx-6 sm:px-6',
        'pb-[max(1rem,env(safe-area-inset-bottom))]',
        'lg:static lg:mx-0 lg:rounded-[var(--r-card)] lg:border-0 lg:p-6',
        'lg:shadow-[inset_0_1px_0_rgb(255_255_255/0.045),0_0_0_1px_rgb(255_255_255/0.035),var(--shadow-md)]',
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="hidden items-end justify-between gap-4 lg:flex">
          <div>
            <p className="micro text-pos">Scoring pad</p>
            <p className="mt-1.5 text-sm text-secondary">
              {!ready
                ? 'Name both batters and the bowler to start scoring.'
                : extraType
                  ? `The next tap is scored as a ${extraType.replace('_', ' ').toLowerCase()}.`
                  : 'Tap the runs off the bat.'}
            </p>
          </div>
          <span className="mono text-[0.625rem] text-muted">
            0–6 · W wicket · D wide · N no ball · B bye · L leg bye · ⌫ undo
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {EXTRAS.map((option) => (
            <button
              key={option.value}
              type="button"
              data-armed={extraType === option.value}
              onClick={() => onExtra(option.value)}
              className="key h-12 text-[0.8125rem] font-semibold"
            >
              <span className="key-legend uppercase">{option.key}</span>
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
            <button
              key={runs}
              type="button"
              disabled={!ready || isSaving || (byeLike && runs === 0)}
              onClick={() => onRuns(runs)}
              data-tone={runs === 4 ? 'four' : runs === 6 ? 'six' : undefined}
              className="key h-[4.5rem] text-[1.75rem] font-semibold sm:h-20"
            >
              {runs}
            </button>
          ))}

          <button
            type="button"
            disabled={!ready || isSaving}
            onClick={onWicket}
            data-tone="wicket"
            className="key col-span-4 h-16 text-base font-bold tracking-[0.12em] uppercase sm:col-span-7"
          >
            <span className="key-legend">W</span>
            Wicket
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.75rem] text-muted lg:hidden">
            {!ready
              ? 'Name both batters and the bowler.'
              : extraType
                ? `Next tap: ${extraType.replace('_', ' ').toLowerCase()}.`
                : 'Tap the runs off the bat.'}
          </p>

          <button
            type="button"
            disabled={!canUndo || isSaving}
            onClick={onUndo}
            className="key ml-auto inline-flex h-11 items-center gap-2 px-4 text-[0.8125rem] font-semibold"
          >
            <UndoIcon />
            Undo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ state panel */

function StatePanel({
  state,
  context,
  par,
}: {
  state: MatchState;
  context: InningsContext;
  par: DlsParPosition | null;
}) {
  const quota = quotaBalls(context);
  const ballsRemaining = Math.max(0, quota - state.legalBalls);
  const runsNeeded = context.targetRuns !== null ? context.targetRuns - state.runs : null;
  const crr = state.legalBalls > 0 ? (state.runs * 6) / state.legalBalls : 0;
  const rrr = runsNeeded !== null && ballsRemaining > 0 ? (runsNeeded * 6) / ballsRemaining : null;
  const partnership = state.partnerships.find((entry) => entry.isCurrent);

  return (
    <Plate className="flex flex-col gap-5 p-5">
      <SectionHead title="Match state" icon={<BoltIcon />} />

      {runsNeeded !== null && runsNeeded > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile icon={<TargetIcon />} tone="hot" label="Need" value={runsNeeded} />
            <StatTile label="From" value={ballsRemaining} sub="balls" />
          </div>

          <Meter
            tone="hot"
            value={state.runs / Math.max(1, context.targetRuns ?? 1)}
            marker={quota > 0 ? state.legalBalls / quota : 0}
            label={`${state.runs} of ${context.targetRuns} runs, ${state.legalBalls} of ${quota} balls`}
          />
        </>
      ) : null}

      <dl className="grid grid-cols-2 gap-3">
        <StatTile label="CRR" value={crr.toFixed(2)} />
        {rrr !== null ? (
          <StatTile label="RRR" tone={rrr > crr ? 'hot' : 'pos'} value={rrr.toFixed(2)} />
        ) : (
          <StatTile label="Extras" value={state.extras.total} />
        )}
      </dl>

      {partnership ? (
        <div className="plate-quiet flex items-center justify-between gap-3 p-4">
          <p className="micro flex items-center gap-1.5 text-pos">
            <TrophyIcon />
            Partnership
          </p>
          <p className="figure text-xl text-primary">
            {partnership.runs}
            <span className="mono ml-1 text-[0.6875rem] font-normal text-muted">
              ({partnership.balls})
            </span>
          </p>
        </div>
      ) : null}

      {par ? (
        <p className="mono text-[0.75rem] text-analytic">
          DLS par {par.parScore} ·{' '}
          {par.difference === 0
            ? 'level'
            : par.difference > 0
              ? `${par.difference} ahead`
              : `${Math.abs(par.difference)} behind`}
        </p>
      ) : null}
    </Plate>
  );
}

/* ----------------------------------------------------------- events feed */

function EventsFeed({ state }: { state: MatchState }) {
  const events = useMemo(() => state.recentBalls.slice(-12).reverse(), [state.recentBalls]);

  return (
    <Plate className="flex flex-col gap-4 p-5">
      <SectionHead title="Match events" icon={<ClockIcon />} />

      {events.length === 0 ? (
        <p className="text-sm text-muted">Nothing bowled yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {events.map((ball) => (
            <li key={ball.seq} className="flex items-center gap-3">
              <BallToken display={ball.display} isWicket={ball.isWicket} size="sm" />
              <span className="mono w-10 shrink-0 text-[0.625rem] text-muted">
                {ball.overNumber}.{ball.ballNumber}
              </span>
              <span
                className={cn(
                  'micro min-w-0 flex-1 truncate',
                  ball.isWicket
                    ? 'text-hot'
                    : !ball.extraType && ball.runs === 6
                      ? 'text-pos'
                      : !ball.extraType && ball.runs === 4
                        ? 'text-cool'
                        : 'text-secondary',
                )}
              >
                {eventLabel(ball)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {state.fallOfWickets.length > 0 ? (
        <div className="flex flex-col gap-2.5 border-t border-line pt-4">
          <p className="micro text-muted">Fall of wickets</p>
          {state.fallOfWickets
            .slice()
            .reverse()
            .map((wicket) => (
              <div key={wicket.wicket} className="flex items-center gap-3">
                <span className="micro grid size-5 shrink-0 place-items-center rounded-full bg-hot-soft text-hot">
                  {wicket.wicket}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-secondary">
                  {wicket.name}
                </span>
                <span className="mono shrink-0 text-[0.75rem] text-primary">
                  {wicket.teamRuns} ({wicket.overs})
                </span>
              </div>
            ))}
        </div>
      ) : null}
    </Plate>
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
  if (queueItems.length === 0) {
    return syncState === 'synced' ? (
      <p className="plate-quiet px-4 py-3 text-[0.8125rem] text-pos">All deliveries synced.</p>
    ) : null;
  }

  const failed = queueItems.some((item) => item.status === 'failed');

  return (
    <div className="plate-quiet flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-[0.8125rem] text-secondary">
        {!isOnline ? 'Offline — deliveries are safely stored on this device.' : null}
        {isOnline && queueItems.some((item) => item.status === 'pending')
          ? 'Syncing deliveries…'
          : null}
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

/* ------------------------------------------------------------ the wicket */

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
      className={cn('key h-11 px-4 text-[0.8125rem] font-semibold', className)}
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
          <p className="micro text-muted">Dismissal</p>
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
          <p className="micro text-muted">Who is out</p>
          <div className="flex flex-wrap gap-2">
            {batters.map((id) => (
              <ChoiceKey
                key={id}
                selected={dismissedId === id}
                onClick={() => setDismissedId(id)}
              >
                {state.batsmen[id]?.name ??
                  context.battingXI.find((player) => player.id === id)?.name}
              </ChoiceKey>
            ))}
          </div>
        </div>

        {needsFielder ? (
          <div className="flex flex-col gap-3">
            <p className="micro text-muted">
              Fielder{wicketType === 'STUMPED' ? ' — the keeper' : ''}
            </p>
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
          <p className="micro text-muted">Runs completed before the dismissal</p>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((value) => (
              <ChoiceKey
                key={value}
                selected={runs === value}
                onClick={() => setRuns(value)}
                className="mono size-12 px-0 text-lg"
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
