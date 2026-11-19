import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { TeamMark } from '@/components/ui/Pill';
import { RollingNumber } from '@/components/ui/Score';
import { cn } from '@/lib/cn';

const PH = {
  back: 'M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z',
  more: 'M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z',
  undo: 'M224,128a96,96,0,0,1-94.71,96H128A95.38,95.38,0,0,1,62.1,197.8a8,8,0,0,1,11-11.63A80,80,0,1,0,71.43,71.39a3.07,3.07,0,0,1-.26.25L44.59,96H72a8,8,0,0,1,0,16H24a8,8,0,0,1-8-8V56a8,8,0,0,1,16,0V85.8L60.25,60A96,96,0,0,1,224,128Z',
  right: 'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z',
  cloud: 'M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Zm37.66-93.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L144,148.69l42.34-42.35A8,8,0,0,1,197.66,106.34Z',
  plus: 'M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z',
  eye: 'M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z',
};

export function Ph({ name, className }: { name: keyof typeof PH; className?: string }) {
  return (
    <svg className={cn('hz-ic', className)} viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <path d={PH[name]} />
    </svg>
  );
}

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView] as const;
}

type Kind = 'dot' | 'run' | 'four' | 'six' | 'wicket' | 'extra';
type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | 'W' | 'Wd' | 'Nb' | 'B' | 'Lb';
type Ball = { id: number; d: string; kind: Kind };
type Batter = { n: string; r: number; b: number };
type Line = { id: number; at: string; text: string; kind: Kind };
type State = {
  runs: number;
  wkts: number;
  balls: number;
  over: Ball[];
  bat: [Batter, Batter];
  striker: 0 | 1;
  bowler: string;
  next: number;
  feed: Line[];
  seq: number;
  endOver: boolean;
  result: string | null;
};

const TARGET = 181;
const NEW_BATTERS = ['S. Patel', 'D. Okafor', 'L. Byrne', 'T. Rahman', 'M. Silva', 'K. Osei', 'P. Nair'];
const PHRASE: Record<Key, string> = {
  '0': 'no run',
  '1': '1 run',
  '2': '2 runs',
  '3': '3 runs',
  '4': 'four',
  '5': '5 runs',
  '6': 'six',
  W: 'out, caught at cover',
  Wd: 'wide',
  Nb: 'no ball',
  B: '1 bye',
  Lb: '1 leg bye',
};
const SCRIPT: Key[] = ['1', '0', '4', '2', '1', '6', '0', 'Wd', '1', 'W', '0', '4', '2', '1'];

const INITIAL: State = {
  runs: 142,
  wkts: 3,
  balls: 98,
  over: [
    { id: -2, d: '1', kind: 'run' },
    { id: -1, d: '4', kind: 'four' },
  ],
  bat: [
    { n: 'A. Mehta', r: 58, b: 41 },
    { n: 'J. Khan', r: 22, b: 17 },
  ],
  striker: 0,
  bowler: 'Dixon',
  next: 0,
  feed: [
    { id: -1, at: '16.2', text: 'Dixon to Mehta, four', kind: 'four' },
    { id: -2, at: '16.1', text: 'Dixon to Khan, 1 run', kind: 'run' },
    { id: -3, at: '15.6', text: 'Ali to Mehta, no run', kind: 'dot' },
  ],
  seq: 0,
  endOver: false,
  result: null,
};

const overs = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;

function apply(s: State, key: Key): State {
  if (s.result || s.endOver) return s;
  const legal = key !== 'Wd' && key !== 'Nb';
  const bat = s.bat.map((b) => ({ ...b })) as [Batter, Batter];
  const striker = bat[s.striker];
  let runs = 1;
  let kind: Kind = 'extra';
  const d = key === 'B' ? '1b' : key === 'Lb' ? '1lb' : key;
  let wkts = s.wkts;
  let next = s.next;
  if (/^\d$/.test(key)) {
    runs = Number(key);
    kind = runs === 0 ? 'dot' : runs === 4 ? 'four' : runs === 6 ? 'six' : 'run';
    striker.r += runs;
    striker.b += 1;
  } else if (key === 'W') {
    runs = 0;
    kind = 'wicket';
    wkts += 1;
    bat[s.striker] = { n: NEW_BATTERS[next % NEW_BATTERS.length], r: 0, b: 0 };
    next += 1;
  } else if (key === 'B' || key === 'Lb') {
    striker.b += 1;
  }
  const at = `${Math.floor(s.balls / 6)}.${(s.balls % 6) + 1}`;
  const surname = striker.n.split(' ').pop();
  const total = s.runs + runs;
  const balls = s.balls + (legal ? 1 : 0);
  const swap = key !== 'W' && key !== 'Wd' && key !== 'Nb' && runs % 2 === 1;
  const result =
    total >= TARGET
      ? `Riverside won by ${10 - wkts} wickets`
      : wkts >= 10 || balls >= 120
        ? total === TARGET - 1
          ? 'Match tied'
          : `Northgate won by ${TARGET - 1 - total} runs`
        : null;
  return {
    ...s,
    runs: total,
    wkts,
    balls,
    bat,
    next,
    striker: swap ? ((1 - s.striker) as 0 | 1) : s.striker,
    over: [...s.over, { id: s.seq, d, kind }],
    feed: [{ id: s.seq, at, text: `${s.bowler} to ${surname}, ${PHRASE[key]}`, kind }, ...s.feed].slice(0, 4),
    seq: s.seq + 1,
    endOver: legal && balls % 6 === 0 && !result,
    result,
  };
}

function Chip({ ball, empty }: { ball?: Ball; empty?: boolean }) {
  return (
    <span className={cn('ball hz-chip', ball && ball.id >= 0 && 'hz-pop')} data-kind={empty ? 'empty' : ball?.kind}>
      {ball ? (ball.d === '0' ? '·' : ball.d) : null}
    </span>
  );
}

function OverRow({ over }: { over: Ball[] }) {
  const legal = over.filter((b) => b.kind !== 'extra' || b.d === '1b' || b.d === '1lb').length;
  return (
    <div className="hz-balls">
      {over.map((b) => (
        <Chip key={b.id} ball={b} />
      ))}
      {Array.from({ length: Math.max(0, 6 - legal) }, (_, i) => (
        <Chip key={`e${i}`} empty />
      ))}
    </div>
  );
}

const KEYS: Array<[Key, string, string?]> = [
  ['0', '0'],
  ['1', '1'],
  ['2', '2'],
  ['3', '3'],
  ['4', '4', 'four'],
  ['5', '5'],
  ['6', '6', 'six'],
  ['W', 'OUT', 'out'],
];
const EXTRAS: Array<[Key, string]> = [
  ['Wd', 'Wide'],
  ['Nb', 'No ball'],
  ['B', 'Bye'],
  ['Lb', 'Leg bye'],
];

export function HeroStage() {
  const [s, setS] = useState(INITIAL);
  const [fan, setFan] = useState(INITIAL);
  const [pressed, setPressed] = useState<Key | null>(null);
  const [auto, setAuto] = useState(true);
  const [ref, inView] = useInView<HTMLDivElement>();
  const step = useRef(0);
  const history = useRef<State[]>([]);

  const press = (key: Key, user = false) => {
    if (user) setAuto(false);
    setPressed(key);
    window.setTimeout(() => setPressed(null), 170);
    setS((cur) => {
      const nextState = apply(cur, key);
      if (nextState !== cur) history.current = [...history.current.slice(-20), cur];
      return nextState;
    });
  };

  const undo = () => {
    setAuto(false);
    const prev = history.current.pop();
    if (prev) setS({ ...prev, seq: s.seq + 1, endOver: false });
  };

  useEffect(() => {
    const t = window.setTimeout(() => setFan(s), 650);
    return () => window.clearTimeout(t);
  }, [s]);

  useEffect(() => {
    if (!s.endOver) return;
    const t = window.setTimeout(
      () =>
        setS((cur) => ({
          ...cur,
          over: [],
          endOver: false,
          striker: (1 - cur.striker) as 0 | 1,
          bowler: cur.bowler === 'Dixon' ? 'Ali' : 'Dixon',
        })),
      1500,
    );
    return () => window.clearTimeout(t);
  }, [s.endOver]);

  useEffect(() => {
    if (!s.result) return;
    const t = window.setTimeout(() => {
      history.current = [];
      setS((cur) => ({ ...INITIAL, seq: cur.seq + 1 }));
    }, 3600);
    return () => window.clearTimeout(t);
  }, [s.result]);

  useEffect(() => {
    if (!auto || !inView || reduced()) return;
    const t = window.setInterval(() => {
      press(SCRIPT[step.current % SCRIPT.length]);
      step.current += 1;
    }, 2300);
    return () => window.clearInterval(t);
  }, [auto, inView]);

  const need = Math.max(0, TARGET - s.runs);
  const left = 120 - s.balls;
  const crr = s.balls ? (s.runs / (s.balls / 6)).toFixed(2) : '0.00';
  const rrr = left ? (need / (left / 6)).toFixed(2) : '–';
  const toast = s.result ?? (s.endOver ? `End of over ${s.balls / 6}` : null);
  const fanNeed = Math.max(0, TARGET - fan.runs);

  return (
    <div className="hz-stage" ref={ref}>
      <div className="hz-window" aria-label="Spectator view of the same match">
        <div className="hz-window-bar">
          <span className="hz-lights" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="hz-url">howzat.ramaa.tech/m/riverside-v-northgate</span>
        </div>
        <div className="hz-fan">
          <div className="hz-fan-main">
            <div className="hz-fan-head">
              <span className="hz-pill-live">Live</span>
              <span className="hz-caption">Sunday League · Match 14</span>
              <span className="hz-watch">
                <Ph name="eye" />
                <span>214 watching</span>
              </span>
            </div>
            <div className="hz-fan-team">
              <TeamMark shortName="RIV" color="#2763c4" size="md" />
              <span>Riverside CC</span>
              <span className="hz-fan-score">
                <RollingNumber value={fan.runs} />
                <span className="hz-slash">/</span>
                <RollingNumber value={fan.wkts} />
              </span>
              <span className="hz-fan-overs">{overs(fan.balls)}</span>
            </div>
            <div className="hz-fan-team hz-fan-team-quiet">
              <TeamMark shortName="NOR" color="#c23d0a" size="md" />
              <span>Northgate XI</span>
              <span className="hz-fan-score-sm">180/6</span>
              <span className="hz-fan-overs">20</span>
            </div>
            <p className="hz-fan-need" key={fan.result ?? 'need'}>
              {fan.result ?? (
                <>
                  Need <b>{fanNeed}</b> off {120 - fan.balls} balls
                </>
              )}
            </p>
            <div className="hz-fan-crease">
              {fan.bat.map((b, i) => (
                <div key={b.n} className={cn(i === fan.striker && 'on')}>
                  <i />
                  <span>{b.n}</span>
                  <b>{b.r}</b>
                  <small>({b.b})</small>
                </div>
              ))}
            </div>
            <div className="hz-fan-over">
              <span className="hz-label">This over</span>
              <OverRow over={fan.over} />
            </div>
          </div>
          <div className="hz-feed">
            <span className="hz-label">Ball by ball</span>
            <ol>
              {fan.feed.map((l) => (
                <li key={l.id} className={cn(l.id >= 0 && 'hz-feed-in')} data-kind={l.kind}>
                  <span className="hz-feed-at">{l.at}</span>
                  <span>{l.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <svg className="hz-wire" viewBox="0 0 96 40" fill="none" aria-hidden>
        <path d="M2 20H92" stroke="currentColor" strokeDasharray="4 6" opacity="0.32" />
        <path d="M6.2 15.8L2 20L6.2 24.2" stroke="currentColor" opacity="0.32" />
        <circle key={s.seq} className="hz-wire-dot" cx="92" cy="20" r="3" fill="currentColor" />
      </svg>

      <div className="hz-phone" aria-label="Scorer’s phone. Tap a key to score a ball.">
        <div className="hz-status">
          <span>14:52</span>
          <span>5G</span>
        </div>
        <div className="hz-bar">
          <span className="hz-icon-btn">
            <Ph name="back" />
          </span>
          <div className="hz-bar-title">
            <b>Riverside v Northgate</b>
            <span>2nd innings · Sunday League</span>
          </div>
          <span className="hz-sync">
            <Ph name="cloud" />
            Synced
          </span>
        </div>
        <div className="hz-card hz-score">
          <div className="hz-score-top">
            <span>
              <TeamMark shortName="RIV" color="#2763c4" size="sm" />
              Riverside CC
            </span>
            <span className="hz-caption">Target {TARGET}</span>
          </div>
          <div className="hz-score-mid">
            <span className="hz-big" key={`${s.runs}-${s.wkts}`}>
              {s.runs}/{s.wkts}
            </span>
            <span className="hz-overs">{overs(s.balls)}</span>
            <span className="hz-need">
              <b>{need}</b>
              <span>off {left}</span>
            </span>
          </div>
          <div className="hz-rates">
            <div>
              <span className="hz-label">CRR</span>
              <b>{crr}</b>
            </div>
            <div>
              <span className="hz-label">RRR</span>
              <b>{rrr}</b>
            </div>
            <div>
              <span className="hz-label">Striker</span>
              <b className="hz-rates-name">{s.bat[s.striker].n}</b>
            </div>
          </div>
        </div>
        <div className="hz-over">
          <span className="hz-label">This over</span>
          <OverRow over={s.over} />
        </div>
        <div className="hz-pad">
          <div className={cn('hz-toast', toast && 'show')} role="status">
            {toast}
          </div>
          <div className="hz-extras">
            {EXTRAS.map(([k, label]) => (
              <button key={k} type="button" className={cn(pressed === k && 'is-pressed')} onClick={() => press(k, true)}>
                {label}
              </button>
            ))}
          </div>
          <div className="hz-keys">
            {KEYS.map(([k, label, tone]) => (
              <button
                key={k}
                type="button"
                data-tone={tone}
                className={cn(pressed === k && 'is-pressed')}
                onClick={() => press(k, true)}
                aria-label={k === 'W' ? 'Out' : `${label} ${label === '1' ? 'run' : 'runs'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="hz-pad-foot">
            <button type="button" onClick={undo}>
              <Ph name="undo" />
              Undo
            </button>
            <span>{auto ? 'Tap a key to take over' : 'You’re scoring'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type Tab = 'matches' | 'table' | 'teams';

const TABLE: Array<[string, string, number, number, number, string]> = [
  ['HAR', 'Harbour CC', 4, 4, 8, '+1.214'],
  ['NOR', 'Northgate XI', 4, 3, 6, '+0.732'],
  ['RIV', 'Riverside CC', 3, 2, 4, '+0.418'],
  ['STA', 'St Albans Rd', 4, 2, 4, '−0.105'],
  ['EAS', 'Eastfield', 3, 1, 2, '−0.240'],
  ['OAK', 'Oakley Town', 4, 1, 2, '−0.512'],
  ['MIL', 'Millbrook', 3, 1, 2, '−0.688'],
];
const COLORS: Record<string, string> = {
  HAR: '#1c8049',
  NOR: '#c23d0a',
  RIV: '#2763c4',
  STA: '#875a00',
  EAS: '#6b34c9',
  OAK: '#1c8049',
  MIL: '#2763c4',
  WES: '#c23d0a',
};
const NAME = Object.fromEntries(TABLE.map(([k, n]) => [k, n])) as Record<string, string>;
NAME.WES = 'Westbury';

function Team({ k, score, lose }: { k: string; score?: ReactNode; lose?: boolean }) {
  return (
    <div className={cn('hz-team', lose && 'lose')}>
      <TeamMark shortName={k} color={COLORS[k]} size="sm" />
      <span>{NAME[k]}</span>
      <b>{score}</b>
    </div>
  );
}

export const TABS: Array<[Tab, string, number?]> = [
  ['matches', 'Matches', 28],
  ['table', 'Table'],
  ['teams', 'Teams', 8],
];

export function TournamentPhone({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ x: 0, w: 0 });

  useLayoutEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [tab]);

  return (
    <div className="hz-phone hz-phone-tm">
      <div className="hz-status">
        <span>14:52</span>
        <span>5G</span>
      </div>
      <div className="hz-bar">
        <span className="hz-icon-btn">
          <Ph name="back" />
        </span>
        <span />
        <span className="hz-icon-btn">
          <Ph name="more" />
        </span>
      </div>
      <div className="hz-tm-head">
        <b>Sunday League</b>
        <span>Cricket · League + playoffs · 8 teams</span>
      </div>
      <div className="hz-tabs" role="tablist" ref={tabsRef}>
        <span className="hz-tabs-ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />
        {TABS.map(([t, label, n]) => (
          <button key={t} type="button" role="tab" data-tab={t} aria-selected={tab === t} onClick={() => onTab(t)}>
            {label}
            {n ? <small>{n}</small> : null}
          </button>
        ))}
      </div>
      <div className="hz-tm-body" key={tab}>
        {tab === 'matches' ? (
          <>
            <div className="hz-group-head">
              <span className="hz-live-dot" />
              <b>Live</b>
            </div>
            <div className="hz-card hz-mrow">
              <div>
                <Team k="RIV" score={<>142/3 <small>16.2</small></>} />
                <Team k="NOR" score="180/6" />
                <p className="hot">Need 39 off 22 · You’re scoring</p>
              </div>
              <span className="hz-btn-sm">Score</span>
            </div>
            <div className="hz-group-head">
              <b>Results</b>
              <span className="hz-caption">12 played</span>
            </div>
            <div className="hz-card">
              <div className="hz-mrow">
                <div>
                  <Team k="HAR" score="164/7" />
                  <Team k="OAK" score="152/9" lose />
                  <p>Harbour CC won by 12 runs</p>
                </div>
                <Ph name="right" className="hz-chev" />
              </div>
              <div className="hz-mrow">
                <div>
                  <Team k="WES" score="121" lose />
                  <Team k="STA" score="122/4" />
                  <p>St Albans Rd won by 6 wickets</p>
                </div>
                <Ph name="right" className="hz-chev" />
              </div>
            </div>
          </>
        ) : tab === 'table' ? (
          <div className="hz-card">
            <table className="hz-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>P</th>
                  <th>Pts</th>
                  <th>NRR</th>
                </tr>
              </thead>
              <tbody>
                {TABLE.map(([k, , p, , pts, nrr], i) => (
                  <tr key={k} className={cn(i < 4 && 'q', i === 3 && 'cut')} style={{ '--i': i } as React.CSSProperties}>
                    <td>{i + 1}</td>
                    <td>
                      <span className="hz-tn">
                        <TeamMark shortName={k} color={COLORS[k]} size="sm" />
                        <span>{NAME[k]}</span>
                      </span>
                    </td>
                    <td>{p}</td>
                    <td className="pts">{pts}</td>
                    <td className="nrr">{nrr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="hz-card">
              {['RIV', 'NOR', 'EAS', 'HAR', 'OAK', 'WES'].map((k, i) => (
                <div className="hz-trow" key={k} style={{ '--i': i } as React.CSSProperties}>
                  <TeamMark shortName={k} color={COLORS[k]} size="sm" />
                  <span>{NAME[k]}</span>
                  <span className={cn('n', k === 'WES' && 'short')}>{k === 'WES' ? '9 of 11' : `${13 + (i % 3)} players`}</span>
                  <Ph name="right" className="hz-chev" />
                </div>
              ))}
            </div>
            <div className="hz-add">
              <span>Team name</span>
              <span className="hz-btn-sm">
                <Ph name="plus" />
                Add
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
