import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const fieldShell = cn(
  'h-12 w-full rounded-[var(--radius-sm)] border bg-raised px-3.5 text-primary',
  'transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]',
  'placeholder:text-muted',
);

function stateBorder(hasError: boolean): string {
  return hasError
    ? 'border-[var(--alert)]'
    : 'border-line hover:border-line-strong focus:border-[var(--accent-strong)]';
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={htmlFor} className="eyebrow text-secondary">
        {label}
      </label>

      {children}

      {error ? (
        <p role="alert" className="text-[0.8125rem] text-alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, type, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  const [revealed, setRevealed] = useState(false);

  const isPassword = type === 'password';
  const resolvedType = isPassword && revealed ? 'text' : type;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="eyebrow text-secondary">
        {label}
      </label>

      <div className={cn(isPassword && 'relative')}>
        <input
          {...props}
          type={resolvedType}
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(fieldShell, stateBorder(Boolean(error)), isPassword && 'pr-12', className)}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[var(--radius-sm)] text-muted transition-colors hover:text-primary"
          >
            <EyeIcon crossed={revealed} />
          </button>
        ) : null}
      </div>

      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-[0.8125rem] text-alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[0.8125rem] leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className, id, children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={selectId} error={error} hint={hint}>
      <div className="relative">
        <select
          {...props}
          id={selectId}
          ref={ref}
          className={cn(
            fieldShell,
            stateBorder(Boolean(error)),
            'cursor-pointer appearance-none pr-10',
            className,
          )}
        >
          {children}
        </select>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3.5 grid place-items-center text-muted"
        >
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor">
            <path d="M2.5 4.5 6 8l3.5-3.5" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </Field>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const areaId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={areaId} error={error} hint={hint}>
      <textarea
        {...props}
        id={areaId}
        ref={ref}
        className={cn(
          'w-full rounded-[var(--radius-sm)] border bg-raised p-3.5 text-primary',
          'transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]',
          'placeholder:text-muted',
          stateBorder(Boolean(error)),
          className,
        )}
      />
    </Field>
  );
});

export function Checkbox({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] px-1 py-1.5',
        'transition-colors hover:bg-hover/60',
        className,
      )}
    >
      <input
        {...props}
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--accent-strong)]"
      />
      <span className="min-w-0">
        <span className="block text-sm text-primary">{label}</span>
        {hint ? <span className="block text-[0.8125rem] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function ChoiceChip({
  selected,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] border px-4',
        'text-sm font-medium transition-all duration-[var(--dur-fast)] ease-[var(--ease)]',
        'active:translate-y-px disabled:pointer-events-none disabled:opacity-40',
        selected
          ? 'border-[var(--accent-strong)] bg-accent-soft text-accent'
          : 'border-line bg-raised text-secondary hover:border-line-strong hover:text-primary',
        className,
      )}
    >
      {children}
    </button>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.15rem]"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed ? <path d="m3 3 18 18" /> : null}
    </svg>
  );
}
