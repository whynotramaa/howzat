import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Btn, Controls, Figure, Hand, Icon, LogPane, useLog, Wire } from './chrome';
import { cn } from '@/lib/cn';

/* ================================================================== *
 * 1. The lock bench
 * ================================================================== */

type Holder = 'A' | 'B' | null;

interface LockState {
  holder: Holder;
  token: string | null;
  expiresAt: number | null;
}

const LEASE_MS = 5000;

function token() {
  return Math.random().toString(16).slice(2, 8);
}

export function LockLab() {
  const [lock, setLock] = useState<LockState>({ holder: null, token: null, expiresAt: null });
  const [heldTokens, setHeldTokens] = useState<{ A: string | null; B: string | null }>({
    A: null,
    B: null,
  });
  const [safeRelease, setSafeRelease] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const { lines, push, clear } = useLog();

  // One timer drives the TTL readout and the automatic expiry.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const expired = lock.expiresAt !== null && now >= lock.expiresAt;

  useEffect(() => {
    if (!expired || !lock.holder) return;
    push(
      `lease expired. Redis dropped lock:match:42 on its own. ${lock.holder} still believes it holds the lock.`,
      'warn',
    );
    setLock({ holder: null, token: null, expiresAt: null });
  }, [expired, lock.holder, push]);

  const acquire = (who: 'A' | 'B') => {
    if (lock.holder) {
      push(`${who}: SET lock:match:42 <token> NX PX 5000 → nil. Held by ${lock.holder}. Backing off.`, 'warn');
      return;
    }
    const t = token();
    setLock({ holder: who, token: t, expiresAt: Date.now() + LEASE_MS });
    setHeldTokens((prev) => ({ ...prev, [who]: t }));
    push(`${who}: SET lock:match:42 ${t} NX PX 5000 → OK. Lease runs 5s.`, 'ok');
  };

  const release = (who: 'A' | 'B') => {
    const mine = heldTokens[who];
    if (!mine) {
      push(`${who}: nothing to release.`, 'warn');
      return;
    }
    if (safeRelease) {
      if (lock.token === mine) {
        setLock({ holder: null, token: null, expiresAt: null });
        push(`${who}: EVAL "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) end" → 1. Released.`, 'ok');
      } else {
        push(
          `${who}: EVAL compare-and-delete → 0. The stored token is not mine, so nothing was deleted. This is the script earning its keep.`,
          'note',
        );
      }
    } else if (lock.holder) {
      const victim = lock.holder;
      setLock({ holder: null, token: null, expiresAt: null });
      if (victim === who) {
        push(`${who}: DEL lock:match:42 → 1. Released.`, 'ok');
      } else {
        push(
          `${who}: DEL lock:match:42 → 1. It deleted ${victim}'s lock. Two writers now both believe they are exclusive, which is worse than having no lock at all.`,
          'bad',
        );
      }
    } else {
      push(`${who}: DEL lock:match:42 → 0. Already gone.`, 'warn');
    }
    setHeldTokens((prev) => ({ ...prev, [who]: null }));
  };

  const ttl = lock.expiresAt ? Math.max(0, lock.expiresAt - now) : 0;

  return (
    <Figure
      label="Figure 6 — the lock bench"
      hint="Set the release mode to Plain DEL. Then: A acquires, wait five seconds for the lease to expire, B acquires, A releases. Watch what A deletes."
      controls={
        <>
          <Controls label="Writer A — the scorer's request">
            <Btn onClick={() => acquire('A')} tone="primary">
              <Icon name="lock" />
              Acquire
            </Btn>
            <Btn onClick={() => release('A')}>Release</Btn>
          </Controls>
          <Controls label="Writer B — its own retry">
            <Btn onClick={() => acquire('B')} tone="primary">
              <Icon name="lock" />
              Acquire
            </Btn>
            <Btn onClick={() => release('B')}>Release</Btn>
          </Controls>
          <Controls label="How release is implemented" tone="danger">
            <Btn onClick={() => setSafeRelease(true)} active={safeRelease}>
              Lua compare-and-delete
            </Btn>
            <Btn onClick={() => setSafeRelease(false)} active={!safeRelease}>
              Plain DEL
            </Btn>
            <Btn
              onClick={() => {
                setLock({ holder: null, token: null, expiresAt: null });
                setHeldTokens({ A: null, B: null });
                clear();
              }}
            >
              Reset
            </Btn>
          </Controls>
        </>
      }
      log={<LogPane lines={lines} />}
      caption="The scenario worth reproducing: switch to plain DEL, let A acquire, wait five seconds for the lease to expire, have B acquire, then press A: release. A deletes B's lock. Repeat with the Lua script and A's release is a no-op, because the stored token is no longer A's."
    >
      <p className="eng-scroll-note">
        <Icon name="hand" /> scroll the drawing sideways
      </p>
      <div className="eng-scroll">
        <svg viewBox="0 0 700 250" className="eng-svg min-w-[560px]" role="img" aria-label="Lock bench">
          <g className="sketch">
            <Wire
              d="M 186 62 L 276 100"
              state={lock.holder === 'A' ? 'active' : 'muted'}
              flow={lock.holder === 'A'}
            />
            <Wire
              d="M 186 190 L 276 140"
              state={lock.holder === 'B' ? 'active' : 'muted'}
              flow={lock.holder === 'B'}
            />

            <Box
              x={40}
              y={36}
              w={146}
              h={52}
              title="Writer A"
              sub={heldTokens.A ? `token ${heldTokens.A}` : 'no token'}
              state={lock.holder === 'A' ? 'active' : heldTokens.A ? 'failed' : 'idle'}
            />
            <Box
              x={40}
              y={164}
              w={146}
              h={52}
              title="Writer B"
              sub={heldTokens.B ? `token ${heldTokens.B}` : 'no token'}
              state={lock.holder === 'B' ? 'active' : heldTokens.B ? 'failed' : 'idle'}
            />

            <rect
              x={276}
              y={74}
              width={200}
              height={92}
              rx={10}
              className="eng-box"
              data-state={lock.holder ? 'active' : 'muted'}
            />
            <text x={376} y={100} textAnchor="middle" className="t-label">
              lock:match:42
            </text>
            <text x={376} y={120} textAnchor="middle">
              {lock.token ? `value = ${lock.token}` : '(not set)'}
            </text>
            <text x={376} y={140} textAnchor="middle">
              {lock.expiresAt ? `PX ${Math.ceil(ttl)}ms left` : 'no lease'}
            </text>
            {lock.expiresAt ? (
              <rect
                x={296}
                y={150}
                width={(160 * ttl) / LEASE_MS}
                height={4}
                rx={2}
                fill="var(--accent)"
              />
            ) : null}

            <Box x={520} y={74} w={150} h={92} title="Postgres" sub="@@unique(inningsId, seq)" state="done" />
            <Wire d="M 476 120 L 520 120" state="done" />

            <Hand x={520} y={62}>
              the real guarantee lives here
            </Hand>
            <Hand x={286} y={200}>
              {heldTokens.A && heldTokens.B ? 'two writers hold tokens. one of them is wrong.' : 'a lease, not a promise'}
            </Hand>
          </g>
        </svg>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 2. Idempotency
 * ================================================================== */

interface Row {
  id: number;
  seq: number;
  clientEventId: string;
  runs: number;
}

interface Reply {
  id: number;
  status: 200 | 201 | 409 | 500;
  note: string;
  runs: number;
}

export function IdempotencyLab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [checkOnly, setCheckOnly] = useState(false);
  const nextId = useRef(1);
  const currentKey = useRef('c-8f3a');

  const total = rows.reduce((sum, row) => sum + row.runs, 0);

  // Everything is computed from `rows` before any setState call. Side effects
  // inside a state updater run twice under StrictMode.
  const post = useCallback(
    (key: string, runs: number, parallel = false) => {
      const seen = rows.some((row) => row.clientEventId === key);
      const currentTotal = rows.reduce((sum, row) => sum + row.runs, 0);

      if (seen) {
        setReplies((prev) => [
          ...prev,
          {
            id: nextId.current++,
            status: 200,
            note: `lookup on ${key} hit. Short-circuit, return the current snapshot.`,
            runs: currentTotal,
          },
        ]);
        return;
      }

      const newTotal = currentTotal + runs;
      const row: Row = { id: nextId.current++, seq: rows.length + 1, clientEventId: key, runs };
      setRows((prev) => [...prev, row]);

      const created: Reply = {
        id: nextId.current++,
        status: 201,
        note: `no row for ${key}. INSERT at seq ${rows.length + 1}.`,
        runs: newTotal,
      };

      // The second request of a genuine race passed the lookup before the first
      // committed. Only the unique index separates them now.
      const raced: Reply | null = parallel
        ? checkOnly
          ? {
              id: nextId.current++,
              status: 500,
              note: 'second request also passed the lookup, then hit P2002 with no catch. Unhandled: a 500 on a ball that is already durable.',
              runs: newTotal,
            }
          : {
              id: nextId.current++,
              status: 200,
              note: 'second request passed the lookup, INSERT raised P2002, caught and converted to an idempotent success.',
              runs: newTotal,
            }
        : null;

      setReplies((prev) => (raced ? [...prev, created, raced] : [...prev, created]));
    },
    [rows, checkOnly],
  );

  return (
    <Figure
      label="Figure 7 — the same six, sent three times"
      hint="Score a six, then press Retry twice. The row count never moves. Now turn the P2002 catch off and send two in parallel."
      controls={
        <>
          <Controls label="What the phone does">
            <Btn
              tone="primary"
              onClick={() => {
                currentKey.current = `c-${Math.random().toString(16).slice(2, 6)}`;
                post(currentKey.current, 6);
              }}
            >
              <Icon name="bolt" />
              Score a six
            </Btn>
            <Btn onClick={() => post(currentKey.current, 6)}>Retry the same clientEventId</Btn>
            <Btn onClick={() => post(`c-${Math.random().toString(16).slice(2, 6)}`, 6, true)}>
              Two requests at once, same id
            </Btn>
          </Controls>
          <Controls label="Server implementation" tone="danger">
            <Btn onClick={() => setCheckOnly((v) => !v)} active={checkOnly}>
              {checkOnly ? 'Lookup only, no P2002 catch' : 'Lookup + P2002 catch'}
            </Btn>
            <Btn
              onClick={() => {
                setRows([]);
                setReplies([]);
              }}
            >
              Reset
            </Btn>
          </Controls>
        </>
      }
      caption="Two nets, and both are load-bearing. The lookup handles the ordinary duplicate. The P2002 catch handles the race where two requests for one id both pass the lookup before either commits. Turn the catch off and that race becomes a 500 on a ball that is already durable."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-2.5">BallEvent rows</p>
          <div className="rounded-[var(--radius-sm)] border border-line bg-sunken">
            {rows.length === 0 ? (
              <p className="px-3 py-8 text-center text-[0.8125rem] text-muted">No rows.</p>
            ) : (
              <ul className="mono divide-y divide-[var(--line)] text-[0.6875rem]">
                {rows.map((row) => (
                  <li key={row.id} className="flex justify-between px-3 py-2">
                    <span className="text-muted">seq {row.seq}</span>
                    <span className="text-accent">{row.clientEventId}</span>
                    <span className="text-primary">{row.runs} runs</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-3 text-[0.875rem] text-secondary">
            Team total: <span className="score-figure text-[1.5rem] text-primary">{total}</span>
            <span className="ml-2 text-muted">
              {rows.length} row{rows.length === 1 ? '' : 's'} for {replies.filter((r) => r.status !== 500).length} accepted request
              {replies.filter((r) => r.status !== 500).length === 1 ? '' : 's'}
            </span>
          </p>
        </div>
        <div>
          <p className="eyebrow mb-2.5">Responses</p>
          <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
            {replies.map((reply) => (
              <li
                key={reply.id}
                className="rounded-[var(--radius-sm)] border border-line bg-raised px-3 py-2"
              >
                <span
                  className="mono mr-2 text-[0.6875rem]"
                  style={{
                    color:
                      reply.status === 201
                        ? 'var(--success)'
                        : reply.status === 200
                          ? 'var(--accent)'
                          : 'var(--alert)',
                  }}
                >
                  {reply.status}
                </span>
                <span className="text-[0.8125rem] text-secondary">{reply.note}</span>
                <span className="mono ml-1 text-[0.6875rem] text-muted">body: {reply.runs} runs</span>
              </li>
            ))}
            {replies.length === 0 ? (
              <li className="text-[0.8125rem] text-muted">Nothing sent yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 3. The snapshot guard
 * ================================================================== */

interface Pending {
  seq: number;
  runs: number;
}

export function SnapshotGuardLab() {
  const [guard, setGuard] = useState(true);
  const [cached, setCached] = useState<{ seq: number; runs: number }>({ seq: 41, runs: 118 });
  const [inFlight, setInFlight] = useState<Pending[]>([]);
  const { lines, push, clear } = useLog();

  const start = (seq: number, runs: number) => {
    if (inFlight.some((p) => p.seq === seq)) return;
    setInFlight((prev) => [...prev, { seq, runs }]);
    push(`ball ${seq} inserted in Postgres. Its snapshot write is now in flight.`, 'note');
  };

  const land = (seq: number) => {
    const pending = inFlight.find((p) => p.seq === seq);
    if (!pending) return;
    setInFlight((prev) => prev.filter((p) => p.seq !== seq));
    if (guard && pending.seq <= cached.seq) {
      push(
        `writeSnapshot(${seq}): cached lastEventSeq is ${cached.seq}, which is not older. Skipped. The viewer keeps the newer score.`,
        'ok',
      );
      return;
    }
    if (!guard && pending.seq <= cached.seq) {
      push(
        `writeSnapshot(${seq}): overwrote seq ${cached.seq}. Every viewer's score just went backwards from ${cached.runs} to ${pending.runs}.`,
        'bad',
      );
    } else {
      push(`writeSnapshot(${seq}): cached seq ${cached.seq} → ${seq}. Written.`, 'ok');
    }
    setCached({ seq: pending.seq, runs: pending.runs });
  };

  return (
    <Figure
      label="Figure 8 — the slow write that lost the race"
      hint="Turn the seq guard off, then press the four buttons left to right. The score of every viewer in the ground rewinds."
      controls={
        <>
          <Controls label="Two balls, out of order">
            <Btn onClick={() => start(42, 124)} tone="primary" disabled={inFlight.some((p) => p.seq === 42)}>
              1. Ball 42 stalls
            </Btn>
            <Btn onClick={() => start(43, 130)} tone="primary" disabled={inFlight.some((p) => p.seq === 43)}>
              2. Ball 43 goes
            </Btn>
            <Btn onClick={() => land(43)} disabled={!inFlight.some((p) => p.seq === 43)}>
              3. 43 lands
            </Btn>
            <Btn onClick={() => land(42)} disabled={!inFlight.some((p) => p.seq === 42)}>
              4. 42 finally lands
            </Btn>
          </Controls>
          <Controls label="writeSnapshot implementation" tone="danger">
            <Btn onClick={() => setGuard((g) => !g)} active={guard}>
              {guard ? 'lastEventSeq guard on' : 'lastEventSeq guard off'}
            </Btn>
            <Btn
              onClick={() => {
                setCached({ seq: 41, runs: 118 });
                setInFlight([]);
                clear();
              }}
            >
              Reset
            </Btn>
          </Controls>
        </>
      }
      log={<LogPane lines={lines} />}
      caption="Press the four buttons in order, with the guard off. Optimistic concurrency with lastEventSeq as the version costs one read and stops the whole match rewinding for every viewer until the next ball."
    >
      <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">In flight</p>
          {inFlight.length === 0 ? (
            <p className="text-[0.8125rem] text-muted">Nothing pending.</p>
          ) : (
            inFlight.map((p) => (
              <div
                key={p.seq}
                className="mono rounded-[var(--radius-sm)] border border-dashed border-[var(--warning)] bg-warning-soft px-3 py-2 text-[0.75rem] text-warning"
              >
                writeSnapshot(seq {p.seq}, {p.runs} runs)
              </div>
            ))
          )}
        </div>
        <span aria-hidden className="ink hidden text-[1.25rem] text-muted sm:block">
          →
        </span>
        <div className="rounded-[var(--radius-md)] border border-line bg-sunken px-5 py-4">
          <p className="eyebrow mb-2">What every viewer sees</p>
          <p className="score-figure text-[2.25rem] text-primary">{cached.runs}</p>
          <p className="mono text-[0.75rem] text-muted">cached lastEventSeq = {cached.seq}</p>
        </div>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 4. Redis: the keyspace, and what a failure costs
 * ================================================================== */

const KEYSPACE = [
  {
    key: 'snapshot:match:<matchId>',
    type: 'STRING (JSON) + TTL',
    why: 'A viewer read that would otherwise re-fold an event log.',
    down: 'readCachedSnapshot catches and returns null. Every read rebuilds from the log. Slower, still correct.',
    tone: 'ok',
  },
  {
    key: 'lock:match:<matchId>',
    type: 'STRING with NX and PX',
    why: 'Serialises the read-validate-insert on one match.',
    down: 'acquireLock throws and the write fails. The only dependency here that does not degrade. The fix is a Postgres advisory lock fallback.',
    tone: 'bad',
  },
  {
    key: 'authz:match:<matchId>:user:<userId>',
    type: "STRING '1' or '0', 60s TTL",
    why: 'Caches a per-object permission decision, negatives included, so a probing request does not reach Postgres each time.',
    down: 'Falls back to the Postgres query it was caching. Slower, still correct.',
    tone: 'ok',
  },
  {
    key: 'ratelimit:<scope>:<subject>',
    type: 'INCR with TTL, in MULTI',
    why: 'Fixed-window counters. 120 ball writes per minute per scorer per match. 5 OTP requests per hour per email.',
    down: 'The limiter catches its own error and calls next(). It fails open on purpose.',
    tone: 'warn',
  },
  {
    key: 'viewers:match:<matchId>',
    type: 'ZSET, socket id scored by join time',
    why: 'Counts live viewers without asking any instance a question.',
    down: 'Counts read zero. Cosmetic.',
    tone: 'ok',
  },
  {
    key: 'slug:<publicSlug>',
    type: 'STRING, matchId',
    why: 'Resolves a share link without a Postgres lookup on the public read path.',
    down: 'Falls back to a Postgres lookup by slug.',
    tone: 'ok',
  },
  {
    key: 'socket.io#/#<room>',
    type: 'PUB/SUB channels',
    why: 'Carries an emit from the instance that wrote the ball to every other instance.',
    down: 'Fan-out stops crossing instances. A viewer attached elsewhere sees nothing until it refetches.',
    tone: 'warn',
  },
] as const;

export function RedisKeyspace() {
  const [down, setDown] = useState(false);

  return (
    <Figure
      label="Figure 9 — every Redis key in the system"
      hint="Press Kill Redis. Each row swaps to what actually happens when that key is unreachable."
      controls={
        <Controls label="Dependency state" tone="danger">
          <Btn onClick={() => setDown((d) => !d)} active={down}>
            <Icon name="offline" />
            {down ? 'Redis is down — bring it back' : 'Kill Redis'}
          </Btn>
        </Controls>
      }
      caption="The test applied to every one of these: if Redis disappeared, would I lose correctness, or would the system just get slower? Six answers are 'slower'. One is not, and that one is written down as a gap rather than argued away."
    >
      <ul className="flex flex-col gap-2">
        {KEYSPACE.map((entry) => (
          <li
            key={entry.key}
            className={cn(
              'rounded-[var(--radius-sm)] border px-4 py-3 transition-colors',
              down && entry.tone === 'bad'
                ? 'border-[var(--alert)] bg-alert-soft'
                : down && entry.tone === 'warn'
                  ? 'border-[var(--warning)] bg-warning-soft'
                  : 'border-line bg-raised',
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="eng-key">{entry.key}</span>
              <span className="mono text-[0.6875rem] text-muted">{entry.type}</span>
            </div>
            <p className="mt-1.5 text-[0.8125rem] text-secondary">
              {down ? entry.down : entry.why}
            </p>
          </li>
        ))}
      </ul>
    </Figure>
  );
}
