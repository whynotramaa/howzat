import { useEffect, useState } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

export function ShareLink({
  slug,
  label = 'Copy link',
  size = 'sm',
  variant = 'secondary',
  matchLabel,
  url: explicitUrl,
}: {
  slug?: string;
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary' | 'quiet';
  matchLabel?: string;
  url?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const url = explicitUrl ?? `${window.location.origin}/live/${slug ?? ''}`;

  async function handleShare() {
    const canShare = typeof navigator.share === 'function';

    if (canShare) {
      try {
        await navigator.share({
          title: matchLabel ? `${matchLabel} — live on Howzat` : 'Live on Howzat',
          text: matchLabel
            ? `Follow ${matchLabel} ball by ball.`
            : 'Follow the score ball by ball.',
          url,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={() => void handleShare()}
      aria-live="polite"
      className={cn(copied && 'text-accent')}
    >
      <span aria-hidden className="mono text-[0.8125rem]">
        {copied ? '✓' : '⧉'}
      </span>
      {copied ? 'Link copied' : label}
    </Button>
  );
}
