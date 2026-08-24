import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Btn, Controls, Figure, Hand, Icon, LogPane, useLog, Wire } from './chrome';
import { cn } from '@/lib/cn';

/* ================================================================== *
 * 1. The WebSocket handshake
 * ================================================================== */

const HANDSHAKE = [
  {
    title: 'GET with an upgrade request',
    body: 'GET /api/socket.io/?EIO=4&transport=websocket\nUpgrade: websocket\nConnection: Upgrade\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\nSec-WebSocket-Version: 13',
    note: 'Still ordinary HTTP/1.1 at this point. The key is a random 16-byte nonce, not a secret.',
  },
  {
    title: '101 Switching Protocols',
    body: 'HTTP/1.1 101 Switching Protocols\nUpgrade: websocket\nConnection: Upgrade\nSec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=',
    note: 'Accept is base64 of SHA-1 of the key plus a fixed GUID. It proves the server understood the protocol rather than being a cache that echoed the request.',
  },
  {
    title: 'Frames, both directions',
    body: "→ 42[\"join\",{\"matchId\":\"m_9f2\"}]\n← 42[\"snapshot\",{ …2.4KB… }]\n← 42[\"ball\",{ …2.4KB… }]",
    note: 'Not HTTP any more. A framed message channel with almost no per-message overhead, and either side can send at any time.',
  },
  {
    title: 'Close, then reconnect',
    body: 'transport close (function hit its 300s ceiling)\n… 2s …\nconnect → join → refetch snapshot',
    note: 'The client rejoins the room and refetches over HTTP, because what happened while it was away is unknowable.',
  },
];

export function HandshakeLab() {
  const [step, setStep] = useState(0);
  const current = HANDSHAKE[step] ?? HANDSHAKE[0]!;

  return (
    <Figure
      label="Figure 12 — how the connection is actually made"
      hint="Step through the four moments. The protocol stops being HTTP at moment two."
      controls={
        <Controls label="Moment">
          {HANDSHAKE.map((s, i) => (
            <Btn key={s.title} onClick={() => setStep(i)} active={step === i}>
              {i + 1}. {s.title}
            </Btn>
          ))}
        </Controls>
      }
      caption="Four moments. The first two are HTTP, the third is not, and the fourth happens every five minutes in production on this deployment."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <svg viewBox="0 0 380 220" className="eng-svg" role="img" aria-label="WebSocket handshake">
          <g className="sketch">
            <Box x={16} y={16} w={120} h={40} title="Browser" state={step === 0 || step === 2 ? 'active' : 'idle'} />
            <Box x={240} y={16} w={120} h={40} title="Server" state={step === 1 || step === 2 ? 'active' : 'idle'} />
            <line x1={76} y1={56} x2={76} y2={210} stroke="var(--line)" strokeDasharray="3 5" />
            <line x1={300} y1={56} x2={300} y2={210} stroke="var(--line)" strokeDasharray="3 5" />

            <Wire d="M 76 88 L 296 88" state={step === 0 ? 'active' : step > 0 ? 'done' : 'muted'} flow={step === 0} />
            <text x={186} y={80} textAnchor="middle" className={step === 0 ? 't-label' : ''}>
              Upgrade: websocket
            </text>

            <Wire d="M 300 126 L 80 126" state={step === 1 ? 'active' : step > 1 ? 'done' : 'muted'} flow={step === 1} />
            <text x={186} y={118} textAnchor="middle" className={step === 1 ? 't-label' : ''}>
              101 Switching Protocols
            </text>

            <Wire d="M 76 162 L 296 162" state={step === 2 ? 'active' : step > 2 ? 'done' : 'muted'} flow={step === 2} arrow />
            <Wire d="M 300 180 L 80 180" state={step === 2 ? 'active' : step > 2 ? 'done' : 'muted'} flow={step === 2} arrow />
            <text x={186} y={200} textAnchor="middle">
              frames, either direction
            </text>
            {step === 3 ? <Hand x={110} y={214}>then it drops, and that is fine</Hand> : null}
          </g>
        </svg>

        <div className="flex flex-col gap-3">
          <pre className="mono overflow-x-auto rounded-[var(--radius-sm)] border border-line bg-sunken px-4 py-3 text-[0.6875rem] leading-relaxed text-secondary">
            {current.body}
          </pre>
          <p className="text-[0.875rem] text-secondary">{current.note}</p>
        </div>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 2. Cross-instance fan-out and the viewer count
 * ================================================================== */

type Phase = 'idle' | 'write' | 'publish' | 'deliver';

export function FanoutLab() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [frozen, setFrozen] = useState(false);
  const [method, setMethod] = useState<'zset' | 'fetchSockets'>('zset');
  const [countState, setCountState] = useState<'ready' | 'stalled'>('ready');
  const { lines, push, clear } = useLog();

  const run = useCallback(() => {
    clear();
    setPhase('write');
    push('instance A: ball inserted, snapshot projected', 'ok');
    setTimeout(() => {
      setPhase('publish');
      push('instance A: io.to("match:m_9f2").emit("ball", snapshot)', 'note');
      push('adapter: PUBLISH to socket.io#/#match:m_9f2 — every instance receives it, subscriber or not');
    }, 800);
    setTimeout(() => {
      setPhase('deliver');
      push('instance B: emits to its own sockets in match:m_9f2', 'ok');
      push('viewer on B: isNewerSnapshot passes, score renders', 'ok');
      if (frozen) {
        push('instance C is frozen. It still holds its Redis subscription and delivers nothing.', 'warn');
      }
    }, 1700);
    setTimeout(() => setPhase('idle'), 2900);
  }, [clear, push, frozen]);

  const countViewers = () => {
    if (method === 'zset') {
      push('ZREMRANGEBYSCORE viewers:match:m_9f2 -inf <15 min ago>, then ZCARD → 3', 'ok');
      push('No instance was asked anything. A frozen instance cannot affect this number.', 'note');
      setCountState('ready');
      return;
    }
    push('fetchSockets(): broadcast a request, wait for every subscribed instance to answer');
    if (frozen) {
      setCountState('stalled');
      push('instance C is frozen. It is counted among the expected responders and will never reply.', 'bad');
      push('the call stalls for its full timeout, then fails', 'bad');
    } else {
      setCountState('ready');
      push('every instance answered → 3', 'ok');
    }
  };

  return (
    <Figure
      label="Figure 13 — a ball written on A, seen on B"
      hint="Freeze instance C, switch the count to fetchSockets(), then press Count viewers. That is the exact bug this platform produces."
      controls={
        <>
          <Controls label="Traffic">
            <Btn onClick={run} tone="primary" disabled={phase !== 'idle'}>
              <Icon name="bolt" />
              Score a ball on A
            </Btn>
            <Btn onClick={countViewers}>Count viewers</Btn>
          </Controls>
          <Controls label="How viewers are counted">
            <Btn onClick={() => setMethod('zset')} active={method === 'zset'}>
              Redis sorted set
            </Btn>
            <Btn onClick={() => setMethod('fetchSockets')} active={method === 'fetchSockets'}>
              fetchSockets()
            </Btn>
          </Controls>
          <Controls label="Platform" tone="danger">
            <Btn onClick={() => setFrozen((f) => !f)} active={frozen}>
              <Icon name="offline" />
              {frozen ? 'C is frozen' : 'Freeze instance C'}
            </Btn>
          </Controls>
        </>
      }
      log={<LogPane lines={lines} />}
      caption="Freeze instance C, switch the count to fetchSockets(), and press Count viewers. That is the exact failure this platform produces: an idle instance keeps its Redis subscription, so it is counted among the responders and never answers."
    >
      <p className="eng-scroll-note">
        <Icon name="hand" /> scroll the drawing sideways
      </p>
      <div className="eng-scroll">
        <svg viewBox="0 0 720 300" className="eng-svg min-w-[600px]" role="img" aria-label="Cross-instance fan-out">
          <g className="sketch">
            <Wire d="M 172 60 L 268 60" state={phase === 'write' ? 'active' : 'idle'} flow={phase === 'write'} />
            <Wire d="M 268 96 L 200 130" state={phase === 'publish' || phase === 'deliver' ? 'active' : 'muted'} flow={phase === 'publish'} />
            <Wire d="M 200 168 L 268 208" state={phase === 'deliver' ? 'active' : 'muted'} flow={phase === 'deliver'} />
            <Wire d="M 140 168 L 92 208" state={phase === 'deliver' ? 'active' : 'muted'} flow={phase === 'deliver'} />
            <Wire d="M 432 232 L 520 232" state={phase === 'deliver' ? 'active' : 'muted'} flow={phase === 'deliver'} />

            <Box x={24} y={36} w={148} h={48} title="Scorer" sub="POST /balls" state={phase === 'write' ? 'active' : 'idle'} />
            <Box x={268} y={36} w={164} h={60} title="API instance A" sub="wrote the ball" state={phase !== 'idle' ? 'active' : 'idle'} />
            <Box x={92} y={130} w={200} h={38} title="Redis pub/sub" sub="socket.io#/#match:m_9f2" state={phase === 'publish' ? 'active' : 'idle'} r={19} />
            <Box x={268} y={202} w={164} h={60} title="API instance B" sub="has viewers here" state={phase === 'deliver' ? 'active' : 'idle'} />
            <Box
              x={24}
              y={202}
              w={148}
              h={60}
              title="API instance C"
              sub={frozen ? 'frozen, still subscribed' : 'idle, warm'}
              state={frozen ? 'failed' : 'muted'}
            />
            <Box x={520} y={202} w={172} h={60} title="Viewers" sub="room match:m_9f2" state={phase === 'deliver' ? 'done' : 'idle'} />

            <rect
              x={520}
              y={60}
              width={172}
              height={92}
              rx={9}
              className="eng-box"
              data-state={countState === 'stalled' ? 'failed' : 'idle'}
            />
            <text x={606} y={84} textAnchor="middle" className="t-label">
              viewers:match:m_9f2
            </text>
            <text x={606} y={104} textAnchor="middle">
              {method === 'zset' ? 'ZSET, scored by join time' : 'fetchSockets() round trip'}
            </text>
            <text x={606} y={126} textAnchor="middle" className="t-label" style={{ fill: countState === 'stalled' ? 'var(--alert)' : 'var(--success)' }}>
              {countState === 'stalled' ? 'timed out' : '3 watching'}
            </text>

            <Hand x={300} y={192}>every instance gets the message</Hand>
            <Hand x={30} y={288}>{frozen ? 'this one will never answer you' : 'no viewers here'}</Hand>
          </g>
        </svg>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 3. The client gate: isNewerSnapshot
 * ================================================================== */

interface Incoming {
  innings: number;
  seq: number;
  runs: number;
  label: string;
}

const ARRIVALS: Incoming[] = [
  { innings: 1, seq: 118, runs: 142, label: 'ball 118 — the normal case' },
  { innings: 1, seq: 117, runs: 138, label: 'ball 117 — delayed, arrives late' },
  { innings: 1, seq: 121, runs: 149, label: 'ball 121 — two were missed' },
  { innings: 2, seq: 1, runs: 0, label: 'innings 2, ball 1 — the sequence restarts' },
];

export function SnapshotGateLab() {
  const [displayed, setDisplayed] = useState({ innings: 1, seq: 117, runs: 138 });
  const [compareInnings, setCompareInnings] = useState(true);
  const { lines, push, clear } = useLog();

  const deliver = (msg: Incoming) => {
    const newer = compareInnings
      ? msg.innings !== displayed.innings
        ? msg.innings > displayed.innings
        : msg.seq > displayed.seq
      : msg.seq > displayed.seq;

    if (newer) {
      setDisplayed({ innings: msg.innings, seq: msg.seq, runs: msg.runs });
      push(`accepted ${msg.label} → ${msg.runs} runs`, 'ok');
      if (msg.seq > displayed.seq + 1 && msg.innings === displayed.innings) {
        push(`hasSequenceGap: ${msg.seq} is more than one ahead of ${displayed.seq}. Refetch the snapshot.`, 'note');
      }
    } else {
      push(
        `discarded ${msg.label}${!compareInnings && msg.innings > displayed.innings ? ' — and this one was the whole second innings' : ''}`,
        !compareInnings && msg.innings > displayed.innings ? 'bad' : 'warn',
      );
    }
  };

  return (
    <Figure
      label="Figure 14 — which broadcasts the client is allowed to believe"
      hint="Deliver them out of order, then switch the comparison to seq only and deliver the second innings."
      controls={
        <>
          <Controls label="Deliver a broadcast">
            {ARRIVALS.map((msg) => (
              <Btn key={msg.label} onClick={() => deliver(msg)} title={msg.label}>
                {msg.label.split(' — ')[0]}
              </Btn>
            ))}
          </Controls>
          <Controls label="isNewerSnapshot implementation" tone="danger">
            <Btn onClick={() => setCompareInnings((v) => !v)} active={compareInnings}>
              {compareInnings ? 'inningsNumber, then seq' : 'seq only'}
            </Btn>
            <Btn
              onClick={() => {
                setDisplayed({ innings: 1, seq: 117, runs: 138 });
                clear();
              }}
            >
              Reset
            </Btn>
          </Controls>
        </>
      }
      log={<LogPane lines={lines} />}
      caption="Turn off the innings comparison and press the last button. A new innings restarts seq at 1, so a naive comparison rejects the entire second innings as stale. The bug is invisible for two hours and then the score freezes at the innings break."
    >
      <div className="flex flex-wrap items-center gap-6">
        <div className="rounded-[var(--radius-md)] border border-line bg-sunken px-6 py-4">
          <p className="eyebrow mb-2">What the viewer sees</p>
          <p className="score-figure text-[2.5rem] text-primary">{displayed.runs}</p>
          <p className="mono text-[0.75rem] text-muted">
            innings {displayed.innings} · seq {displayed.seq}
          </p>
        </div>
        <p className="max-w-md text-[0.875rem] text-secondary">
          The property being protected is <strong>monotonic reads</strong>. Being 400 milliseconds
          stale is invisible to a spectator. A score that goes from 47 back to 42 is alarming, and it
          is the first thing anyone reports.
        </p>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 4. The offline outbox
 * ================================================================== */

interface QueuedBall {
  id: string;
  runs: number;
  status: 'pending' | 'failed';
}

let queueId = 0;

export function OutboxLab() {
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedBall[]>([]);
  const [confirmed, setConfirmed] = useState(112);
  const [rejectAt, setRejectAt] = useState(false);
  const [draining, setDraining] = useState(false);
  const { lines, push, clear } = useLog();

  const optimistic = confirmed + queue.reduce((sum, b) => sum + b.runs, 0);
  const blocked = queue[0]?.status === 'failed';

  const enqueue = useCallback(
    (runs: number) => {
      const id = `c-${(++queueId).toString(16).padStart(4, '0')}`;
      setQueue((prev) => [...prev, { id, runs, status: 'pending' }]);
      push(`put ${id} in IndexedDB, marked pending. Optimistic fold applied to the console.`, 'note');
    },
    [push],
  );

  const drain = useCallback(() => {
    if (!online) {
      push('navigator.onLine is false. The drain does not start.', 'warn');
      return;
    }
    setDraining(true);
  }, [online, push]);

  // The drain sends one ball at a time, in createdAt order, and stops on the
  // first rejection. That stop is the whole design: the balls behind it were
  // validated against a state that includes the one that failed.
  //
  // Everything is decided from `queue` before any setState, because React
  // double-invokes state updaters under StrictMode.
  useEffect(() => {
    if (!draining) return;
    const id = setTimeout(() => {
      const head = queue[0];
      if (!head) {
        push('queue empty. Nothing left to send.', 'ok');
        setDraining(false);
        return;
      }
      if (head.status === 'failed') {
        push(`${head.id} is already marked failed. The drain will not step over it.`, 'bad');
        setDraining(false);
        return;
      }
      if (rejectAt && queue.length === 3) {
        push(
          `${head.id} → 422 CONSECUTIVE_OVERS. Marked failed. ${queue.length - 1} balls stay pending behind it.`,
          'bad',
        );
        setDraining(false);
        setQueue((prev) => prev.map((b, i) => (i === 0 ? { ...b, status: 'failed' as const } : b)));
        return;
      }
      push(`${head.id} → 201. Removed from the outbox.`, 'ok');
      setConfirmed((c) => c + head.runs);
      setQueue((prev) => prev.slice(1));
      if (queue.length === 1) setDraining(false);
    }, 620);
    return () => clearTimeout(id);
  }, [draining, queue, rejectAt, push]);

  const goOffline = () => {
    setOnline(false);
    setDraining(false);
    push('offline. Balls keep landing in IndexedDB and the console keeps scoring.', 'warn');
  };

  const goOnline = () => {
    setOnline(true);
    push("the 'online' event fired. Starting the drain.", 'note');
    setDraining(true);
  };

  return (
    <Figure
      label="Figure 15 — the outbox, and the ball that jams it"
      hint="Go offline, score five balls, switch the rejection on, then come back online. The drain stops at the failed ball."
      controls={
        <>
          <Controls label="Score">
            <Btn onClick={() => enqueue(1)} tone="primary">
              1
            </Btn>
            <Btn onClick={() => enqueue(4)} tone="primary">
              4
            </Btn>
            <Btn onClick={() => enqueue(6)} tone="primary">
              6
            </Btn>
          </Controls>
          <Controls label="Connectivity">
            <Btn onClick={online ? goOffline : goOnline}>
              <Icon name={online ? 'offline' : 'bolt'} />
              {online ? 'Go offline' : 'Come back online'}
            </Btn>
            <Btn onClick={drain} disabled={draining || queue.length === 0}>
              Drain now
            </Btn>
          </Controls>
          <Controls label="Server behaviour" tone="danger">
            <Btn onClick={() => setRejectAt((v) => !v)} active={rejectAt}>
              Reject the 3rd-from-last ball
            </Btn>
            <Btn
              onClick={() => {
                setQueue([]);
                setConfirmed(112);
                setOnline(true);
                setDraining(false);
                clear();
              }}
            >
              Reset
            </Btn>
          </Controls>
        </>
      }
      log={<LogPane lines={lines} />}
      caption="Score five or six balls offline, switch the rejection on, then come back online. The drain stops at the failed ball and everything behind it stays pending. That stop is deliberate. Ball four was validated against a state that includes ball three, so sending it anyway would trade a stalled queue for a corrupted innings."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ background: online ? 'var(--success)' : 'var(--alert)' }}
            />
            <span className="eyebrow">{online ? 'online' : 'offline'}</span>
            <span className="mono ml-auto text-[0.6875rem] text-muted">
              IndexedDB · keyed by clientEventId
            </span>
          </div>
          <ol className="flex flex-col gap-1.5">
            {queue.length === 0 ? (
              <li className="rounded-[var(--radius-sm)] border border-dashed border-line px-4 py-6 text-center text-[0.8125rem] text-muted">
                Outbox empty. Every ball goes through here, online or not.
              </li>
            ) : (
              queue.map((ball, i) => (
                <li
                  key={ball.id}
                  className={cn(
                    'mono flex items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-2 text-[0.75rem]',
                    ball.status === 'failed'
                      ? 'border-[var(--alert)] bg-alert-soft text-alert'
                      : i === 0 && draining
                        ? 'border-[var(--accent)] bg-accent-soft text-accent'
                        : 'border-line bg-raised text-secondary',
                  )}
                >
                  <span className="text-muted">{i + 1}</span>
                  <span>{ball.id}</span>
                  <span className="text-primary">{ball.runs} runs</span>
                  <span className="ml-auto">
                    {ball.status === 'failed' ? '422 — jammed' : i === 0 && draining ? 'sending' : 'pending'}
                  </span>
                </li>
              ))
            )}
          </ol>
          {blocked ? (
            <p className="mt-3 text-[0.8125rem] text-alert">
              Retrying an invalid ball fails again, permanently. The correct design separates
              transport failures, which retry with backoff, from semantic rejections, which should
              show the offending ball and offer to edit or discard it. Today it shows an error string
              and a retry button, and that is the sharpest weakness in this layer.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-md)] border border-line bg-sunken px-5 py-4">
            <p className="eyebrow mb-2">Console shows</p>
            <p className="score-figure text-[2.25rem] text-primary">{optimistic}</p>
            <p className="mono text-[0.75rem] text-muted">
              {confirmed} confirmed + {optimistic - confirmed} folded from the outbox
            </p>
          </div>
          <p className="text-[0.875rem] text-secondary">
            The fold always starts from the last server-confirmed state and replays only the queued
            balls on top, so drift is bounded by queue depth. The server's answer is applied
            unconditionally on every response. The client never accumulates state of its own.
          </p>
        </div>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 5. Refresh token rotation and reuse detection
 * ================================================================== */

interface TokenRow {
  id: string;
  revoked: boolean;
}

export function AuthLab() {
  const [tokens, setTokens] = useState<TokenRow[]>([{ id: 'rt_a1', revoked: false }]);
  const [attacker, setAttacker] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const { lines, push, clear } = useLog();

  const present = (id: string, who: 'user' | 'attacker') => {
    const row = tokens.find((t) => t.id === id);
    if (!row) {
      push(`${who}: presented ${id}, which does not exist. 401.`, 'warn');
      return;
    }
    if (row.revoked) {
      push(`${who}: presented ${id}, already revoked. This cannot happen in normal operation.`, 'bad');
      push('reuse detected. Revoking every unrevoked token for this user.', 'bad');
      setTokens((prev) => prev.map((t) => ({ ...t, revoked: true })));
      setSignedOut(true);
      return;
    }
    const next = `rt_${Math.random().toString(36).slice(2, 4)}`;
    setTokens((prev) => [...prev.map((t) => (t.id === id ? { ...t, revoked: true } : t)), { id: next, revoked: false }]);
    push(`${who}: ${id} accepted. Revoked and rotated to ${next}, both in one transaction. New 15-minute access token issued.`, 'ok');
  };

  const live = tokens.filter((t) => !t.revoked);

  return (
    <Figure
      label="Figure 16 — rotation alone is not enough"
      hint="Steal the token, let the user refresh once, then replay the stolen one. Watch every session die."
      controls={
        <>
          <Controls label="The real user">
            <Btn tone="primary" onClick={() => present(live[0]?.id ?? 'rt_gone', 'user')} disabled={signedOut}>
              Refresh the session
            </Btn>
          </Controls>
          <Controls label="The attacker" tone="danger">
            <Btn
              onClick={() => {
                const stolen = live[0]?.id ?? tokens[tokens.length - 1]?.id ?? 'rt_a1';
                setAttacker(stolen);
                push(`attacker copied ${stolen} off the wire. Rotation does not stop them holding it.`, 'warn');
              }}
              disabled={signedOut || !live[0]}
            >
              1. Steal the current token
            </Btn>
            <Btn onClick={() => attacker && present(attacker, 'attacker')} disabled={!attacker || signedOut}>
              2. Replay it
            </Btn>
            <Btn
              onClick={() => {
                setTokens([{ id: 'rt_a1', revoked: false }]);
                setAttacker(null);
                setSignedOut(false);
                clear();
              }}
            >
              Reset
            </Btn>
          </Controls>
        </>
      }
      log={<LogPane lines={lines} />}
      caption="Steal the token, let the user refresh once, then replay the stolen one. Rotation alone only decides who wins the race. What family revocation adds is detection: the loser presents a revoked token, which is a signal that cannot occur in normal operation."
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr]">
        <div>
          <p className="eyebrow mb-2.5">RefreshToken rows — stored as SHA-256 hashes</p>
          <ul className="flex flex-col gap-1.5">
            {tokens.map((t) => (
              <li
                key={t.id}
                className={cn(
                  'mono flex items-center justify-between rounded-[var(--radius-sm)] border px-4 py-2 text-[0.75rem]',
                  t.revoked ? 'border-line bg-sunken text-muted line-through' : 'border-[var(--success)] bg-success-soft text-success',
                )}
              >
                <span>{t.id}</span>
                <span>{t.revoked ? 'revoked' : 'valid'}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 text-[0.875rem] text-secondary">
          <p>
            The access token is a 15-minute JWT held in a module-scoped variable, never in
            localStorage. The refresh token is 48 random bytes in an httpOnly, sameSite=strict cookie
            scoped to path <code className="mono">/</code>, stored server-side as a hash.
          </p>
          <p>
            Password hashing is bcrypt at cost 12, about 250ms, run once per login. The refresh token
            gets SHA-256, because 384 bits from a CSPRNG is not brute-forceable and this hash runs on
            every single refresh.
          </p>
          {signedOut ? (
            <p className="text-alert">
              Every session for this user is now dead, with a message that explains exactly what
              happened. A genuine client racing itself produces the same signal, which is why the
              message matters.
            </p>
          ) : null}
        </div>
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 6. Serverless: the freeze and the 300-second ceiling
 * ================================================================== */

export function FreezeLab() {
  const [awaited, setAwaited] = useState(true);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = p + 6;
        if (!awaited && next >= 34) {
          setRunning(false);
          setOutcome(
            'Response sent at this point, so the instance froze. The standings rebuild stopped part-way with no exception, no log line, and no failed request. The points table is silently half-written.',
          );
          return 34;
        }
        if (next >= 100) {
          setRunning(false);
          setOutcome(
            'Both subscribers finished before the response was sent. The points table and every player card are consistent, and the request took about 180ms longer.',
          );
          return 100;
        }
        return next;
      });
    }, 90);
    return () => clearInterval(id);
  }, [running, awaited]);

  const start = () => {
    setProgress(0);
    setOutcome(null);
    setRunning(true);
  };

  return (
    <Figure
      label="Figure 17 — void versus await on the completion path"
      hint="Run it with await, then switch to void and run it again. Nothing errors either way, which is the problem."
      controls={
        <>
          <Controls label="Finish the match">
            <Btn onClick={start} tone="primary" disabled={running}>
              <Icon name="bolt" />
              Complete the match
            </Btn>
          </Controls>
          <Controls label="How the publish is called" tone="danger">
            <Btn onClick={() => setAwaited(true)} active={awaited}>
              await publishMatchEvent
            </Btn>
            <Btn onClick={() => setAwaited(false)} active={!awaited}>
              void publishMatchEvent
            </Btn>
          </Controls>
        </>
      }
      caption="On the hot ball path the publish is dropped with void, because the only consumer is a socket broadcast and the scorer should not wait on it. On the completion path it is awaited, because two heavy recomputes hang off match:completed and the instance freezes the moment the response is sent."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[0.75rem]">
            <span className="mono text-secondary">recomputeStandings + recomputePlayerStatsForMatch</span>
            <span className="mono text-muted">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full transition-[width] duration-100"
              style={{
                width: `${progress}%`,
                background: outcome && !awaited ? 'var(--alert)' : 'var(--accent)',
              }}
            />
          </div>
          {!awaited ? (
            <div className="relative h-4">
              <span
                className="ink absolute text-[0.9375rem] text-alert"
                style={{ left: '34%', transform: 'translateX(-50%)' }}
              >
                ↑ instance frozen here
              </span>
            </div>
          ) : null}
        </div>
        {outcome ? (
          <p className={cn('max-w-3xl text-[0.875rem]', awaited ? 'text-secondary' : 'text-alert')}>
            {outcome}
          </p>
        ) : (
          <p className="max-w-3xl text-[0.875rem] text-secondary">
            This is the worst class of bug, because it is non-deterministic. It works in development,
            works under load while other requests keep the instance warm, and fails at 11pm on a quiet
            Tuesday.
          </p>
        )}
      </div>
    </Figure>
  );
}

/* ================================================================== *
 * 7. What breaks first: fan-out cost
 * ================================================================== */

export function FanoutChart() {
  const [instances, setInstances] = useState(4);
  const [payload, setPayload] = useState<'snapshot' | 'delta'>('snapshot');

  const series = useMemo(() => {
    const bytes = payload === 'snapshot' ? 2600 : 180;
    // Cost per ball = payload x viewers x instances, in both socket egress and
    // pub/sub bandwidth, because the adapter publishes to every instance.
    return Array.from({ length: 26 }, (_, i) => {
      const viewers = i * 400;
      return { viewers, mb: (bytes * viewers * instances) / 1_000_000 };
    });
  }, [instances, payload]);

  const max = Math.max(...series.map((p) => p.mb), 1);
  const path = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${40 + (p.viewers / 10000) * 620} ${210 - (p.mb / max) * 170}`)
    .join(' ');

  const at5k = series.find((p) => p.viewers === 4800)?.mb ?? 0;

  return (
    <Figure
      label="Figure 18 — the number that decides when deltas become necessary"
      hint="Drag the instance count up. The cost is payload times viewers times instances, and only one of those three is under your control."
      controls={
        <>
          <Controls label="Deployment">
            <label className="flex items-center gap-2 text-[0.75rem] text-secondary">
              <input
                type="range"
                min={1}
                max={12}
                value={instances}
                onChange={(e) => setInstances(Number(e.target.value))}
                className="w-28 accent-[var(--accent)]"
                aria-label="API instances"
              />
              <span className="mono w-14 text-primary">{instances} inst</span>
            </label>
          </Controls>
          <Controls label="What each broadcast carries">
            <Btn onClick={() => setPayload('snapshot')} active={payload === 'snapshot'}>
              Full snapshot, 2.6KB
            </Btn>
            <Btn onClick={() => setPayload('delta')} active={payload === 'delta'}>
              Delta + keyframe, 180B
            </Btn>
          </Controls>
        </>
      }
      caption="Fan-out breaks before the write path does. A ball is a small write and Postgres barely notices, but every ball costs payload x viewers x instances, because the Redis adapter publishes each emit to every instance whether or not it holds a subscriber."
    >
      <p className="eng-scroll-note">
        <Icon name="hand" /> scroll the chart sideways
      </p>
      <div className="eng-scroll">
        <svg
          viewBox="0 0 700 250"
          className="eng-svg min-w-[560px]"
          role="img"
          aria-label="Fan-out cost per ball"
        >
        <line x1={40} y1={210} x2={680} y2={210} stroke="var(--line-strong)" />
        <line x1={40} y1={30} x2={40} y2={210} stroke="var(--line-strong)" />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={40} y1={210 - f * 170} x2={680} y2={210 - f * 170} stroke="var(--line)" strokeDasharray="2 6" />
            <text x={34} y={214 - f * 170} textAnchor="end" className="t-num">
              {(max * f).toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 2000, 4000, 6000, 8000, 10000].map((v) => (
          <text key={v} x={40 + (v / 10000) * 620} y={228} textAnchor="middle" className="t-num">
            {v.toLocaleString()}
          </text>
        ))}
        <text x={360} y={244} textAnchor="middle" className="t-num">
          concurrent viewers on one match
        </text>
        <text x={12} y={24} className="t-num">
          MB per ball
        </text>
        <g className="sketch">
          <path
            d={path}
            fill="none"
            stroke={payload === 'snapshot' ? 'var(--alert)' : 'var(--success)'}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <Hand x={330} y={64}>
            {`${at5k.toFixed(1)} MB per ball at 4,800 viewers`}
          </Hand>
        </g>
        </svg>
      </div>
      <p className="mt-3 max-w-3xl text-[0.875rem] text-secondary">
        Below a few hundred viewers per match the full snapshot is plainly right: the client
        self-heals, a missed message is corrected by the next one, and a mid-match join uses the same
        code path as the steady state. Switch to deltas and you owe a replay protocol, gap-filling,
        and a per-client buffer. Three pieces of machinery that do not exist today because of this
        one decision.
      </p>
    </Figure>
  );
}

/* ================================================================== *
 * 8. Strike rotation, for the cricket appendix
 * ================================================================== */

export function StrikeLab() {
  const [runs, setRuns] = useState(1);
  const [lastBallOfOver, setLastBallOfOver] = useState(false);
  const [extra, setExtra] = useState<'none' | 'wide' | 'noball'>('none');

  const runsRun = extra === 'wide' ? Math.max(0, runs - 1) : runs;
  const oddSwap = runsRun % 2 === 1;
  const overSwap = lastBallOfOver && extra === 'none';
  const striker = (oddSwap ? 1 : 0) + (overSwap ? 1 : 0);
  const onStrike = striker % 2 === 0 ? 'Rama' : 'Peehu';

  return (
    <Figure
      label="Figure 19 — two swaps, and the one everybody gets wrong"
      hint="Pick 1 run, then switch on Last ball of the over. Two swaps fire and the same batsman keeps strike."
      controls={
        <>
          <Controls label="Runs off the bat">
            {[0, 1, 2, 3, 4, 6].map((r) => (
              <Btn key={r} onClick={() => setRuns(r)} active={runs === r}>
                {r}
              </Btn>
            ))}
          </Controls>
          <Controls label="Conditions">
            <Btn onClick={() => setExtra(extra === 'wide' ? 'none' : 'wide')} active={extra === 'wide'}>
              Wide
            </Btn>
            <Btn onClick={() => setLastBallOfOver((v) => !v)} active={lastBallOfOver}>
              Last ball of the over
            </Btn>
          </Controls>
        </>
      }
      caption="An odd run off the last ball of an over leaves the same batsman on strike, because both swaps fire. There is a regression test for exactly that, since both wrong answers look plausible on screen."
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr] sm:items-center">
        <svg viewBox="0 0 340 170" className="eng-svg" role="img" aria-label="Strike rotation">
          <g className="sketch">
            <line x1={70} y1={40} x2={270} y2={40} stroke="var(--line-strong)" strokeWidth={1.4} />
            <line x1={70} y1={130} x2={270} y2={130} stroke="var(--line-strong)" strokeWidth={1.4} />
            <Box x={40} y={20} w={80} h={40} title={onStrike} sub="on strike" state="active" />
            <Box x={220} y={110} w={80} h={40} title={onStrike === 'Rama' ? 'Peehu' : 'Rama'} sub="non-striker" />
            {oddSwap ? <Hand x={130} y={76}>odd runs run → swap</Hand> : null}
            {overSwap ? <Hand x={130} y={98}>over complete → swap again</Hand> : null}
            {!oddSwap && !overSwap ? <Hand x={140} y={88}>no swap</Hand> : null}
          </g>
        </svg>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[0.875rem]">
          <dt className="text-muted">runsRun</dt>
          <dd className="mono text-primary">
            {runsRun}
            {extra === 'wide' ? ' (extraRuns − 1: the penalty run is a sanction, not a completed run)' : ''}
          </dd>
          <dt className="text-muted">facedDelivery</dt>
          <dd className="mono text-primary">{extra === 'wide' ? 'false' : 'true'}</dd>
          <dt className="text-muted">advances the over</dt>
          <dd className="mono text-primary">{extra === 'none' ? 'yes' : 'no'}</dd>
          <dt className="text-muted">swaps applied</dt>
          <dd className="mono text-primary">{(oddSwap ? 1 : 0) + (overSwap ? 1 : 0)}</dd>
        </dl>
      </div>
    </Figure>
  );
}
