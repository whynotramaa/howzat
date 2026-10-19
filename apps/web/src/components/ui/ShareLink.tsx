import { toast } from './Toast';
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
          title: matchLabel ? `${matchLabel} live on Howzat` : 'Live on Howzat',
          text: matchLabel
            ? `Follow ${matchLabel} ball by ball.`
            : 'Follow the score ball by ball.',
          url,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast('Link copied');
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
      <span aria-hidden>
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d={copied ? 'm4 10 4 4 8-8' : 'M7 7h10v10H7zM3 12V3h9'} />
        </svg>
      </span>
      {copied ? 'Copied' : label}
    </Button>
  );
}
