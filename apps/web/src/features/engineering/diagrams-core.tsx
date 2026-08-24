import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BallEvent, InningsContext } from '@howzat/shared';
import { buildState, materializeEvents, formatOvers } from '@howzat/shared';
import { Box, Btn, Controls, Figure, Hand, Icon, LogPane, useLog, Wire } from './chrome';
import type { DrawState } from './chrome';
import { cn } from '@/lib/cn';

/* ================================================================== *
 * 1. The system map
 * ================================================================== */

const MAP_NODES = {
  scorer: {
    title: 'Scorer console',
    job: 'Validates the tap locally, writes the ball to IndexedDB first, then POSTs it. Renders the score by folding queued balls through the same reducer the server runs.',
    gone: 'Nobody can score. This is the only writer in the system.',
    truth: 'client',
  },
  viewer: {
    title: 'Viewer page',
    job: 'Loads a snapshot over HTTP, then subscribes to a socket room and accepts any broadcast that proves it is newer.',
    gone: 'Spectators lose the live view. Scoring is unaffected.',
    truth: 'client',
  },
  api: {
    title: 'API instance',
    job: 'Express and socket.io in one process. Every write goes through it: auth, rate limit, lock, validate, insert, project, publish.',
    gone: 'Writes stop. The next instance up serves the same requests, because an instance holds no state of its own.',
    truth: 'stateless',
  },
  pg: {
    title: 'Postgres',
    job: 'Holds BallEvent, the append-only log, plus the setup tables. Two unique constraints carry the correctness of the whole write path.',
    gone: 'Everything stops. This is the only copy of the truth.',
    truth: 'truth',
  },
  redis: {
    title: 'Redis',
    job: 'Snapshot cache, the per-match write lock, the cross-instance event bus, and every short-lived counter.',
    gone: 'The system serves correct answers more slowly, on one instance, with no live push. Except the lock, which throws.',
    truth: 'derived',
  },
} as const;

type MapNodeId = keyof typeof MAP_NODES;

export function SystemMap() {
  const [selected, setSelected] = useState<MapNodeId>('pg');
  const node = MAP_NODES[selected];

  return (
    <Figure
      label="Figure 1 — the whole system on one sheet"
      hint="Tap any box to see what it does and what happens the moment it disappears."
      caption="Click any box. Solid arrows are HTTP requests, the dashed arrow is the WebSocket fan-out, and the ring through Redis is how a ball written on one instance reaches a viewer attached to another."
    >
      <p className="eng-scroll-note">
        <Icon name="hand" /> scroll the drawing sideways
      </p>
      <div className="eng-scroll">
        <svg viewBox="0 0 760 400" className="eng-svg min-w-[640px]" role="img" aria-label="System map">
          <g className="sketch">
            <Wire d="M 186 76 L 292 100" state={selected === 'api' || selected === 'scorer' ? 'active' : 'idle'} />
            <Wire d="M 292 132 L 186 168" state={selected === 'viewer' ? 'active' : 'idle'} dashed />
            <Wire d="M 456 96 L 560 70" state={selected === 'pg' ? 'active' : 'idle'} />
            <Wire d="M 456 124 L 560 158" state={selected === 'redis' ? 'active' : 'idle'} />
            <Wire d="M 560 196 C 470 250 470 250 456 268" state={selected === 'redis' ? 'active' : 'idle'} />
            <Wire d="M 292 300 L 186 322" state={selected === 'redis' ? 'active' : 'idle'} dashed />

            <Box x={46} y={48} w={140} h={54} title="Scorer console" sub="SPA + outbox" state={selected === 'scorer' ? 'active' : 'idle'} onClick={() => setSelected('scorer')} />
            <Box x={46} y={142} w={140} h={54} title="Viewer page" sub="snapshot-first" state={selected === 'viewer' ? 'active' : 'idle'} onClick={() => setSelected('viewer')} />
            <Box x={46} y={296} w={140} h={54} title="Viewer page" sub="another device" state={selected === 'viewer' ? 'active' : 'idle'} onClick={() => setSelected('viewer')} />

            <Box x={292} y={72} w={164} h={80} title="API instance A" sub="Express + socket.io" state={selected === 'api' ? 'active' : 'idle'} onClick={() => setSelected('api')} />
            <Box x={292} y={244} w={164} h={80} title="API instance B" sub="same image, no state" state={selected === 'api' ? 'active' : 'idle'} onClick={() => setSelected('api')} />

            <Box x={560} y={40} w={154} h={60} title="Postgres" sub="BallEvent — the truth" state={selected === 'pg' ? 'active' : 'idle'} onClick={() => setSelected('pg')} />
            <Box x={560} y={136} w={154} h={60} title="Redis" sub="cache · lock · bus" state={selected === 'redis' ? 'active' : 'idle'} onClick={() => setSelected('redis')} />

            <Hand x={196} y={62}>POST /balls</Hand>
            <Hand x={196} y={196}>ws: read only</Hand>
            <Hand x={472} y={228}>pub/sub</Hand>
            <Hand x={478} y={44}>append only</Hand>
          </g>
        </svg>
      </div>

      <div className="mt-5 grid gap-4 rounded-[var(--radius-md)] border border-line bg-sunken px-5 py-4 sm:grid-cols-[1fr_1fr]">
        <div>
          <p className="eyebrow mb-2">{node.title} — what it does</p>
          <p className="text-[0.875rem] text-secondary">{node.job}</p>
        </div>
        <div>
          <p className="eyebrow mb-2">If it disappears right now</p>
          <p className="text-[0.875rem] text-secondary">{node.gone}</p>
        </div>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 2. The ledger: the real reducer, running in this page
 * ================================================================== */

const XI: { id: string; name: string }[] = [
  { id: 'p1', name: 'Rama' },
  { id: 'p2', name: 'Peehu' },
  { id: 'p3', name: 'Sam' },
  { id: 'p4', name: 'Kabir' },
];

const BOWLERS = [
  { id: 'b1', name: 'Arjun' },
  { id: 'b2', name: 'Neel' },
];

const CONTEXT: InningsContext = {
  inningsId: 'demo-innings',
  matchId: 'demo-match',
  number: 1,
  battingTeam: { id: 't1', name: 'Bandra Blues', shortName: 'BAN', primaryColor: '#0a5ca8' },
  bowlingTeam: { id: 't2', name: 'Andheri Arrows', shortName: 'AND', primaryColor: '#a8322a' },
  oversQuota: 2,
  targetRuns: null,
  battingXI: XI,
  bowlingXI: BOWLERS,
};

const STRIKER = 'p1';
const NON_STRIKER = 'p2';
const OPENING_BOWLER = 'b1';

let ledgerSeq = 0;

function makeEvent(
  base: {
    seq: number;
    overNumber: number;
    ballNumber: number;
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
  },
  patch: Partial<BallEvent> = {},
): BallEvent {
  const runsOffBat = patch.runsOffBat ?? 0;
  const extraType = patch.extraType ?? null;
  return {
    id: `e${++ledgerSeq}`,
    inningsId: CONTEXT.inningsId,
    clientEventId: `c${ledgerSeq}`,
    eventType: 'BALL',
    supersedesEventId: null,
    isLegalDelivery: extraType !== 'WIDE' && extraType !== 'NO_BALL',
    createdBy: 'u-scorer',
    createdAt: new Date().toISOString(),
    runsOffBat,
    extraRuns: 0,
    extraType,
    isWicket: false,
    wicketType: null,
    dismissedPlayerId: null,
    fielderId: null,
    ...base,
    ...patch,
  };
}

/**
 * The last delivery still standing, paired with the original BALL row it came
 * from. A correction supersedes the ORIGINAL ball's id, never a previous
 * correction's, because `materializeEvents` only maps replacements onto BALL
 * events.
 */
function lastDelivery(events: BallEvent[]): { original: BallEvent; effective: BallEvent } | null {
  const undone = new Set(
    events.filter((e) => e.eventType === 'UNDO' && e.supersedesEventId).map((e) => e.supersedesEventId!),
  );
  const originals = [...events]
    .sort((a, b) => a.seq - b.seq)
    .filter((e) => e.eventType === 'BALL' && !undone.has(e.id));
  const effectives = materializeEvents(events);
  const original = originals[originals.length - 1];
  const effective = effectives[effectives.length - 1];
  if (!original || !effective) return null;
  return { original, effective };
}

type LedgerPreset = 'runs' | 'wide' | 'wicket' | 'six';

export function LedgerLab() {
  const [events, setEvents] = useState<BallEvent[]>([]);
  const [showEffective, setShowEffective] = useState(true);

  const state = useMemo(() => buildState(CONTEXT, events), [events]);
  const effective = useMemo(() => materializeEvents(events), [events]);

  const append = useCallback(
    (preset: LedgerPreset) => {
      setEvents((prev) => {
        const current = buildState(CONTEXT, prev);
        const seq = current.lastEventSeq + 1;
        const overNumber = Math.floor(current.legalBalls / 6);
        const ballNumber = (current.legalBalls % 6) + 1;
        const base = {
          seq,
          overNumber,
          ballNumber,
          strikerId: current.strikerId ?? STRIKER,
          nonStrikerId: current.nonStrikerId ?? NON_STRIKER,
          bowlerId: current.bowlerId ?? OPENING_BOWLER,
        };
        const patch: Partial<BallEvent> =
          preset === 'runs'
            ? { runsOffBat: 1 }
            : preset === 'six'
              ? { runsOffBat: 6 }
              : preset === 'wide'
                ? { extraType: 'WIDE', extraRuns: 1 }
                : {
                    isWicket: true,
                    wicketType: 'BOWLED',
                    dismissedPlayerId: base.strikerId,
                  };
        return [...prev, makeEvent(base, patch)];
      });
    },
    [],
  );

  const correctLast = useCallback(() => {
    setEvents((prev) => {
      const target = lastDelivery(prev);
      if (!target) return prev;
      const seq = prev.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
      return [
        ...prev,
        makeEvent(
          {
            seq,
            // The correction keeps the original delivery's position in the over.
            // That is a fact about the past and a correction may not move it.
            overNumber: target.original.overNumber,
            ballNumber: target.original.ballNumber,
            strikerId: target.effective.strikerId,
            nonStrikerId: target.effective.nonStrikerId,
            bowlerId: target.effective.bowlerId,
          },
          {
            eventType: 'CORRECTION',
            supersedesEventId: target.original.id,
            runsOffBat: target.effective.runsOffBat === 4 ? 6 : 4,
            extraType: null,
            isWicket: false,
            wicketType: null,
            dismissedPlayerId: null,
          },
        ),
      ];
    });
  }, []);

  const undoLast = useCallback(() => {
    setEvents((prev) => {
      const target = lastDelivery(prev);
      if (!target) return prev;
      const seq = prev.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
      return [
        ...prev,
        makeEvent(
          {
            seq,
            overNumber: target.original.overNumber,
            ballNumber: target.original.ballNumber,
            strikerId: target.effective.strikerId,
            nonStrikerId: target.effective.nonStrikerId,
            bowlerId: target.effective.bowlerId,
          },
          { eventType: 'UNDO', supersedesEventId: target.original.id },
        ),
      ];
    });
  }, []);

  const rows = showEffective ? effective : events;

  return (
    <Figure
      label="Figure 2 — the log, the fold, and the score"
      hint="Score a few balls, then append a CORRECTION and switch between Raw log and After materialize."
      controls={
        <>
          <Controls label="Score a delivery">
            <Btn onClick={() => append('runs')} tone="primary">
              1 run
            </Btn>
            <Btn onClick={() => append('six')} tone="primary">
              Six
            </Btn>
            <Btn onClick={() => append('wide')}>Wide</Btn>
            <Btn onClick={() => append('wicket')}>Wicket</Btn>
          </Controls>
          <Controls label="Repair the last delivery">
            <Btn onClick={correctLast} disabled={effective.length === 0}>
              Append CORRECTION
            </Btn>
            <Btn onClick={undoLast} disabled={effective.length === 0}>
              Append UNDO
            </Btn>
          </Controls>
          <Controls label="What the table shows">
            <Btn onClick={() => setShowEffective(false)} active={!showEffective}>
              Raw log
            </Btn>
            <Btn onClick={() => setShowEffective(true)} active={showEffective}>
              After materialize
            </Btn>
            <Btn onClick={() => setEvents([])}>Clear</Btn>
          </Controls>
        </>
      }
      caption="This figure imports buildState and materializeEvents from packages/shared. It is the reducer the API runs and the reducer the scorer's phone runs, folding in your browser with no server involved. Append a correction and watch it land at a later seq in the raw log while the effective list keeps the delivery in its original position."
    >
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0">
          <p className="eyebrow mb-2.5">{showEffective ? 'Effective deliveries — what the fold sees' : 'Raw log — what Postgres stores'}</p>
          <div className="max-h-72 overflow-auto rounded-[var(--radius-sm)] border border-line bg-sunken">
            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-[0.8125rem] text-muted">
                Empty innings. Score a ball.
              </p>
            ) : (
              <table className="w-full min-w-[22rem] text-left">
                <thead>
                  <tr className="border-b border-line text-[0.625rem] tracking-[0.12em] text-muted uppercase">
                    <th className="px-3 py-2 font-medium">seq</th>
                    <th className="px-3 py-2 font-medium">type</th>
                    <th className="px-3 py-2 font-medium">o.b</th>
                    <th className="px-3 py-2 font-medium">outcome</th>
                    <th className="px-3 py-2 font-medium">supersedes</th>
                  </tr>
                </thead>
                <tbody className="mono text-[0.6875rem]">
                  {rows.map((event) => (
                    <tr key={event.id} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-1.5 text-muted">{event.seq}</td>
                      <td
                        className="px-3 py-1.5"
                        style={{
                          color:
                            event.eventType === 'BALL' ? 'var(--text-secondary)' : 'var(--accent)',
                        }}
                      >
                        {event.eventType}
                      </td>
                      <td className="px-3 py-1.5 text-muted">
                        {event.overNumber}.{event.ballNumber}
                      </td>
                      <td className="px-3 py-1.5 text-primary">
                        {event.eventType === 'UNDO'
                          ? '—'
                          : `${event.runsOffBat}${event.extraType ? ` +${event.extraType}` : ''}${event.isWicket ? ' W' : ''}`}
                      </td>
                      <td className="px-3 py-1.5 text-muted">{event.supersedesEventId ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="eyebrow">buildState(context, log) →</p>
          <div className="rounded-[var(--radius-md)] border border-line bg-raised px-5 py-4">
            <p className="score-figure text-[2.5rem] text-primary">
              {state.runs}
              <span className="text-muted">/</span>
              {state.wickets}
            </p>
            <p className="mono mt-1 text-[0.8125rem] text-secondary">
              {formatOvers(state.legalBalls)} ov · RR{' '}
              {state.legalBalls ? ((state.runs / state.legalBalls) * 6).toFixed(2) : '0.00'}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
            <dt className="text-muted">On strike</dt>
            <dd className="text-primary">
              {state.strikerId ? state.batsmen[state.strikerId]?.name : '— needs a batsman'}
            </dd>
            <dt className="text-muted">Non-striker</dt>
            <dd className="text-primary">
              {state.nonStrikerId ? state.batsmen[state.nonStrikerId]?.name : '—'}
            </dd>
            <dt className="text-muted">Extras</dt>
            <dd className="text-primary">{state.extras.total}</dd>
            <dt className="text-muted">lastEventSeq</dt>
            <dd className="mono text-primary">{state.lastEventSeq}</dd>
            <dt className="text-muted">Innings</dt>
            <dd className="text-primary">{state.isComplete ? state.endReason : 'in progress'}</dd>
          </dl>
          <div>
            <p className="eyebrow mb-2">This over</p>
            <div className="flex flex-wrap gap-1.5">
              {state.thisOver.length === 0 ? (
                <span className="text-[0.8125rem] text-muted">—</span>
              ) : (
                state.thisOver.map((ball) => (
                  <span
                    key={ball.seq}
                    className="mono grid size-7 place-items-center rounded-full border border-line bg-sunken text-[0.6875rem] text-primary"
                  >
                    {ball.display}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 3. The write path
 * ================================================================== */

type Lane = 'client' | 'api' | 'redis' | 'pg' | 'bus';

const LANE_ICON: Record<Lane, 'phone' | 'server' | 'bolt' | 'database' | 'eye'> = {
  client: 'phone',
  api: 'server',
  redis: 'bolt',
  pg: 'database',
  bus: 'eye',
};

const LANES: { id: Lane; label: string; y: number }[] = [
  { id: 'client', label: 'Scorer device', y: 20 },
  { id: 'api', label: 'API instance', y: 100 },
  { id: 'redis', label: 'Redis', y: 180 },
  { id: 'pg', label: 'Postgres', y: 260 },
  { id: 'bus', label: 'Bus + sockets', y: 340 },
];

interface Step {
  lane: Lane;
  title: string;
  sub?: string;
  log: string;
  tone?: 'ok' | 'warn' | 'bad' | 'note';
  outcome?: 'failed' | 'done';
}

interface WriteFlags {
  redisDown: boolean;
  duplicate: boolean;
  invalid: boolean;
  contended: boolean;
}

function buildTrace(flags: WriteFlags): Step[] {
  const steps: Step[] = [
    {
      lane: 'client',
      title: 'validateBall',
      sub: 'local',
      log: 'client runs the same validateBall the server will run — a bad tap never costs a round trip',
    },
    {
      lane: 'client',
      title: 'IndexedDB put',
      sub: 'clientEventId',
      log: 'ball written to the outbox first, keyed by clientEventId, marked pending',
      tone: 'note',
    },
    {
      lane: 'client',
      title: 'optimistic render',
      sub: 'fold on top',
      log: 'the console folds the queued ball onto the last confirmed state and paints instantly',
    },
    {
      lane: 'api',
      title: 'requireAuth',
      sub: 'bearer JWT',
      log: 'JWT verified. It carries a user id and nothing about permissions.',
    },
    {
      lane: 'api',
      title: 'requireScorerForMatch',
      sub: '60s authz cache',
      log: 'authz:match:<id>:user:<id> hit in Redis — a definite 1 or 0, negatives cached too',
    },
  ];

  if (flags.redisDown) {
    steps.push({
      lane: 'api',
      title: 'rate limiter',
      sub: 'fails open',
      log: 'Redis is down. The limiter catches its own error and calls next(). A live match must not become unscorable because a cache blinked.',
      tone: 'warn',
    });
    steps.push({
      lane: 'redis',
      title: 'acquireLock',
      sub: 'throws',
      log: 'acquireLock throws. This is the one dependency that does not degrade gracefully, and the fix is a Postgres advisory lock fallback.',
      tone: 'bad',
      outcome: 'failed',
    });
    return steps;
  }

  steps.push({
    lane: 'redis',
    title: 'INCR window',
    sub: '120/min/scorer',
    log: 'fixed-window counter incremented. MULTI pipelines INCR and TTL so the 429 could carry a truthful Retry-After.',
  });

  if (flags.contended) {
    steps.push({
      lane: 'redis',
      title: 'SET NX PX',
      sub: 'held by another',
      log: 'lock:match:<id> is held. Back off and retry: 20 attempts across about 1.5 seconds.',
      tone: 'warn',
    });
    steps.push({
      lane: 'api',
      title: '409 Conflict',
      sub: 'retryable',
      log: 'still held after the last attempt. Return 409 — honest, retryable, and the client keeps the ball in its outbox.',
      tone: 'bad',
      outcome: 'failed',
    });
    return steps;
  }

  steps.push({
    lane: 'redis',
    title: 'SET NX PX 5000',
    sub: 'random token',
    log: 'lock acquired with a random token and a 5 second lease',
    tone: 'ok',
  });

  steps.push({
    lane: 'pg',
    title: 'findUnique',
    sub: 'clientEventId',
    log: flags.duplicate
      ? 'clientEventId already present — this is a retry of a ball that already landed'
      : 'clientEventId not seen before',
    tone: flags.duplicate ? 'note' : undefined,
  });

  if (flags.duplicate) {
    steps.push({
      lane: 'api',
      title: '200 OK',
      sub: 'same body as 201',
      log: 'short-circuit. Return the current snapshot with a 200 and a body identical to the 201, so a replaying client cannot tell the difference.',
      tone: 'ok',
      outcome: 'done',
    });
    steps.push({
      lane: 'redis',
      title: 'Lua release',
      sub: 'if token is mine',
      log: 'lock released with a compare-and-delete script',
    });
    return steps;
  }

  steps.push({
    lane: 'pg',
    title: 'findMany',
    sub: 'inningsId, seq',
    log: 'read the innings log — the index (inningsId, seq) serves the hottest query in the system',
  });
  steps.push({
    lane: 'api',
    title: 'buildState',
    sub: 'pure fold',
    log: 'fold the log. About 130 events at the end of a T20 innings, low single-digit milliseconds.',
  });

  if (flags.invalid) {
    steps.push({
      lane: 'api',
      title: 'validateBall',
      sub: 'CONSECUTIVE_OVERS',
      log: '422 with a message written for a human: "A bowler cannot bowl two overs in a row." The code is the contract, the message is for the scorer.',
      tone: 'bad',
      outcome: 'failed',
    });
    steps.push({
      lane: 'redis',
      title: 'Lua release',
      sub: 'in finally',
      log: 'lock released. A rejected ball still releases the lock.',
    });
    return steps;
  }

  steps.push({
    lane: 'api',
    title: 'validateBall',
    sub: 'against folded state',
    log: 'valid against the state that includes every ball before it. This is the check the lock exists to make meaningful.',
    tone: 'ok',
  });
  steps.push({
    lane: 'pg',
    title: 'INSERT BallEvent',
    sub: 'seq = last + 1',
    log: 'the ball is now durable. Everything after this point may fail without failing the ball.',
    tone: 'ok',
  });
  steps.push({
    lane: 'api',
    title: 'fold again',
    sub: 'project snapshot',
    log: 'fold including the new ball, then shape it for display',
  });
  steps.push({
    lane: 'redis',
    title: 'writeSnapshot',
    sub: 'guarded by seq',
    log: 'skip the write if the cached lastEventSeq is higher. Optimistic concurrency, with seq as the version.',
  });
  steps.push({
    lane: 'bus',
    title: "publishMatchEvent('ball')",
    sub: 'void, not awaited',
    log: 'dropped with void on the hot path. The scorer does not wait on a broadcast.',
  });
  steps.push({
    lane: 'redis',
    title: 'Lua release',
    sub: 'compare and delete',
    log: 'lock released only if the stored token is still mine',
  });
  steps.push({
    lane: 'api',
    title: '201 Created',
    sub: 'snapshot body',
    log: 'response sent. The client removes the ball from IndexedDB.',
    tone: 'ok',
    outcome: 'done',
  });
  steps.push({
    lane: 'bus',
    title: 'io.to(room).emit',
    sub: 'every instance',
    log: 'the adapter republishes to every instance; each emits to its own sockets in match:<id>',
    tone: 'note',
  });

  return steps;
}

export function WritePathLab() {
  const [flags, setFlags] = useState<WriteFlags>({
    redisDown: false,
    duplicate: false,
    invalid: false,
    contended: false,
  });
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const { lines, push, clear } = useLog();

  const trace = useMemo(() => buildTrace(flags), [flags]);

  const reset = useCallback(() => {
    setCursor(-1);
    setPlaying(false);
    clear();
  }, [clear]);

  // The log line is pushed here rather than inside a setState updater. React
  // double-invokes updaters in StrictMode, and a side effect in one prints
  // every line twice in development.
  const advance = useCallback(() => {
    const next = cursor + 1;
    const step = trace[next];
    if (!step) {
      setPlaying(false);
      return;
    }
    push(`${step.lane.padEnd(6)} │ ${step.log}`, step.tone);
    setCursor(next);
  }, [cursor, trace, push]);

  /** Clicking a step replays the log up to it, so the pane always matches. */
  const jumpTo = useCallback(
    (index: number) => {
      setPlaying(false);
      setCursor(index);
      clear();
      trace.slice(0, index + 1).forEach((step) => {
        push(`${step.lane.padEnd(6)} │ ${step.log}`, step.tone);
      });
    },
    [trace, clear, push],
  );

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(advance, 900);
    return () => clearTimeout(id);
  }, [playing, cursor, advance]);

  useEffect(() => {
    reset();
  }, [flags, reset]);

  const toggle = (key: keyof WriteFlags) =>
    setFlags((prev) => {
      // The four scenarios are alternatives, not a matrix. Only one at a time.
      const cleared = { redisDown: false, duplicate: false, invalid: false, contended: false };
      return { ...cleared, [key]: !prev[key] };
    });

  // Drawn like a commit graph. The five lanes are thin tracks down the left
  // gutter, time is the y axis, and the step card gets the whole width of the
  // column. A twenty-step trace grows downwards, never off the side of the box.
  const TRACK_GAP = 21;
  const GUTTER = 108;
  const WIDTH = 660;
  const BOX_H = 44;
  const ROW_H = 56;
  const HEAD_H = 104;
  const height = HEAD_H + trace.length * ROW_H + 30;
  const trackX = (li: number) => 18 + li * TRACK_GAP;
  const rowY = (i: number) => HEAD_H + i * ROW_H;
  const finished = cursor === trace.length - 1;
  const last = cursor >= 0 ? trace[cursor] : null;

  const stateFor = (i: number, step: Step): DrawState =>
    cursor < i
      ? 'muted'
      : cursor === i
        ? step.outcome === 'failed'
          ? 'failed'
          : 'active'
        : step.outcome === 'failed'
          ? 'failed'
          : 'done';

  return (
    <Figure
      label="Figure 3 — one tap, end to end"
      hint="Press Run the tap, then switch on a scenario and run it again. Any step in the diagram is clickable."
      controls={
        <>
          <Controls label="Playback">
            <Btn onClick={() => setPlaying((p) => !p)} tone="primary" disabled={finished && !playing}>
              <Icon name={playing ? 'clock' : 'bolt'} />
              {playing ? 'Pause' : cursor < 0 ? 'Run the tap' : 'Resume'}
            </Btn>
            <Btn onClick={advance} disabled={finished}>
              Step
            </Btn>
            <Btn onClick={reset}>Reset</Btn>
          </Controls>
          <Controls label="Then break something" tone="danger">
            <Btn onClick={() => toggle('duplicate')} active={flags.duplicate}>
              Retry the same ball
            </Btn>
            <Btn onClick={() => toggle('invalid')} active={flags.invalid}>
              Break a cricket rule
            </Btn>
            <Btn onClick={() => toggle('contended')} active={flags.contended}>
              Lock already held
            </Btn>
            <Btn onClick={() => toggle('redisDown')} active={flags.redisDown}>
              <Icon name="offline" />
              Kill Redis
            </Btn>
          </Controls>
        </>
      }
      log={<LogPane lines={lines} />}
      caption="Five lanes across, one request down. Every step above the Postgres insert can fail the ball. Nothing below it can, which is why the snapshot write, the publish, and the rate limiter are all allowed to throw."
    >
      {/* Phone: the same trace as a tappable ladder. A 1,900px swimlane does
          not become readable by shrinking, so narrow screens get a list. */}
      <ol className="flex flex-col gap-1.5 lg:hidden">
        {trace.map((step, i) => {
          const state = stateFor(i, step);
          return (
            <li key={`${step.title}-${i}`}>
              <button
                type="button"
                onClick={() => jumpTo(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors',
                  state === 'muted' && 'border-line bg-sunken opacity-60',
                  state === 'active' && 'border-[var(--accent)] bg-accent-soft',
                  state === 'done' && 'border-[var(--success)] bg-success-soft',
                  state === 'failed' && 'border-[var(--alert)] bg-alert-soft',
                )}
              >
                <span className="mono w-4 shrink-0 text-[0.625rem] text-muted">{i + 1}</span>
                <span className="shrink-0 text-muted">
                  <Icon name={LANE_ICON[step.lane]} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium text-primary">
                    {step.title}
                  </span>
                  {step.sub ? (
                    <span className="mono block truncate text-[0.625rem] text-muted">{step.sub}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Desktop: the same trace as a track graph. */}
      <div className="hidden lg:block">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="eng-svg"
          role="img"
          aria-label="Write path, step by step"
        >
          {LANES.map((lane, li) => (
            <g key={lane.id}>
              <line
                x1={trackX(li)}
                y1={HEAD_H - 14}
                x2={trackX(li)}
                y2={height - 18}
                stroke="var(--line)"
                strokeWidth={1}
                strokeDasharray="2 6"
              />
              {/* Lane names run up the gutter. Written once, at the top, so
                  every step card keeps its full width for the step itself. */}
              <text
                x={trackX(li)}
                y={HEAD_H - 22}
                textAnchor="start"
                style={{ fontSize: 11 }}
                transform={`rotate(-90 ${trackX(li)} ${HEAD_H - 22})`}
              >
                {lane.label}
              </text>
            </g>
          ))}

          {trace.map((step, i) => {
            const li = LANES.findIndex((l) => l.id === step.lane);
            const x = trackX(li);
            const y = rowY(i);
            const mid = y + BOX_H / 2;
            const prev = i > 0 ? trace[i - 1] : null;
            const prevX = prev ? trackX(LANES.findIndex((l) => l.id === prev.lane)) : null;
            const state = stateFor(i, step);
            const wireState =
              cursor >= i ? (step.outcome === 'failed' ? 'failed' : 'active') : 'muted';
            return (
              <g key={`${step.title}-${i}`}>
                {prevX !== null ? (
                  <Wire
                    d={`M ${prevX} ${mid - ROW_H} C ${prevX} ${mid - 14} ${x} ${mid - ROW_H + 14} ${x} ${mid}`}
                    state={wireState}
                    arrow={false}
                    flow={cursor === i && playing}
                  />
                ) : null}
                <line
                  x1={x}
                  y1={mid}
                  x2={GUTTER}
                  y2={mid}
                  className="eng-wire"
                  data-state={wireState}
                />
                <circle cx={x} cy={mid} r={4.5} className="eng-box" data-state={state} />
                <rect
                  x={GUTTER}
                  y={y}
                  width={WIDTH - GUTTER - 8}
                  height={BOX_H}
                  rx={8}
                  className="eng-box"
                  data-state={state}
                />
                <text x={GUTTER + 14} y={mid + 5} className="t-num">
                  {String(i + 1).padStart(2, '0')}
                </text>
                <text x={GUTTER + 44} y={mid + 5} className="t-label">
                  {step.title}
                </text>
                {step.sub ? (
                  <text x={WIDTH - 26} y={mid + 5} textAnchor="end">
                    {step.sub}
                  </text>
                ) : null}
                <rect
                  x={GUTTER}
                  y={y}
                  width={WIDTH - GUTTER - 8}
                  height={BOX_H}
                  rx={8}
                  className="eng-hit"
                  tabIndex={0}
                  role="button"
                  aria-label={`Step ${i + 1}: ${step.title}`}
                  onClick={() => jumpTo(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      jumpTo(i);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <p
        className={cn(
          'mt-4 min-h-[3.25rem] rounded-[var(--radius-sm)] border px-3 py-2.5 text-[0.8125rem]',
          last?.outcome === 'failed'
            ? 'border-[var(--alert)] bg-alert-soft text-alert'
            : 'border-line bg-sunken text-secondary',
        )}
      >
        <span className="mono text-[0.6875rem] text-muted">
          step {cursor + 1}/{trace.length}
          {' · '}
        </span>
        {last ? last.log : 'Nothing has happened yet. Press Run the tap.'}
      </p>
    </Figure>
  );
}

/* ================================================================== *
 * 3b. Where the ball physically lives, moment by moment
 * ================================================================== */

interface OutboxRow {
  id: string;
  runs: number;
  state: 'pending' | 'failed';
}

interface World {
  outbox: OutboxRow[];
  pg: { seq: number; runs: number }[];
  redis: { seq: number; runs: number } | null;
  viewer: { seq: number; runs: number };
  inFlight: string | null;
}

const START_WORLD: World = {
  outbox: [],
  pg: [
    { seq: 39, runs: 1 },
    { seq: 40, runs: 4 },
    { seq: 41, runs: 0 },
  ],
  redis: { seq: 41, runs: 118 },
  viewer: { seq: 41, runs: 118 },
  inFlight: null,
};

const worldRuns = (pg: World['pg']) => 113 + pg.reduce((sum, row) => sum + row.runs, 0);

interface Phase {
  id: string;
  where: 'device' | 'api' | 'pg' | 'redis' | 'viewer';
  title: string;
  note: string;
  tone?: 'ok' | 'warn' | 'bad' | 'note';
  apply: (world: World) => World;
}

function flowPhases(runs: number, scenario: 'happy' | 'offline' | 'redisDown' | 'lostReply'): Phase[] {
  const id = 'c-7b2e';

  const phases: Phase[] = [
    {
      id: 'idb',
      where: 'device',
      title: 'IndexedDB put',
      note: `The ball is durable on the phone before any request exists. Key is the clientEventId ${id}, so enqueueing twice is one row, not two.`,
      tone: 'note',
      apply: (w) => ({ ...w, outbox: [...w.outbox, { id, runs, state: 'pending' }] }),
    },
    {
      id: 'optimistic',
      where: 'device',
      title: 'Optimistic fold',
      note: 'The console folds the pending ball onto the last confirmed state with the same reducer the server runs, and paints. No network involved.',
      apply: (w) => w,
    },
  ];

  if (scenario === 'offline') {
    phases.push({
      id: 'stuck',
      where: 'device',
      title: 'No network',
      note: "The drain does not start. The ball sits in IndexedDB, the console keeps scoring, and the browser's online event will start the drain later. Nothing is lost and nothing reached the server.",
      tone: 'warn',
      apply: (w) => w,
    });
    return phases;
  }

  phases.push(
    {
      id: 'post',
      where: 'api',
      title: 'POST /matches/:id/balls',
      note: 'Auth, the match-level authorization check from its 60 second Redis cache, then the rate limiter. The ball is still only on the phone.',
      apply: (w) => ({ ...w, inFlight: id }),
    },
    {
      id: 'lock',
      where: 'redis',
      title: 'SET lock NX PX 5000',
      note: 'Mutual exclusion for this match. It makes the validation that follows meaningful, and it is not the correctness guarantee.',
      apply: (w) => w,
    },
    {
      id: 'read',
      where: 'pg',
      title: 'Read the log, fold, validate',
      note: 'Every event for this innings, ordered by seq, folded by buildState. The new ball is validated against a state that includes every ball before it.',
      apply: (w) => w,
    },
    {
      id: 'insert',
      where: 'pg',
      title: `INSERT at seq ${START_WORLD.pg.length + 39}`,
      note: 'seq = lastEventSeq + 1, assigned under the lock. From this line on, the ball exists whatever else fails.',
      tone: 'ok',
      apply: (w) => ({ ...w, pg: [...w.pg, { seq: 42, runs }] }),
    },
  );

  if (scenario === 'redisDown') {
    phases.push({
      id: 'snapfail',
      where: 'redis',
      title: 'writeSnapshot throws',
      note: 'Caught, logged, and ignored. Postgres already holds the ball, so a cache failure must degrade the next read to a rebuild rather than fail a write that succeeded. The cached snapshot is now stale at seq 41.',
      tone: 'warn',
      apply: (w) => w,
    });
  } else {
    phases.push({
      id: 'snapshot',
      where: 'redis',
      title: 'Project and write the snapshot',
      note: 'Fold again including the new ball, shape it for display, and write it with lastEventSeq attached. The write is skipped if the cached seq is already higher.',
      tone: 'ok',
      apply: (w) => ({ ...w, redis: { seq: 42, runs: worldRuns(w.pg) } }),
    });
  }

  phases.push({
    id: 'publish',
    where: 'viewer',
    title: 'publishMatchEvent → socket',
    note: 'Dropped with void: the scorer does not wait on a broadcast. Every viewer that receives it runs isNewerSnapshot before believing it.',
    apply: (w) =>
      scenario === 'redisDown' ? w : { ...w, viewer: { seq: 42, runs: worldRuns(w.pg) } },
  });

  if (scenario === 'lostReply') {
    phases.push(
      {
        id: 'lost',
        where: 'device',
        title: '201 never arrives',
        note: 'The response died on the way back. The server is finished and correct, and the phone cannot tell the difference between that and a request that never landed. So it keeps the ball.',
        tone: 'bad',
        apply: (w) => ({ ...w, inFlight: null }),
      },
      {
        id: 'retry',
        where: 'api',
        title: 'Drain retries the same ball',
        note: `Same clientEventId ${id}. The server finds the row, short-circuits, and returns 200 with a body identical to the 201. One row, one ball, no double count.`,
        tone: 'ok',
        apply: (w) => ({ ...w, outbox: [] }),
      },
    );
    return phases;
  }

  phases.push({
    id: 'ack',
    where: 'device',
    title: '201, outbox cleared',
    note: 'The response carries the snapshot. The client applies it unconditionally, because a fresh read of the source of truth outranks anything it folded locally, and deletes the row.',
    tone: 'ok',
    apply: (w) => ({ ...w, outbox: [], inFlight: null }),
  });

  return phases;
}

type FlowScenario = 'happy' | 'offline' | 'redisDown' | 'lostReply';

const SCENARIO_LABEL: Record<FlowScenario, string> = {
  happy: 'Normal ball',
  offline: 'Phone is offline',
  redisDown: 'Redis is down',
  lostReply: 'Reply lost on the way back',
};

export function DataFlowLab() {
  const [scenario, setScenario] = useState<FlowScenario>('happy');
  const [runs, setRuns] = useState(4);
  const [step, setStep] = useState(-1);
  const [world, setWorld] = useState<World>(START_WORLD);
  const [playing, setPlaying] = useState(false);

  const phases = useMemo(() => flowPhases(runs, scenario), [runs, scenario]);

  const reset = useCallback(() => {
    setStep(-1);
    setWorld(START_WORLD);
    setPlaying(false);
  }, []);

  // Rebuilding from START_WORLD on every move keeps forwards and backwards
  // identical, so a phase never has to know how to undo itself.
  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.max(-1, Math.min(target, phases.length - 1));
      setStep(clamped);
      setWorld(phases.slice(0, clamped + 1).reduce((w, phase) => phase.apply(w), START_WORLD));
      if (clamped === phases.length - 1) setPlaying(false);
    },
    [phases],
  );

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => goTo(step + 1), 1100);
    return () => clearTimeout(id);
  }, [playing, step, goTo]);

  useEffect(() => {
    reset();
  }, [scenario, runs, reset]);

  const current = step >= 0 ? phases[step] : null;
  const optimistic = worldRuns(world.pg) + world.outbox.reduce((sum, row) => sum + row.runs, 0);
  const redisStale = world.redis !== null && world.redis.seq < (world.pg[world.pg.length - 1]?.seq ?? 0);

  const stores = [
    {
      key: 'device',
      icon: 'phone' as const,
      name: 'Scorer phone',
      sub: 'IndexedDB outbox',
      seq: null as string | null,
      rows: world.outbox.map((row) => ({
        left: row.id,
        right: `${row.runs} runs · ${row.state}`,
      })),
      empty: 'outbox empty',
    },
    {
      key: 'pg',
      icon: 'database' as const,
      name: 'Postgres',
      sub: 'BallEvent, append only',
      seq: `lastEventSeq ${world.pg[world.pg.length - 1]?.seq ?? 0}`,
      rows: world.pg.slice(-4).map((row) => ({
        left: `seq ${row.seq}`,
        right: `${row.runs} runs`,
      })),
      empty: 'no rows',
    },
    {
      key: 'redis',
      icon: 'bolt' as const,
      name: 'Redis',
      sub: 'snapshot cache',
      seq: world.redis ? `lastEventSeq ${world.redis.seq}` : 'no snapshot',
      rows: world.redis
        ? [
            { left: 'runs', right: String(world.redis.runs) },
            { left: 'stale?', right: redisStale ? 'yes, rebuild on read' : 'no' },
          ]
        : [],
      empty: 'cold: next read rebuilds from the log',
    },
    {
      key: 'viewer',
      icon: 'eye' as const,
      name: 'Viewer',
      sub: 'what a spectator sees',
      seq: `lastEventSeq ${world.viewer.seq}`,
      rows: [{ left: 'score', right: `${world.viewer.runs}` }],
      empty: '',
    },
  ];

  return (
    <Figure
      label="Figure 4 — where the ball is at every moment"
      hint="Step through and watch lastEventSeq move: the phone has no seq at all, Postgres assigns it, Redis carries it, and the viewer checks it."
      controls={
        <>
          <Controls label="Playback">
            <Btn onClick={() => setPlaying((p) => !p)} tone="primary" disabled={step === phases.length - 1 && !playing}>
              <Icon name={playing ? 'clock' : 'bolt'} />
              {playing ? 'Pause' : step < 0 ? `Tap ${runs}` : 'Resume'}
            </Btn>
            <Btn onClick={() => goTo(step - 1)} disabled={step < 0}>
              Back
            </Btn>
            <Btn onClick={() => goTo(step + 1)} disabled={step === phases.length - 1}>
              Next
            </Btn>
            <Btn onClick={reset}>Reset</Btn>
          </Controls>
          <Controls label="Runs off the bat">
            {[1, 4, 6].map((value) => (
              <Btn key={value} onClick={() => setRuns(value)} active={runs === value}>
                {value}
              </Btn>
            ))}
          </Controls>
          <Controls label="Scenario" tone="danger">
            {(Object.keys(SCENARIO_LABEL) as FlowScenario[]).map((key) => (
              <Btn key={key} onClick={() => setScenario(key)} active={scenario === key}>
                {SCENARIO_LABEL[key]}
              </Btn>
            ))}
          </Controls>
        </>
      }
      caption="The phone never invents a sequence number. It invents an identity, the clientEventId, and Postgres decides position. That split is why a retry is safe: identity travels with the ball, position is assigned once, under the lock."
    >
      <div className="flex flex-col gap-4">
        <ol className="flex flex-wrap gap-1.5">
          {phases.map((phase, i) => (
            <li key={phase.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] transition-colors',
                  i > step && 'border-line bg-sunken text-muted',
                  i === step && 'border-[var(--accent)] bg-accent-soft text-accent',
                  i < step && 'border-[var(--success)] bg-success-soft text-success',
                )}
              >
                <span className="mono">{i + 1}</span>
                <span className="hidden sm:inline">{phase.title}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {stores.map((store) => {
            const live = current?.where === store.key;
            const down = scenario === 'redisDown' && store.key === 'redis' && step >= 0;
            return (
              <div key={store.key} className="eng-store" data-live={down ? 'down' : live ? 'true' : undefined}>
                <p className="eng-store-head">
                  <Icon name={store.icon} />
                  {store.name}
                  {store.seq ? <span className="eng-store-seq">{store.seq}</span> : null}
                </p>
                <p className="text-[0.6875rem] text-muted">{store.sub}</p>
                <div className="eng-store-rows">
                  {store.rows.length === 0 ? (
                    <p className="text-[0.6875rem] text-muted italic">{store.empty}</p>
                  ) : (
                    store.rows.map((row) => (
                      <span key={row.left} className="eng-store-row">
                        <span>{row.left}</span>
                        <span className="text-primary">{row.right}</span>
                      </span>
                    ))
                  )}
                </div>
                {store.key === 'device' && world.outbox.length > 0 ? (
                  <p className="text-[0.6875rem] text-accent">
                    console shows {optimistic}, {optimistic - worldRuns(world.pg)} of it unconfirmed
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <p
          className={cn(
            'min-h-[4.5rem] rounded-[var(--radius-sm)] border px-3 py-2.5 text-[0.8125rem]',
            current?.tone === 'bad'
              ? 'border-[var(--alert)] bg-alert-soft text-alert'
              : current?.tone === 'warn'
                ? 'border-[var(--warning)] bg-warning-soft text-warning'
                : 'border-line bg-sunken text-secondary',
          )}
        >
          {current ? (
            <>
              <span className="font-semibold text-primary">{current.title}. </span>
              {current.note}
            </>
          ) : (
            `Innings so far: ${worldRuns(world.pg)} runs, 41 events. Press Tap ${runs} to add one more.`
          )}
        </p>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 4. Truth versus derived
 * ================================================================== */

const TABLES = [
  { name: 'BallEvent', kind: 'truth', note: 'Append-only. Never updated, never deleted. Everything else is a fold of this.' },
  { name: 'Tournament, Team, Player, MatchPlayer', kind: 'truth', note: 'Setup data. Authoritative, but not event-sourced — a squad is state, not a stream.' },
  { name: 'Match, Innings', kind: 'truth', note: 'Status, toss, result, and oversQuota copied at creation so an organizer edit cannot move a finished innings.' },
  { name: 'User, RefreshToken, Notification', kind: 'truth', note: 'Identity and the record of what was sent.' },
  { name: 'PointsTable', kind: 'derived', note: 'Recomputed for the whole tournament on every match completion. Never incremented.' },
  { name: 'PlayerMatchStats', kind: 'derived', note: 'Rewritten per match. A career profile is the sum across every Player slot linked to an account.' },
  { name: 'Redis snapshot', kind: 'derived', note: 'One innings, shaped for display, behind a TTL. A cold cache is a latency problem, never a correctness one.' },
  { name: 'Standings and stats caches', kind: 'derived', note: 'Read-through with a TTL. Deleting them costs one rebuild.' },
] as const;

export function TruthTable() {
  const [truncated, setTruncated] = useState<Set<string>>(new Set());

  const toggle = (name: string, kind: string) => {
    if (kind === 'truth') return;
    setTruncated((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <Figure
      label="Figure 5 — the TRUNCATE test"
      hint="Try to drop a row. The four marked truth refuse; the projections vanish and tell you what rebuilds them."
      controls={
        <Controls label="Drop a table">
          <Btn onClick={() => setTruncated(new Set())}>Rebuild everything</Btn>
        </Controls>
      }
      caption="One question sorts the schema: can I TRUNCATE this table and rebuild it from something else with no loss? If yes, it is a projection, and the rule that follows is that a projection is recomputed, never incremented."
    >
      <ul className="flex flex-col gap-1.5">
        {TABLES.map((row) => {
          const dropped = truncated.has(row.name);
          return (
            <li key={row.name}>
              <button
                type="button"
                onClick={() => toggle(row.name, row.kind)}
                className={cn(
                  'flex w-full items-start gap-4 rounded-[var(--radius-sm)] border px-4 py-3 text-left transition-colors',
                  row.kind === 'truth'
                    ? 'cursor-not-allowed border-line bg-raised'
                    : 'cursor-pointer border-dashed border-line-strong bg-raised hover:border-[var(--accent)]',
                  dropped && 'opacity-45',
                )}
              >
                <span
                  className="eyebrow mt-1 w-16 shrink-0"
                  style={{ color: row.kind === 'truth' ? 'var(--alert)' : 'var(--accent)' }}
                >
                  {row.kind}
                </span>
                <span className="min-w-0">
                  <span className="mono block text-[0.8125rem] text-primary">
                    {row.name}
                    {dropped ? ' — dropped, rebuilds on next read' : ''}
                  </span>
                  <span className="mt-0.5 block text-[0.8125rem] text-secondary">{row.note}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Figure>
  );
}
