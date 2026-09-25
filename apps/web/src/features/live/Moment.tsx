import { useEffect, useRef, useState } from 'react';
import type { BallSummary } from '@howzat/shared';

type MomentKind = 'four' | 'six' | 'wicket';

interface Moment {
  id: number;
  kind: MomentKind;
  sub: string;
}

function classify(ball: BallSummary): MomentKind | null {
  if (ball.isWicket) return 'wicket';
  if (ball.extraType !== null) return null;
  if (ball.runs === 6) return 'six';
  if (ball.runs === 4) return 'four';
  return null;
}

/**
 * Watches the snapshot for the three deliveries worth interrupting the page
 * for. The first snapshot only seeds the watermark, because arriving at a
 * match that is already 40 overs old must not replay its last six.
 */
export function useMoment(
  lastEventSeq: number,
  recentBalls: ReadonlyArray<BallSummary>,
): Moment | null {
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

    setMoment({ id: latest.seq, kind, sub: `${latest.overNumber}.${latest.ballNumber}` });
  }, [lastEventSeq, recentBalls]);

  useEffect(() => {
    if (!moment) return;
    const timer = window.setTimeout(() => setMoment(null), 2200);
    return () => window.clearTimeout(timer);
  }, [moment]);

  return moment;
}

/*
 * The drawings.
 *
 * Everything is one stroke width, drawn on a 320x220 board, and inked in by
 * `stroke-dashoffset`. `--len` is a generous over-estimate of each path's
 * length, which is all the animation needs to run cleanly.
 */

const COPY: Record<MomentKind, { word: string; note: string; ink: string }> = {
  four: { word: 'Four', note: 'Boundary', ink: 'var(--accent)' },
  six: { word: 'Six', note: 'Maximum', ink: 'var(--accent)' },
  wicket: { word: 'Wicket', note: 'Out', ink: 'var(--live)' },
};

function Stroke({
  d,
  i = 0,
  len = 420,
  width = 3,
  cap = 'round',
}: {
  d: string;
  i?: number;
  len?: number;
  width?: number;
  cap?: 'round' | 'butt';
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap={cap}
      strokeLinejoin="round"
      className="ink-draw"
      style={{ '--len': len, '--i': i } as React.CSSProperties}
    />
  );
}

/** The ball racing away, then the rope it beat. */
function FourDrawing() {
  return (
    <>
      <Stroke d="M22 132 C 92 84, 168 72, 292 96" len={300} i={0} />
      <Stroke d="M262 82 l30 14 -26 20" len={80} i={1} />
      <Stroke d="M18 152 C 110 142, 210 142, 302 154" len={300} i={2} width={2} />
      <Stroke d="M40 114 l-16 -12 M62 102 l-12 -18" len={40} i={3} width={2} />
      <circle
        cx="24"
        cy="132"
        r="7"
        fill="currentColor"
        className="ink-pop"
        style={{ '--i': 0 } as React.CSSProperties}
      />
    </>
  );
}

/** Over the rope and gone, with the crowd noise scribbled in. */
function SixDrawing() {
  return (
    <>
      <Stroke d="M24 190 C 70 40, 210 26, 300 96" len={380} i={0} />
      <Stroke d="M276 74 l26 22 -32 12" len={80} i={1} />
      <Stroke d="M46 60 l14 -22 M92 40 l6 -26 M142 30 l-2 -26" len={90} i={2} width={2} />
      <Stroke d="M18 200 C 110 190, 214 190, 306 202" len={300} i={3} width={2} />
      <circle
        cx="300"
        cy="96"
        r="8"
        fill="currentColor"
        className="ink-pop"
        style={{ '--i': 2 } as React.CSSProperties}
      />
    </>
  );
}

/** Three stumps, two bails leaving, one appeal. */
function WicketDrawing() {
  return (
    <>
      <Stroke d="M126 86 L122 190 M160 84 L160 190 M194 86 L198 190" len={120} i={0} />
      <Stroke d="M96 44 l24 22 -26 12" len={70} i={1} width={2} />
      <Stroke d="M206 40 c 22 6, 34 18, 38 32" len={70} i={1} width={2} />
      <Stroke d="M74 196 C 140 186, 200 186, 250 198" len={220} i={2} width={2} />
      <Stroke d="M60 96 l-22 -14 M262 92 l24 -16" len={50} i={3} width={2} />
      <rect
        x="112"
        y="52"
        width="34"
        height="9"
        rx="4"
        fill="currentColor"
        className="ink-pop"
        style={{ '--i': 1 } as React.CSSProperties}
      />
      <rect
        x="180"
        y="44"
        width="34"
        height="9"
        rx="4"
        fill="currentColor"
        className="ink-pop"
        style={{ '--i': 2 } as React.CSSProperties}
      />
    </>
  );
}

const DRAWING: Record<MomentKind, () => React.JSX.Element> = {
  four: FourDrawing,
  six: SixDrawing,
  wicket: WicketDrawing,
};

const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  a: `${(i * 360) / 22 + (i % 3) * 7}deg`,
  r: `${-30 - ((i * 37) % 24)}vmin`,
  d: `${(i % 5) * 30}ms`,
}));

export function MomentOverlay({ moment }: { moment: Moment | null }) {
  if (!moment) return null;

  const { word, note, ink } = COPY[moment.kind];
  const Drawing = DRAWING[moment.kind];
  const rings = moment.kind === 'six' ? 3 : moment.kind === 'four' ? 2 : 1;

  return (
    <div
      key={moment.id}
      className="moment"
      data-kind={moment.kind}
      role="status"
      aria-live="polite"
      style={{ '--moment-ink': ink } as React.CSSProperties}
    >
      {Array.from({ length: rings }, (_, i) => (
        <span key={i} aria-hidden className="moment-ring" style={{ '--i': i } as React.CSSProperties} />
      ))}
      {moment.kind !== 'wicket'
        ? SPARKS.slice(0, moment.kind === 'six' ? 22 : 10).map((spark, i) => (
            <span
              key={i}
              aria-hidden
              className="moment-spark"
              style={{ '--a': spark.a, '--r': spark.r, '--d': spark.d } as React.CSSProperties}
            />
          ))
        : null}

      <div className="moment-plate flex flex-col items-center">
        <svg viewBox="0 0 320 220" aria-hidden className="w-56 sm:w-64" style={{ color: ink }}>
          <Drawing />
        </svg>

        <p className="moment-badge -mt-2" aria-label={word}>
          {[...word].map((letter, i) => (
            <span key={i} aria-hidden style={{ '--i': i } as React.CSSProperties}>
              {letter}
            </span>
          ))}
        </p>

        <p className="hand mt-3 text-[1.75rem] text-secondary">{note}</p>
        <p className="mono mt-1 text-xs tracking-[0.3em] text-muted uppercase">Over {moment.sub}</p>
      </div>
    </div>
  );
}

/**
 * One displacement filter roughens every stroke at once, which is what stops
 * the drawings reading as vector art. Rendered once per page so anything with
 * `.sketch` can use it.
 */
export function SketchFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <filter id="ink-sketch" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03"
            numOctaves="3"
            seed="9"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="2.4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
