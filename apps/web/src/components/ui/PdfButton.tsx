import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/cn';
import type { BuiltPdf } from '@/lib/pdf/doc';

type State = 'idle' | 'working' | 'shared' | 'downloaded' | 'error';

export function PdfButton({
  build,
  label,
  size = 'sm',
  variant = 'secondary',
  disabled = false,
  disabledReason,
  arrow = false,
  className,
}: {
  build: () => Promise<BuiltPdf>;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  disabledReason?: string;
  arrow?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<State>('idle');
  const [canShare, setCanShare] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void import('@/lib/pdf/share').then(({ canShareFiles }) => {
      if (!cancelled) setCanShare(canShareFiles());
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state === 'idle' || state === 'working') return;

    const timer = window.setTimeout(() => setState('idle'), 2800);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function handleClick() {
    setState('working');

    try {
      const [{ deliverPdf }, built] = await Promise.all([import('@/lib/pdf/share'), build()]);
      const delivery = await deliverPdf(built.blob, built.fileName, {
        title: built.title,
        text: built.text,
      });

      if (alive.current) setState(delivery);
    } catch {
      if (alive.current) setState('error');
    }
  }

  const wording = label ?? (canShare ? 'Share PDF' : 'Download PDF');

  const confirmation = state === 'shared' ? 'Shared' : state === 'downloaded' ? 'Saved' : null;

  return (
    <Button
      size={size}
      variant={variant}
      disabled={disabled}
      isLoading={state === 'working'}
      onClick={() => void handleClick()}
      title={disabled ? disabledReason : undefined}
      aria-live="polite"
      className={cn(
        confirmation !== null && 'text-accent',
        state === 'error' && 'text-alert',
        className,
      )}
    >
      {state !== 'working' ? (
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d={
              confirmation !== null
                ? 'm3.5 8.5 3 3 6-7'
                : state === 'error'
                  ? 'M8 3.5v5.5M8 12v.5'
                  : arrow
                    ? 'M3 8h10m-4-4 4 4-4 4'
                    : 'M8 2.5v8m-3.5-3.5L8 10.5 11.5 7M3 13.5h10'
            }
          />
        </svg>
      ) : null}
      {state === 'working'
        ? 'Preparing…'
        : (confirmation ?? (state === 'error' ? 'Try again' : wording))}
    </Button>
  );
}
