import { QueueRecovery } from './QueueRecovery';
import { useAuth } from '@/features/auth/AuthProvider';
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
import { Button, ButtonLink } from '@/components/ui/Button';
import { ErrorText, SkeletonCard } from '@/components/ui/Feedback';
import { UndoIcon } from '@/components/ui/Icons';
import { PdfButton } from '@/components/ui/PdfButton';
import { PlayerTiles } from '@/components/ui/PlayerTiles';
import { BallChip } from '@/components/ui/Score';
import { Sheet } from '@/components/ui/Sheet';
import { Disclosure } from '@/components/ui/Disclosure';
import { ShareLink } from '@/components/ui/ShareLink';
import { cn } from '@/lib/cn';
import { TeamMark } from '@/components/ui/Pill';
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
  const { user } = useAuth();

  const scorer = useScorerState(matchId);
  const recordBall = useRecordBall(matchId);
  const undo = useUndoBall(matchId);
  const resume = useResumeInnings(matchId);
  const submitBall = useCallback(
    (input: BallRequestInput, inningsId: string) => recordBall.mutateAsync({ ...input, inningsId }),
    [recordBall.mutateAsync],
  );
  const queue = useOfflineBallQueue(matchId, user?.id ?? '', scorer.data?.innings?.id, submitBall);
  const dls = useDlsState(matchId);
  const [dlsOpen, setDlsOpen] = useState(false);
  const [assisted, setAssisted] = useState(() => {
    try {
      return localStorage.getItem('howzat-assisted') === 'true';
    } catch {
      return false;
    }
  });

  if (scorer.isPending) {
    return (
      <Shell>
        <SkeletonCard rows={6} />
      </Shell>
    );
  }
  if (scorer.error && !scorer.data) {
    return (
      <Shell>
        <ErrorText error={scorer.error} onRetry={() => void scorer.refetch()} />
      </Shell>
    );
  }
  if (!scorer.data) return null;

  const { match, state, context, innings, previousOverBowlerId } = scorer.data;

  const dlsApplied = dls.data?.applied ?? false;
  const matchClosed = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const optimistic =
    state && context
      ? foldQueuedBalls(
          state,
          context,
          previousOverBowlerId,
          queue.items.filter(
            (item) =>
              item.inningsId === context.inningsId &&
              !scorer.data.acceptedEventIds?.includes(item.id),
          ),
        )
      : null;

  const label = `${match.team1?.shortName ?? 'TBD'} v ${match.team2?.shortName ?? 'TBD'}`;

  return (
    <Shell>
      <div className={cn('flex flex-col gap-3', assisted && 'assist-mode')}>
        <header className="-mx-2 grid h-[3.25rem] grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-1">
          <Link
            to="/dashboard"
            aria-label="Back to matches"
            className="press grid size-11 place-items-center text-primary hover:bg-hover"
          >
            <svg viewBox="0 0 256 256" className="size-[22px]" fill="currentColor" aria-hidden>
              <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
            </svg>
          </Link>
          <div className="grid min-w-0">
            <h1 className="truncate text-[0.9375rem] leading-5 font-semibold">
              {match.team1?.name ?? 'TBD'} v {match.team2?.name ?? 'TBD'}
            </h1>
            <span className="t-caption truncate">
              {innings ? `Innings ${innings.number}` : 'Scoring'}
              {dlsApplied ? ' · DLS' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
          <SyncPill
            isOnline={queue.isOnline}
            syncState={queue.syncState}
            pending={queue.items.length > 0 || recordBall.isPending}
          />
          <Disclosure className="relative shrink-0">
            <summary
              aria-label="Match tools"
              className="press grid size-11 cursor-pointer place-items-center text-primary hover:bg-hover"
            >
              <svg viewBox="0 0 256 256" className="size-[22px]" fill="currentColor" aria-hidden>
                <path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z" />
              </svg>
            </summary>
            <div className="absolute right-0 top-full z-40 mt-1 flex w-56 flex-col border border-line bg-raised p-1 text-sm">
              <button
                type="button"
                aria-pressed={assisted}
                onClick={() =>
                  setAssisted((value) => {
                    try {
                      localStorage.setItem('howzat-assisted', String(!value));
                    } catch {}
                    return !value;
                  })
                }
                className="flex h-9 items-center justify-between rounded-[var(--radius-sm)] px-2.5 text-left hover:bg-hover"
              >
                Large keys <span className="text-muted">{assisted ? 'On' : 'Off'}</span>
              </button>
              {matchClosed ? null : (
                <button
                  type="button"
                  onClick={() => setDlsOpen(true)}
                  className="flex h-9 items-center rounded-[var(--radius-sm)] px-2.5 text-left hover:bg-hover"
                >
                  {dlsApplied ? 'Rain revision' : 'DLS'}
                </button>
              )}
              <Link
                to={`/matches/${matchId}`}
                className="flex h-9 items-center rounded-[var(--radius-sm)] px-2.5 hover:bg-hover"
              >
                Match details
              </Link>
              <div className="flex items-center justify-between gap-2 px-1.5 py-1">
                <ShareLink slug={match.publicSlug} variant="quiet" label="Share" matchLabel={label} />
                <QueueRecovery matchId={matchId} userId={user?.id ?? ''} />
              </div>
            </div>
          </Disclosure>
          </div>
        </header>

        {queue.error ? (
          <p role="alert" className="rounded-[var(--radius-md)] border border-alert px-3 py-2 text-sm text-alert">
            {queue.error}
          </p>
        ) : null}
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
            headline={match.resultText ?? 'Match over'}
            action={
              <PdfButton
                label="Share PDF"
                size="md"
                build={() =>
                  import('@/lib/pdf').then((pdf) => pdf.buildCricketMatchPdf(match.publicSlug))
                }
              />
            }
          />
        ) : match.status === 'INNINGS_BREAK' || (state?.isComplete && innings) ? (
          <div className="flex flex-col gap-3">
            {state && context ? <Board state={state} context={context} /> : null}
            <Closed
              headline={
                innings?.targetRuns ? `Target ${innings.targetRuns}` : 'Innings complete'
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
            headline="Not started"
            action={<ButtonLink to={`/matches/${matchId}`}>Match details</ButtonLink>}
          />
        ) : optimistic ? (
          <Console
            key={context.inningsId}
            publicSlug={match.publicSlug}
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
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1120px] px-3 pt-2 pb-10 sm:px-6">{children}</div>;
}

function Closed({ headline, action }: { headline: string; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-line bg-raised px-6 py-12 text-center">
      <p className="text-lg font-semibold">{headline}</p>
      {action ? <div className="flex flex-col items-center gap-2">{action}</div> : null}
    </section>
  );
}

interface Crease {
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
}

interface ConsoleProps {
  publicSlug: string;
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
  publicSlug,
  optimisticState,
  context,
  par,
  matchStatus,
  previousOverBowlerId,
  isSaving,
  saveError,
  queueItems,
  isOnline,
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
    try {
      await onBall(input);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'This ball could not be saved. Try again.',
      );
    }
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
      if (
        wicketOpen ||
        isSaving ||
        document.querySelector('[role=dialog]') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;

      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (/^[0-6]$/.test(event.key)) {
        if (byeLike && event.key === '0') return;
        event.preventDefault();
        void handleRuns(Number(event.key));
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'w' && ready) {
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

      if (
        event.key === 'Backspace' &&
        displayState.lastEventSeq > 0 &&
        queueItems.length === 0 &&
        isOnline
      ) {
        event.preventDefault();
        void onUndo();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const canUndo = displayState.lastEventSeq > 0 && !isSaving && queueItems.length === 0 && isOnline;

  const batters = [crease.striker, crease.nonStriker]
    .filter((id): id is string => Boolean(id))
    .map((id) => {
      const batsman = displayState.batsmen[id];
      return {
        id,
        name: batsman?.name ?? context.battingXI.find((player) => player.id === id)?.name ?? 'Batter',
        runs: batsman?.runs ?? 0,
        balls: batsman?.balls ?? 0,
        fours: batsman?.fours ?? 0,
        sixes: batsman?.sixes ?? 0,
        onStrike: id === crease.striker,
      };
    });
  const bowler = bowlerFigures(displayState, context, crease.bowler);
  const partnership = displayState.partnerships.find((entry) => entry.isCurrent);

  const legalInOver = displayState.thisOver.filter((ball) => ball.isLegalDelivery).length;
  const overRuns = displayState.thisOver.reduce((sum, ball) => sum + ball.runs, 0);

  return (
    <div className="scoring-console grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <Board
          state={displayState}
          context={context}
          par={par}
          partnership={partnership ? partnership.runs : null}
        />

        <section className="border border-line bg-raised px-4 py-1">
          <div className="crow crow-bat head">
            <span className="t-label flex items-center gap-2">
              Batter
              {crease.striker && crease.nonStriker ? (
                <button
                  type="button"
                  onClick={() =>
                    setOverride((current) => ({
                      ...current,
                      striker: crease.nonStriker,
                      nonStriker: crease.striker,
                    }))
                  }
                  className="press bg-sunken px-1.5 py-0.5 text-[11px] font-semibold tracking-normal normal-case text-secondary"
                >
                  Swap
                </button>
              ) : null}
            </span>
            <span className="t-label">R (B)</span>
            <span className="t-label">4s</span>
            <span className="t-label">6s</span>
          </div>
          {batters.length === 0 ? (
            <div className="crow crow-bat">
              <span className="text-sm text-muted">Pick openers below</span>
            </div>
          ) : (
            batters.map((batter) => (
              <div key={batter.id} className="crow crow-bat" data-on={batter.onStrike || undefined}>
                <span className="nm">
                  <i aria-hidden />
                  <span>{batter.name}</span>
                  {batter.onStrike ? <span className="sr-only">on strike</span> : null}
                </span>
                <span className="t-fig">
                  {batter.runs} <small>({batter.balls})</small>
                </span>
                <span className="t-fig">{batter.fours}</span>
                <span className="t-fig">{batter.sixes}</span>
              </div>
            ))
          )}
          <div className="crow crow-bowl head">
            <span className="t-label flex items-center gap-2">
              Bowler
              {crease.bowler ? (
                <button
                  type="button"
                  onClick={() => setOverride((current) => ({ ...current, bowler: null }))}
                  className="press bg-sunken px-1.5 py-0.5 text-[11px] font-semibold tracking-normal normal-case text-secondary"
                >
                  Change
                </button>
              ) : null}
            </span>
            <span className="t-label">O-M-R-W</span>
            <span className="t-label">Econ</span>
          </div>
          <div className="crow crow-bowl">
            <span className="nm">
              <span>{bowler?.name ?? 'Pick a bowler below'}</span>
            </span>
            <span className="t-fig">
              {bowler ? `${bowler.overs}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : '—'}
            </span>
            <span className="t-fig">{bowler?.econ != null ? bowler.econ.toFixed(2) : '0.00'}</span>
          </div>
        </section>

        <section className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="t-label">This over</span>
            <span className="t-caption">
              {overRuns} run{overRuns === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayState.thisOver.map((ball) => (
              <span key={ball.seq} className="chip-land">
                <BallChip display={ball.display} isWicket={ball.isWicket} size="sm" />
              </span>
            ))}
            {Array.from({ length: Math.max(0, 6 - legalInOver) }, (_, index) => (
              <span key={`empty-${index}`} data-kind="empty" className="ball size-[1.875rem]" />
            ))}
          </div>
        </section>
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
        scorecardHref={`/live/${publicSlug}?view=scorecard`}
        onOverride={(next) => setOverride((current) => ({ ...current, ...next }))}
        onExtra={(value) => setExtraType((current) => (current === value ? null : value))}
        onRuns={(runs) => void handleRuns(runs)}
        onWicket={() => {
          setLocalError(null);
          setWicketOpen(true);
        }}
        onUndo={() => void onUndo()}
        onRetryQueue={onRetryQueue}
      />

      <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2 lg:col-start-1">
        <EventsCard state={displayState} />
        <WicketsCard state={displayState} />
      </div>

      {wicketOpen ? (
        <WicketSheet
          key={extraType ?? 'none'}
          open={wicketOpen}
          state={displayState}
          context={context}
          crease={crease}
          extraType={extraType}
          isSaving={isSaving}
          error={localError}
          onClose={() => setWicketOpen(false)}
          onSubmit={(ball) => submit(ball)}
        />
      ) : null}
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

function Board({
  state,
  context,
  par,
  partnership,
}: {
  state: MatchState;
  context: InningsContext;
  par?: DlsParPosition | null;
  partnership?: number | null;
}) {
  const quota = quotaBalls(context);
  const ballsLeft = Math.max(0, quota - state.legalBalls);
  const needed = context.targetRuns !== null ? context.targetRuns - state.runs : null;
  const crr = state.legalBalls > 0 ? (state.runs * 6) / state.legalBalls : 0;
  const rrr = needed !== null && ballsLeft > 0 ? (Math.max(0, needed) * 6) / ballsLeft : null;
  const rates: Array<[string, string]> = [
    ['CRR', crr.toFixed(2)],
    ['RRR', rrr !== null ? rrr.toFixed(2) : '—'],
    ['Extras', String(state.extras.total)],
    ["P'ship", partnership != null ? String(partnership) : '—'],
  ];

  return (
    <section className="grid gap-3 border border-line bg-raised p-4">
      <div className="flex h-5 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
          <TeamMark
            shortName={context.battingTeam.shortName}
            color={context.battingTeam.primaryColor}
            size="sm"
            className="!size-5"
          />
          <span className="truncate">{context.battingTeam.name}</span>
        </span>
        <span className="t-caption whitespace-nowrap">
          {context.targetRuns ? `Target ${context.targetRuns}` : `${formatOvers(quota)} overs`}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2 whitespace-nowrap">
          <span key={`${state.runs}-${state.wickets}`} className="score-figure score-bump text-[64px]">
            {state.runs}/{state.wickets}
          </span>
          <span className="mono text-[22px] font-medium text-muted">
            {formatOvers(state.legalBalls)}
          </span>
        </p>
        {needed !== null && needed > 0 ? (
          <div className="grid justify-items-end gap-0.5 pb-0.5 whitespace-nowrap">
            <b className="mono text-2xl leading-[26px]">{needed}</b>
            <span className="t-caption">needed off {ballsLeft}</span>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-4 border-t border-line pt-3">
        {rates.map(([label, value], index) => (
          <div key={label} className={cn('grid gap-0.5', index > 0 && 'border-l border-line pl-3')}>
            <span className="t-label">{label}</span>
            <span className="t-fig">{value}</span>
          </div>
        ))}
      </div>
      {par ? (
        <p className="t-caption">
          DLS par <span className="mono text-primary">{par.parScore}</span> ·{' '}
          {par.difference === 0
            ? 'level'
            : par.difference > 0
              ? `${par.difference} ahead`
              : `${Math.abs(par.difference)} behind`}
        </p>
      ) : null}
    </section>
  );
}

function SyncPill({
  isOnline,
  syncState,
  pending,
}: {
  isOnline: boolean;
  syncState: 'idle' | 'syncing' | 'synced' | 'failed';
  pending: boolean;
}) {
  const failed = syncState === 'failed';
  const label = failed
    ? 'Not saved'
    : !isOnline
      ? 'Offline'
      : pending || syncState === 'syncing'
        ? 'Saving'
        : 'Synced';
  const tone = failed
    ? 'bg-[var(--wkt-soft)] text-[var(--wkt-ink)]'
    : !isOnline || label === 'Saving'
      ? 'bg-[var(--xtra-soft)] text-[var(--xtra-ink)]'
      : 'bg-[var(--six-soft)] text-[var(--six-ink)]';
  return (
    <span
      role="status"
      className={cn('inline-flex h-6 items-center gap-1 px-2 text-xs font-semibold whitespace-nowrap', tone)}
    >
      <svg viewBox="0 0 256 256" className="size-3.5" fill="currentColor" aria-hidden>
        <path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Z" />
      </svg>
      {label}
    </span>
  );
}

const RUNS = [0, 1, 2, 3, 4, 5, 6] as const;

function runTone(runs: number): string | undefined {
  if (runs === 4) return 'four';
  if (runs === 6) return 'six';
  return undefined;
}

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
  scorecardHref,
  onOverride,
  onExtra,
  onRuns,
  onWicket,
  onUndo,
  onRetryQueue,
}: {
  scorecardHref: string;
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
  const failedInQueue = queueItems.some((item) => item.status === 'failed');
  const notice = padNotice({ localError, saveError, isOnline, failedInQueue, queueItems });
  const prerequisite =
    !crease.striker || !crease.nonStriker
      ? 'Select batters'
      : !crease.bowler
        ? 'Select bowler'
        : null;
  const [hit, setHit] = useState<{ key: string; n: number } | null>(null);

  function press(key: string, action: () => void) {
    setHit((current) => ({ key, n: (current?.n ?? 0) + 1 }));
    action();
  }

  const ripple = (key: string) =>
    hit?.key === key ? <span key={hit.n} aria-hidden className="key-ripple" /> : null;

  return (
    <div className="pad sticky bottom-0 z-20 -mx-3 grid gap-2 border-x-0 px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:mx-0 sm:border-x lg:top-3 lg:bottom-auto lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:p-4">
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

      {notice.alert || prerequisite ? (
        <p
          role={notice.alert ? 'alert' : undefined}
          className={cn('text-[13px]', notice.alert ? 'font-semibold text-live' : 'text-muted')}
        >
          {notice.alert ? notice.message : prerequisite}
          {failedInQueue ? (
            <button type="button" onClick={() => void onRetryQueue()} className="ml-2 underline">
              Retry
            </button>
          ) : null}
        </p>
      ) : null}

      <div className="pad-seg" role="group" aria-label="Extras">
        {EXTRAS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={extraType === option.value}
            data-armed={extraType === option.value}
            onClick={() => onExtra(option.value)}
            className="pad-key"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {RUNS.map((runs) => (
          <button
            key={runs}
            type="button"
            disabled={!ready || isSaving || (byeLike && runs === 0)}
            onClick={() => press(`r${runs}`, () => onRuns(runs))}
            data-tone={runTone(runs)}
            className="pad-key h-[3.75rem] text-[32px]"
          >
            {ripple(`r${runs}`)}
            {runs}
          </button>
        ))}
        <button
          type="button"
          disabled={!ready || isSaving}
          onClick={() => press('w', onWicket)}
          data-tone="wicket"
          className="pad-key h-[3.75rem]"
        >
          {ripple('w')}
          OUT
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canUndo}
          title={
            !isOnline
              ? 'Undo is available after deliveries sync'
              : queueItems.length
                ? 'Wait for pending deliveries to sync'
                : 'Undo last delivery'
          }
          onClick={() => press('undo', onUndo)}
          data-tone="quiet"
          className="pad-key h-10"
        >
          {ripple('undo')}
          <UndoIcon />
          Undo
        </button>
        <a
          href={scorecardHref}
          target="_blank"
          rel="noreferrer"
          data-tone="quiet"
          className="pad-key h-10"
        >
          <svg viewBox="0 0 256 256" className="size-[18px]" fill="currentColor" aria-hidden>
            <path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z" />
          </svg>
          Scorecard
        </a>
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
  return { message: 'Ready to score', alert: false };
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
    <PlayerTiles
      label={label}
      players={players}
      value={null}
      onChange={(playerId) => playerId && onPick(playerId)}
    />
  );
}

function WicketsCard({ state }: { state: MatchState }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-raised">
      <h2 className="border-b border-line px-3 py-2 text-xs font-medium text-muted">
        Fall of wickets
      </h2>
      {state.fallOfWickets.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted">None</p>
      ) : (
        <ol>
          {state.fallOfWickets
            .slice()
            .reverse()
            .map((wicket) => (
              <li
                key={wicket.wicket}
                className="flex justify-between gap-3 border-b border-line px-3 py-2 text-[0.8125rem] last:border-b-0"
              >
                <span className="truncate">
                  <span className="mono text-muted">{wicket.wicket}.</span> {wicket.name}
                </span>
                <span className="mono shrink-0">
                  {wicket.teamRuns} <span className="text-muted">({wicket.overs})</span>
                </span>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}

function EventsCard({ state }: { state: MatchState }) {
  const events = useMemo(() => state.recentBalls.slice(-8).reverse(), [state.recentBalls]);

  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-raised">
      <h2 className="border-b border-line px-3 py-2 text-xs font-medium text-muted">
        Recent balls
      </h2>
      {events.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted">None</p>
      ) : (
        <ol>
          {events.map((ball) => (
            <li
              key={ball.seq}
              className="flex items-center gap-3 border-b border-line px-3 py-1.5 last:border-b-0"
            >
              <BallChip display={ball.display} isWicket={ball.isWicket} size="sm" />
              <span className="mono w-9 shrink-0 text-xs text-muted">
                {ball.overNumber}.{ball.ballNumber}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[0.8125rem]',
                  ball.isWicket ? 'font-medium text-primary' : 'text-secondary',
                )}
              >
                {eventLabel(ball)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
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
      aria-pressed={selected}
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
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  state: MatchState;
  context: InningsContext;
  crease: Crease;
  extraType: ExtraType | null;
  isSaving: boolean;
  error?: string | null;
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
      title="Wicket"
      description={
        extraType
          ? `Off a ${extraType.replace('_', ' ').toLowerCase()}, so only some dismissals are possible.`
          : undefined
      }
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isSaving}
            disabled={!batters.includes(dismissedId) || (needsFielder && !fielderId)}
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
            Record wicket
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-7">
        {error ? (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        ) : null}
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
            <p className="eyebrow">Fielder{wicketType === 'STUMPED' ? ' (keeper)' : ''}</p>
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
          <p className="eyebrow">Runs completed</p>
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
