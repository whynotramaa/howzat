import { useEffect, useState } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

/**
 * Copying the public link.
 *
 * This is the single most-used action in the product — the link is how a match
 * reaches the group chat — so it never requires opening the page first, and it
 * confirms in place rather than through a toast that appears somewhere else.
 *
 * Where the platform supports it, the native share sheet is offered first: on a
 * phone, sharing straight into WhatsApp is the actual task, and copy-then-paste
 * is the fallback for a desktop.
 */
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
  /** Used as the share title, e.g. "CSK v MI". */
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
          text: matchLabel ? `Follow ${matchLabel} ball by ball.` : 'Follow the score ball by ball.',
          url,
        });
        return;
      } catch {
        // A dismissed share sheet is not a failure — fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure origin, or a permission refused): select the
      // URL so it can be copied by hand rather than failing silently.
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
