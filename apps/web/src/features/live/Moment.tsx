import { useEffect, useRef, useState } from 'react';
import type { BallSummary } from '@howzat/shared';

type MomentKind = 'four' | 'six' | 'wicket';

interface Moment {
  id: number;
  kind: MomentKind;
  sub: string;
}

const COPY: Record<MomentKind, { word: string; ink: string; glow: string }> = {
  four: { word: 'FOUR', ink: 'var(--cool)', glow: 'rgb(103 179 245 / 0.28)' },
  six: { word: 'SIX', ink: 'var(--pos)', glow: 'rgb(62 224 137 / 0.3)' },
  wicket: { word: 'OUT', ink: 'var(--hot)', glow: 'rgb(255 143 74 / 0.3)' },
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

  const { word, ink, glow } = COPY[moment.kind];

  return (
    <div
      key={moment.id}
      className="moment"
      role="status"
      aria-live="polite"
      style={{ '--moment-ink': ink, '--moment-glow': glow } as React.CSSProperties}
    >
      <span aria-hidden className="moment-ring" />
      <span aria-hidden className="moment-ring" />
      <span aria-hidden className="moment-ring" />

      <div className="flex flex-col items-center">
        <p className="moment-word">{word}</p>
        <p className="moment-sub micro text-secondary">Over {moment.sub}</p>
      </div>
    </div>
  );
}
