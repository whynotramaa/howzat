import { useMemo, useState } from 'react';
import {
  BALLS_PER_OVER,
  formatOvers,
  parseOversToBalls,
  type DlsInningsResources,
  type DlsStateDto,
  type InningsContext,
  type MatchState,
} from '@howzat/shared';
import { Button } from '@/components/ui/Button';
import { ChoiceChip, Input } from '@/components/ui/Input';
import { ErrorText } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import {
  useAddDlsInterruption,
  useConcludeUnderDls,
  useDlsState,
  useRemoveDlsInterruption,
  useUpdateDlsSettings,
} from './queries';

/**
 * The scorer's DLS worksheet.
 *
 * It asks for exactly what an ICC scorer writes down at a stoppage — overs
 * left, wickets down, overs left when they came back — and shows the resource
 * arithmetic it did with them, because a revised target nobody can check is a
 * revised target nobody will trust.
 */
export function DlsSheet({
  open,
  onClose,
  matchId,
  state,
  context,
  inningsNumber,
}: {
  open: boolean;
  onClose: () => void;
  matchId: string;
  state: MatchState | null;
  context: InningsContext | null;
  inningsNumber: number;
}) {
  const dls = useDlsState(matchId, open);
  const settings = useUpdateDlsSettings(matchId);
  const add = useAddDlsInterruption(matchId);
  const remove = useRemoveDlsInterruption(matchId);
  const conclude = useConcludeUnderDls(matchId);

  const data = dls.data;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title="Duckworth-Lewis-Stern"
      description="Record what the weather cost each side. The target is recomputed from the stoppages every time this list changes."
      footer={
        <Button variant="quiet" onClick={onClose}>
          Done
        </Button>
      }
    >
      {dls.isPending ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : dls.error ? (
        <ErrorText error={dls.error} />
      ) : !data ? null : (
        <div className="flex flex-col gap-8">
          <SwitchRow
            applied={data.applied}
            isSaving={settings.isPending}
            onToggle={(applied) => settings.mutate({ applied })}
          />

          {settings.error ? <ErrorText error={settings.error} /> : null}

          {data.applied ? (
            <>
              <G50Row
                g50={data.g50}
                isSaving={settings.isPending}
                onChange={(value) => settings.mutate({ g50: value })}
              />

              <Worksheet data={data} />

              <StoppageList
                data={data}
                isRemoving={remove.isPending}
                onRemove={(id) => remove.mutate(id)}
              />

              {remove.error ? <ErrorText error={remove.error} /> : null}

              <AddStoppage
                data={data}
                state={state}
                context={context}
                inningsNumber={inningsNumber}
                isSaving={add.isPending}
                error={add.error}
                onAdd={(input) => add.mutateAsync(input)}
              />

              <ConcludeRow
                data={data}
                state={state}
                isSaving={conclude.isPending}
                error={conclude.error}
                onConclude={(reason) => conclude.mutateAsync(reason)}
              />
            </>
          ) : (
            <p className="text-sm leading-relaxed text-secondary">
              Switch DLS on when rain, bad light or anything else has already cost overs, or looks
              like it will. Nothing changes until you record a stoppage.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

function SwitchRow({
  applied,
  isSaving,
  onToggle,
}: {
  applied: boolean;
  isSaving: boolean;
  onToggle: (applied: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="eyebrow">Method</p>
        <p className="mt-1.5 text-sm text-secondary">
          {applied
            ? 'DLS is on — allotments and the target follow the stoppages below.'
            : 'This match is being scored without DLS.'}
        </p>
      </div>

      <Button
        variant={applied ? 'secondary' : 'primary'}
        size="sm"
        isLoading={isSaving}
        onClick={() => onToggle(!applied)}
      >
        {applied ? 'Switch off' : 'Apply DLS'}
      </Button>
    </div>
  );
}

const G50_PRESETS = [
  { value: 245, label: '245 — 50-over' },
  { value: 200, label: '200 — T20' },
];

function G50Row({
  g50,
  isSaving,
  onChange,
}: {
  g50: number;
  isSaving: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-7">
      <p className="eyebrow">G50 — the average 50-over score at this level</p>
      <p className="text-[0.8125rem] leading-relaxed text-muted">
        Only used when the chasing side ends up with more resource than the side batting first,
        which in practice means a first-innings washout.
      </p>

      <div className="flex flex-wrap gap-2">
        {G50_PRESETS.map((preset) => (
          <ChoiceChip
            key={preset.value}
            selected={g50 === preset.value}
            disabled={isSaving}
            onClick={() => onChange(preset.value)}
            className="h-10 px-3 text-[0.8125rem]"
          >
            {preset.label}
          </ChoiceChip>
        ))}

        {G50_PRESETS.every((preset) => preset.value !== g50) ? (
          <ChoiceChip selected className="h-10 px-3 text-[0.8125rem]">
            {g50} — this competition
          </ChoiceChip>
        ) : null}
      </div>
    </div>
  );
}

/** The resource arithmetic, laid out the way the DLS worksheet lays it out. */
function Worksheet({ data }: { data: DlsStateDto }) {
  const { firstInnings, secondInnings, calculation } = data;

  if (!firstInnings || !secondInnings) return null;

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-7">
      <p className="eyebrow">Resources</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ResourceCard label="Innings 1" innings={firstInnings} />
        <ResourceCard label="Innings 2" innings={secondInnings} />
      </div>

      {calculation ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--accent-line)] bg-accent-soft px-4 py-4">
          <p className="mono text-[0.8125rem] text-secondary">
            {calculation.method === 'RATIO' ? (
              <>
                {calculation.team1Score} × {calculation.team2Resource}% ÷ {calculation.team1Resource}
                % = {calculation.rawPar}
              </>
            ) : (
              <>
                {calculation.team1Score} + {calculation.g50} × (
                {calculation.team2Resource - calculation.team1Resource}% ÷ 100) ={' '}
                {calculation.rawPar}
              </>
            )}
          </p>

          <p className="mt-2.5 text-[0.9375rem] text-primary">
            Par <span className="mono">{calculation.parScore}</span> — target{' '}
            <span className="mono text-accent">{calculation.target}</span> off{' '}
            <span className="mono">{formatOvers(secondInnings.revisedBalls)}</span> overs
          </p>
        </div>
      ) : (
        <p className="text-[0.8125rem] text-muted">
          The target appears once the first innings is closed and there is a score to scale.
        </p>
      )}
    </div>
  );
}

function ResourceCard({ label, innings }: { label: string; innings: DlsInningsResources }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-sunken px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      <p className="mono mt-2 text-xl text-primary">{innings.availableResource}%</p>
      <p className="mono mt-1.5 text-[0.6875rem] text-muted">
        {innings.startingResource}% start
        {innings.lostResource > 0 ? ` − ${innings.lostResource}% lost` : ''} ·{' '}
        {formatOvers(innings.revisedBalls)} ov
      </p>
    </div>
  );
}

function StoppageList({
  data,
  isRemoving,
  onRemove,
}: {
  data: DlsStateDto;
  isRemoving: boolean;
  onRemove: (id: string) => void;
}) {
  const steps = [
    ...(data.firstInnings?.steps.map((step) => ({ step, innings: 1 })) ?? []),
    ...(data.secondInnings?.steps.map((step) => ({ step, innings: 2 })) ?? []),
  ];

  if (steps.length === 0) {
    return (
      <p className="border-t border-line pt-7 text-sm text-muted">
        No stoppages recorded — both sides still have their full allotment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-7">
      <p className="eyebrow">Stoppages</p>

      {steps.map(({ step, innings }) => (
        <div
          key={step.interruptionId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-line px-3.5 py-3"
        >
          <div className="min-w-0">
            <p className="text-[0.8125rem] text-primary">
              Innings {innings} · off at{' '}
              <span className="mono">{formatOvers(step.ballsRemainingAtSuspension)}</span> left,{' '}
              {step.wicketsLost} down · back with{' '}
              <span className="mono">{formatOvers(step.ballsRemainingOnResumption)}</span>
            </p>
            <p className="mono mt-1 text-[0.6875rem] text-muted">
              {step.resourceAtSuspension}% → {step.resourceOnResumption}% ·{' '}
              <span className="text-alert">−{step.resourceLost}%</span>
              {step.reason ? ` · ${step.reason}` : ''}
            </p>
          </div>

          <button
            type="button"
            disabled={isRemoving}
            onClick={() => onRemove(step.interruptionId)}
            className="text-[0.6875rem] tracking-[0.08em] text-muted uppercase transition-colors hover:text-alert disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

interface StoppageDraft {
  inningsNumber: 1 | 2;
  ballsRemainingAtSuspension: number;
  wicketsLost: number;
  ballsRemainingOnResumption: number;
  reason: string | null;
}

function AddStoppage({
  data,
  state,
  context,
  inningsNumber,
  isSaving,
  error,
  onAdd,
}: {
  data: DlsStateDto;
  state: MatchState | null;
  context: InningsContext | null;
  inningsNumber: number;
  isSaving: boolean;
  error: unknown;
  onAdd: (input: StoppageDraft) => Promise<unknown>;
}) {
  const liveInnings: 1 | 2 = inningsNumber === 2 ? 2 : 1;
  const [innings, setInnings] = useState<1 | 2>(liveInnings);

  // Where the innings actually stands, so the common case is one number to
  // type. Only the live innings has a "right now" to offer — a stoppage in the
  // other one has to be spelled out.
  const suggested = useMemo(() => {
    if (!state || !context || innings !== liveInnings) return null;

    const allotted = data[innings === 1 ? 'firstInnings' : 'secondInnings']?.revisedBalls;
    if (allotted === undefined) return null;

    return {
      balls: Math.max(0, allotted - state.legalBalls),
      wickets: state.wickets,
    };
  }, [state, context, data, innings, liveInnings]);
  const [left, setLeft] = useState('');
  const [wickets, setWickets] = useState('');
  const [back, setBack] = useState('');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const suspensionBalls =
    left.trim() === '' ? (suggested?.balls ?? null) : parseOversToBalls(left);
  const resumptionBalls = parseOversToBalls(back);
  const wicketsDown = wickets.trim() === '' ? (suggested?.wickets ?? 0) : Number(wickets);

  const secondInningsExists = data.hasSecondInnings;

  async function submit() {
    if (suspensionBalls === null) {
      setLocalError('Enter the overs left when play stopped, as overs and balls — 12.3.');
      return;
    }

    if (resumptionBalls === null) {
      setLocalError('Enter the overs left when play resumed. Use 0 if the innings is over.');
      return;
    }

    if (resumptionBalls > suspensionBalls) {
      setLocalError('Play cannot resume with more overs left than there were when it stopped.');
      return;
    }

    if (!Number.isInteger(wicketsDown) || wicketsDown < 0 || wicketsDown > 9) {
      setLocalError('Wickets down must be between 0 and 9.');
      return;
    }

    setLocalError(null);

    await onAdd({
      inningsNumber: innings,
      ballsRemainingAtSuspension: suspensionBalls,
      wicketsLost: wicketsDown,
      ballsRemainingOnResumption: resumptionBalls,
      reason: reason.trim() === '' ? null : reason.trim(),
    });

    setLeft('');
    setWickets('');
    setBack('');
    setReason('');
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-7">
      <p className="eyebrow">Record a stoppage</p>
      <p className="text-[0.8125rem] leading-relaxed text-muted">
        Overs are written as cricket says them — 12.3 is twelve overs and three balls. A delayed
        start is a stoppage with the full allotment left; an innings called off for good resumes
        with 0.
        {suggested
          ? ' The first two boxes are already filled in from where the innings stands — leave them alone unless the umpires say otherwise.'
          : ''}
      </p>

      <div className="flex flex-wrap gap-2">
        {([1, 2] as const).map((value) => (
          <ChoiceChip
            key={value}
            selected={innings === value}
            disabled={value === 2 && !secondInningsExists}
            onClick={() => setInnings(value)}
            className="h-10 px-3 text-[0.8125rem]"
          >
            Innings {value}
          </ChoiceChip>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Overs left when play stopped"
          inputMode="decimal"
          placeholder={suggested ? formatOvers(suggested.balls) : '20.0'}
          value={left}
          onChange={(event) => setLeft(event.target.value)}
        />
        <Input
          label="Wickets down"
          inputMode="numeric"
          placeholder={suggested ? String(suggested.wickets) : '0'}
          value={wickets}
          onChange={(event) => setWickets(event.target.value)}
        />
        <Input
          label="Overs left on resumption"
          inputMode="decimal"
          placeholder="15.0"
          value={back}
          onChange={(event) => setBack(event.target.value)}
        />
      </div>

      <Input
        label="Reason (optional)"
        placeholder="Rain"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />

      {localError ? (
        <p role="alert" className="text-[0.8125rem] text-alert">
          {localError}
        </p>
      ) : null}
      {error ? <ErrorText error={error} /> : null}

      <div>
        <Button size="sm" isLoading={isSaving} onClick={() => void submit()}>
          Record the stoppage
        </Button>
      </div>
    </div>
  );
}

function ConcludeRow({
  data,
  state,
  isSaving,
  error,
  onConclude,
}: {
  data: DlsStateDto;
  state: MatchState | null;
  isSaving: boolean;
  error: unknown;
  onConclude: (reason?: string) => Promise<unknown>;
}) {
  const par = data.par;

  if (!par || !state) return null;

  const minimumBalls = data.minimumOversForResult * BALLS_PER_OVER;
  const reached = state.legalBalls >= minimumBalls;

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-7">
      <p className="eyebrow">End the match here</p>

      <div className="rounded-[var(--radius-md)] border border-line bg-sunken px-4 py-4">
        <p className="text-[0.9375rem] text-primary">
          Par is <span className="mono">{par.parScore}</span> with{' '}
          <span className="mono">{formatOvers(par.ballsRemaining)}</span> overs left.
        </p>
        <p
          className={cn(
            'mono mt-1.5 text-[0.8125rem]',
            par.difference > 0 ? 'text-success' : par.difference < 0 ? 'text-alert' : 'text-muted',
          )}
        >
          {par.difference === 0
            ? 'Level with par'
            : par.difference > 0
              ? `${par.difference} run${par.difference === 1 ? '' : 's'} ahead of par`
              : `${Math.abs(par.difference)} run${Math.abs(par.difference) === 1 ? '' : 's'} behind par`}
        </p>
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-muted">
        {reached
          ? `The chase has faced its ${data.minimumOversForResult} overs, so DLS can decide the match on the par score above.`
          : `DLS cannot decide this match until the chase has faced ${data.minimumOversForResult} overs — ${formatOvers(Math.max(0, minimumBalls - state.legalBalls))} short. Ending it now records a no result.`}
      </p>

      {error ? <ErrorText error={error} /> : null}

      <div>
        <Button
          variant="danger"
          size="sm"
          isLoading={isSaving}
          onClick={() => void onConclude('rain')}
        >
          {reached ? 'Call the match on DLS' : 'Call it a no result'}
        </Button>
      </div>
    </div>
  );
}
