import { useEffect, useRef, useState } from 'react';
import type { BallSummary } from '@howzat/shared';

type MomentKind = 'four' | 'six' | 'wicket';

interface Moment {
  id: number;
  kind: MomentKind;
  sub: string;
}

const COPY: Record<MomentKind, { word: string; ink: string }> = {
  four: { word: 'FOUR', ink: 'var(--accent)' },
  six: { word: 'SIX', ink: 'var(--accent-strong)' },
  wicket: { word: 'OUT', ink: 'var(--live)' },
};

function classify(ball: BallSummary): MomentKind | null {
  if (ball.isWicket) return 'wicket';
  if (ball.extraType !== null) return null;
  if (ball.runs === 6) return 'six';
  if (ball.runs === 4) return 'four';
  return null;
}

/**
 * Watches the snapshot for the three deliveries worth interrupting the page
 * for. The first snapshot only seeds the watermark — arriving at a match that
 * is already 40 overs old must not replay its last six.
 */
export function useMoment(lastEventSeq: number, recentBalls: BallSummary[]): Moment | null {
  const [moment, setMoment] = useState<Moment | null>(null);
  const watermark = useRef<number | null>(null);

  useEffect(() => {
    const previous = watermark.current;
    watermark.current = lastEventSeq;

    if (previous === null || lastEventSeq <= previous) return;

    const latest = recentBalls[recentBalls.length - 1];
    if (!latest || latest.seq <= previous) return;

    const kind = classify(latest);
    if (!kind) return;

    setMoment({
      id: latest.seq,
      kind,
      sub: `${latest.overNumber}.${latest.ballNumber}`,
    });
  }, [lastEventSeq, recentBalls]);

  useEffect(() => {
    if (!moment) return;
    const timer = window.setTimeout(() => setMoment(null), 1600);
    return () => window.clearTimeout(timer);
  }, [moment]);

  return moment;
}

export function MomentOverlay({ moment }: { moment: Moment | null }) {
  if (!moment) return null;

  const { word, ink } = COPY[moment.kind];

  return (
    <div
      key={moment.id}
      className="moment"
      role="status"
      aria-live="polite"
      style={{ '--moment-ink': ink } as React.CSSProperties}
    >
      <span aria-hidden className="moment-ring" />
      <span aria-hidden className="moment-ring" />
      <span aria-hidden className="moment-ring" />

      <div className="flex flex-col items-center gap-3">
        <p className="moment-word">{word}</p>
        <p className="eyebrow">Over {moment.sub}</p>
      </div>
    </div>
  );
}
