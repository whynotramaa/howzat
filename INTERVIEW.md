# Howzat — Interview Preparation

## How to use this

This is built the way an interview actually runs, not as a feature list. Twelve rounds, in roughly the order a good interviewer moves through a project: framing → architecture → data → domain → concurrency → realtime → offline → security → infra → frontend → ops → the hostile round. Then a short fundamentals drill at the end.

Each entry is:

- **The question**, phrased the way it would be asked
- *What they're testing* — the thing behind the question
- **The answer** — what you say
- **→ If they push** — the follow-up that always comes, answered inline

The follow-ups are where the detail lives. Nobody asks "what is your rate limit"; they ask "how do you stop a runaway client" and then push on the number. Prepare the shape, and the numbers come out on demand.

**76 core questions across 12 rounds, plus 16 rapid-fire fundamentals.**

---

## The ten anchors

If you remember nothing else, these ten sentences answer most of the project.

1. **The event log is the only truth.** Everything else is a projection and can be deleted and rebuilt.
2. **Writes are HTTP; sockets are a read-only fan-out.** Auth, idempotency, validation and retries live in one place, which makes the realtime layer disposable.
3. **socket.io, for the Redis adapter and rooms** — the horizontal scaling story is one line, and I'd have written the alternative worse.
4. **`transports: ['websocket']`**, because the long-polling handshake is process-sticky and dies behind a load balancer.
5. **Viewers are counted in a Redis sorted set**, not `fetchSockets()`, because a frozen instance stays subscribed and never answers.
6. **Broadcasts carry whole snapshots, not deltas** — self-healing, and a mid-match join is instant.
7. **`clientEventId` makes the POST idempotent**, so a bad connection at a ground cannot double-count a six.
8. **The Redis lock reduces contention; the database constraints guarantee correctness.** Never let a lock be your only defence.
9. **Offline is a durable IndexedDB outbox plus an optimistic fold through the same reducer the server runs.**
10. **`await publishMatchEvent` on the completion path**, because serverless freezes the instance the moment the response is sent.

---

# ROUND 1 — Opening: framing and the walkthrough

The first ten minutes. They're deciding whether you understand the *problem* or only the code.

---

### Q1. Give me the overview — what is Howzat and who is it for?

*Testing: can you describe a system at the right altitude, and do you know who the user is.*

A live cricket scoring platform for club and street cricket. Three users. The **organizer** creates a tournament, registers squads, generates fixtures and assigns scorers. The **scorer** runs a console for one match — one tap per ball. The **spectator** gets a URL, with no account and no app install, and sees the score update live.

That third one drives most of the architecture. The people who actually want the score are a parent at work or a teammate on a bus, and any friction between them and the number loses them. So the public surface is a random unguessable slug, its own no-auth router with a hand-picked response shape, and a WebSocket that carries the score without ever asking who's watching.

Technically: an append-only event log in Postgres is the source of truth, a derived snapshot in Redis is the read cache, and a socket fan-out pushes updates. Scoring is HTTP, never WebSocket. Everything that isn't the log — the snapshot, the points table, career stats — is a projection that can be deleted and rebuilt by folding the log.

**→ If they push: "why does no-login matter enough to shape the architecture?"**
Because it removes the one thing I could have leaned on for security — identity — from the largest population of users. That forces the design to be safe *by construction* rather than by authorization: the socket is read-only, so there's nothing to authorize; the public router can't leak organizer data because it never queries it; and discovery is prevented by ~49 bits of entropy in the slug rather than by a permission check.

---

### Q2. Walk me through everything that happens when a scorer taps "4".

*Testing: do you actually know your own request path, end to end, across both processes.*

Client side: it validates locally with the same `validateBall` the server runs, generates a `clientEventId` (a UUID), writes the ball to IndexedDB, and — if online — POSTs `/matches/:id/balls`. The console re-renders immediately from an optimistic fold, so the tap feels instant regardless of the network.

Server side, in order: `requireAuth` verifies the bearer JWT → `requireScorerForMatch` checks match-level authorization from a 60-second Redis cache → the ball-write rate limiter increments a Redis counter → acquire `lock:match:{id}` → look up the `clientEventId`, and if it exists, short-circuit and return the current snapshot with a 200 → load the innings' event log and fold it with `buildState` → `validateBall` against that folded state → insert the `BallEvent` at `seq + 1` → fold again including the new event → project a snapshot → write it to Redis, guarded by `lastEventSeq` → publish `ball` on the event bus → release the lock → respond 201 with the snapshot.

The bus hands it to socket.io, which emits to room `match:{id}`. The Redis adapter republishes that to every other instance, each of which emits to its own local sockets. Each viewer's `useLiveMatch` checks `isNewerSnapshot` and renders. Back on the scorer's device, the successful response removes the ball from IndexedDB.

**→ If they push: "which of those steps can fail without failing the ball?"**
Everything after the Postgres insert. The snapshot write is wrapped in a try/catch that logs and continues — Postgres already has the ball, so a cache failure degrades the next read to a rebuild rather than failing a write that succeeded. The publish is the same: it's caught inside `publishMatchEvent`, because a transport failure must never fail a durable write. The rate limiter also fails open. The only steps that can legitimately fail the request are auth, validation, and the insert itself.

---

### Q3. What was the hardest engineering problem here?

*Testing: whether you can identify difficulty, as opposed to volume.*

Not the cricket — the fact that the same score has to be correct in five places at once: Postgres, the Redis snapshot, the scorer's optimistic screen, every viewer's socket-fed screen, and the points table. Five things that can disagree is not five bugs, it's ten pairwise disagreements, and each one looks like "the number is wrong" with no way to tell which side lied.

The insight was to make exactly one of them the truth and every other one a *pure function* of it. `BallEvent` is append-only and authoritative; `buildState` is a pure fold with no I/O, no `Date.now()` and no randomness. Once that was true, the four other views weren't four implementations that had to be kept in agreement — they were four callers of one function, agreeing by construction. And it made the cache genuinely disposable, because "rebuild it" and "compute it" are the same code path.

**→ If they push: "what does purity actually buy you here, concretely?"**
Three things I use daily. The client can render an optimistic score by folding queued balls with the identical function the server will use, so the optimistic view isn't an approximation — it's the same answer, early. A cold Redis is a latency problem and never a correctness one, so I can put a TTL on the snapshot and stop thinking about it. And the entire domain is testable in milliseconds with no database, which is why 45 tests cover the part of the system where a bug would otherwise be silent.

---

### Q4. What did you deliberately leave out, and how did you decide?

*Testing: scope judgment. Juniors build everything; seniors defend a boundary.*

The rule I applied: cut anything that needs data the club game doesn't have, or that doubles the domain surface without changing whether the app works at a ground.

Out of scope by that test: venue-clash detection and calendar scheduling — fixture generation never depends on dates, which is why `scheduledAt` is nullable and the round-robin generator is a pure function of team ids. DLS, super overs, powerplays and bowler over-quotas: all enforceable additions to `validateBall`, none of which change the storage model, which is itself the argument that the model is right. Live commentary and video. And real-time collaborative scoring with two scorers on one match, which I'll come back to as a genuine gap rather than a clean cut.

**→ If they push: "so what cricket rules *are* you enforcing?"**
The ones where breaking them produces a scorecard nobody can reconcile afterwards, because the log is immutable and a bad ball is expensive to live with. Legal-delivery accounting (wides and no-balls don't advance the over), strike rotation including the over boundary, the consecutive-overs rule, which dismissals are possible off a wide versus a no-ball, that a run-out needs a fielder, that only a batsman at the crease can be dismissed, that runs can't come off the bat on a wide or a bye, and the innings-end conditions with their priority order. All of it in one pure `validateBall` that runs on the server inside the lock and again on the client before a tap costs a round-trip.

---

### Q5. This runs for a local league. What breaks first at 50,000 users?

*Testing: can you reason about scale without hand-waving "add more servers".*

Not the writes. A ball is a few hundred bytes, and even at thousands of concurrent matches you're in the low hundreds of writes per second, which one Postgres handles without noticing.

What breaks first is **fan-out**. Every ball broadcasts a full snapshot — 2–3KB — to every viewer of that match, and the Redis adapter publishes each emit to *every* instance regardless of whether that instance has a subscriber. So the cost is snapshot × viewers × instances, in both egress and pub/sub bandwidth. That's the number that makes deltas necessary, and it's the specific threshold where "self-healing is worth the bytes" stops being true.

Second to break is the standings recompute, which rebuilds an entire tournament from the event log on every match completion. Bounded and cheap at 49 matches; quadratic misery at 49,000.

**→ If they push: "so what would you actually change, in order?"**
First, deltas with a periodic keyframe — that's an order of magnitude off the per-message cost and the client already tolerates gaps, so it's a small change. Second, put the snapshot behind a CDN with a one-second TTL and let the overwhelming majority of viewers poll that, keeping sockets for the small set that needs sub-second latency; at that population the right answer stops being "a better WebSocket" and starts being "cache the number". Third, scope the standings recompute to affected teams, or make it incremental with a periodic full reconciliation to preserve the idempotency property. And fix the N+1 in `fillInningsTotals` before any of that, because it's fifteen minutes of work.

---

# ROUND 2 — Architecture and boundaries

---

### Q6. Why a monorepo, and what's the argument for `packages/shared` specifically?

*Testing: whether the monorepo is a habit or a decision.*

Because the scoring reducer has to run identically on the client and the server. In separate repos that's a published package and a version bump every time a cricket rule changes, plus a window where the two are on different versions and silently disagree about the score. In one workspace it's an import.

`shared` holds the domain with no I/O: the reducer and validator, over and rate formatting, the round-robin generator, NRR and standings aggregation, the qualification engine, every zod request schema, and the typed socket event map. It has no dependency on Prisma, Express or React — which is what makes it testable in milliseconds and reusable in a browser.

The contract enforcement is the other half. One zod schema per request body, imported by the route and by the client. Shared DTO types. And `ServerToClientEvents`/`ClientToServerEvents` as a typed pair, so the server literally cannot emit an event the client doesn't handle. `npm run typecheck` is `tsc -b` across all three workspaces, so a contract break is a compile error rather than a runtime 400 in production.

**→ If they push: "shared ships TypeScript source, not compiled JS. Why, and what does that break?"**
No build step means no stale `dist` and no watch-mode desync during development. It breaks two things, both one-line costs: Vite would pre-bundle it with esbuild and choke on type-only imports, so it's in `optimizeDeps.exclude`; and tsup has to list it in `noExternal` so it's bundled into the API output rather than left as a runtime import Node can't resolve. If the package ever had external consumers I'd ship a build.

---

### Q7. `createApp()` doesn't call `listen()`, and you have two entrypoints. Why?

*Testing: coupling between application and deployment.*

Because the moment `listen` is inside your app factory, you've welded your application to one deployment model. `createApp` returns an Express app and nothing else, so it's host-agnostic: `index.ts` wraps it in an `http.Server` and listens, `vercel.ts` mounts it under `/api` and exports the server without listening, and a test can hand it to supertest with no port at all.

The two entrypoints differ in exactly three ways that can't be expressed as conditionals. The serverless one exports rather than listens, because the platform owns the socket and hands us the upgrade. It mounts the app under `/api` on an outer Express instance, because the platform's rewrite preserves the original path — `/api/health` arrives as `/api/health`, not `/health` — so Express strips the prefix and every route stays mounted where it already expects to be. And it registers no signal handlers, because the platform freezes or discards instances rather than sending SIGTERM.

Both call the same `createApp`, the same `attachRealtime`, and the same subscriber registration. There's no divergence in what the server *does*, only in how it's hosted.

**→ If they push: "why is subscriber registration at module scope in the serverless entry?"**
So a cold start has its subscribers in place before the request that woke it up reaches the write path. If registration happened lazily on first use, the very first `match:completed` on a fresh instance would have no listener and the points table would silently not rebuild — a bug that only appears on the first request after a scale-up, which is the worst possible place to find one.

---

### Q8. Talk me through `realtime/bus.ts`. Isn't that indirection for its own sake?

*Testing: can you justify an abstraction with something it actually paid for.*

It's about fifty lines, and it earned them twice.

The write path calls `publishMatchEvent('ball', payload)` and does not import socket.io. The bus does two distinct things with that: it hands the envelope to a pluggable *transport publisher* (attached by `attachRealtime`, and a no-op that logs and drops if nothing is attached), and it awaits any registered *in-process subscribers*. Those are genuinely different concerns — pushing to browsers versus recomputing the points table — and a naive `io.emit` inside the service would have fused them permanently.

The first payoff: tests, and any future worker, run with the no-op publisher and don't need a socket server. The second payoff is the one I'd actually cite. `publishMatchEvent` returns a promise that settles when every subscriber finishes. On the hot ball path I drop it with `void`. On the match-completion path I `await` it, because two heavy subscribers hang off `match:completed` and on serverless the instance freezes the moment the response is sent. That fix was a one-line change *because* the seam existed; in a codebase where the service called `io.emit` directly it would have been a refactor.

**→ If they push: "if I told you the realtime layer had to go tomorrow, how long?"**
An afternoon. Delete `realtime/io.ts`, drop `attachRealtime` from both entrypoints, and the bus falls back to the no-op publisher — the write path doesn't change by a single line. On the client, replace `useLiveMatch`'s subscription with a three-second poll of the snapshot endpoint it already calls. The reducer, the snapshot shape and the render path are untouched. That's the payoff of the seam combined with full-snapshot broadcasts: the realtime layer is a latency optimisation over an endpoint that already exists.

---

### Q9. Justify the second datastore. What does Redis do that Postgres couldn't?

*Testing: whether Redis is there because it's fashionable.*

Four things, and I applied one test to each: can I delete it with no loss of correctness?

**Snapshot cache** — so a viewer's read doesn't re-fold an event log. **Distributed lock** for the per-match write path. **Pub/sub for cross-instance socket fan-out**, which is the one with no real Postgres alternative: `LISTEN/NOTIFY` doesn't survive a transaction-mode pooler, which is exactly what Neon puts in front of the database. And **ephemeral counters** — rate limits, viewer sets, the authz cache, slug resolution — which are write-heavy, disposable, and a terrible use of durable storage.

Every one passes the deletion test. Drop the whole Redis instance and the system serves correct answers more slowly, single-instance, with no live push.

**→ If they push: "so what actually happens if Redis dies mid-match?"**
Reads survive: `readCachedSnapshot` catches and returns null, so every read rebuilds from the log. Authorization survives: it falls back to a Postgres query. Rate limits fail open by design — the limiter catches its own errors and calls `next()`, because a live match must not become unscorable due to a cache outage. Realtime fan-out stops working across instances and viewer counts read zero. The one thing that does *not* degrade gracefully is the lock, because acquisition throws — that's a real gap, and the fix is a fallback to a Postgres advisory lock, which gives the same mutual exclusion from the datastore that's already required to be up.

---

### Q10. Why Express and Prisma, over the alternatives?

*Testing: technology choice as trade-off rather than preference.*

Express because it's the boring choice, and for a project whose value is in the domain and the realtime layer, boring middleware is correct. Fastify is faster at the router level, which is irrelevant when a ball write is dominated by two Redis round-trips and a Postgres insert. NestJS would have added a DI framework and decorators to an app with about twenty routes. tRPC was genuinely tempting for the end-to-end types — but the API also serves an unauthenticated public surface addressed by slug, and REST resources map cleanly onto a domain that is literally nested resources.

Prisma because the schema *is* the model, migrations are generated and reviewable as SQL, and the generated types flow into the shared DTOs. Its real weakness is that relation loads become N+1 if you're careless, and I have exactly one instance of that, which I know about. If the read side got heavier I'd drop to raw SQL for those specific aggregates rather than switch ORM — the ORM isn't the problem, one loop is.

**→ If they push: "where's the layering boundary?"**
`packages/shared` is pure domain. `modules/*/service.ts` is orchestration — transactions, locks, cache writes, publishing. `modules/*/routes.ts` is HTTP only: parse with zod, call the service, choose a status code. `lib/*` is infrastructure. The rule I held to is that no cricket rule lives in a route and no `req`/`res` ever reaches a service. That's what makes the fixture generator a pure function tested with no database, and `createApp` testable with no port.

---

# ROUND 3 — Data modelling and the event log

---

### Q11. Walk me through the schema. Which tables are truth and which are derived?

*Testing: whether you have a mental model or just a list of tables.*

Four clusters. **Identity**: `User`, `RefreshToken`, `OtpCode`, `Notification`. **Setup**: `Tournament` → `Team` → `Player`, plus `ScorerAssignment`. **Match**: `Match` → `Innings` → `BallEvent`, with `MatchPlayer` freezing the XI at toss. **Projections**: `PointsTable` and `PlayerMatchStats`.

The line that matters is between the third cluster and the fourth. Truth is `BallEvent` plus the setup tables. Derived is `PointsTable`, `PlayerMatchStats`, the Redis snapshot, and the standings and stats caches.

The test I applied to classify them: can I `TRUNCATE` it and rebuild it from something else with no loss? If yes it's a projection — and then the rule follows automatically, which is that a projection must be **recomputed, never incremented**. That's why `recomputeStandings` rebuilds an entire tournament in one transaction rather than adding two points, and why `recomputePlayerStatsForMatch` rewrites every player's card rather than nudging a total.

**→ If they push: "why does recompute-don't-increment matter so much to you?"**
Because incrementing isn't idempotent. Replay the event and a team gets four points for one win. And replay is not hypothetical: the trigger is a domain event, and a correction to a finished match needs that event republished. Recomputing means a replay *converges* rather than double-counting, a manually repaired row heals on the next match, and a correction propagates without anyone remembering a second place to update. I'm buying a whole class of bug out of existence for a few milliseconds of CPU.

---

### Q12. There's no `role` column on `User`. Defend that.

*Testing: modelling instinct — do you model people or relationships.*

Because role isn't a property of a person, it's a property of a relationship. Whoever creates a tournament is its organizer. Whoever holds a `ScorerAssignment` for a match is that match's scorer. The same account routinely organises their own league on Sunday and scores someone else's final on Tuesday — a role column would have meant asking at signup and then working around the answer forever.

The consequence runs all the way through the authorization layer: there is no `requireRole` middleware anywhere in this codebase. Every authorization question is about a specific object — do you own this tournament, do you own this match's tournament or hold an assignment for it. A coarse "is an organizer" gate would be either redundant with the object-level check or actively wrong.

**→ If they push: "doesn't that mean a database hit on every request?"**
For the match check, it would, which is why `requireScorerForMatch` caches a definite yes-or-no in Redis for 60 seconds under `authz:match:<id>:user:<id>` — negatives cached too, so a probing request doesn't hit Postgres each time. That's a cache I control and explicitly invalidate when an assignment changes, as opposed to a permission claim baked into a token I can't reach. Same performance profile, but revocable.

---

### Q13. `User`, `Player`, `MatchPlayer` — three tables for one person. Justify each.

*Testing: can you defend normalisation against a "why not just one table" challenge.*

`User` is an account. `Player` is a **squad slot** — one row per person per team per tournament, which is why it carries `teamId` and a *nullable* `userId`. `MatchPlayer` is the **playing XI for one match**.

Collapsing any two loses something real. Without `Player`, you can't have a squad member who doesn't have an account — and that's the common case in club cricket, someone who just turned up to play. Those get a generated `guest_…` username so the UI has something stable and the scorer has something unambiguous to tap. Without `MatchPlayer`, you can't have a squad larger than eleven or a different eleven next week, which is every real team.

**→ If they push: "why doesn't a guest get a career profile?"**
Because a career profile is defined as the sum of `PlayerMatchStats` across every `Player` slot linked to an *account*. A guest slot has no `userId`, so it accumulates match stats within its tournament but rolls up to nobody. Retro-linking a guest to an account later is an identity claim I have no way to verify — "that Rahul was me" is unfalsifiable — so if that person signs up, their history starts from the squads they're added to afterwards. That's a deliberate choice to not invent identity.

---

### Q14. Why is `BallEvent` append-only? What did that actually buy you?

*Testing: whether event sourcing is a buzzword or a decision with consequences.*

Three payoffs, and one real cost.

**Auditability**: a disputed six is answerable, because the ball, its author and its timestamp are all still there. **Idempotency**: a retry is a duplicate key, not a double-count — which is what makes an offline queue safe to replay at all. **Rebuildability**: every derived number is a fold of the log, which is what let me put the snapshot in Redis behind a TTL and stop worrying about cache coherence.

The cost is that a bad ball is expensive to live with, since you can't just fix the row. That's precisely why validation is aggressive and runs before anything is written — it's cheaper to refuse a ball than to live with it.

**→ If they push: "so how do you fix a mistake?"**
Two event types, both appends. A `CORRECTION` carries replacement data and names the ball it supersedes. An `UNDO` names a ball and removes it. Nothing is deleted, so `GET /matches/:id/events` still shows the ball *and* its retraction — which is exactly what you want when two people at a ground disagree, because "the scorer entered a six at 16:42 and undid it at 16:42" is the answer. Undo also carries its own `clientEventId`, so it's idempotent for free.

---

### Q15. If corrections are appended at a later sequence number, why isn't your over ticker out of order?

*Testing: this is the subtle one. Do you understand your own materialisation step.*

Because a correction is an **instruction, not a delivery**. `materializeEvents` runs before every fold: it walks the log in `seq` order, collects every `CORRECTION` keyed by the ball it supersedes and every `UNDO` as a removal, then emits only `BALL` rows — skipping removed ones and *substituting* the replacement into the position of the ball it replaces.

So the correction is stored at a later `seq` for auditing, but it is never folded in its own position. And the substituted event explicitly keeps the **original's** `overNumber` and `ballNumber`, because those describe where in the innings the delivery happened — that's a fact about the past, and a correction isn't allowed to move it. Everything else comes from the correction.

The result: the ticker reads in the order the balls were actually bowled, while the log still records when the fix was made. Those are two different questions and the design answers both.

**→ If they push: "where else does that logic live, and isn't that a duplication risk?"**
It lives in three places — the reducer, the standings' `fillInningsTotals`, and the player-stats projection — and yes, that's the sharpest duplication in the codebase. The reducer is the reference implementation; the other two re-derive the same supersede semantics because they aggregate over different shapes. The right fix is for the stats projection to consume `buildState` rather than re-implement it, and the honest reason it doesn't is that it aggregates across both innings while the reducer is per-innings. That's a solvable shape problem, not a real obstacle. Until then, the mitigation is that both share the exported `BOWLER_CREDITED` set, so at least "what counts as a bowler's wicket" can't drift.

---

### Q16. What's `seq`, and what does it guarantee?

*Testing: sequencing and uniqueness, which is where the concurrency answer starts.*

Monotonic and gap-free per innings, assigned server-side as `lastEventSeq + 1` inside the match lock. Per-innings rather than per-match because an innings is the unit the reducer folds.

It carries three jobs. `@@unique([inningsId, seq])` is a **correctness constraint** — two balls physically cannot claim the same position, which is the backstop if the lock ever fails. Client-side, `isNewerSnapshot` compares it to discard an out-of-order broadcast, so a delayed message can't visibly rewind a viewer's score. And `hasSequenceGap` detects that more than one event was missed and triggers a refetch.

The consequence worth knowing: a new innings restarts the sequence at 1. That's exactly why `isNewerSnapshot` compares `inningsNumber` *before* it compares `seq` — a naive seq comparison would reject the entire second innings as stale.

**→ If they push: "which indexes matter here?"**
`@@index([inningsId, seq])` serves the hottest query in the system, which is the fold's `findMany where inningsId order by seq`. `clientEventId` being `@unique` isn't an optimisation at all — it *is* the idempotency mechanism. On the notification side, `(userId, createdAt)` serves the bell list and `(userId, readAt)` serves the unread badge, which exists as a separate index because the badge is fetched on every page.

---

### Q17. What have you denormalised on purpose, and why?

*Testing: whether you can break a rule deliberately and say why.*

Three, each for a different reason.

**Player ids on every ball.** Each `BallEvent` carries `strikerId`, `nonStrikerId` and `bowlerId`. That's what makes the reducer simple: because the event names its own participants, the reducer never has to *infer* who came in after a wicket or who's bowling this over — the scorer already declared it, and the log is self-describing in isolation. If I inferred it, a correction mid-innings would silently change who was on strike for every subsequent ball. Three cuids per row is cheap for that.

**`oversQuota` on `Innings`.** The tournament already has `oversPerInnings`, but if an organizer edits it after a match, every finished innings' NRR would silently move. Copying the quota at innings creation makes it a fact about that innings forever. It's load-bearing for the bowled-out rule.

**`username` on `Player`.** Copied from `User` so the scoring console never needs the join on a hot path.

**→ If they push: "and `PointsTable` stores balls, not overs — why?"**
Because decimal overs are a lie. 98 balls is 16.333… overs for arithmetic and "16.2" for display, and "16.2" parses as a perfectly valid float — so every wrong implementation compiles, runs, and is quietly off by a few percent in NRR. The table sums balls, which are exact integers, and converts exactly once at read time. That's the same reason `formatOvers` returns a `string` and `ballsToOvers` returns a `number`: making them different types makes the mistake unrepresentable.

---

### Q18. Why is a notification a stored row rather than a query over current state?

*Testing: events versus state — a genuine modelling distinction.*

Because "you were added to a squad" is an *event*, and by the time someone reads it the squad may have changed again. A query over current state can only tell you what's true now, not what a person was told — so if they were added and then removed, the notice has to survive.

The copy is frozen at write time for the same reason: a notification that re-renders itself from live data is a notification that can quietly start saying something the recipient was never sent. And the context columns — `tournamentId`, `teamId`, `matchId` — are nullable and deliberately *not* foreign-key constrained, because a deleted tournament must not delete the notice that you were once added to it.

**→ If they push: "how does it get delivered?"**
Two channels, one write path. The row is the durable one — it's what the bell reads and it survives a bounced address. The email is a nudge on top, and it's explicitly detached with `Promise.allSettled` after the row is written, because waiting on an SMTP round-trip per player would put a mail provider on the critical path of a database write. An organizer pasting eleven names must not get a 500 because Resend is having a bad afternoon; failures are counted and logged, and the in-app notice is unaffected.

---

# ROUND 4 — The scoring engine and cricket correctness

---

### Q19. What is `buildState`, and where does it run?

*Testing: the core abstraction.*

It folds `applyBall` over an innings' ordered, materialised event log and returns complete innings state: score, wickets, both batsmen with their figures, the bowler, the current over, extras, fall of wickets, partnerships, and whether the innings has ended and why.

It runs in four places: the API's snapshot writer, the cold-cache rebuild, the scorer-state endpoint, and the scorer's optimistic client renderer. Four consumers, one implementation — they agree by construction rather than by maintenance.

It is pure. No I/O, no `Date.now()`, no randomness — same context plus same events always gives the same state. If it called `Date.now()`, folding the same log twice would give two different answers, which breaks the entire premise that the cache is disposable, makes every test flaky, and means client and server can render different scores from identical data.

**→ If they push: "isn't folding the whole log per ball O(n²) across an innings?"**
Yes, and the bound is what makes it fine: a T20 innings is around 130 events, so the worst fold is a 130-element reduce over in-memory objects — low single-digit milliseconds, completely dominated by the Postgres round-trip that fetched the rows. Optimising it would be optimising the wrong thing. If innings were 10,000 events I'd checkpoint: store a `MatchState` every 100 events and fold only the tail. The reducer already takes a starting state, and `rebuildState` is the single seam every fold goes through — that's not an accident, it's what keeps the optimisation a local change rather than a refactor.

---

### Q20. Walk me through strike rotation, including the edge cases.

*Testing: domain depth. Anyone can add runs; this is where the real bugs are.*

Two independent swaps per ball.

First: if the runs **physically run by the batsmen** are odd, striker and non-striker swap. That's `runsRun`, computed separately from team runs — on a wide it's `extraRuns - 1`, on a no-ball it's `runsOffBat + (extraRuns - 1)`, otherwise everything. The one automatic penalty run is a sanction, not a completed run, so it can never put a batsman at the other end.

Second: if that ball completed the over, they swap again. Which is why an odd run off the last ball of an over leaves the *same* batsman on strike — a double swap, very easy to get wrong and impossible to spot by eye. There's a specific regression test for it.

Then, if the ball was a wicket, whichever end the dismissed batsman occupies is set to null, so the UI prompts for a replacement. The scorer names them on the next ball, which is why the reducer never has to infer a new batsman.

**→ If they push: "what about balls faced, and what does the bowler get charged?"**
`facedDelivery = !isWide` — a batsman is credited with facing a no-ball, because he had to play it, but never a wide, which was never reachable. For the bowler, `bowlerRuns = runsOffBat + (isWide || isNoBall ? extraRuns : 0)`: wide and no-ball extras hit his economy, byes and leg-byes don't, because they're the batting side's runs but not the bowler's fault. A maiden is a *completed* over with zero bowler-runs — the `legalBalls >= 6` clause is there so an over cut short by the end of an innings isn't a maiden, however tidy it looked.

---

### Q21. How does the reducer decide an innings is over, and does the order matter?

*Testing: whether you know why a priority order exists.*

Three conditions, checked in this order: target chased → all out → overs complete. Wickets allowed is `battingXI.length - 1`, so ten for a full XI but correct for a short side rather than hard-coded.

The order matters and it's not cosmetic. The last ball can satisfy two at once — the winning run is scored, and the non-striker is run out completing it. That match is *won*; it is not an all-out innings. And `endReason` feeds directly into the NRR calculation, so getting it backwards would charge the winning side its full quota of overs and corrupt their net run rate for the entire tournament.

**→ If they push: "so what happens when the innings closes?"**
`closeInnings` runs inside the scoring lock, so no other ball can land mid-decision. It marks the innings complete with its `endReason`, then branches: if it was innings one, it creates innings two with `targetRuns = runs + 1` and moves the match to `INNINGS_BREAK`; if it was innings two, it calls `completeMatch`, which writes the winner and the result text and publishes `match:completed`. That event is the single trigger for both the points table and every player's career stats — no cron, no polling.

---

### Q22. Explain net run rate, and the trap in it.

*Testing: the one piece of domain arithmetic that separates people who read the rules from people who guessed.*

NRR is (runs scored ÷ overs faced) − (runs conceded ÷ overs bowled), **aggregated across the tournament**, not averaged per match. That aggregation is the first thing people get wrong.

The trap is the **bowled-out rule**: a side dismissed *inside* its quota is charged the **full quota** of overs, not the balls it actually faced. It's the most common NRR bug because the naive implementation just sums what happened — which *flatters a team that collapsed*. Bowled out for 60 in 12 overs computes as 5.00 run rate rather than the correct 3.00 over 20 overs. A team can miss a playoff spot on that.

It's isolated in one function, `chargeableBalls`, so it's impossible to apply inconsistently, and there's a regression test written so that it *fails* against the naive implementation rather than merely exercising the code path.

**→ If they push: "why isn't a successful chase charged the full quota too?"**
Because that innings ended by achievement, not by failure. A side chasing 150 that gets there in 15 overs genuinely scored at that rate, and charging them 20 would penalise winning quickly. So `chargeableBalls` keys off `endReason`: only `ALL_OUT` triggers the quota substitution. `OVERS_COMPLETE` gets actual balls, which is the same number anyway, and `TARGET_CHASED` gets what it used.

---

### Q23. Two teams finish level on points and NRR. What happens?

*Testing: do you handle the case where there's no right answer.*

Sort order is points, then NRR, then head-to-head, then team name.

Head-to-head is applied **only when exactly two teams** share the points-and-NRR key. With three or more, the mini-table can be circular — A beat B, B beat C, C beat A — and there is no defensible answer, so it's skipped rather than guessed at. The team-name comparison at the end isn't a tiebreak anyone cares about; it's there so the table never renders in a different order on two consecutive page loads, which is the kind of thing that makes users think the system is broken.

The other decision worth mentioning: the API returns every NRR *input* — runs scored, overs faced, runs conceded, overs bowled — not just the figure. A disputed number should be traceable by a human, not require trust.

**→ If they push: "how do you know your NRR is right?"**
Three things. The rule is isolated in one function, so there's exactly one place it can be wrong. It's tested against a hand-computed worked scenario including the bowled-out case. And the whole aggregation is pure — it takes finished innings and returns rows — so it's tested with no database at all, which is why those tests run in milliseconds and actually get run.

---

### Q24. A correction lands on a match that finished last week. What has to happen?

*Testing: whether you've thought past the happy path of your own design.*

The correction appends to the log, which is the easy part. Then both projections have to be rebuilt: `recomputePlayerStatsForMatch` for that match, and `recomputeStandings` for its tournament — because a corrected ball can change a batsman's average *and*, if it changes the runs total, the NRR of two teams.

The design makes that safe: both are recomputes, not increments, so replaying `match:completed` converges on the right answer instead of double-counting. That's the property I bought when I chose recompute over increment, and this is the case that spends it.

The honest gap: today the recompute is triggered only by the `match:completed` event, and there's no UI or endpoint that republishes it after a post-completion correction. The data model supports it perfectly; the plumbing isn't wired. That's on the shortlist.

**→ If they push: "and how does someone even find the ball to correct?"**
`GET /matches/:id/events` returns the full log, including undos and corrections, so the data is queryable today. What's missing is a screen that renders it for a human — which is the difference between "the evidence exists" and "the evidence is usable," and it's a fair hit. An append-only log whose main value is dispute resolution should have a dispute-resolution UI.

---

# ROUND 5 — The write path: concurrency, idempotency, consistency

This is the round that separates people who wired an API from people who thought about failure. Expect the most pushback here.

---

### Q25. Give me the exact race the match lock prevents.

*Testing: can you name a concrete race, not just say "concurrency".*

Two requests both read `lastEventSeq = 41`, both fold the same state, both validate against it, and both try to insert `seq = 42`.

The obvious harm is the collision. The subtler harm is worse: before either insert lands, both have *validated against a state that doesn't include the other's ball*. So a ball that should have been rejected as the seventh delivery of an over gets accepted, because the over looked incomplete to both of them.

And the realistic trigger isn't two scorers — it's one scorer's phone retrying a request that was actually still in flight, which is the normal condition on bad signal at a ground.

**→ If they push: "why `SET NX PX` with a random token and a Lua release?"**
`SET key token NX PX 5000` is atomic mutual exclusion with automatic expiry, so a crashed holder can't deadlock the match — the TTL reclaims it, and since a ball write holds it for single-digit milliseconds, 5 seconds is three orders of magnitude of headroom. The random token exists because a plain `DEL` on release is genuinely dangerous: if my lock already expired and someone else acquired it, my `DEL` deletes *their* lock, and now two writers each believe they're exclusive — which is worse than having no lock at all. The Lua script makes "check it's mine, then delete" one atomic operation. On failure it backs off ~1.5 seconds across 20 attempts and then returns a 409, which is honest and retryable.

---

### Q26. That's a single-node Redis lock with no fencing token. Convince me this system is correct.

*Testing: the hostile follow-up. Do you know the limits of your own tool.*

You're right that it isn't a correctness guarantee, and I wouldn't claim it is. Single-node Redis gives no formal mutual exclusion, and Redlock exists to raise that bar — though Redlock is itself contested, because Kleppmann's point stands: without fencing tokens, no lease protects a resource against a paused holder.

So I deliberately made the lock a **contention optimiser**, not the guarantee, and put correctness in the database. `@@unique([inningsId, seq])` makes two balls at the same position physically impossible to persist. `clientEventId` being unique makes a duplicate submission a constraint violation I explicitly catch and convert into an idempotent success.

Which means the pathological case a fencing token would prevent — a paused holder writing after its lease expired — surfaces one layer down as a `P2002` on a retryable request, not as a corrupted innings. The lock's job is to make contention rare and validation meaningful. The database's job is to make bad data impossible. Designing it the other way round is exactly where distributed locks hurt people.

**→ If they push: "is the read-validate-insert in a database transaction? Because your comment says 'transaction'."**
It isn't, and that comment overstates it — it should say "under the lock". The insert is a single statement so it's atomic on its own; the read-validate-insert sequence is serialised by Redis with the unique constraint as the backstop. If I wanted the guarantee purely in Postgres I'd use `SELECT … FOR UPDATE` on the innings row inside a transaction and drop Redis from that path entirely, which is arguably the better design and is what I'd do if I were removing the lock. What I'd defend is having both a serialiser and a constraint; what I wouldn't defend is having neither — and a comment that overstates a guarantee is worse than no comment, because the next person relies on it.

---

### Q27. Explain idempotency here, end to end.

*Testing: whether you understand that idempotency is a client-server contract, not a server trick.*

The **client** generates `clientEventId` — a UUID — before the first attempt, and reuses that exact value for every retry of that ball. That's the crucial part and it's why a server-generated id can't work: the server needs the client to say "this is the same ball I sent before," and only the client knows.

Server side there are two nets. The common path is a lookup on `clientEventId`; if it exists, short-circuit and return the current snapshot. The second net is catching `P2002` on the insert, because two requests for the same id can both pass the lookup before either commits — the check alone is a 500 under concurrency, and the catch alone would make every ordinary duplicate an exception.

The response is 201 for a new ball and 200 for a duplicate, **with identical bodies**. The status distinction is useful in logs and metrics. The identical body is deliberate: a client replaying its offline queue must not be able to tell the difference, because if the duplicate response were different, every consumer would need a branch for it and one of them would eventually get it wrong.

**→ If they push: "so is your POST idempotent? POST isn't idempotent by spec."**
Correct — by spec, GET, PUT, DELETE and HEAD are idempotent and POST is not. Mine is made idempotent by an application-level idempotency key with a uniqueness constraint behind it, which is the standard pattern for making an unsafe method safe to retry. Stripe does the same thing with `Idempotency-Key`. The reason I didn't use PUT is that the client doesn't choose the resource's location — `seq` is server-assigned — so POST is honest about who owns the URL.

---

### Q28. Postgres and Redis aren't written atomically. Defend that.

*Testing: dual-write awareness. The wrong answer is claiming they are.*

They aren't, there's no distributed transaction between them, and pretending otherwise would be dishonest. The design makes it not matter.

Postgres holds the truth. Redis holds a projection that is derivable from it. Every read goes through `getSnapshot`, which falls back to a rebuild on a miss. So a crash between the two writes costs a stale or missing snapshot, which self-heals on the next read. The ordering is load-bearing: Postgres first, always — the opposite order would let the cache advertise a ball that isn't durable.

There's a second guard on top. `writeSnapshot` reads the cached snapshot first and skips the write if the cached `lastEventSeq` is *higher* than the incoming one. That stops a slow write that lost a race from overwriting a newer score: ball 42 stalls, ball 43 completes and writes, then 42 finally lands — without the guard, every viewer's score rewinds until the next ball. It's optimistic concurrency, with `lastEventSeq` as the version.

**→ If they push: "that read-then-write isn't atomic either."**
No, it isn't, and there's a residual window. The lock makes it narrow — both writes for the same match are serialised — but the fully correct version is a Lua compare-and-set that reads the stored seq and writes only if the incoming one is higher, in one atomic script. That's maybe eight lines and I'd take it. I'd rather state the remaining gap precisely than claim the guard closes it completely.

---

### Q29. Two people are assigned to score the same match and both start scoring. What happens?

*Testing: will you admit a gap and describe the fix, or bluff.*

The system stays *consistent* and produces *wrong* content, and those are different things.

The lock serialises them, so the log stays valid — monotonic sequence numbers, no collisions, every ball validated against the state before it. But they're both entering their own view of the same over, so you get double-scored balls. And `clientEventId` doesn't help at all, because two people scoring the same six generate two different UUIDs — idempotency deduplicates *retries*, not *observations*.

So this is a genuine gap, not a mitigated one. The product assumption is one scorer per match, and I enforced *authorization* (who may score) without enforcing *exclusivity* (who is scoring right now).

**→ If they push: "how would you fix it?"**
A single-writer claim: a Redis key holding the current scorer for a live match with a heartbeat TTL, an explicit handover flow when the phone dies or someone takes over, and the console showing "Priya is currently scoring" to anyone else who opens it, with a "take over" button. The event log already records `createdBy` per ball, so after a contested handover you can see exactly who entered what. That's the design; it isn't built because enforcing an assumption I hadn't validated is its own mistake — but I should at least have surfaced a warning.

---

### Q30. Walk me through your caching strategy across the whole system.

*Testing: whether cache invalidation is a strategy or a scattering of TTLs.*

Two patterns, chosen per cache by whether a write path exists.

**Write-through with explicit invalidation**, where something changes it: the match snapshot is overwritten on every ball (seq-guarded, 6-hour TTL that's really just garbage collection, since the write path always refreshes it). Standings are deleted at the end of every recompute, with a 5-minute TTL as a safety net. Tournament stats are deleted after a player-stats rebuild, with 60 seconds — short because an organizer refreshes the leaderboard repeatedly while a tournament runs, and I'd rather they see a slightly stale Orange Cap than hammer a heavy aggregate. Match authorization is invalidated by `invalidateMatchAuthz` when an assignment changes, which `SCAN`s the match's keys when no specific user is given.

**TTL-only, where the mapping cannot change**: slug → match id is cached for 24 hours with no invalidation, because a `publicSlug` is set at fixture creation and never changes. There is nothing to invalidate; the TTL only bounds memory for slugs nobody revisits.

The sizing principle is the cost of being wrong. Where a write path refreshes the key anyway, the TTL is hygiene. Where staleness is user-visible but harmless, it's minutes. Where it's a security decision, it's 60 seconds *and* explicit invalidation.

**→ If they push: "and how do you stop a runaway client hammering the write path?"**
Redis fixed-window counters. Ball writes are capped at 120 per minute per scorer per match — deliberately generous, because a fast over is six balls in under a minute and a drained offline queue is bursty, so it catches a runaway client rather than a busy one. OTP requests are 5 per hour per email and 30 per hour per IP, the IP limit looser on purpose so shared ground wifi doesn't lock out a whole team. `incrementWindow` pipelines `INCR` and `TTL` in a `MULTI` so it's one round-trip, and returns the remaining TTL so the 429 carries a truthful `Retry-After` rather than a guess. And it fails open: the limiter catches its own errors and calls `next()`, because a live match must not become unscorable because a cache is down. Fail open when a guard is about cost; fail closed when it's about correctness.

---

# ROUND 6 — Realtime and WebSockets

The round most likely to go deep on fundamentals before it gets to your code.

---

### Q31. What is a WebSocket, and why is it the right choice here over SSE or polling?

*Testing: fundamentals first, then judgment. Answer both halves.*

A WebSocket is a full-duplex, persistent TCP connection between browser and server, established by upgrading an HTTP/1.1 request. The client sends `GET` with `Upgrade: websocket`, `Connection: Upgrade`, a random `Sec-WebSocket-Key` and version 13; the server replies `101 Switching Protocols` with `Sec-WebSocket-Accept` — base64 of SHA-1 of the key plus a magic GUID, which proves the server actually understood the protocol rather than being a cache that echoed the request. After the 101 it's not HTTP any more: it's a framed message channel with almost no per-message overhead, and either side can send at any time.

Versus **polling**, which pays a full request, headers and connection setup per check and is always latency-bound by the interval. Versus **SSE**, which is a long-lived HTTP response streaming `text/event-stream`, server-to-client only, with automatic reconnection and `Last-Event-ID` built in.

SSE is the fair challenge, because my fan-out genuinely is one-directional. Three reasons I still chose WebSockets. The client isn't purely passive — it sends `join` and `leave` for a specific match room, and with SSE that's a second out-of-band HTTP channel plus server-side session correlation. Viewer counting depends on knowing precisely when a connection goes away, and SSE disconnects are noticed late and unreliably. And HTTP/1.1's six-connections-per-origin limit makes a long-lived SSE stream a real cost on a page that also fetches.

**→ If they push: "if the product became purely one-way, would you switch?"**
Yes, and I'd say so. SSE would be a legitimate simplification — it's plain HTTP, it traverses proxies that mangle upgrades, and reconnection with replay is in the spec rather than in a library. The thing that would make me keep WebSockets is the viewer count, which is a product feature that depends on precise disconnect detection.

---

### Q32. Why socket.io rather than raw `ws`?

*Testing: whether you chose the library or inherited it.*

The honest answer: because of the Redis adapter and rooms, which are the two things I would otherwise have written badly.

With raw `ws` I'd hand-roll room membership and the match→sockets map; cross-instance fan-out over Redis pub/sub, including not re-delivering my own messages; client reconnection with backoff and jitter; heartbeats and dead-connection detection; and packet encoding. That's several hundred lines of infrastructure with subtle bugs, in a project whose value is the cricket domain. `@socket.io/redis-adapter` is one line and it is the *entire* horizontal scaling story.

The typed event map is the other half: `ServerToClientEvents`/`ServerToClient` as a shared pair means compile-time safety across the wire.

What it costs, because there is a cost: about 40KB on the client bundle, a custom framing protocol so you can't `curl` it or use a generic WebSocket client, version coupling between the two ends, and — the one that actually bit me — defaults that are wrong for a modern platform.

**→ If they push: "which default bit you?"**
Transport negotiation. socket.io defaults to establishing the session over HTTP long-polling and *then* upgrading. That handshake is **process-sticky**: the session lives in one instance's memory and every subsequent poll must reach that same instance. Behind a load balancer that spreads requests — and certainly on serverless, where consecutive requests routinely hit different instances — the second poll lands somewhere that has never heard of that session, and the handshake dies with `session ID unknown`. So both ends pin `transports: ['websocket']`. One connection, established once, no affinity requirement. Pinning only one end doesn't help. Sticky sessions at the load balancer are the alternative solution, but that's infrastructure I don't control on this platform and it degrades every scaling property I wanted.

---

### Q33. A ball is scored on instance A. How does it reach a viewer connected to instance B?

*Testing: do you actually understand horizontal scaling, or does it just work on your laptop.*

Via the Redis adapter. When instance A calls `io.to('match:x').emit('ball', payload)`, the adapter publishes the encoded packet — plus the broadcast options, target rooms, exclusions, and the originating instance's id so it doesn't double-deliver to itself — to a Redis pub/sub channel. Every instance is subscribed. Each one receives it and re-emits to *its own* locally-connected sockets in that room. So instance A never needs to know that instance B, or the socket on it, exists.

Rooms are the addressing scheme: a room is a server-side set of socket ids you broadcast to by name. I use exactly one pattern, `match:<matchId>`, produced by a shared `matchRoom()` helper so client and server cannot disagree about the string. A ball in one match therefore costs nothing to viewers of any other match.

The adapter needs **two dedicated Redis connections**, separate from the general-purpose client, because a connection in subscriber mode is blocked on `SUBSCRIBE` and can't issue normal commands. Sharing them produces a client that intermittently refuses commands, which is a horrible bug to diagnose.

**→ If they push: "why not just subscribe to a Redis channel yourself? That's forty lines."**
It is, and then I owe: correct room bookkeeping on disconnect, self-delivery suppression, packet encoding, resubscription when the subscriber connection drops, and every future broadcast primitive. It's a well-solved problem with a maintained, widely deployed implementation. Writing my own would be choosing a worse version of the same idea in order to say I wrote it. I'd rather spend that budget on the cricket.

---

### Q34. How do you count live viewers?

*Testing: this is the question where the serverless-specific insight lives.*

A Redis **sorted set** per match, `viewers:<matchId>`, holding socket ids scored by join timestamp. On join it's one `MULTI`: `ZADD`, then `ZREMRANGEBYSCORE` to prune anything older than 15 minutes, then `EXPIRE` to refresh the key, then `ZCARD` — one round-trip, consistent count. On leave or disconnect it's `ZREM` plus `ZCARD`.

The obvious implementation is the adapter's `fetchSockets()`, and it cannot work here. `fetchSockets()` broadcasts a request and waits for **every subscribed instance to answer**. On a platform that *freezes* idle instances, a frozen instance still holds its Redis subscription — so it's counted among the expected responders, and it will never reply. The call stalls for its full timeout and then fails. A sorted set has no dependency on who happens to be awake.

Scoring by timestamp is what makes the structure self-healing. A plain set would count correctly and leak forever: an instance killed without a clean disconnect leaves its socket ids behind and the count inflates permanently. Pruning on every join means stale entries are removed by ordinary traffic rather than by a cleanup job.

**→ If they push: "why handle `disconnecting` rather than `disconnect`?"**
Because during `disconnecting` the socket's rooms are still attached, so I can iterate them, find which match rooms it was in, and decrement the right counters. By `disconnect` the rooms are gone and there's nothing left to recount. It's a small thing that's completely silent when you get it wrong — the count just drifts upward over hours.

---

### Q35. You broadcast the entire snapshot on every ball, not a delta. Justify the bandwidth.

*Testing: an explicit trade-off with a known breaking point.*

It's a couple of KB larger on the wire and it buys self-healing.

A client that misses one message is corrected by the next. That means no replay protocol, no gap-filling request, and no server-side per-client buffer — three pieces of machinery that don't exist because of this one decision. `seq` monotonicity is then enough to discard an out-of-order arrival.

The bigger win is that it makes a mid-match join instant: the viewer gets the current score immediately rather than a replay from ball one, and — importantly — the joining path and the steady-state path are the *same code*. There's no separate catch-up mode to get wrong.

I know exactly where it breaks. A snapshot is 2–3KB; the cost is snapshot × viewers × instances, since the adapter publishes to every instance regardless of subscribers. Below a few hundred viewers per match it's plainly right. At tens of thousands it's the first thing to change, to deltas with a periodic keyframe.

**→ If they push: "how does the client handle loss and reordering today?"**
`isNewerSnapshot` gates every socket message: accept only if `lastEventSeq` is higher — but compare `inningsNumber` *first*, because a new innings restarts the sequence and a naive comparison would reject the entire second innings as stale. `hasSequenceGap` returns true when the incoming seq is more than one ahead and triggers a full refetch. With whole snapshots that gap check isn't a correctness requirement; it drives the resync affordance and keeps the scorecard tab consistent.

---

### Q36. Someone opens the share link mid-match. Walk me through the first two seconds. Then the connection drops.

*Testing: the client lifecycle, including failure.*

`useLiveMatch` is snapshot-first, then subscribe. `GET /public/matches/:slug/snapshot` resolves the slug from a Redis cache, reads the snapshot from Redis or rebuilds it by folding the log, and returns the current score — that renders immediately, before any socket exists. Then the socket connects, emits `join` with the match id, the server adds it to the room and `ZADD`s the viewer set, and echoes `joined` with the count. From then on, every ball arrives as a push.

That ordering is the whole point: the page is useful before the socket is open, and a slow or failed socket degrades to a static-but-correct score rather than a spinner.

On a drop: `disconnect` fires, the badge flips to "Reconnecting", and socket.io retries with backoff from 500ms to a 5-second ceiling. On `connect` the client does two things — re-emits `join`, because a new socket id is not in the old room, and **refetches the snapshot**, because what happened while it was away is unknowable and trusting stale local state is exactly how a score goes wrong.

**→ If they push: "why is the refetch applied unconditionally when socket messages are gated?"**
Different provenance, different trust. A refetch is a fresh read of the source of truth, so it's by definition the most recent state — and gating it would risk rejecting a *newer* state across an innings rollover. A socket message is a push that the network may have delayed or reordered, so it has to prove it's newer before it's allowed to move the score. The user-visible property I'm protecting is monotonic reads: being 400ms stale is invisible, but a score going from 47 back to 42 is alarming.

---

### Q37. Why is scoring done over HTTP and not over the socket you already have open?

*Testing: the single most defensible decision in the project. Have three reasons ready.*

Three concrete reasons.

**Auth.** HTTP gives me a per-request `Authorization` header and middleware that already exists. A socket authenticates once at connect and then has to re-check authorization per message anyway, because assignments change mid-connection.

**Idempotency and retry.** HTTP has status codes, `Retry-After`, and a client — `fetch` — that already understands failure. Over a socket I'd rebuild request/response correlation, timeouts, retries and acks by hand. Given that the offline queue's entire premise is safe replay, that machinery is not optional.

**Disposability.** Because nothing writes over the socket, the whole realtime layer is a read-only fan-out I could delete and replace with polling in an afternoon without touching a line of the write path. That's a property I'd only have by accident if writes went over the socket.

Look at the shared event map: there is no client-to-server event that mutates anything. `join` and `leave` are the entire surface. That's enforced by the type contract, not by convention.

**→ If they push: "your socket has no authentication at all. Decision or omission?"**
Decision, and here's the test: what does a socket grant? Exactly one thing — receiving score updates for a room you named. Since nothing writes over it, authenticating it would protect a read that the share link already grants to anyone with the URL. What *is* protected is discovery: the only public address is a ~49-bit random slug — 31 symbols to the 10th, with ambiguous glyphs removed so it survives being read aloud at a ground — so you can't enumerate matches. If private matches ever existed, the change is a signed token verified in a socket middleware at handshake. One function, because the room model already exists.

---

### Q38. How would you test and load-test this layer?

*Testing: whether "it works on my machine" is your standard.*

The correctness test that matters is the cross-instance guarantee, because it's the one you cannot verify by clicking around. Boot two `createApp` instances against one Redis, connect a `socket.io-client` to each, POST a ball to instance A, and assert the client on instance B receives it with the right snapshot. Then the reconnect path: kill the connection, assert the client refetches and converges on the server's state. Both are possible precisely because `createApp` doesn't call `listen`.

For load: k6 or Artillery with the socket.io engine — ramp N clients into one room, drive a scripted scorer at real over pace, and measure end-to-end ball-to-render latency percentiles, memory per connection, and Redis pub/sub throughput. The two things I'd specifically watch for are p99 degrading non-linearly past some connection count, and pub/sub bandwidth becoming the wall, which is what I'd expect to break first given the full-snapshot design.

**→ If they push: "what's the concurrent connection ceiling today?"**
On a long-lived Node host, tens of thousands per instance — the limits are file descriptors and per-connection heap, and it's I/O bound rather than CPU bound. On this deployment it's a different question entirely, because the function has a hard 300-second ceiling regardless of connection count, which I'll come to. But connection count isn't the real bottleneck at any scale: fan-out volume is.

---

# ROUND 7 — Offline and the queue

The round where the interviewer will try to catch you overselling. Don't.

---

### Q39. Walk me through offline mode.

*Testing: the mechanism, precisely.*

Every ball the scorer taps is written to **IndexedDB first**, keyed by its `clientEventId`, with status `pending`. If the browser is online, the drain runs immediately: it lists the queue in `createdAt` order and POSTs each ball sequentially, removing each one on success. If offline, the ball sits there and the UI says so. A `window` `online` listener triggers a drain the moment connectivity returns.

Meanwhile the console renders the **optimistic** state: the last server-confirmed state with every queued ball folded on top by the same reducer the server uses. So the scorer sees a live, correct score with no network at all — not a mock, the same function producing the same answer the server will produce when the queue drains.

The design point is that **every ball goes through the queue, even online.** `navigator.onLine` means "there's a network interface," not "the request will succeed" — at a ground on two bars, requests fail constantly while the browser insists you're online. If the online path bypassed the queue, every one of those failures would be a ball that existed only in a React state variable and died with the next re-render. Persist-then-send means the only difference between online and offline is how long the ball sits in the store. One code path, one set of bugs.

**→ If they push: "why IndexedDB, and why key it by `clientEventId`?"**
`localStorage` is synchronous and blocks the main thread, which is unacceptable on a UI whose entire promise is that a tap feels instant. It's also string-only, so every read is a `JSON.parse` of the whole queue, capped around 5MB, and has no indexes — I'd be scanning a blob to filter by match. IndexedDB is async, stores structured objects, and indexes by `matchId` and `createdAt`, which is exactly how the queue is read. Keying by `clientEventId` makes the *store itself* idempotent — enqueueing the same ball twice is a `put` over one key, not a second row — and it's the same value the server enforces uniqueness on, so the client key and the server constraint are literally the same identifier with no mapping to get wrong. There's also an in-memory `Map` fallback when IndexedDB is unavailable, so the module degrades to "works but not durable" rather than throwing at import and taking the console down.

---

### Q40. What exactly are you queueing — and what aren't you?

*Testing: precision. A vague answer here reads as "I bolted this on".*

Queued: ball submissions, and only ball submissions. The full `BallRequestInput` — runs off bat, extras and type, wicket details, striker/non-striker/bowler ids, and the client-generated `clientEventId`.

Not queued: undo, corrections, toss, playing XI, start match, resume innings, and every organizer action. Two different reasons.

**Undo and corrections** reference a server-side event id, and their meaning depends on what the server currently holds. Queueing an undo offline means queueing "remove the last ball" against a log that has since changed — the semantics aren't well-defined, and getting it wrong destroys data in an append-only store, which is the one place you can't quietly repair.

**Setup actions** are one-time, happen before a match when someone is almost certainly still on signal, and have downstream consequences — freezing the XI, opening the event log, moving the match to LIVE — that shouldn't be applied optimistically.

**→ If they push: "so a scorer offline can't undo? That's a real usability hole."**
It is, and it's the one genuine gap in that list — the other exclusions I'd defend, this one I'd fix. The right design isn't to queue a server undo; it's to make undo a **local dequeue** when the target ball is still sitting in the queue, which is trivially correct because the ball never reached the server. Only fall back to a server-side `UNDO` when the target has already been accepted, which requires connectivity anyway. That's maybe thirty lines and it covers the actual case — a scorer fixing a mistap five seconds later.

---

### Q41. Is this actually a queue? There's no worker, no backoff, no retry schedule.

*Testing: intellectual honesty. Overselling here is fatal; a precise answer is a strong signal.*

It's a durable, ordered, at-least-once **outbox** with an event-driven drain, and I'd rather describe it that way than call it something it isn't.

What it genuinely has: durability across reloads and crashes, FIFO ordering, safe replay via idempotency keys, a terminal `failed` state, and an explicit user-triggered retry.

What it does **not** have: a background worker — nothing runs with the tab closed — no exponential backoff, no retry schedule, no dead-letter policy, and no cross-tab coordination. The drain is triggered by exactly three things: an enqueue while online, the `online` event, and the user pressing retry.

For a scorer who is looking at the phone for the entire match, that trigger set covers the real cases. For anything else it's genuinely insufficient, and the fix is a Service Worker with Background Sync.

**→ If they push: "so why isn't it a PWA with Background Sync?"**
No manifest, no Service Worker, deliberate for the version I shipped. Background Sync is Chromium-only, a Service Worker introduces a cache-invalidation problem of its own on a fast-iterating app, and the actual user is a person holding the phone with the console open for two hours. The moment I want a send to survive a tab close or a browser crash, it's the right answer — and the queue is already structured for it, because the store and the drain function are both independent of React and take `submit` as a parameter.

---

### Q42. The queue is draining and the server rejects ball 3 of 7. What happens?

*Testing: the failure path, which is where this design is weakest. Know it cold.*

Balls 1 and 2 are gone from the queue, accepted. Ball 3 is marked `failed` with the server's message, the drain **breaks**, and 4 through 7 stay `pending` and unsent. The UI shows the failed count and a retry action. The optimistic state still includes all five unsent balls, so the scorer's score doesn't jump backwards — but they can now see something is wrong.

The break is deliberate: the balls are causally dependent. Ball 4 was validated against a state that includes ball 3. If 3 didn't land, submitting 4 means submitting it against a server state that never saw 3, and the server will either reject it or — worse — accept it into the wrong position in the over. Stopping preserves the invariant that the server's log is a prefix of the scorer's intent. Continuing would trade a stalled queue for a corrupted innings.

**→ If they push: "and if the rejection is a 422, not a network failure? Then it's stuck forever."**
Correct, and that's the sharpest weakness in this layer — retrying an invalid ball fails again, permanently. It's mitigated by the client running the *same* `validateBall` before enqueueing, so a 422 means the client's state had genuinely diverged from the server's, which is rare and is exactly the case a human should look at. But the correct design distinguishes **transport failures**, which should retry with exponential backoff and jitter, from **semantic rejections**, which should surface the offending ball's full details and offer to edit or discard it. Today it shows an error string and a retry button, which is not enough. That's the first thing I'd fix in this file.

---

### Q43. How does the console show a correct score with no network?

*Testing: the optimistic layer — and this is where you cite a bug you found and fixed.*

`foldQueuedBalls` takes the last server-confirmed `MatchState` and replays every queued ball through `applyBall` — the identical reducer the server runs. So the console shows a real score, a real over ticker, real batsman figures, correct strike rotation, and correct end-of-innings detection, all computed locally.

Crucially the fold always starts from the *last server-confirmed state* and replays only the locally-queued balls on top, so drift is bounded by queue depth, and the server's answer is applied unconditionally on every response. The client never accumulates state of its own.

I rewrote this recently and it fixed two bugs. The old version built each optimistic event's `seq` as `lastEventSeq + index + 1` using the *original* state for every item — but each fold step already advances `lastEventSeq`, so the sequence numbers were wrong once more than one ball was queued. Now each event is built from the *current* folded state. And I re-pointed the "clear the manual crease overrides" effect at the **displayed** sequence rather than the server's: offline, the server's sequence never moves, so a manual striker or bowler override would stick and freeze the crease for the rest of the innings.

**→ If they push: "the fold also carries `previousOverBowlerId`. Why does that matter?"**
The consecutive-overs rule. The server's answer for "who bowled the previous over" is frozen at the moment the connection dropped. If the scorer bowls two full overs offline, a stale value both offers the wrong bowler options at the over boundary *and* lets through a ball the server will reject with `CONSECUTIVE_OVERS` on sync. And because a failed ball halts the entire queue, that single stale value would strand every subsequent delivery. So the fold watches for `currentOverNumber` changing and updates the value from the ball that completed the over. It's a good example of how a client-side convenience becomes a correctness concern once there's a queue behind it.

---

### Q44. Two tabs are open on the same match and both go offline. What happens?

*Testing: a case most people haven't thought about. Credit for knowing the answer is imperfect.*

IndexedDB is shared across tabs on the same origin, so both tabs see the same queued balls in storage. But `subscribeToBallQueue` is an in-memory `Set` per tab, so tab B doesn't re-render when tab A enqueues — it shows a stale list until something else triggers a refresh.

Worse: when connectivity returns, both tabs' `online` handlers fire and both start draining. The `draining` guard is a React ref, so it's per-tab and doesn't help. They interleave.

The saving grace is idempotency — the loser's submissions come back 200 with the same snapshot and nothing is double-counted — so the *outcome* is correct while the ordering is uglier than it should be. The fix is a `BroadcastChannel` for subscriber notifications and a Web Lock via `navigator.locks` around the drain, so exactly one tab drains at a time.

**→ If they push: "you order by `createdAt` — what if the device clock is wrong?"**
`createdAt` is `Date.now()` used only to order *that device's own* queue, so it's a relative ordering within one origin in one session and a wrong absolute clock doesn't matter. A clock that jumps backwards mid-session would, and the robust version is a monotonic counter or a `performance.now()`-based sequence. The server never trusts it at all — server-side ordering comes from `seq`, which the server assigns.

---

# ROUND 8 — Auth and security

---

### Q45. Walk me through the auth flow, and defend where each token lives.

*Testing: the standard question. The differentiator is the storage argument.*

Register with email, username, name and password → the account is created unverified and a 6-digit OTP is emailed, or logged in dev → verifying the code both confirms the address and signs them in, so there's no second step. Login accepts username or email plus password. A successful auth returns a short-lived access JWT **in the response body** and sets an **httpOnly refresh cookie**.

The access token lives in a module-scoped variable in the SPA — memory only, never `localStorage`. `localStorage` is readable by any JavaScript on the page, so a single XSS, in my code or in a dependency, exfiltrates a valid token. A closure variable isn't reachable from an injected script without already having execution in that context, and it dies with the tab. It's also only 15 minutes, so the window is small even in the worst case.

The reload then survives on the cookie: `AuthProvider` calls `/auth/refresh` on mount, the browser sends the httpOnly cookie automatically, and it comes back with a fresh access token. That's the whole point of the split — the thing JavaScript can read is short-lived and low-value, and the thing that's long-lived is unreadable by JavaScript.

**→ If they push: "why is the refresh token opaque rather than a JWT?"**
Because a refresh token must be revocable, and a stateless JWT can't be — it's valid until it expires no matter what you do. Making it a 48-byte random string means the database row *is* the authority: revoke the row and it's dead immediately. JWTs are the right shape for a 15-minute access token, where statelessness beats revocability; they're the wrong shape for a 30-day one.

---

### Q46. Explain refresh token rotation and reuse detection.

*Testing: whether you know why rotation alone isn't enough.*

Every use of a refresh token revokes it and issues a new one, inside a single transaction — so a crash can't leave a user with no valid token.

The interesting case is presenting a token that is **already revoked**. That means either a replay of a stolen token or a legitimate client racing itself, and I cannot distinguish them — so I treat it as theft: every unrevoked token for that user is revoked and they're signed out everywhere, with an explicit message saying so.

Rotation *alone* doesn't stop an attacker who holds a copy; it just means whoever uses it first wins. What family revocation adds is **detection**: the loser of that race presents a revoked token, which is a signal that cannot occur in normal operation. So the theft is caught and terminated rather than silently persisting for thirty days. The cost is a false positive on a genuine race, which is why the message explains exactly what happened rather than just failing.

**→ If they push: "you SHA-256 the refresh token but bcrypt the password. Why the difference?"**
Different threat models. A password is low-entropy and human-chosen, so a leaked hash is brute-forceable and you need a deliberately slow KDF — bcrypt at cost 12, roughly 250ms, verified once per login. A refresh token is 48 bytes from a CSPRNG, 384 bits: brute force isn't a thing that happens. The only property I need is that a database leak yields nothing replayable, and SHA-256 gives me exactly that at a fraction of the cost — which matters, because this hash is computed on *every single refresh*. OTP codes get bcrypt at cost 10, because there the secret is only six digits and what protects it is the 10-minute TTL and the 5-attempt cap, not the hash; paying 250ms for a code that expires in ten minutes buys nothing.

---

### Q47. How do you prevent account enumeration?

*Testing: security thinking beyond "hash the password".*

Every surface, deliberately.

**Login**: identical message for unknown user and wrong password — and identical *timing*, via `burnPasswordComparison`. Without it, "no such username" returns in about a millisecond while "wrong password" takes 250ms, so an attacker learns which accounts exist purely from response time no matter how carefully the message is worded. When the user doesn't exist, that function burns an equivalent bcrypt comparison against a decoy. The decoy is generated lazily from a random value rather than checked into the repo — a literal digest in source is a published hash of a known string, and a malformed one would be rejected instantly and defeat the whole purpose.

**OTP verification**: every failure path — no code, expired, wrong code — returns the same "that code is incorrect or has expired."

**Registration and forgot-password**: 202 regardless of whether the address exists.

**Handle lookup**, used when an organizer adds a player by username: requires a session, because an unauthenticated "does this handle exist" endpoint is an enumeration oracle by definition.

**→ If they push: "registration must still reject a duplicate username. Isn't that a signal?"**
It is, and it's the one I can't fully close — you cannot both enforce uniqueness and hide it. The mitigation is that usernames are *public by design* in this product: they're the handle an organizer types to add someone to a squad and they're the stats URL. So it isn't secret information, and I'd rather be clear about that than pretend the surface doesn't exist. Email addresses, which *are* secret, are never confirmed or denied anywhere.

---

### Q48. What's your CSRF and XSS story?

*Testing: knowing which mitigation addresses which attack.*

XSS is attacker-controlled script executing in my origin, so it can do anything my JavaScript can do. Mitigations: React's default escaping, no `dangerouslySetInnerHTML` anywhere, helmet's security headers, and — the one that actually limits blast radius — keeping the access token out of `localStorage`, so a successful XSS can't walk away with a long-lived credential.

CSRF is a third-party site causing the browser to send an authenticated request using ambient credentials. `sameSite=strict` on the refresh cookie means the browser won't send it on any cross-site request, which kills CSRF against `/auth/refresh`. Every other authenticated endpoint uses the `Authorization` header, which a cross-site form or image tag cannot set — so there is no ambient-authority endpoint to forge against. CORS is an explicit origin allow-list, not a wildcard, and `credentials: true` requires it to be explicit.

Same-origin deployment reinforces all of it: web and API are one origin, so `sameSite=strict` is actually viable. Cross-origin it would need `sameSite=none; secure`, which is strictly weaker and increasingly hostile to third-party cookie restrictions.

**→ If they push: "tell me about the cookie bug you shipped."**
The refresh cookie was scoped to path `/auth`. Login worked, the session worked, and every reload came back signed out — and it only reproduced in the deployed environment. The reason: **a cookie path is matched against the URL the *browser* requests**, not the path your router thinks it's mounted at. The browser never asks for `/auth` — in dev it's `/api/auth/refresh` through the Vite proxy, in production the platform mounts the function under `/api`. So the cookie was set, visible in devtools, and never sent again. What made it hard was that it *looked* like a server problem because the cookie was plainly there. Path `/` fixed it, and the reasoning is now a comment in the code.

---

### Q49. What's in your JWT, and what's deliberately not?

*Testing: the authorization-in-tokens trap.*

`sub` (user id), `email`, `iss: 'howzat'`, and the expiry. That's it.

What it deliberately does *not* contain is anything about permissions — no role, no list of matches you may score. Permissions are read per request, which means revoking a scorer assignment takes effect immediately rather than waiting up to 15 minutes for a token to expire. Putting authorization claims in a bearer token is putting a cache with no invalidation into the hands of the client.

The matching design is `requireScorerForMatch`, which grants access two ways: an explicit `ScorerAssignment` row for (match, user), or ownership — the organizer of a tournament may always score its matches. The result is cached in Redis for 60 seconds as a definite `'1'` or `'0'`, so negatives are cached too and a probing request doesn't hit Postgres each time. It's also invalidated explicitly when an assignment changes.

**→ If they push: "so a revoked scorer can keep scoring for 60 seconds."**
Only if the explicit invalidation fails, since I `SCAN` and delete that match's authz keys the moment an assignment changes — the TTL is the backstop, not the mechanism. And I'd argue the worst case is mild: someone who was authorised sixty seconds ago enters balls into an append-only log that records exactly who they were, and every one of them is correctable. The alternative is a Postgres query with a relation load on every single ball write — six times an over per live match — for a check whose answer changes maybe once a season. I'd take that trade again. What I would *not* do is cache a security decision this way if the action it guarded were irreversible.

---

# ROUND 9 — Serverless and deployment

---

### Q50. How is this deployed, and what did the platform force you to change?

*Testing: whether you've actually operated it or just pushed it.*

One Vercel project. The SPA is the static output at `/`, the API is a Vercel Function at `/api/*` via a rewrite, and sockets live at `/api/socket.io`. One origin for both.

Same-origin buys three things: the refresh cookie stays first-party, which is what makes `sameSite=strict` viable; CORS disappears from the browser path entirely; and the socket connects to `window.location.origin`, so there's no separate socket host to configure per environment. The dev setup mirrors it deliberately through the Vite proxy, so dev and prod have the same origin topology rather than two different sets of bugs.

Four things the platform forced. **Websocket-only transport**, because the polling handshake is process-sticky. **Viewer counting in Redis** rather than `fetchSockets()`, because frozen instances never answer. **Awaiting event subscribers** on the completion path, because the instance freezes when the response is sent. And **bundling the API with tsup**, because files under `api/` are transpiled individually and won't follow a relative TypeScript import out of that directory — so `api/server.ts` is a one-line re-export of the built bundle rather than of the source.

**→ If they push: "any other platform-specific gotchas?"**
Two. The rewrite has to target a static `api/server` rather than a `[...path]` catch-all, because the catch-all matched only a single path segment — `/api/health` resolved and `/api/health/live` 404'd at the platform before ever reaching Express. And Prisma needs `binaryTargets` including `rhel-openssl-3.0.x`, because the native query engine is per-platform: without it the client builds perfectly and then fails at runtime with "Query Engine not found." Both are build-passes-deploy-fails bugs, which is the most expensive category, so both are pinned in config with a comment.

---

### Q51. WebSockets on a platform with a 300-second function limit. How does that work?

*Testing: do you know the constraint and did you verify the behaviour.*

It works because the function *exports an `http.Server`* rather than a request handler, so the server's own upgrade handling is in place and socket.io attaches to it exactly as it does locally. The platform routes the upgrade to the function and the instance stays alive for the connection's duration.

The constraint is real and hard: the connection is torn down at the function's maximum duration, 300 seconds on the free plan. So a live-match socket reconnects at least every five minutes.

It doesn't matter, because the client is snapshot-first. On reconnect it rejoins the room and refetches the snapshot, so the score is correct within a round-trip and the user sees a "Reconnecting" badge flicker at most.

And I measured it rather than assuming: the connection held for 315 seconds, dropped with `transport close`, and reconnected 2 seconds later with the viewer count intact. "It reconnects fine" is a claim; that's the evidence.

**→ If they push: "would you deploy it this way for real users?"**
For this scale, yes — the reconnect is invisible and the operational simplicity of one project on one origin is worth a lot. Past a few hundred concurrent viewers I'd split the socket layer onto a long-lived host — Fly, Railway, a container — and keep the API serverless, because the socket server is stateless apart from room membership, which the Redis adapter already externalises. That split is cheap precisely because the realtime layer doesn't own any truth.

---

### Q52. Why must `publishMatchEvent` be awaited on one path and dropped on another?

*Testing: the single best serverless insight in the project.*

`publishMatchEvent` returns a promise that settles once every in-process subscriber has finished.

On the **hot ball path** I drop it with `void`. The only consumer there is socket fan-out, and I don't want the scorer's response waiting on a broadcast.

On the **match-completion path** I `await` it, because two heavy subscribers hang off `match:completed` — the standings recompute and the player-stats recompute — and on serverless the instance is frozen the moment the response is sent. A detached rebuild would be truncated part-way through **with no error anywhere**: no exception, no log line, no failed request. Just a points table that's silently half-written.

That's the worst class of bug, because it's non-deterministic: it works in dev, works under load when other requests keep the instance warm, and fails at 11pm on a quiet Tuesday. The rule is that on a freeze-based platform, nothing important may be fire-and-forget.

**→ If they push: "and if a subscriber throws?"**
Each one is caught individually inside the bus, so a failing subscriber never fails the caller and the returned promise always resolves. That's deliberate: the ball is already durable in Postgres and the match result is already written — a failing projection must not turn a successful write into a 500. It logs at error level, and a failed standings rebuild is recoverable by republishing the event, precisely because the recompute is idempotent.

---

### Q53. Why two database URLs, and what's the connection-pooling problem on serverless?

*Testing: infrastructure literacy.*

`DATABASE_URL` is Neon's **pooled** endpoint — a transaction-mode pooler — and is what the app uses at runtime. `DIRECT_URL` is the non-pooled endpoint, used by Prisma Migrate, because migrations run DDL and session-level operations a transaction-mode pooler cannot support. Both point at the same database. Using the pooled one for migrations fails in confusing ways, so it's worth having the two named explicitly.

The underlying problem: a Postgres connection is expensive — it forks a backend process with its own memory — so a pool amortises them. Serverless breaks the assumption a pool is built on, because each instance has its own pool and the platform may run hundreds of instances, so you get pools-of-pools and exhaust `max_connections` under load. The fix is an external pooler that multiplexes many short-lived clients onto few real backends.

Redis has the mirror-image problem, which is why the client is cached on `globalThis`: a reused warm instance must not open a new connection per invocation, or it leaks one per request until the provider's concurrent-connection cap cuts it off. And `lazyConnect` means a cold start doesn't open three TCP connections before knowing whether the request it woke up for even needs Redis.

**→ If they push: "how does the app behave on a cold start?"**
Module graph loads, env is parsed and validated, subscribers register, socket.io attaches, Redis is constructed but not connected, Prisma connects on first query. Env parsing is at import time and **throws** rather than calling `process.exit(1)`, deliberately: on serverless this runs during module init, where an exit is reported as an opaque crash with no output, while a thrown error carries the itemised zod message into the platform's logs. It also logs with `console` rather than the logger, because the logger itself depends on env.

---

# ROUND 10 — Frontend

---

### Q54. Why React Query, and how does it coexist with socket push?

*Testing: server state vs client state, and avoiding two systems owning one value.*

React Query because I had **server state**, not client state, and the two need different tools. It gave me caching keyed by resource, deduplication of concurrent identical requests, background refetch, and one declarative invalidation model. Hand-rolling that with `useEffect` means loading flags, unmount races, stale closures, and a manual refetch at every mutation site.

The two systems are deliberately kept apart rather than merged. The **scorer console** uses React Query — it's the writer, so it invalidates on every mutation. The **viewer page** uses `useLiveMatch`, which owns its snapshot in local state fed by the socket, with HTTP only for the initial load and for resync. Pushing socket payloads into the query cache would mean two systems racing to own one key, which is how you get a value that flickers between two sources.

Where they meet is the resync: HTTP is always authoritative and applied unconditionally; socket messages must pass `isNewerSnapshot`.

**→ If they push: "your `invalidateMatch` invalidates four keys at once. Isn't that lazy?"**
It's coarse on purpose. Any write to a match moves both the header — status, toss, result — and the innings state, and those render on different screens. Invalidating precisely per mutation means six call sites each remembering which three keys to touch, and one of them eventually gets it wrong, producing a stale screen that's very hard to trace. One coarse function costs a few redundant refetches of small payloads and makes it impossible to forget one. The fixture list is matched by key *predicate* rather than plumbing a tournament id through every mutation, for the same reason.

---

### Q55. Walk me through `useLiveMatch`.

*Testing: hooks discipline — deps, refs, cleanup.*

Three steps. Fetch the snapshot over HTTP so the score is on screen before any socket exists. Join `match:{id}` and apply every broadcast that passes `isNewerSnapshot`. On reconnect, refetch, because the gap while disconnected is unknowable.

Two details that matter. The latest snapshot is held in a **ref**, not read from state, inside the socket callbacks — because if `snapshot` were a dependency of the subscription effect, the effect would tear down and rebuild the entire socket subscription on *every single ball*. Unsubscribing and resubscribing six times an over is both wasteful and a source of dropped messages in the gap.

And the socket itself is a **module-level singleton**, one per tab. A hook-owned socket would open a connection per mounted component, so a page showing several matches would hold several sockets each with its own handshake, heartbeat and reconnect timer. The singleton also survives route navigation.

The cleanup emits `leave` and removes every listener, which is what keeps the viewer count honest.

**→ If they push: "how does the silent token refresh work, and what about a stampede?"**
A 401 on a request where we *had* a token means it expired mid-session, so `apiFetch` refreshes once and replays the original request — the user never sees a login screen for an expired token. The stampede is handled by a module-level `refreshInFlight` promise: concurrent 401s all `??=` onto the same in-flight refresh and await it, so five parallel requests produce one refresh call rather than five. That's not just efficiency — with rotation, only the first of five would succeed and the other four would burn the family and sign the user out. The loop is prevented by an internal `_retried` flag, and refresh is only attempted when a token existed, so an anonymous 401 doesn't trigger a pointless attempt.

---

### Q56. How did you make the scoring console fast for someone who does this every week?

*Testing: product empathy expressed as engineering decisions.*

One tap per ball for the common case: the run pad is 0 through 6 and commits immediately, with no confirmation step. Extras, wicket and undo are all one reach away rather than behind a menu. Keyboard shortcuts for everything, because a regular scorer often has a laptop.

The crease is inferred by the reducer, so the console only asks who's on strike or bowling when it genuinely changed — after a wicket or at an over boundary. Manual overrides are available and are cleared automatically once a ball is accepted, which is exactly the effect I re-pointed at the displayed sequence so it doesn't wedge offline.

And the whole thing renders optimistically, so network latency is never in the tap-to-feedback path. That's the single biggest perceived-performance decision: at a ground on bad signal, the difference between a console that feels instant and one that feels broken is entirely whether you wait for the server.

**→ If they push: "what about accessibility and theming?"**
Semantic elements and real buttons rather than clickable divs, so keyboard and screen-reader behaviour comes for free; full keyboard operation of the pad; alt text throughout. Theming uses semantic CSS variables rather than Tailwind `dark:` classes, because `dark:` doubles every colour decision at every call site and a third theme would mean touching every component — with tokens, a component says what a thing *is* and the theme layer says what it looks like. It follows the OS by default, a manual choice wins and survives a reload, and it's applied as a `data-theme` attribute on the root before first paint so there's no flash. What I have *not* done, and would need before claiming compliance, is a screen-reader pass on live score updates — they should be in an `aria-live` region so a ball is announced rather than silently mutating the DOM.

---

# ROUND 11 — Testing, operations and debugging

---

### Q57. What do you test, and what do you deliberately not test?

*Testing: whether your coverage is a decision or an accident.*

I test the pure domain exhaustively — 45 tests over the scoring reducer, the fixture generator's pairing guarantees, NRR including the worked bowled-out scenario, and career-stat aggregation. All in `packages/shared`, all running in milliseconds with no database, no mocks, no fixtures.

I don't unit-test Express routes, Prisma calls, or React components.

The rationale: tests are most valuable where behaviour is complex and failure is **quiet**. A wrong NRR looks like a number — nobody notices until a team misses a playoff. A broken route or a broken query fails loudly the first time anyone uses it. So I put the coverage where a bug hides, and that's also exactly the code I made pure, which is not a coincidence — purity is what makes it cheap to test, and cheap tests are the ones that actually get run.

**→ If they push: "give me a test that caught something real."**
The NRR bowled-out case, written so it *fails* against the naive implementation rather than merely exercising the path — it encodes the worked scenario with the hand-computed expected answer, so it proves the rule changes the result. And the over-boundary strike test: an odd run off the last ball of an over must leave the same batsman on strike. That's a double swap, and it's the kind of thing you cannot verify by eye because both wrong answers look plausible on screen.

---

### Q58. You have no API integration tests. Defend that, and tell me what you'd write first.

*Testing: honesty plus a concrete plan.*

Time, honestly — and I'd rather say that than dress it up. What I'd argue is that it was the right *order*: the domain tests cover the logic that's expensive to get wrong, and the cross-system behaviour is covered by a documented manual verification pass rather than by nothing.

That pass exists because the things most likely to be wrong here are cross-system behaviours no unit test reaches. Delete the Redis snapshot and confirm the rebuilt score is identical. Re-post a ball with the same `clientEventId` and confirm a 200 with an unmoved score. Run two API instances, score through one, confirm a viewer on the other updates. Kill the API with the live page open and confirm it resyncs. Each row is a specific action with a specific expected result, repeatable by someone who didn't write the code.

What I'd write first: Testcontainers with real Postgres and Redis, supertest against `createApp()` — which is already possible because `createApp` doesn't listen. Three tests, in order: idempotent re-post; concurrent balls under the lock; cold-cache rebuild equivalence.

**→ If they push: "and the offline queue? That's the least tested and most fragile part."**
Agreed, and it's testable — `fake-indexeddb` for the store, a stubbed `submit`, a mocked `navigator.onLine`. The cases: order preserved across a drain; a failure at item 3 leaves 4–7 pending and stops; a duplicate enqueue is one row; the `online` event triggers exactly one drain. And the property test that matters most: `foldQueuedBalls` must produce the same state the server produces for the same sequence of inputs — which is only testable *because* both sides call the same pure reducer.

---

### Q59. A user says "the score jumped backwards." Debug it.

*Testing: systematic debugging in a distributed system.*

First question: did the *server's* score go backwards, or only the client's? Those are completely different bugs and the log tells you immediately.

Fetch `/public/matches/:slug/snapshot` and compare it against a fold of the event log. If they agree, the log is fine and it's a client ordering bug — which points straight at `isNewerSnapshot`, and specifically at the innings-rollover case, since that's the one place seq comparison alone is insufficient.

If Redis disagrees with the log, it's a snapshot write that lost a race, which points at the `lastEventSeq` guard and its non-atomic read-then-write window.

If the *log itself* is non-monotonic, that's the serious one — it means the lock failed — and I'd look for `P2002`s and 409s clustered around that timestamp.

Three hypotheses, each with a distinct signature in the data. That's the payoff of having one source of truth: "which layer lied" is answerable rather than a guess.

**→ If they push: "and 'my six wasn't counted'?"**
Pull the innings' event log, because it's append-only, so the answer is definitely in there. Three possibilities, each looking different: the ball was never submitted — nothing in the log, so check the client's IndexedDB queue and the ball-write rate limiter; it was submitted and undone — there's an `UNDO` superseding it, with an author and a timestamp; or it was recorded as something else — the ball is there with different runs, which is scorer input error and a `CORRECTION` fixes it. That's precisely the question an append-only log exists to answer, and it's why I'd build the event-log viewer.

---

### Q60. What's your observability story, and what would you add before calling this production-ready?

*Testing: operational maturity.*

Today: Pino structured JSON logs with `pino-http`, health checks excluded from auto-logging or they'd drown the log at a line per second. Match ids, event ids, user ids, durations and error objects are logged. Tokens, OTP codes in production, password hashes and auth request bodies are not.

Errors are uniform by construction: every failure is an `AppError` with a `status`, a machine-readable `code` and a message, so the error middleware has exactly one shape to serialise — `{ error: { code, message, details? } }`. Anything else that escapes a handler is an unexpected bug and becomes a generic 500 with the detail logged and never leaked. `AppError` also carries an `expected` flag defaulting to `status < 500`, so a 404 or a validation failure logs at `info` rather than `error` — otherwise you train yourself to ignore your own error log and an alert on error-level becomes meaningless.

Two health endpoints, because liveness and readiness are different questions. `/health/live` says the process is up and depends on nothing external, or a Redis blip would cause an orchestrator to kill a healthy process. `/health` pings Postgres and Redis and returns **503** when either is unreachable, which is what a load balancer should act on. Conflating them is how you get a cascading restart loop during a dependency outage.

Before production: Sentry with source maps; latency and error-rate percentiles specifically on the ball-write path, since that's the user-visible one; Redis and Postgres connection saturation; socket connection count and reconnect rate, because a rising reconnect rate is the earliest signal of a platform problem; and an alert on standings-recompute failures, which are otherwise silent by construction.

**→ If they push: "what does the client do with the error `code`?"**
Branches on behaviour without string-matching a message. `BAD_REQUEST` means "these are field errors" and `ApiError.fieldErrors` maps them onto form inputs. Domain rules come back as 422 with messages written for a human — "A bowler cannot bowl two overs in a row" — and are shown verbatim, because the scorer is the person who needs to act on them. Messages are for humans and can be reworded; codes are the contract.

---

# ROUND 12 — The hostile round

Where they stop asking what you built and start attacking it. Concede real points fast and precisely; defend the ones you can with a reason.

---

### Q61. What's the weakest part of this codebase?

*Testing: self-assessment. A vague answer is worse than a harsh one.*

The offline queue's failure handling. A semantically rejected ball halts the queue permanently with no way to inspect or discard it; there's no backoff; two tabs can interleave drains; and the failure UI shows an error string rather than the offending ball.

That's the piece where the *design* is right — persist-then-send, idempotent replay, optimistic fold through the shared reducer — and the *implementation* is thin. Everything else in this codebase either does what it claims or documents why it doesn't.

If you gave me one day, that's where it goes: split transport failures from semantic rejections, backoff with jitter on the former, surface the ball and offer edit-or-discard on the latter, and a Web Lock around the drain.

**→ If they push: "what would you rewrite entirely?"**
The player-stats projection. It re-implements the fold — including maiden detection and the supersede semantics — instead of calling `buildState`, so there are two places in this codebase that know what a maiden is. That's exactly the drift I designed the shared reducer to prevent, and I violated it. The reason is that it aggregates across both innings while the reducer is per-innings, which is a shape problem, not a real obstacle. Today the only thing keeping them honest is the exported `BOWLER_CREDITED` set.

---

### Q62. You recompute an entire tournament's points table on every match completion. That's absurd.

*Testing: will you defend a deliberate inefficiency or fold.*

It's O(matches × innings × events) per completion, and I chose it with my eyes open.

Incrementing is O(1) and is **not idempotent**. Replay the event and a team gets four points for one win. And replay is not hypothetical here: the trigger is a domain event, and a correction to a finished match requires republishing it. Recomputing means a replay *converges*, a manually repaired row heals on the next match, and a correction propagates without anyone remembering a second place to update.

The cost is bounded by the domain: 49 matches, ~130 events each, once per completed match — roughly every twenty minutes. I'm paying milliseconds of CPU to buy a whole class of bug out of existence. That's a good trade at this scale and a bad one at 49,000 matches, where I'd scope the recompute to affected teams or go incremental with a periodic full reconciliation to preserve the property.

**→ If they push: "and `fillInningsTotals` queries ball events once per innings. That's an N+1."**
Guilty, and it's the clearest performance defect in the codebase. It should be one `findMany` with `inningsId: { in: [...] }` and a group-by in memory, or better, a single SQL aggregate applying the supersede logic in the query. It hasn't hurt because it runs once per match completion over a bounded set, but "it hasn't hurt yet" isn't a defence — it's a fifteen-minute fix and it should have been done.

---

### Q63. Where does this system actually lose data?

*Testing: can you find your own single point of loss.*

One place, and it's the client: a ball sitting in IndexedDB that never drains because the queue is wedged on a semantic rejection, on a device that then gets cleared or replaced. That's the only path from "the scorer entered it" to "it doesn't exist."

Everywhere else, no. Once a ball reaches Postgres it's in an append-only table with a unique key, never updated and never deleted. Redis holds nothing that isn't derivable. A failed snapshot write degrades a read to a rebuild. A failed publish loses a broadcast, which the next one corrects. Notification *emails* are fire-and-forget and can be lost, but the durable in-app notice is a row written first, precisely so the channel that can fail isn't the channel of record.

**→ If they push: "which comment in this codebase is now a lie?"**
`recordBall`'s docblock, which says step 3 is "transaction — read the log, validate, insert." It isn't a database transaction; it's a read-validate-insert serialised by the Redis lock with a unique constraint as the backstop. The behaviour is defensible, the comment overstates it, and a comment that overstates a guarantee is worse than no comment because the next person will rely on it. It should say "under the lock." That's the kind of thing I'd want caught in review.

---

### Q64. What did you learn?

*Testing: the closing question. Have something real.*

That the decisions that mattered were almost all about **where** something lives, not how it's written.

Making the reducer pure is what let it run in four places and agree by construction. Making Redis strictly derivable is what let me stop reasoning about cache coherence. Making the event bus a seam is what turned a silent serverless-freeze bug into a one-line `await`. None of those are clever code; they're placement decisions, and each one removed a category of bug rather than fixing an instance of one.

The second thing: be much more suspicious of framework defaults. socket.io's polling-first transport and Prisma's binary targets were both "works perfectly locally" bugs that only appeared on a platform — which is the most expensive place to find them, and the reason both are now pinned in config with a comment explaining what happens if you remove them.

---

# RAPID-FIRE FUNDAMENTALS

Short answers. They'll come as follow-ups, not as their own questions.

**Idempotency?** Doing it N times has the same effect as once. By spec GET/PUT/DELETE/HEAD are idempotent; POST isn't. Mine is, via a client-supplied idempotency key with a uniqueness constraint behind it.

**Optimistic vs pessimistic concurrency?** Pessimistic locks first and assumes conflict; optimistic proceeds and detects conflict at write time via a version. I use pessimistic on the ball write (a lock) and optimistic on the snapshot cache (`lastEventSeq` as the version).

**CAP, and where does this sit?** Under partition you choose availability or consistency. CP for writes — a ball fails rather than being accepted possibly-conflicting. AP for reads — viewers get a slightly stale cached snapshot. The offline scorer is AP at the edge, and gets away with it because the merge is trivial: append-only, idempotent, single writer.

**What consistency does a viewer get?** Eventual, with **monotonic reads**. Being 400ms stale is invisible; a score going backwards is alarming, and `isNewerSnapshot` is what prevents it.

**Event sourcing? CQRS?** Event sourcing: state derived by folding an append-only log. I do it for the match domain, not for setup data. CQRS informally: the write model is the log, the read models are the snapshot, `PointsTable` and `PlayerMatchStats`. No event store abstraction, no versioned event schema, no sagas — deliberate scoping.

**What's a projection?** A read model derived from the log. Three here: the Redis snapshot (one innings, shaped for display), `PointsTable` (all completed matches, shaped for standings), `PlayerMatchStats` (one match, shaped per player).

**At-least-once vs exactly-once?** Exactly-once isn't achievable end-to-end across a network; what people mean is at-least-once delivery plus idempotent processing, which is what I have. The socket fan-out is at-most-once and lossy by design, which is fine because every message is a full snapshot.

**ACID, and what's actually atomic here?** Atomicity, Consistency, Isolation, Durability. Genuinely atomic: the standings upsert (one transaction, so no reader sees a half-updated table), the player-stats upsert, refresh-token rotation, the XI replacement, fixture generation. Explicitly not atomic: the Postgres write and the Redis snapshot write.

**What's an index?** A secondary structure — B-tree — turning a scan into a logarithmic lookup, at the cost of write amplification. The ones that matter: `(inningsId, seq)`, which is also a correctness constraint, and `clientEventId` unique, which *is* the idempotency mechanism.

**Connection pooling, and why serverless breaks it?** A pool amortises expensive Postgres connections. Serverless gives each instance its own pool across potentially hundreds of instances, exhausting `max_connections`. Fixed by an external transaction-mode pooler — which then can't do session-level operations, hence `DIRECT_URL` for migrations.

**When is a distributed lock the wrong tool?** When you need a guarantee rather than a coordination hint. No lease prevents a paused holder from acting after expiry unless the resource itself checks a fencing token. Use it to reduce contention; put the real invariant in the resource.

**Give me a race condition from this project.** Two balls concurrently reading `lastEventSeq = 41` and both writing 42 — prevented by the lock, backstopped by the unique constraint. Also: a slow snapshot write landing after a newer one, prevented by the seq guard. Also, not fully closed: two tabs draining the offline queue at once.

**XSS vs CSRF?** XSS is attacker script running in my origin — mitigated by React escaping, helmet, and keeping the token out of `localStorage`. CSRF is a third party causing an authenticated request with ambient credentials — mitigated by `sameSite=strict` and by every other endpoint using an `Authorization` header a cross-site request can't set.

**Authentication vs authorization in your code?** `requireAuth` verifies the JWT and attaches `req.user` — who are you. `requireScorerForMatch` and the ownership checks read from the database — may you do this to *this object*. The second deliberately doesn't live in the token, so revocation is immediate.

**Why is a JWT hard to revoke?** It's self-verifying, so there's no server-side record to delete — it's valid until it expires. Work around it with short expiry, a denylist (which reintroduces the state you were avoiding), or by keeping the long-lived half stateful, which is what I did.

**Backpressure — do you have any?** Very little, and I know where. The socket broadcast has none; socket.io buffers per-socket, so a slow client grows a buffer rather than applying pressure upstream. The offline queue's sequential drain is *accidental* backpressure — it never has more than one request in flight. The fix at scale is dropping intermediate snapshots for a lagging client, which is safe precisely because every message is a full state.

---

## Final check before you walk in

Three things to have ready, because they'll be asked in some form and a hesitant answer costs you more than a wrong one:

1. **A bug you shipped and how you found it.** The cookie path. It's a good story because the failure looked like a server problem and the cause was a spec detail about how browsers match cookie paths.
2. **Something you'd do differently.** The stats projection duplicating the fold, or the offline queue's failure handling. Pick one, say why, say what you'd do.
3. **The thing you're proudest of.** The bus seam, because it's fifty lines that paid for themselves twice — once making the transport disposable, once turning a silent serverless data-loss bug into a one-line `await`.
