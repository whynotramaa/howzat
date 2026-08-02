import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * A control with mass.
 *
 * The rest of the system is flat on purpose — a scorecard is a document, and
 * documents do not have buttons that stick out of them. The scoring console is
 * the exception, and the reason is not decoration:
 *
 *   • It is operated one-handed, at a ground, in daylight, by somebody whose
 *     eyes are on the pitch rather than the phone. A flat rectangle gives a
 *     thumb nothing to aim at; an extrusion does.
 *   • The most expensive mistake on this screen is a goal recorded a minute
 *     late because the scorer was not sure the tap had registered. A control
 *     that visibly travels is the confirmation, and it costs no time.
 *
 * The travel is real rather than a scale: the face moves down, the side wall it
 * was riding on is consumed, and the cast shadow tightens. Press is 34ms and
 * release is 220ms with a little overshoot, because that asymmetry is what a
 * physical key does and it is most of why this feels like hardware.
 *
 * `tone` is a colour, not a variant name — the button's whole surface, wall and
 * shadow are mixed from it, so a new one is one hex value rather than a new
 * branch.
 */

export interface PushButtonProps {
  tone: string;
  /** Height of the extrusion. The hero control gets more travel than the rest. */
  depth?: number;
  radius?: string;
  /** Text laid over the face. White on a saturated tone, ink on a pale one. */
  faceClassName?: string;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel?: string;
  children: ReactNode;
}

export function PushButton({
  tone,
  depth = 9,
  radius = 'var(--radius-lg)',
  faceClassName,
  className,
  disabled = false,
  onClick,
  ariaLabel,
  children,
}: PushButtonProps) {
  // Keyed remount rather than a class toggle: a scorer tapping twice in quick
  // succession has to see two presses, and a CSS animation that is already
  // running will not restart on its own.
  const [presses, setPresses] = useState(0);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        setPresses((count) => count + 1);
        onClick();
      }}
      className={cn('push', className)}
      style={
        {
          '--push-tone': tone,
          '--push-depth': `${depth}px`,
          '--push-radius': radius,
        } as CSSProperties
      }
    >
      <span aria-hidden className="push__shadow" />
      <span aria-hidden className="push__edge" />

      <span className={cn('push__face relative overflow-hidden', faceClassName)}>
        {children}
        {presses > 0 ? <span key={presses} aria-hidden className="push-halo" /> : null}
      </span>
    </button>
  );
}
