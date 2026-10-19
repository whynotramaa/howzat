import type { CSSProperties, ReactNode } from 'react';
import type { Sport } from '@howzat/shared';
import { cn } from '@/lib/cn';

export function delayed(ms: number, extra?: Record<string, string | number>): CSSProperties {
  return { '--len': 1, '--delay': `${ms}ms`, ...extra } as CSSProperties;
}

export function Stroke({
  d,
  delay = 0,
  color = 'currentColor',
  width = 1.8,
  dashed,
}: {
  d: string;
  delay?: number;
  color?: string;
  width?: number;
  dashed?: boolean;
}) {
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? '0.012 0.018' : undefined}
      className={dashed ? 'sketch-fade' : 'sketch-draw'}
      style={delayed(delay)}
      filter="url(#sketch-rough)"
    />
  );
}

export function Label({
  x,
  y,
  children,
  anchor = 'middle',
  delay = 0,
  size = 17,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  delay?: number;
  size?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      className="sketch-label sketch-fade"
      style={delayed(delay)}
    >
      {children}
    </text>
  );
}

export function SketchDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <filter id="sketch-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.2" />
        </filter>
      </defs>
    </svg>
  );
}

export type SceneName = 'trophy' | 'stumps' | 'goal' | 'squad' | 'fixtures' | 'scorebook';

export function Scene({
  name,
  className,
}: {
  name: SceneName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 220 140"
      aria-hidden
      className={cn('block h-auto w-full max-w-[220px] text-primary', className)}
    >
      <Stroke d="M14 124c64-3 128-3 192 0" width={1.2} />
      {SCENES[name]}
    </svg>
  );
}

const SCENES: Record<SceneName, ReactNode> = {
  trophy: (
    <>
      <Stroke d="M84 30c18-1 36-1 52 0-1 30-8 46-26 50-18-4-25-20-26-50Z" delay={100} />
      <Stroke d="M84 38c-14-2-18 18-2 24M136 38c14-2 18 18 2 24" width={1.4} delay={400} />
      <Stroke d="M110 80v18M94 108c10-4 22-4 32 0l2 10H92Z" delay={600} />
      <Stroke d="M98 44c6 10 14 14 24 12" color="var(--ink-amber)" width={2.4} delay={900} />
      <Stroke d="M58 34l6 6M64 34l-6 6M160 24l5 5M165 24l-5 5" color="var(--ink-blue)" width={1.4} delay={1100} />
      <Stroke d="M52 74c4-2 8 2 12 0M156 66c4-2 8 2 12 0" color="var(--ink-red)" width={1.4} delay={1200} />
    </>
  ),
  stumps: (
    <>
      <Stroke d="M92 120c1-24 0-48-1-70M110 120c0-24 1-48 0-71M128 120c1-24 0-48 0-70" delay={100} />
      <Stroke d="M88 49c8-2 16-2 22 0M110 49c8-2 16-1 22 1" width={1.6} delay={500} />
      <Stroke d="M150 112c4-8 14-10 20-4 6 6 2 16-6 18-8 2-16-6-14-14Z" color="var(--ink-red)" delay={800} />
      <Stroke d="M156 108c4 4 8 8 10 14" color="var(--ink-red)" width={1} delay={1000} />
      <Stroke d="M40 70c20-14 34-16 46-14" color="var(--ink-blue)" dashed delay={1100} />
    </>
  ),
  goal: (
    <>
      <Stroke d="M54 124c-1-30 0-56 2-80 36-2 74-2 110 0 2 24 2 50 1 80" delay={100} />
      <Stroke
        d="M76 46v78M98 45v79M120 45v79M142 46v78M56 70c36-2 74-2 110 0M56 96c36-2 74-2 110 0"
        width={0.8}
        delay={500}
      />
      <Stroke d="M178 118c4-8 14-9 19-3 5 7 1 14-6 15-8 1-15-5-13-12Z" color="var(--ink-green)" delay={900} />
      <Stroke d="M30 84c16-6 26-6 34-2" color="var(--ink-blue)" dashed delay={1100} />
    </>
  ),
  squad: (
    <>
      {[60, 110, 160].map((x, index) => (
        <g key={x}>
          <Stroke
            d={`M${x - 11} 52c0-8 5-13 11-13s11 5 11 13-5 13-11 13-11-5-11-13Z`}
            delay={index * 200}
          />
          <Stroke
            d={`M${x - 22} 118c0-22 9-36 22-36s22 14 22 36`}
            color={['var(--ink-blue)', 'var(--ink-red)', 'var(--ink-green)'][index]}
            delay={300 + index * 200}
          />
        </g>
      ))}
    </>
  ),
  fixtures: (
    <>
      {[30, 62, 94].map((y, index) => (
        <g key={y}>
          <Stroke d={`M36 ${y}c18-1 34-1 52 0`} delay={index * 120} />
          <Stroke d={`M132 ${y}c18-1 34-1 52 0`} delay={60 + index * 120} />
          <Label x={110} y={y + 5} delay={400 + index * 120} size={15}>
            v
          </Label>
        </g>
      ))}
      <Stroke d="M30 30c-8 0-8 64 0 64" color="var(--ink-amber)" width={1.4} delay={900} />
    </>
  ),
  scorebook: (
    <>
      <Stroke d="M58 26c34-2 70-2 104 0 2 32 2 62 0 92-34 2-70 2-104 0-2-30-2-60 0-92Z" delay={100} />
      <Stroke d="M110 26v92" width={1} delay={300} />
      {[44, 60, 76, 92].map((y, index) => (
        <Stroke key={y} d={`M68 ${y}h32M120 ${y}h32`} width={1} delay={500 + index * 80} />
      ))}
      <Stroke d="M124 60c4-4 8-4 10 0s6 4 10 0" color="var(--ink-blue)" width={1.6} delay={1000} />
      <Stroke d="M72 92l6 4 10-10" color="var(--ink-green)" width={1.8} delay={1200} />
    </>
  ),
};

export function SportGlyph({ sport, className }: { sport: Sport; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={cn('size-12 shrink-0 text-primary', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {sport === 'CRICKET' ? (
        <>
          <path d="M14 36c6-7 13-15 20-23l3 3c-7 8-14 15-21 21Z" />
          <path d="M34 13l4-4" />
          <circle cx="34" cy="34" r="5" stroke="var(--ink-red)" />
          <path d="M31 31c2 2 4 4 6 6" stroke="var(--ink-red)" strokeWidth="1" />
        </>
      ) : (
        <>
          <circle cx="24" cy="24" r="13" />
          <path d="M24 17l6 4.4-2.3 7h-7.4l-2.3-7Z" fill="var(--ink-green)" stroke="var(--ink-green)" />
          <path d="M24 17v-6M30 21.4l6-2M27.7 28.4l3.6 5M20.3 28.4l-3.6 5M18 21.4l-6-2" strokeWidth="1.1" />
        </>
      )}
    </svg>
  );
}
