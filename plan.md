# Howzat /  — Implementation Plan

## Context

`brief.md` specifies : a platform for running local cricket tournaments with live ball-by-ball scoring, public no-login share links, and horizontal scalability from day one. The directory is currently empty apart from the brief — this is a greenfield build.

The brief is strong on architecture (event sourcing, snapshot-first reads, Redis adapter, circle-method fixtures) but its sketched `ball_events` table is thinner than a real cricket match requires. Confirmed decisions from the user:

- **Project name: `howzat`**, npm workspaces monorepo in TypeScript — `apps/api`, `apps/web`, `packages/shared`
- **Prisma** for Postgres
- **Resend** for OTP email, with a console fallback in dev
- **Deploy target deferred** — plan stays platform-agnostic
- **Full cricket fidelity** — innings, toss, playing XI, extra types, wicket types, strike rotation
- **Scorer console is phone-first** (thumb-zone tap grid, optimistic UI, offline queue) **but must look genuinely good on desktop** — reference point: crex.live
- **Light + dark, system-following** via CSS variables
- **Minimal automated tests** — the user will test manually and report back

Intended outcome: a deployable, correct, explainable platform. Two artifacts land in the repo root on approval: `plan.md` (this document, as the project's living roadmap) and `.env.example` (below, for the user to populate).

---

## The one architectural decision that carries the whole project

Everything correct in this system falls out of a single pure function:

```ts
// packages/shared/src/scoring/reducer.ts
export function applyBall(state: MatchState, event: BallEvent): MatchState
export function buildState(innings: Innings, events: BallEvent[]): MatchState
```

`buildState` is a fold of `applyBall` over the append-only event log. This one function is:

- the **server's** snapshot writer (fold the log → write Redis)
- the **scorer client's** optimistic renderer (apply locally before the network round-trip)
- the **viewer client's** delta applier (apply each socket event to the snapshot it loaded)
- the **rebuild path** if Redis is ever cold or evicted

It lives in `packages/shared` so all three consumers run byte-identical logic. It is pure — no I/O, no Prisma, no Date.now() — so it is trivially testable and trivially explainable. This is the core of the interview story: *"the event log is the truth, one pure reducer projects it, and every surface runs the same reducer."*

---

## Repo layout

```
howzat/
├─ package.json                # npm workspace root, shared scripts
├─ npm-workspace.yaml
├─ tsconfig.base.json          # strict: true, path aliases to @howzat/shared
├─ .env.example                # single root file; both apps read from it
├─ plan.md
├─ .github/workflows/ci.yml    # typecheck + lint + build on push
│
├─ packages/shared/
│  └─ src/
│     ├─ types/                # Match, Innings, BallEvent, MatchState, PlayerStats
│     ├─ schemas/              # zod — request bodies, socket payloads, env
│     ├─ scoring/
│     │  ├─ reducer.ts         # applyBall / buildState  ← the core
│     │  ├─ validate.ts        # legal-state guard, runs before any commit
│     │  └─ format.ts          # "16.2", "3.2-0-28-2", run-rate, SR, econ
│     ├─ fixtures/circle.ts    # round-robin generator (pure, no DB)
│     ├─ nrr/index.ts          # NRR + points aggregation (pure)
│     └─ socket/events.ts      # typed client↔server event map
│
├─ apps/api/
│  ├─ prisma/schema.prisma
│  └─ src/
│     ├─ index.ts              # express + http server + socket.io bootstrap
│     ├─ config/env.ts         # zod-parsed process.env, fails fast at boot
│     ├─ lib/{prisma,redis,logger}.ts
│     ├─ middleware/{auth,requireRole,requireScorerForMatch,error}.ts
│     ├─ modules/
│     │  ├─ auth/              # OTP request/verify, JWT issue/refresh
│     │  ├─ tournaments/
│     │  ├─ teams/             # incl. 11-player eligibility gate
│     │  ├─ fixtures/          # circle method + knockout bracket
│     │  ├─ matches/           # setup, toss, XI, innings lifecycle
│     │  ├─ scoring/           # ball ingest — the hot path
│     │  ├─ snapshot/          # Redis read/write/rebuild
│     │  ├─ standings/         # points table + NRR, event-triggered
│     │  ├─ stats/             # orange/purple cap, player aggregates
│     │  └─ scenarios/         # (stretch) qualification engine
│     └─ realtime/
│        ├─ io.ts              # Redis adapter wiring
│        └─ rooms.ts           # match:{id} join/leave, viewer count
│
└─ apps/web/                   # Vite + React + Tailwind + TanStack Query
   └─ src/
      ├─ styles/tokens.css     # CSS custom properties, light + dark
      ├─ lib/{api,socket,queue}.ts
      ├─ components/ui/        # Button, Sheet, Tabs, Skeleton, ScoreDigits…
      ├─ features/
      │  ├─ auth/  organizer/  scorer/  live/
      └─ routes/
```

---

## Data model (Prisma)

Extends the brief where real cricket demands it. Additions are marked ★.

```prisma
User            id, email @unique, name, role: ORGANIZER|SCORER, createdAt
OtpCode      ★  id, email, codeHash, expiresAt, consumedAt, attempts
                // hashed, 6-digit, 10-min TTL, max 5 attempts

Tournament      id, organizerId, name, format: LEAGUE|KNOCKOUT|LEAGUE_PLAYOFFS,
                teamsCount, oversPerInnings ★ (default 20), doubleRoundRobin ★,
                status: DRAFT|FIXTURES_GENERATED|IN_PROGRESS|COMPLETED
Team            id, tournamentId, name, shortName ★, primaryColor ★
                // shortName + color power the broadcast-style UI
Player          id, teamId, name, role: BATSMAN|BOWLER|ALL_ROUNDER|KEEPER,
                battingStyle?, bowlingStyle?

Match           id, tournamentId, round, stage ★: LEAGUE|Q1|ELIMINATOR|Q2|FINAL,
                team1Id, team2Id, scheduledAt?  (nullable — dates are optional),
                venue? ★ (free text, no clash logic — explicitly out of scope),
                status: SCHEDULED|TOSS|LIVE|INNINGS_BREAK|COMPLETED|ABANDONED,
                tossWinnerId ★, tossDecision ★: BAT|BOWL,
                oversPerInnings ★,             // copied from tournament, overridable
                winnerTeamId ★, resultText ★,  // "CSK won by 4 wickets"
                publicSlug ★ @unique           // short URL id, not a raw UUID

ScorerAssignment  id, matchId, scorerId, assignedBy
                  @@unique([matchId, scorerId])

MatchPlayer   ★  id, matchId, teamId, playerId, battingOrder?, isCaptain, isKeeper
                 @@unique([matchId, playerId])   // the playing XI, locked at toss

Innings       ★  id, matchId, number (1|2), battingTeamId, bowlingTeamId,
                 oversQuota,                    // key to the NRR edge case
                 targetRuns?, status: IN_PROGRESS|COMPLETED,
                 endReason: ALL_OUT|OVERS_COMPLETE|TARGET_CHASED
                 @@unique([matchId, number])

BallEvent       id, matchId, inningsId ★, clientEventId @unique,   // idempotency
                seq ★,                          // monotonic per innings, gap-free
                overNumber, ballNumber,
                eventType: BALL|CORRECTION|UNDO ★,
                supersedesEventId? ★,           // CORRECTION points at its target
                runsOffBat ★, extraRuns ★, extraType? ★: WIDE|NO_BALL|BYE|LEG_BYE,
                isLegalDelivery ★,              // false for wide/no-ball
                isWicket, wicketType? ★, dismissedPlayerId? ★, fielderId? ★,
                strikerId, nonStrikerId ★, bowlerId,
                createdBy ★, createdAt
                @@unique([inningsId, seq])
                @@index([matchId, createdAt])

PointsTable     id, tournamentId, teamId, played, won, lost, tied, noResult ★,
                points, runsScored ★, oversFaced ★, runsConceded ★, oversBowled ★,
                nrr        // components stored so NRR is auditable, not just a float
                @@unique([tournamentId, teamId])
```

**Why the extra columns matter.** `extraType` + `isLegalDelivery` is the difference between a wide (no ball counted, +1 run, striker unchanged) and a leg-bye (ball counted, run to team not batsman, striker may rotate). Without them, over completion, strike rotation, and every per-player stat is quietly wrong. `oversQuota` on `Innings` is what makes the NRR bowled-out rule implementable at all.

**Redis snapshot** stays as the brief specifies — `match:{id}` → JSON, not a Postgres table:

```jsonc
{
  "matchId", "status", "innings": 2,
  "batting": { "teamId", "name", "short", "runs", "wickets", "overs": "16.2", "balls": 98, "runRate": 8.63 },
  "bowling": { "teamId", "name", "short" },
  "target": 187, "required": { "runs": 45, "balls": 22, "rrr": 12.27 },
  "batsmen": [{ "playerId", "name", "runs", "balls", "fours", "sixes", "sr", "onStrike": true }],
  "bowler": { "playerId", "name", "overs": "3.2", "maidens", "runs", "wickets", "econ" },
  "thisOver": ["1", "W", "4", "wd", "·"],
  "recentBalls": [/* last 30, for the ticker */],
  "lastEventSeq": 143,
  "updatedAt"
}
```

`lastEventSeq` is load-bearing: a client that receives a delta with `seq > lastEventSeq + 1` knows it missed something and refetches the snapshot instead of rendering a wrong score. This closes the reconnect gap that snapshot-then-subscribe otherwise leaves open.

---

## Build phases

### Phase 0 — Foundation
Workspace scaffold, `tsconfig.base.json` with `strict: true`, ESLint + Prettier, Prisma init, `config/env.ts` that zod-parses `process.env` at boot and **exits with a readable error if anything is missing** (no `undefined` surprises at 3am). Express app with a `/health` endpoint that pings Postgres and Redis. Structured error middleware returning `{ error: { code, message, details? } }` consistently.

### Phase 1 — Auth & authorization
Passwordless OTP: `POST /auth/otp/request` → generate 6 digits, store bcrypt hash with 10-min TTL, send via Resend (or `logger.info` the code when `RESEND_API_KEY` is absent). `POST /auth/otp/verify` → issue a 15-min access JWT + a 30-day refresh token in an httpOnly cookie. Rate-limit OTP requests per email and per IP via Redis counters.

Three middleware layers, composed:
- `requireAuth` — verifies JWT, attaches `req.user`
- `requireRole('ORGANIZER')` — coarse role gate
- `requireScorerForMatch` — **the one the brief singles out**: looks up `ScorerAssignment` for `req.params.matchId` + `req.user.id`, 403 otherwise. Result cached in Redis for 60s since it hits on every ball. An organizer scoring their own tournament passes this check by ownership.

### Phase 2 — Tournament / team / player CRUD
Organizer-scoped CRUD. The **11-player gate** is a single reusable predicate — `assertTeamEligible(teamId)` — enforced at two points: fixture generation, and playing-XI lock at toss. `GET /tournaments/:id/teams` returns each team's `playerCount` and `isEligible` so the UI can show progress ("9/11 players — 2 more to schedule") rather than failing at submit time.

### Phase 3 — Fixture generation
`packages/shared/src/fixtures/circle.ts` — pure, no DB:

```ts
generateRoundRobin(teamIds: string[], opts: { double: boolean }): Round[]
```

Classic circle method: if odd, append a `BYE` sentinel; fix `teams[0]`, rotate the remainder each round; `n-1` rounds, `n/2` matches per round; drop BYE pairings. Double round-robin appends the same rounds with home/away flipped. Deterministic, O(n²), always succeeds — no backtracking, exactly as the brief demands. No dates, no venues assigned.

Knockout bracket for `LEAGUE_PLAYOFFS`, seeded from final standings, IPL-style: Q1 (1v2), Eliminator (3v4), Q2 (Q1 loser v Eliminator winner), Final. Bracket matches are created with null teams and filled in as feeders complete.

Regeneration is destructive and guarded: refuse if any match in the tournament is past `SCHEDULED`.

### Phase 4 — Scoring engine (the hot path)

**`validate.ts`** rejects illegal states *before* any write:
- more than 6 legal deliveries in an over
- a ball submitted to a `COMPLETED` innings or non-`LIVE` match
- striker/non-striker/bowler not in the playing XI, or striker == non-striker
- a bowler bowling two consecutive overs
- negative runs, wicket without a dismissed player, run-out without a fielder
- `seq` conflicting with an existing event

**`POST /matches/:id/balls`** — the write path, in order:
1. `requireScorerForMatch`
2. Acquire Redis lock `lock:match:{id}` (SET NX PX 5000, token-checked release) — serializes concurrent writes to one match
3. Prisma transaction: read innings + tail of event log → `validateBall` → insert `BallEvent`
4. Unique violation on `clientEventId` → **return the existing snapshot with 200, not 409** — a retry must be indistinguishable from success from the client's view. That is what idempotency is *for*
5. Recompute state via `buildState` → `SET match:{id}` in Redis
6. `io.to('match:'+id).emit('ball', delta)` — fans out to every instance through the Redis adapter
7. Release lock

Steps 3 and 5 are not atomic across two systems, and pretending otherwise would be dishonest engineering. Instead: **Postgres is the truth, Redis is derived**. If the process dies between them, the next read finds a stale/missing snapshot and `rebuildSnapshot(matchId)` folds the log again. Snapshot writes are guarded by `lastEventSeq` so a slow write can never overwrite a newer one.

**Corrections** append `eventType: CORRECTION` with `supersedesEventId` set; the reducer skips any event that has been superseded. Nothing is ever deleted. Undo of the last ball is the same mechanism with a dedicated endpoint. The scorer UI shows a correction history so a match referee can audit it.

**Innings lifecycle**: auto-close on `oversQuota` completion, all-out (wickets == XI-1), or target chased. Closing innings 1 opens innings 2 with `targetRuns`. Closing innings 2 sets `winnerTeamId` + `resultText` and emits `match:completed` — which is the trigger for Phase 6.

### Phase 5 — Real-time delivery
`socket.io` + `@socket.io/redis-adapter` (separate pub and sub clients — the adapter requires it). Rooms are `match:{id}`. Public viewers connect without a token; scorers connect with one, but **all ball writes go over HTTP, never over the socket** — sockets are read-only fan-out. That keeps auth, idempotency, validation, and retry semantics in one well-understood place and makes the socket layer disposable.

Viewer flow, exactly as the brief prescribes:
1. `GET /public/matches/:slug/snapshot` → instant current state from Redis (falls back to a rebuild if cold)
2. Subscribe to `match:{id}`, apply deltas via the same `applyBall` reducer
3. On reconnect, or on a `seq` gap, refetch the snapshot and resync

Sequence-gap detection is what makes "joins mid-match, sees current state" true even across a flaky mobile connection.

### Phase 6 — Points table & NRR
Triggered by the `match:completed` domain event only — no cron, no polling. Recomputed for the whole tournament from `Innings` rows inside one transaction, so it is idempotent and self-healing rather than incrementally drifting.

The edge case the brief calls out, stated precisely:

> If a team is **all out** before its full quota, its `oversFaced` counts as the **full quota**, not balls actually faced. The opposing bowling side likewise records the full quota as `oversBowled`.

```ts
const oversFaced = innings.endReason === 'ALL_OUT'
  ? innings.oversQuota
  : ballsToOvers(legalBalls);   // 6 balls == 1.0, decimal not 1.5
```

Two further traps handled: overs are **base-6**, so `ballsToOvers` must divide, never treat `16.5 + 0.1 = 16.6`; and a **successful chase** counts only the overs actually faced, never the quota. Points: win 2, tie/no-result 1, loss 0. Standings sort by points, then NRR, then head-to-head.

Components (`runsScored`, `oversFaced`, `runsConceded`, `oversBowled`) are persisted alongside the NRR value so any disputed number can be traced to its inputs.

### Phase 7 — Frontend

**Design tokens** in `styles/tokens.css` — semantic CSS custom properties (`--surface`, `--surface-raised`, `--text-primary`, `--accent`, `--live`) defined for light, overridden under `@media (prefers-color-scheme: dark)` and a `:root[data-theme]` override so a manual toggle wins in both directions. Tailwind consumes the variables, so no `dark:` class is ever hand-written on a component. Team colors inject per-match as scoped variables.

**Public live page** (`/live/:slug`) — the WhatsApp-shared link, crex-inspired:
- Hero score block with tabular-nums digits that animate on change, live pulse dot, this-over ticker
- Tabs: Live / Scorecard / Commentary
- Full scorecard with batting and bowling tables, fall-of-wickets, partnership
- Chase panel with required run rate when innings 2 is live
- Skeleton on first paint, never a spinner-then-jump
- Dynamic OG image so the shared link previews the live score itself
- Desktop is a genuine two-column layout, not a stretched phone view

**Scorer console** (`/score/:matchId`) — phone-first, desktop-excellent:
- Phone: state summary pinned top, bottom-anchored thumb-zone grid `0 1 2 / 3 4 6 / WD NB BYE W`, modifiers open a bottom sheet, undo always one tap away
- Desktop: three-column — live scorecard left, entry pad center, over-by-over log and correction history right. Full keyboard shortcuts (`0-6`, `w`, `n`, `b`, `⌫` undo) so a laptop scorer never touches the mouse
- **Optimistic UI**: tap → `applyBall` locally → render immediately → POST in background. Per-ball status chip: pending / synced / failed-retry
- **Offline queue** in IndexedDB keyed by `clientEventId`; drains in order on reconnect. Because the server is idempotent, replaying the queue is always safe — a ground with bad signal doesn't lose a single ball
- Pre-match wizard: toss → decision → playing XI (11 enforced) → opening batsmen + bowler

**Organizer dashboard** — tournament CRUD, team roster with the 11/11 progress ring, one-click fixture generation with a preview before commit, scorer assignment per match, live standings, stats.

**Stats** — orange cap, purple cap, per-player pages. Served from indexed aggregate queries over `BallEvent` grouped by player, cached in Redis with a 60s TTL and busted on `match:completed`.

---

## `.env.example` (created at repo root on approval)

```bash
# ── Core ─────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:5173          # CORS origin + OTP email links

# ── Postgres ─────────────────────────────────────────────────────────
# Local:  postgresql://postgres:postgres@localhost:5432/howzat
# Hosted: copy the connection string from your provider (add ?sslmode=require)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/howzat

# ── Redis ────────────────────────────────────────────────────────────
# Local:  redis://localhost:6379
# Hosted: rediss://default:<password>@<host>:<port>   (note: rediss, TLS)
REDIS_URL=redis://localhost:6379

# ── Auth ─────────────────────────────────────────────────────────────
# Generate each with:  openssl rand -base64 48
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# ── OTP email (Resend) ───────────────────────────────────────────────
# Get a key at https://resend.com/api-keys
# Leave RESEND_API_KEY blank in dev — the OTP is printed to the server log.
RESEND_API_KEY=
OTP_FROM_EMAIL=onboarding@resend.dev        # swap for your verified domain
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5

# ── Rate limiting ────────────────────────────────────────────────────
OTP_REQUESTS_PER_HOUR=5
BALL_WRITES_PER_MINUTE=120

# ── Frontend (Vite — must be VITE_ prefixed to reach the browser) ─────
VITE_API_BASE_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

**You need to populate:** `DATABASE_URL`, `REDIS_URL`, the two JWT secrets, and — only when you want real emails — `RESEND_API_KEY` + `OTP_FROM_EMAIL`. Everything else has a working default.

---

## Testing

Per your instruction, minimal automated testing — you'll verify manually and report back. I'll still keep a small Vitest file for the pure reducer and the NRR quota rule while building them, because writing those two correctly without a scratch harness is guesswork. No E2E, no CI test gate.

## Verification (manual, end-to-end)

1. `npm dev` — API on :4000, web on :5173. `/health` reports both Postgres and Redis reachable.
2. `npm db:seed` — seeds a tournament, 4 teams × 11 players, and a scorer account, so there's something to click within a minute.
3. Sign up via OTP; with no `RESEND_API_KEY`, read the code from the server log.
4. Generate fixtures for 4 teams → expect 3 rounds × 2 matches, every pair exactly once.
5. Assign yourself as scorer; open the scorer console on your **phone**, the public link on **desktop**, side by side.
6. Score an over including a wide, a no-ball, a leg-bye, a boundary and a wicket. Confirm on the public page: over reads `0.4` not `0.6` after two extras, strike rotates on odd runs and at over-end, bowler's economy is right.
7. **Mid-match join** — open the public link in a fresh incognito window at, say, 12.3 overs. It must show 12.3 overs immediately, then continue live.
8. **Idempotency** — put the phone in airplane mode, score 3 balls, re-enable. Exactly 3 balls appear, never 6.
9. **Horizontal scale** — run two API instances on different ports, point two browsers at different ones. A ball scored through instance A appears on the viewer attached to instance B.
10. **NRR** — complete a match where the chasing side is bowled out in 14.2 of 20 overs. Verify the points table used **20.0** overs faced, not 14.33.
11. Toggle OS theme light ↔ dark on the public page; check the manual toggle overrides in both directions.
12. Resize the scorer console from 375px to 1920px — no horizontal scroll, no cramped desktop layout.

## Order of work

Phases are sequenced so something is demoable early and the risky parts land before the polish:

**0 → 1 → 2 → 3** gets you a working organizer flow with real fixtures.
**4 → 5** is the heart — scoring correctness and live delivery; budget the most time here.
**6 → 7** makes it presentable and complete.
**8 → 9** when you've picked a platform and if time allows.
