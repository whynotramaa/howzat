import { useEffect, useState } from 'react';
import { FOOTBALL_EVENT_LABELS, type FootballEventKind } from '@howzat/shared';
import { cn } from '@/lib/cn';

/*
 * The receipt.
 *
 * A scorer on a touchline is not looking at the screen when they tap — they are
 * looking at the pitch. Before this, the only feedback that a goal had been
 * recorded was a number changing somewhere they were not looking, which is
 * exactly why the console felt inert: the tap and the consequence were in
 * different places.
 *
 * So the confirmation goes over the middle of the screen, at a size that is
 * catchable in peripheral vision, and says the two things the scorer needs to
 * verify without stopping: what was recorded, and for whom.
 *
 * It is fired from the mutation's success, not from its optimistic start. A
 * flash that appears before the write lands would be a receipt for something
 * that had not happened, and the one moment it mattered — a failed submission
 * at the far end of a bad connection — is the one moment it would lie.
 */

export interface FlashPayload {
  kind: FootballEventKind;
  teamShort: string;
  teamColor: string;
  playerName: string | null;
  /** The minute it was stamped with, as it will read on the timeline. */
  minuteLabel: string;
}

const TONES: Record<FootballEventKind, { ring: string; accent: string }> = {
  GOAL: { ring: 'border-[var(--accent-strong)]', accent: 'text-accent' },
  OWN_GOAL: { ring: 'border-line-strong', accent: 'text-secondary' },
  YELLOW_CARD: { ring: 'border-[var(--warning)]', accent: 'text-warning' },
  RED_CARD: { ring: 'border-[var(--alert)]', accent: 'text-alert' },
  SAVE: { ring: 'border-[var(--success)]', accent: 'text-success' },
  SUBSTITUTION: { ring: 'border-line-strong', accent: 'text-secondary' },
};

export function IncidentFlash({ payload }: { payload: FlashPayload | null }) {
  const [shown, setShown] = useState<FlashPayload | null>(null);
  // Bumped on every flash so React remounts the node and the animation
  // restarts — two goals in a minute must produce two flashes, not one.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!payload) return;

    setShown(payload);
    setNonce((value) => value + 1);

    const timer = window.setTimeout(() => setShown(null), 1_600);
    return () => window.clearTimeout(timer);
  }, [payload]);

  if (!shown) return null;

  const tone = TONES[shown.kind];

  return (
    <div
      // Announced politely rather than assertively: a scorer using a screen
      // reader is mid-task, and this is a confirmation, not an alert.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-1/3 z-50 flex justify-center px-6"
    >
      <div
        key={nonce}
        className={cn(
          'incident-flash flex items-center gap-4 rounded-[var(--radius-lg)] border-2 bg-raised',
          'px-6 py-4 shadow-[var(--shadow-lg)]',
          tone.ring,
        )}
      >
        <Glyph kind={shown.kind} />

        <div className="min-w-0">
          <p className={cn('serif text-2xl leading-tight', tone.accent)}>
            {FOOTBALL_EVENT_LABELS[shown.kind]}
          </p>
          <p className="mt-1 truncate text-[0.8125rem] text-secondary">
            {shown.playerName ? `${shown.playerName} · ` : ''}
            <span
              className="mono"
              style={{ color: shown.teamColor }}
            >
              {shown.teamShort}
            </span>
            <span className="mx-1.5 text-line-strong">·</span>
            <span className="mono">{shown.minuteLabel}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** The same marks the timeline uses, at the size this needs. */
function Glyph({ kind }: { kind: FootballEventKind }) {
  if (kind === 'YELLOW_CARD' || kind === 'RED_CARD') {
    return (
      <span
        aria-hidden
        className={cn(
          'h-10 w-7 shrink-0 rounded-[2px] ring-1 ring-black/25',
          kind === 'RED_CARD' ? 'bg-[#c8332a]' : 'bg-[#e0b23c]',
        )}
      />
    );
  }

  if (kind === 'SUBSTITUTION') {
    return (
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-line-strong text-secondary"
      >
        <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M2 5h9M9 3l2 2-2 2M14 11H5m2-2-2 2 2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (kind === 'SAVE') {
    return (
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-[var(--success)]"
      >
        <span className="size-3 rounded-full bg-[var(--success)]" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full',
        kind === 'OWN_GOAL' ? 'bg-line-strong' : 'bg-[var(--accent-strong)]',
      )}
    >
      <span className="size-4 rounded-full bg-white/85" />
    </span>
  );
}
