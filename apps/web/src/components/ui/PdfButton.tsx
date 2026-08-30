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
        <span aria-hidden className="mono text-[0.8125rem]">
          {confirmation !== null ? '✓' : state === 'error' ? '!' : arrow ? '→' : '↓'}
        </span>
      ) : null}
      {state === 'working'
        ? 'Preparing…'
        : (confirmation ?? (state === 'error' ? 'Try again' : wording))}
    </Button>
  );
}
