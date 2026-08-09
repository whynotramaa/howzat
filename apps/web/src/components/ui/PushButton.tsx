import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PushButtonProps {
  tone: string;
  depth?: number;
  radius?: string;
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
