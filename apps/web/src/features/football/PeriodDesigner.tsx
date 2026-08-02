import {
  MAX_PERIODS,
  MAX_PERIOD_MINUTES,
  MIN_PERIODS,
  MIN_PERIOD_MINUTES,
  periodName,
} from '@howzat/shared';
import { cn } from '@/lib/cn';

/*
 * Choosing how long a match is.
 *
 * This could have been two number fields, and two number fields would have been
 * worse. The thing being chosen is a *shape* — two forty-fives, four twelves,
 * one thirty — and a shape is something you recognise faster than you read. So
 * the control shows the shape: a bar divided into the periods, drawn to scale,
 * with the total written under it. Changing either number redraws the bar, and
 * the organizer sees what they have made before they make it.
 *
 * The presets are first because almost everybody wants one of them, and the
 * two dials underneath are for the Sunday league that plays 35-minute halves
 * because the pitch is booked until four.
 */

interface Preset {
  label: string;
  detail: string;
  periods: number;
  periodMinutes: number;
}

const PRESETS: Preset[] = [
  { label: 'Full match', detail: '2 × 45', periods: 2, periodMinutes: 45 },
  { label: 'Short halves', detail: '2 × 30', periods: 2, periodMinutes: 30 },
  { label: 'Five-a-side', detail: '2 × 20', periods: 2, periodMinutes: 20 },
  { label: 'Quarters', detail: '4 × 15', periods: 4, periodMinutes: 15 },
];

export function PeriodDesigner({
  periods,
  periodMinutes,
  onChange,
}: {
  periods: number;
  periodMinutes: number;
  onChange: (next: { periods: number; periodMinutes: number }) => void;
}) {
  const total = periods * periodMinutes;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow mb-3">Match length</p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((preset) => {
            const active = preset.periods === periods && preset.periodMinutes === periodMinutes;

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  onChange({ periods: preset.periods, periodMinutes: preset.periodMinutes })
                }
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-[var(--radius-sm)] border px-3.5 py-3 text-left',
                  'transition-all duration-[var(--dur-fast)] ease-[var(--ease)]',
                  active
                    ? 'border-[var(--accent-strong)] bg-accent-soft'
                    : 'border-line bg-raised hover:border-line-strong hover:bg-hover',
                )}
              >
                <span
                  className={cn(
                    'text-[0.8125rem] font-medium',
                    active ? 'text-accent' : 'text-primary',
                  )}
                >
                  {preset.label}
                </span>
                <span className="mono text-[0.6875rem] text-muted">{preset.detail}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The shape itself. This is the control's whole reason for existing. */}
      <PeriodBar periods={periods} periodMinutes={periodMinutes} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Dial
          label="Periods"
          value={periods}
          min={MIN_PERIODS}
          max={MAX_PERIODS}
          suffix={periods === 1 ? 'period' : 'periods'}
          hint={periods === 2 ? 'Halves' : periods === 4 ? 'Quarters' : 'Straight through'}
          onChange={(next) => onChange({ periods: next, periodMinutes })}
        />

        <Dial
          label="Minutes each"
          value={periodMinutes}
          min={MIN_PERIOD_MINUTES}
          max={MAX_PERIOD_MINUTES}
          step={5}
          suffix="min"
          hint={`${total} minutes of football`}
          onChange={(next) => onChange({ periods, periodMinutes: next })}
        />
      </div>
    </div>
  );
}

/**
 * The match drawn to scale: one segment per period, a hairline gap where the
 * whistle goes. Segments are equal because periods are equal — this is a
 * diagram of the format, not a progress bar of a match being played.
 */
function PeriodBar({ periods, periodMinutes }: { periods: number; periodMinutes: number }) {
  const total = periods * periodMinutes;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line bg-sunken px-5 py-5">
      <div className="flex h-11 gap-1.5">
        {Array.from({ length: periods }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'relative flex-1 rounded-[var(--radius-xs)] bg-[var(--accent-strong)]',
              'transition-all duration-[var(--dur)] ease-[var(--ease)]',
            )}
            style={{ opacity: 1 - index * 0.14 }}
          >
            <span className="mono absolute inset-0 grid place-items-center text-[0.6875rem] text-white/90">
              {periodMinutes}′
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <p className="text-[0.8125rem] text-secondary">
          {periods === 1
            ? 'One straight period'
            : `${periods} × ${periodMinutes} minutes — ${periodName(1, periods).toLowerCase()} to ${periodName(
                periods,
                periods,
              ).toLowerCase()}`}
        </p>
        <p className="mono text-sm font-medium text-primary">{total}′ total</p>
      </div>
    </div>
  );
}

/**
 * A stepper rather than a spinner: the value is set at a ground, one-handed,
 * and a native number input on a phone opens a keyboard for a number that is
 * almost always one tap away from where it already is.
 */
function Dial({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow text-secondary">{label}</span>

      <div className="flex items-center gap-2">
        <StepButton
          label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </StepButton>

        <div className="flex h-12 flex-1 items-baseline justify-center gap-1.5 rounded-[var(--radius-sm)] border border-line bg-raised">
          <span className="mono text-xl font-medium text-primary tabular-nums">{value}</span>
          <span className="text-[0.75rem] text-muted">{suffix}</span>
        </div>

        <StepButton
          label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </StepButton>
      </div>

      <p className="text-[0.8125rem] text-muted">{hint}</p>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'mono grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-line-strong',
        'bg-raised text-lg text-primary transition-all duration-[var(--dur-fast)]',
        'hover:border-[var(--accent-line)] hover:bg-hover active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-35',
      )}
    >
      {children}
    </button>
  );
}
