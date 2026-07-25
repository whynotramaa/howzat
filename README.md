# Howzat

Local cricket tournaments with live ball-by-ball scoring and public, no-login
share links. See [`plan.md`](./plan.md) for the full roadmap and
[`brief.md`](./brief.md) for the original requirements.

**Built so far: Phases 0–6** — foundation, auth, CRUD, fixture generation, the
scoring engine, real-time delivery with the public share link, and the points
table with NRR.

**Still ahead: Phase 7, the UIs.** There is no scorer console yet, so scoring
runs over HTTP rather than by tapping a grid. The organizer dashboard has no
fixtures or standings screens either — both are served by the API.

All of the above is verified end-to-end against live Neon Postgres and Upstash
Redis, including two API instances sharing one Redis adapter.

## Seeded data

`npm run db:seed` creates two tournaments and three accounts:

| Account | Handle | Role |
| --- | --- | --- |
| `organizer@howzat.local` | `@organizer` | Organizer — owns both tournaments |
| `whynotramaa@howzat.local` | `@whynotramaa` | Scorer — assigned to **every** IPL 2026 match |
| `scorer@howzat.local` | `@demoscorer` | Scorer — assigned to nothing, useful for testing 403s |

- **IPL 2026** — 10 teams, 11 players each, 49 matches (45 league + 4 playoff
  slots), single round-robin. Set `doubleRoundRobin` and regenerate for the
  full 90-match season. Squads are illustrative demo data, not real rosters.
- **Sunday League 2026** — 4 teams, a small sandbox for quick tests.

The seed is idempotent and never regenerates fixtures for a tournament whose
matches have started, so re-running it cannot destroy scoring data.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Create the datastores

Both have free tiers and neither needs a local install.

- **Postgres — [Neon](https://neon.tech)**: create a project, then copy *two*
  connection strings from the dashboard. The **pooled** one (host contains
  `-pooler`) is `DATABASE_URL`; the **direct** one is `DIRECT_URL`. Prisma
  migrations cannot run through the pooler, which is why both exist.
- **Redis — [Upstash](https://upstash.com)**: create a database and copy the
  `rediss://` URL (note the double *s* — it is TLS) into `REDIS_URL`.

### 3. Configure

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, and generate the two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Leave `RESEND_API_KEY` blank — sign-in codes are then printed to the API log
rather than emailed, which is the intended development path.

### 4. Create the schema and seed

```bash
npm run db:migrate      # first run will ask for a migration name; "init" is fine
npm run db:seed
```

The seed creates one tournament, four teams with a full XI each, and two
accounts: `organizer@howzat.local` and `scorer@howzat.local`.

### 5. Run

```bash
npm run dev             # API on :4000, web on :5173
```

---

## Verifying phases 0–2

1. **Health** — `curl http://localhost:4000/health` reports
   `{"status":"ok","dependencies":{"postgres":"ok","redis":"ok"}}`. If either
   is `unreachable` the response is a 503 and names which one.
2. **Fail-fast config** — delete `REDIS_URL` from `.env` and start the API. It
   exits immediately naming the missing variable, rather than crashing later.
3. **Sign in** — open http://localhost:5173, enter `organizer@howzat.local`.
   The 6-digit code appears in the API log *and* on screen (dev-only banner).
4. **Session survives reload** — hard-refresh the page; you stay signed in. The
   access token lives in memory only; the httpOnly refresh cookie restores it.
5. **Rate limiting** — request a code six times for the same email. The sixth
   returns 429 with a truthful `Retry-After`.
6. **Wrong code** — enter `000000` five times; the sixth attempt reports the
   code is burned and asks for a new one.
7. **CRUD** — create a tournament for 4 teams, add a team, open it, paste 11
   names into the bulk box. The 11/11 ring fills and the team flips to
   "eligible". Try pasting a 12th — it is refused with the count in the message.
8. **The eligibility gate** — with one team at 9 players, the tournament page
   states exactly what is missing instead of only failing later at fixture time.
9. **Ownership isolation** — sign in as `scorer@howzat.local` and hit
   `/tournaments`. The role gate returns 403; organizer data is never visible.
10. **Theme** — toggle the OS between light and dark with the toggle set to
    "System"; the page follows. Then click through to Light and Dark and confirm
    the manual choice wins in both directions and survives a reload.

## Verifying phases 3–4

The pure logic is covered by `npm test` (20 tests: strike rotation, extras,
maidens, corrections, innings end, and the circle method's pairing guarantees).
The database-backed parts need a running API.

**Fixtures.** With four eligible teams, preview then commit:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/tournaments/$T/fixtures/preview
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{}' http://localhost:4000/tournaments/$T/fixtures
```

Expect 3 rounds × 2 matches, every pair exactly once, no dates. Ask for it
twice and the second call is refused unless you pass `{"regenerate":true}` —
and it is refused outright once any match has left `SCHEDULED`.

**Scoring.** Assign a scorer, record the toss, name both XIs, start, then post
balls to `POST /matches/:id/balls`. Each ball needs a fresh `clientEventId`
(any UUID). Things worth confirming:

- Score a wide and a no-ball in an over: after six *submissions* the over reads
  `0.4`, not `0.6`.
- Re-post an identical body with the same `clientEventId`: you get `200` with
  the same snapshot instead of `201`, and the score does not move.
- `POST /matches/:id/balls/undo` reverses the last ball. `GET /matches/:id/events`
  still shows both the original and the UNDO — nothing is deleted.
- Bowl two overs with the same bowler back to back and the second is rejected
  with `CONSECUTIVE_OVERS`.
- Ten wickets, or the overs quota, closes the innings automatically; closing
  innings 1 creates innings 2 with `targetRuns` set.

**Snapshot rebuild.** With a match in progress, delete the cache key
(`DEL match:<id>` in Redis) and re-request `GET /matches/:id/snapshot`. The
score comes back identical — it was rebuilt by folding the event log.

## Verifying phase 5

**The share link.** Open `http://localhost:5173/live/<publicSlug>` — no login.
The slug comes from any match in `GET /tournaments/:id/matches`. Score a ball
over HTTP and the page updates without a refresh.

**Mid-match join.** Open the same link in a fresh incognito window after a few
overs. It shows the current score immediately — snapshot first, then subscribe
— never a replay from ball one.

**Reconnect.** Kill the API while the page is open: the badge flips to
"Reconnecting". Restart it and the page resyncs by refetching the snapshot,
because the gap while disconnected is unknowable.

**Horizontal scale.** This is what the Redis adapter is for:

```bash
npm run dev:api                    # instance A on :4000
PORT=4001 npm run dev:api          # instance B on :4001
```

Point a viewer at B, score a ball through A, and the viewer updates — the emit
crosses via Redis pub/sub. Verified: 5/5 checks.

## Verifying phase 6

The NRR arithmetic is covered by `npm test`, including the plan's exact
scenario and a regression guard proving the bowled-out rule changes the answer.

**End to end.** Play a match out and the table appears on its own — the recompute
is triggered by the `match:completed` domain event, with no cron and no polling:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/tournaments/$T/standings
curl http://localhost:4000/public/tournaments/$T/standings   # no auth
```

**The rule to check.** Complete a match where the chasing side is bowled out
inside its quota, then read that team's row: `oversFaced` must be the **full
quota**, not the balls it actually faced. Verified with a 2-over match — the
chase was all out having faced 11 of 12 balls and the table charged `2.0`.

Every NRR input (`runsScored`, `oversFaced`, `runsConceded`, `oversBowled`) is
returned alongside the figure, so a disputed number can be traced rather than
taken on trust.

**Idempotency.** `POST /tournaments/:id/standings/recompute` rebuilds the whole
table from the event log. Running it repeatedly does not change the numbers —
the table is recomputed, never incremented, so it cannot drift.

## Usernames

Every account has a unique handle, so an organizer can find a scorer without
knowing their email:

```bash
GET /users/search?q=why&role=SCORER   # prefix search over handle and name
GET /users/whynotramaa                # exact lookup + activity counts
POST /tournaments/:t/matches/:m/scorers  {"username":"whynotramaa"}
```

Handles are allocated automatically at signup from the email local part, with a
numeric suffix on collision, and can be changed later via `PATCH /auth/me`.
Lookup requires a session — a public endpoint that confirms whether a handle
exists would be an enumeration oracle.

---

## Layout

```
packages/shared/   types, zod schemas, constants — one contract for both apps
  src/scoring/reducer.ts   applyBall / buildState — the core of the system
  src/scoring/validate.ts  the legal-state guard, run before any write
  src/scoring/format.ts    base-6 overs, run rate, strike rate, economy
  src/fixtures/circle.ts   round-robin by the circle method (pure, no DB)
  src/nrr/index.ts         points + NRR, incl. the bowled-out quota rule (pure)
apps/api/          express + prisma + redis
  src/config/env.ts        zod-parsed process.env, exits at boot if incomplete
  src/lib/                 prisma, redis, logger, errors, lock, slug
  src/middleware/          requireAuth, requireRole, requireScorerForMatch, error
  src/modules/             auth, users, tournaments, teams, players, fixtures,
                           matches (lifecycle), scoring (ingest), snapshot,
                           standings (points + NRR)
  src/modules/public/      the no-auth share link surface (slug-addressed)
  src/realtime/bus.ts      transport-agnostic seam the write path publishes to
  src/realtime/io.ts       socket.io + Redis adapter (separate pub/sub clients)
apps/web/          vite + react + tailwind v4
  src/styles/tokens.css    semantic CSS variables; light/dark, no `dark:` classes
  src/lib/api.ts           fetch wrapper with silent token refresh
  src/lib/socket.ts        one shared socket per tab
  src/features/            auth, organizer, live (the public share page)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API and web together |
| `npm run typecheck` | `tsc -b` across all three workspaces |
| `npm run lint` | ESLint |
| `npm test` | Vitest over the reducer and the fixture generator |
| `npm run build` | API bundle + web static build |
| `npm run db:migrate` | Create/apply a migration (uses `DIRECT_URL`) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Demo tournament, teams, squads, accounts |

## Notes on the implementation

- **Auth**: access tokens are 15-minute JWTs held in memory; refresh tokens are
  opaque random strings stored as SHA-256 hashes and rotated on every use.
  Presenting an already-revoked token is treated as theft and revokes the
  user's whole session family.
- **OTP**: bcrypt-hashed, 10-minute TTL, 5-attempt cap, and every failure path
  returns the same message so the endpoint is not an account-enumeration oracle.
- **The 11-player rule** lives in exactly one predicate,
  `apps/api/src/modules/teams/eligibility.ts`, ready for its two callers in
  phases 3 and 4 (fixture generation and the playing-XI lock at toss).
- **`requireScorerForMatch`** guards every match route. The 60s Redis cache is
  invalidated immediately when an assignment is added or removed.
- **Scoring is HTTP-only, never websocket.** Auth, idempotency, validation and
  retry semantics stay in one place, which makes the realtime layer a
  disposable read-only fan-out. Phase 5 plugs into `src/realtime/bus.ts`.
- **Broadcasts carry the whole snapshot, not a minimal delta.** The plan
  sketched applying deltas client-side with the shared reducer. A snapshot is
  slightly larger but self-healing: a client that misses one is corrected by
  the next, and `seq` monotonicity is enough to discard an out-of-order
  arrival. The shared reducer still runs on the server and will drive the
  scorer's optimistic UI in Phase 7.
- **Postgres is the truth, Redis is derived.** The event insert and the
  snapshot write are not atomic across two systems, and the code does not
  pretend otherwise: a crash between them leaves a stale cache, and the next
  read folds the log again. Snapshot writes are guarded by `lastEventSeq` so a
  slow write can never overwrite a newer score.
- **`PointsTable` stores balls, not decimal overs.** Overs are base-6, so
  `16.5 + 0.1` is `17.0`, not `16.6`. Storing balls and converting only at read
  time is what makes the NRR arithmetic hard to get subtly wrong.
- **The points table is recomputed, never incremented.** Every
  `match:completed` rebuilds the whole tournament from the event log inside one
  transaction. That costs more than an increment and buys idempotency: replaying
  the event, or repairing a bad row, converges instead of double-counting.
- **The standings recompute is detached from the ball write.** A slow rebuild
  must not delay or fail the ball that triggered it, so subscribers run outside
  the request. The table therefore settles a moment after the final ball.
