import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------ *
 * Chapter registry
 *
 * Every chapter registers its id and title on mount. The minimap reads
 * the list, so adding a chapter never means editing a second array.
 * ------------------------------------------------------------------ */

export interface ChapterEntry {
  id: string;
  num: string;
  title: string;
}

interface RegistryValue {
  register: (entry: ChapterEntry, el: HTMLElement) => () => void;
}

const RegistryContext = createContext<RegistryValue | null>(null);

export function ChapterProvider({
  children,
  onChange,
}: {
  children: ReactNode;
  onChange: (entries: ChapterEntry[], activeId: string) => void;
}) {
  const nodes = useRef(new Map<string, { entry: ChapterEntry; el: HTMLElement }>());
  const order = useRef<string[]>([]);
  const activeId = useRef('');

  const publish = useCallback(() => {
    const entries = order.current
      .map((id) => nodes.current.get(id)?.entry)
      .filter((e): e is ChapterEntry => Boolean(e));
    onChange(entries, activeId.current);
  }, [onChange]);

  const register = useCallback(
    (entry: ChapterEntry, el: HTMLElement) => {
      nodes.current.set(entry.id, { entry, el });
      // Keep registry order equal to document order, not mount order.
      order.current = [...nodes.current.values()]
        .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        .map((n) => n.entry.id);
      publish();
      return () => {
        nodes.current.delete(entry.id);
        order.current = order.current.filter((id) => id !== entry.id);
        publish();
      };
    },
    [publish],
  );

  // One scroll listener decides the active chapter: the last heading whose top
  // has passed a quarter of the viewport. An IntersectionObserver gets this
  // wrong for chapters taller than the screen, which most of them are.
  useEffect(() => {
    let frame = 0;
    const recompute = () => {
      frame = 0;
      const line = window.innerHeight * 0.28;
      let current = order.current[0] ?? '';
      for (const id of order.current) {
        const node = nodes.current.get(id);
        if (!node) continue;
        if (node.el.getBoundingClientRect().top <= line) current = id;
      }
      if (current !== activeId.current) {
        activeId.current = current;
        publish();
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(recompute);
    };
    recompute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [publish]);

  const value = useMemo(() => ({ register }), [register]);
  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

/* ------------------------------------------------------------------ *
 * Chapter
 * ------------------------------------------------------------------ */

export function Chapter({
  id,
  num,
  title,
  standfirst,
  children,
}: {
  id: string;
  num: string;
  title: string;
  standfirst?: ReactNode;
  children: ReactNode;
}) {
  const registry = useContext(RegistryContext);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!registry || !ref.current) return;
    return registry.register({ id, num, title }, ref.current);
  }, [registry, id, num, title]);

  return (
    <section ref={ref} id={id} className="eng-chapter eng-prose flex flex-col gap-8 pt-20">
      <header className="relative flex flex-col gap-4">
        <span aria-hidden className="eng-chapter-num tabular">
          {num}
        </span>
        <div className="min-w-0">
          <p className="eyebrow mb-2.5">Chapter {num}</p>
          <h2 className="serif text-[2rem] text-primary sm:text-[2.5rem]">{title}</h2>
        </div>
        {standfirst ? (
          <p className="serif text-[1.1875rem] leading-[1.5] text-secondary">{standfirst}</p>
        ) : null}
        <div className="rule" />
      </header>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Minimap
 * ------------------------------------------------------------------ */

export function Minimap({ entries, activeId }: { entries: ChapterEntry[]; activeId: string }) {
  if (entries.length === 0) return null;

  return (
    <nav className="eng-minimap" aria-label="Chapters">
      <ul className="flex flex-col">
        {entries.map((entry, i) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className="eng-minimap-item"
              data-active={entry.id === activeId}
              title={`${entry.num}. ${entry.title}`}
              style={{ '--delay': `${i * 12}ms` } as React.CSSProperties}
            >
              {/* The label is hover-only. At rest the rail is ticks and nothing else. */}
              <span className="eng-minimap-label">{entry.title}</span>
              <span aria-hidden className="eng-minimap-tick" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The phone equivalent of the minimap: a floating button that opens the
 * chapter list over the page. A native select was fine but invisible — nobody
 * finds a jump control parked in a header they have already scrolled past.
 */
export function ChapterSheet({ entries, activeId }: { entries: ChapterEntry[]; activeId: string }) {
  const [open, setOpen] = useState(false);
  const active = entries.find((entry) => entry.id === activeId);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <div className="eng-sheet-root">
      {open ? (
        <button
          type="button"
          className="eng-sheet-scrim"
          aria-label="Close the chapter list"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open ? (
        <nav className="eng-sheet" aria-label="Chapters">
          <p className="eyebrow px-4 pt-3.5 pb-2">Chapters</p>
          <ol className="eng-sheet-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  className="eng-sheet-item"
                  data-active={entry.id === activeId}
                  onClick={() => setOpen(false)}
                >
                  <span className="eng-sheet-num tabular">{entry.num}</span>
                  <span className="min-w-0 flex-1">{entry.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <button
        type="button"
        className="eng-sheet-fab"
        aria-expanded={open}
        aria-label={open ? 'Close the chapter list' : 'Open the chapter list'}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Icon name={open ? 'close' : 'list'} size={16} />
        <span className="tabular">{active ? active.num : '01'}</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Figure: a drawing, its controls, and its caption
 * ------------------------------------------------------------------ */

export function Figure({
  label,
  caption,
  controls,
  hint,
  log,
  children,
  className,
}: {
  label: string;
  caption?: ReactNode;
  controls?: ReactNode;
  /** One imperative sentence telling the reader what to press first. */
  hint?: ReactNode;
  log?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn('eng-figure my-2 flex flex-col', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5 sm:px-4">
        <span className="eyebrow truncate">{label}</span>
        <span aria-hidden className="mono hidden shrink-0 text-[0.625rem] text-muted sm:inline">
          interactive
        </span>
      </div>
      {hint ? (
        <p className="eng-hint">
          <Icon name="hand" />
          <span>{hint}</span>
        </p>
      ) : null}
      <div className="eng-figure-stage">{children}</div>
      {controls ? <div className="eng-figure-bar">{controls}</div> : null}
      {log}
      {caption ? (
        <figcaption className="border-t border-line px-3 py-3 text-[0.8125rem] text-muted sm:px-4">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * A labelled cluster of controls. Without the label, a bar of eight buttons is
 * a puzzle: nothing says which ones drive the model and which ones break it.
 */
export function Controls({
  label,
  children,
  tone,
}: {
  label: string;
  children: ReactNode;
  tone?: 'danger';
}) {
  return (
    <div className="eng-controls" data-tone={tone}>
      <span className="eng-controls-label">{label}</span>
      <div className="eng-controls-row">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Small parts
 * ------------------------------------------------------------------ */

export function Btn({
  children,
  onClick,
  tone,
  active,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'primary' | 'danger';
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="eng-btn"
      data-tone={tone}
      data-active={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export interface LogLine {
  id: number;
  text: string;
  tone?: 'ok' | 'warn' | 'bad' | 'note';
}

export function LogPane({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  if (lines.length === 0) return null;
  return (
    <div ref={ref} className="eng-log" role="log" aria-live="polite">
      {lines.map((line) => (
        <div key={line.id} className="eng-log-line" data-tone={line.tone}>
          <span className="text-muted">›</span> {line.text}
        </div>
      ))}
    </div>
  );
}

/** Appends log lines with stable ids, capped so the pane never grows forever. */
export function useLog(cap = 60) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const next = useRef(0);
  const push = useCallback(
    (text: string, tone?: LogLine['tone']) => {
      setLines((prev) => [...prev, { id: next.current++, text, tone }].slice(-cap));
    },
    [cap],
  );
  const clear = useCallback(() => setLines([]), []);
  return { lines, push, clear };
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="eng-note">
      <span aria-hidden className="eng-note-mark ink">
        note
      </span>
      <p>{children}</p>
    </aside>
  );
}

const CALLOUT_TONE = {
  gap: { word: 'Known gap', icon: 'gap' as const },
  trap: { word: 'The trap', icon: 'trap' as const },
  why: { word: 'Why it is like this', icon: 'why' as const },
};

export function Callout({
  kind,
  title,
  children,
}: {
  kind: keyof typeof CALLOUT_TONE;
  title: string;
  children: ReactNode;
}) {
  const tone = CALLOUT_TONE[kind];

  return (
    <aside className="eng-callout" data-kind={kind}>
      <p className="eng-callout-tag">
        <Icon name={tone.icon} />
        {tone.word}
      </p>
      <p className="eng-callout-title">{title}</p>
      <div className="eng-callout-body">{children}</div>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * Icons. Drawn on a 24-unit grid with the same open stroke as the
 * diagrams, so an icon and a diagram box read as the same hand.
 * ------------------------------------------------------------------ */

const ICONS = {
  phone: 'M8 2h8v20H8zM11 19h2',
  server: 'M3 4h18v7H3zM3 13h18v7H3zM7 7.5h.01M7 16.5h.01',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  eye: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  hand: 'M4 12h9M9 7l-5 5 5 5',
  gap: 'M12 3 2 20h20zM12 9v5M12 17h.01',
  trap: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16h.01',
  why: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3 2.5v1.5M12 17h.01',
  offline: 'M2 4l20 16M5 12a10 10 0 0 1 4-3M2.5 8.5a15 15 0 0 1 5-3.4M12 19h.01M8.5 15.5a5 5 0 0 1 3-1.4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  list: 'M4 6h16M4 12h16M4 18h10',
  close: 'M6 6l12 12M18 6L6 18',
};

export function Icon({ name, size = 14 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Law({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="eng-law">
      <span className="eng-law-num tabular">{String(n).padStart(2, '0')}</span>
      <span className="text-[0.9375rem] text-secondary">{children}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * The one filter every drawing shares.
 * ------------------------------------------------------------------ */

export function SketchDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="eng-sketch" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.1" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <marker id="eng-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0.5 L9 5 L0 9.5" fill="none" stroke="context-stroke" strokeWidth="1.6" strokeLinecap="round" />
        </marker>
      </defs>
    </svg>
  );
}

/* SVG building blocks. Every diagram draws with these three. */

export type DrawState = 'idle' | 'active' | 'done' | 'failed' | 'muted';

export function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  state = 'idle',
  onClick,
  r = 8,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  state?: DrawState;
  onClick?: () => void;
  r?: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} className="eng-box" data-state={state} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 3 : h / 2 + 4)} textAnchor="middle" className="t-label">
        {title}
      </text>
      {sub ? (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle">
          {sub}
        </text>
      ) : null}
      {onClick ? (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={r}
          className="eng-hit"
          tabIndex={0}
          role="button"
          aria-label={title}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
        />
      ) : null}
    </g>
  );
}

export function Wire({
  d,
  state = 'idle',
  flow,
  arrow = true,
  dashed,
}: {
  d: string;
  state?: DrawState;
  flow?: boolean;
  arrow?: boolean;
  dashed?: boolean;
}) {
  return (
    <path
      d={d}
      className="eng-wire"
      data-state={state}
      data-flow={flow || undefined}
      markerEnd={arrow ? 'url(#eng-arrow)' : undefined}
      strokeDasharray={dashed && !flow ? '4 5' : undefined}
    />
  );
}

export function Hand({
  x,
  y,
  children,
  anchor = 'start',
}: {
  x: number;
  y: number;
  children: string;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="t-hand">
      {children}
    </text>
  );
}
