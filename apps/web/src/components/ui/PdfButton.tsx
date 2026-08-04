import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/cn';
import type { BuiltPdf } from '@/lib/pdf/doc';

/**
 * Taking the record away with you.
 *
 * The label is the platform's, not ours: on a phone that can hand a file to a
 * share sheet this says "Share PDF", because sending the card into the group
 * chat is the actual task; on a desktop it says "Download PDF", because there
 * is nowhere for it to go but the disk. Naming the action after what will
 * happen is the difference between a button someone trusts and one they press
 * to find out.
 *
 * jsPDF and the report builders are a large dependency that almost nobody
 * needs on first paint, so nothing is imported until the button is pressed —
 * the whole PDF layer is a chunk that arrives on demand.
 */

type State = 'idle' | 'working' | 'shared' | 'downloaded' | 'error';

export function PdfButton({
  build,
  label,
  size = 'sm',
  variant = 'secondary',
  disabled = false,
  disabledReason,
  className,
}: {
  /** Fetches whatever the report needs and renders it. Called on press. */
  build: () => Promise<BuiltPdf>;
  /** Overrides the platform-derived wording, when a page needs to be specific. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const [state, setState] = useState<State>('idle');
  const [canShare, setCanShare] = useState(false);
  // A press that resolves after the page has moved on must not set state.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Probed rather than assumed: the answer depends on the browser *and* on
  // whether the document is in a secure context, and getting it wrong means
  // the label promises a share sheet that never opens.
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
      // The reason is almost always a failed fetch, and the recovery is the
      // same either way: press it again once the connection is back.
      if (alive.current) setState('error');
    }
  }

  const wording = label ?? (canShare ? 'Share PDF' : 'Download PDF');

  const confirmation =
    state === 'shared' ? 'Shared' : state === 'downloaded' ? 'Saved' : null;

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
          {confirmation !== null ? '✓' : state === 'error' ? '!' : '↓'}
        </span>
      ) : null}
      {state === 'working'
        ? 'Preparing…'
        : (confirmation ?? (state === 'error' ? 'Try again' : wording))}
    </Button>
  );
}
