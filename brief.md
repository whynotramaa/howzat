# CrickLive — Local Tournament & Live Scoring Platform
## Project Brief / Build Prompt

---

## 1. Project Overview

CrickLive is a real-life, production-grade platform for running local cricket tournaments with live ball-by-ball scoring. It supports **multiple tournaments and multiple matches running concurrently** (including at the same venue), with **public shareable live-score links** requiring no login. Built for real usage, not just a demo — scalability and correctness are priorities over feature count.

---

## 2. Scope & Constraints (Non-Negotiable)

- Multiple tournaments can run in parallel.
- Multiple matches can run concurrently, even at the same stadium — **no venue-clash scheduling logic needed**.
- Match **dates are optional** — fixture generation does not depend on calendar dates.
- **Score entry is mandatory** for every match — no match exists without live scoring capability.
- **Exactly 11 players per team is mandatory** before a team can be scheduled into a fixture.
- Scoring must be **live**: any viewer joining mid-match must immediately see the **current state**, not a replay from ball 1.
- Fixture generation must be **IPL-style round-robin** (circle method) — **no brute-force / backtracking scheduling**.
- **No Docker** for this phase — deploy directly.
- **Redis required** for real-time updates and horizontal scalability.

---

## 3. Modules

### A. User & Role Management
- Roles: **Organizer**, **Scorer**, **Public Viewer** (no auth).
- JWT-based auth for Organizer/Scorer; OTP/email signup.
- Organizer assigns Scorer(s) to specific matches — a scorer can only submit balls for matches they're assigned to (match-level authorization, not just role-level).
- Middleware validates role + match-assignment per protected route.

### B. Tournament & Team Setup
- Organizer creates tournament: name, format (league / knockout / league+playoffs), team count.
- Add teams and players (role: batsman/bowler/all-rounder/keeper).
- **Validation gate**: a team is not eligible for fixture generation until it has exactly 11 players assigned.

### C. Fixture Generator — Round Robin (Circle Method)
- Standard circle method: fix one team, rotate the rest → generates n-1 rounds for n teams (add a "bye" if n is odd).
- Double round-robin (home/away) = repeat rotation reversed, if format requires it.
- Deterministic, O(n²), **always succeeds** — no constraint solving, no backtracking.
- No venue or date assigned by the algorithm — matches are ordered as Round 1, Round 2, etc. Date is an optional free field the organizer can fill in independently, anytime.
- Knockout stage (if applicable): standard bracket, seeded by league standings (IPL-style Qualifier1 / Eliminator / Qualifier2 / Final).

### D. Live Scoring Engine
- Scorer submits ball-by-ball events: runs, extras, wicket, over completion.
- Each ball = one **immutable, append-only event** in `ball_events` (event-sourcing pattern) — source of truth.
- **Idempotency**: client generates a UUID per ball event; unique constraint on server prevents duplicate submission on retry/reconnect.
- **Corrections/undo**: never delete an event — append a compensating `correction` event. Preserves full audit trail.
- On every valid ball event: current match state is recomputed and written to a **Redis snapshot** (`match:{id}` key) atomically alongside the Postgres write.

### E. Shareable Live Link (Mid-Match Join — Correctly Solved)
- Public URL per match, no login required.
- **On page load**: client calls `GET /match/:id/snapshot` → reads current state instantly from Redis (score, over, batsmen, bowler, recent balls, run rate).
- **Then**: client subscribes via Socket.io to `match:{id}` room for live deltas going forward.
- This two-step (snapshot-first, then subscribe) is what guarantees a viewer joining mid-match sees current state immediately, not a replay from zero.

### F. Real-Time Architecture & Scaling (Redis)
Redis is used for three distinct purposes:
1. **Snapshot cache** — fast reads of current match state without recomputing from the full event log every request.
2. **Pub/Sub via Socket.io Redis Adapter** — keeps multiple backend instances in sync, enabling horizontal scaling (essential since many matches can run concurrently).
3. **Per-match lock (optional)** — prevents race conditions if two write attempts hit the same match simultaneously.

### G. Points Table + NRR Engine
- Recalculated on **match-completion event only** (event-triggered, not cron/polling).
- NRR formula: `(Total Runs Scored / Total Overs Faced) − (Total Runs Conceded / Total Overs Bowled)`, aggregated across all matches in the tournament.
- **Edge case handled explicitly**: if a team is bowled out before completing its full quota of overs, overs faced/bowled = the **full allotted quota**, not actual balls faced. This is a common bug source and must be implemented correctly.

### H. Qualification Scenario Engine (Stretch)
- "Team X qualifies if Team Y loses by >20 runs" style scenarios.
- Simulates only the remaining fixtures that **affect the target team's position** (pruned scope), not full brute-force permutation of all remaining matches.
- Bounded: if remaining relevant matches exceed a defined threshold, return a "too complex to compute" response rather than blowing up combinatorially.

### I. Stats Dashboard
- Orange cap (top run-scorer), purple cap (top wicket-taker), per-player stats.
- Aggregate queries over `ball_events`, grouped by player.

### J. Validation Layer
- Ball event validator rejects illegal states before commit: e.g., more than 6 legal balls in an over, runs recorded on a dead ball, negative/impossible over counts.

---

## 4. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Tailwind |
| Backend | Node.js + Express |
| Primary DB | PostgreSQL |
| Cache / Real-time | Redis (Pub/Sub + snapshot cache) |
| Real-time transport | Socket.io (with Redis Adapter) |
| Auth | JWT + OTP |
| Deployment | Direct deploy — Render / Railway / Fly.io (no Docker this phase) |
| CI/CD | GitHub Actions |

---

## 5. Data Model

```
tournaments (id, name, format, teams_count)

teams (id, tournament_id, name)

players (id, team_id, name, role)

scorer_assignments (match_id, scorer_id)   -- match-level authorization

matches (id, tournament_id, round, team1_id, team2_id, date NULLABLE, status)

ball_events (
  id, match_id, client_event_id UNIQUE,   -- idempotency
  over, ball, runs, extras, wicket,
  striker_id, bowler_id,
  event_type,                              -- normal | correction
  created_at
)

-- match_snapshot: Redis key "match:{id}" → JSON blob
--   { score, wickets, over, ball, batsmen, bowler, recent_balls[], run_rate }
--   NOT a Postgres table — lives in Redis for fast reads

points_table (tournament_id, team_id, played, won, lost, points, nrr)
  -- recalculated on match-completion event
```

---

## 6. Build Order

1. Auth + tournament/team/player CRUD, with 11-player validation gate.
2. Round-robin fixture generator (circle method) + knockout bracket.
3. Ball-by-ball scoring backend: validation, idempotency, Redis snapshot write (no UI yet).
4. Redis Pub/Sub + Socket.io Redis Adapter + snapshot-fetch-then-subscribe public live page.
5. Points table + NRR engine (event-triggered, correct bowled-out edge case).
6. Stats dashboard.
7. Deploy (Render/Railway + managed Redis add-on).
8. (Stretch) Qualification scenario engine — bounded/pruned simulation.

---

## 7. Design Principles to Maintain Throughout

- **Event-sourcing integrity**: `ball_events` is append-only; corrections are new events, never deletions.
- **Snapshot-first reads**: any "current state" read (live page, stats) should prefer Redis snapshot over recomputing from full event log where possible.
- **No assumptions the scope doesn't require**: do not add venue-clash or date-conflict logic — explicitly out of scope.
- **Horizontal scalability by default**: assume multiple concurrent matches/instances from day one; Redis Adapter is not optional.
- **Correctness over cleverness** in NRR and points calculations — these are the most bug-prone areas.
