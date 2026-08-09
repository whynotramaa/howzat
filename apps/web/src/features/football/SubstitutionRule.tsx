import { cn } from '@/lib/cn';

interface Option {
  limit: number | null;
  label: string;
  detail: string;
}

const OPTIONS: Option[] = [
  { limit: 3, label: 'Three', detail: 'Per side' },
  { limit: 5, label: 'Five', detail: 'Per side' },
  { limit: null, label: 'Unlimited', detail: 'Rolling' },
];

export function SubstitutionRule({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (limit: number | null) => void;
}) {
  return (
    <div>
      <p className="eyebrow mb-3">Substitutions</p>

      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => {
          const active = option.limit === value;

          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(option.limit)}
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
                {option.label}
              </span>
              <span className="mono text-[0.6875rem] text-muted">{option.detail}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[0.8125rem] text-secondary">
        {value === null
          ? 'Futsal rules — a side can change as often as it likes, and a player who has come off can go straight back on.'
          : `Each side gets ${value} changes. A player who has come off can still be brought back on, so long as the side has a change left.`}
      </p>
    </div>
  );
}
