import { useEffect, useState, type CSSProperties } from 'react';
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
 * It is built out of four things happening on one beat:
 *
 *   the aura   a wash of the incident's colour thrown onto the page and let go
 *   the card   arriving through the plane, overshooting a hair, settling
 *   the sheen  one specular sweep, so the surface reads as lit rather than painted
 *   the word   landing letter-spaced and closing up into something read
 *
 * All of it is one keyframe each and none of it loops. This is the only piece of
 * theatre in the product, and it is theatre that does a job: it is the receipt.
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

/** One colour per incident. Everything else on the card is mixed from it. */
const TONE: Record<FootballEventKind, string> = {
  GOAL: 'var(--accent-strong)',
  OWN_GOAL: 'var(--text-muted)',
  YELLOW_CARD: '#e0b23c',
  RED_CARD: 'var(--alert)',
  SAVE: 'var(--success)',
  SUBSTITUTION: 'var(--text-secondary)',
};

const HOLD_MS = 1_900;

export function IncidentFlash({ payload }: { payload: FlashPayload | null }) {
  const [shown, setShown] = useState<FlashPayload | null>(null);
  // Bumped on every flash so React remounts the node and the animation
  // restarts — two goals in a minute must produce two flashes, not one.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!payload) return;

    setShown(payload);
    setNonce((value) => value + 1);

    const timer = window.setTimeout(() => setShown(null), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [payload]);

  if (!shown) return null;

  const tone = TONE[shown.kind];

  return (
    <div
      // Announced politely rather than assertively: a scorer using a screen
      // reader is mid-task, and this is a confirmation, not an alert.
      role="status"
      aria-live="polite"
      key={nonce}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ '--flash-tone': tone } as CSSProperties}
    >
      <div aria-hidden className="incident-aura absolute inset-0" />

      <div
        className={cn(
          'incident-flash relative flex items-center gap-5 overflow-hidden',
          'rounded-[var(--radius-xl)] border bg-raised px-7 py-5',
          'shadow-[var(--shadow-lg)]',
        )}
        style={{
          borderColor: `color-mix(in oklab, ${tone} 60%, transparent)`,
          boxShadow: `0 32px 70px -30px color-mix(in oklab, ${tone} 55%, transparent), var(--shadow-lg)`,
        }}
      >
        <span aria-hidden className="incident-sheen" />

        {/* The tone as a 3px bar down the leading edge — the same device the
            timeline uses, so the receipt and the log read as one system. */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: tone }}
        />

        <Glyph kind={shown.kind} tone={tone} />

        <div className="min-w-0">
          <p
            className="incident-word serif text-[1.75rem] leading-none whitespace-nowrap"
            style={{ color: tone }}
          >
            {FOOTBALL_EVENT_LABELS[shown.kind]}
          </p>

          <p className="mt-2 truncate text-[0.8125rem] text-secondary">
            {shown.playerName ? <span className="text-primary">{shown.playerName}</span> : null}
            {shown.playerName ? <span className="mx-2 text-line-strong">·</span> : null}
            <span className="mono font-medium" style={{ color: shown.teamColor }}>
              {shown.teamShort}
            </span>
            <span className="mx-2 text-line-strong">·</span>
            <span className="mono">{shown.minuteLabel}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** The same marks the timeline uses, at the size this needs. */
function Glyph({ kind, tone }: { kind: FootballEventKind; tone: string }) {
  const shell = 'incident-glyph grid size-12 shrink-0 place-items-center rounded-full';

  if (kind === 'YELLOW_CARD' || kind === 'RED_CARD') {
    return (
      <span
        aria-hidden
        className="incident-glyph h-12 w-8 shrink-0 rounded-[3px] shadow-[0_6px_14px_-6px_rgb(0_0_0/0.5)] ring-1 ring-black/25"
        style={{ background: kind === 'RED_CARD' ? '#c8332a' : '#e0b23c' }}
      />
    );
  }

  if (kind === 'SUBSTITUTION') {
    return (
      <span
        aria-hidden
        className={cn(shell, 'border-2 border-line-strong text-secondary')}
      >
        <svg viewBox="0 0 16 16" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M2 5h9M9 3l2 2-2 2M14 11H5m2-2-2 2 2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (kind === 'SAVE') {
    return (
      <span aria-hidden className={cn(shell, 'border-2')} style={{ borderColor: tone }}>
        <span className="size-3.5 rounded-full" style={{ background: tone }} />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={shell}
      style={{
        background: tone,
        boxShadow: `0 8px 22px -8px color-mix(in oklab, ${tone} 80%, transparent)`,
      }}
    >
      <span className="size-5 rounded-full bg-white/85" />
    </span>
  );
}
