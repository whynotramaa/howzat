import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '@/components/Wordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  Callout,
  Chapter,
  ChapterProvider,
  ChapterSheet,
  Law,
  Minimap,
  Note,
  SketchDefs,
  type ChapterEntry,
} from './chrome';
import { DataFlowLab, LedgerLab, SystemMap, TruthTable, WritePathLab } from './diagrams-core';
import {
  IdempotencyLab,
  LockLab,
  RedisKeyspace,
  SnapshotGuardLab,
} from './diagrams-concurrency';
import { CacheMap, StandingsLab } from './diagrams-tournament';
import {
  AuthLab,
  FanoutChart,
  FanoutLab,
  FreezeLab,
  HandshakeLab,
  OutboxLab,
  SnapshotGateLab,
  StrikeLab,
} from './diagrams-edge';
import './engineering.css';

export function EngineeringPage() {
  const [chapters, setChapters] = useState<{ entries: ChapterEntry[]; activeId: string }>({
    entries: [],
    activeId: '',
  });

  const onChange = useCallback((entries: ChapterEntry[], activeId: string) => {
    setChapters({ entries, activeId });
  }, []);

  return (
    <div className="eng-paper min-h-dvh">
      <SketchDefs />

      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--surface)_86%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-8">
          <Link to="/" className="shrink-0">
            <Wordmark />
          </Link>
          <span className="hidden text-[0.8125rem] text-muted sm:inline">Engineering</span>
          <span className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
          </span>
        </div>
      </header>

      <ChapterProvider onChange={onChange}>
        <Minimap entries={chapters.entries} activeId={chapters.activeId} />
        <ChapterSheet entries={chapters.entries} activeId={chapters.activeId} />

        <main className="mx-auto w-full max-w-[44rem] px-5 pb-24 sm:px-8 sm:pb-32">
          <Preface />

          {/* ============================================================ */}

          <Chapter
            id="ch-shape"
            num="01"
            title="The shape of the system"
            standfirst="Five boxes and two datastores. Before any of the detail is useful, you need to know which box holds the truth and which boxes are allowed to be wrong."
          >
            <p>
              Howzat is a live scoring app for club and street cricket. Three people use it. An
              organizer sets up a tournament and assigns scorers. A scorer records one match, ball by
              ball. A spectator opens a link and follows the score without an account and without an
              app install.
            </p>
            <p>
              That third person shapes the architecture more than the other two. The people who want
              the score are a parent at work or a teammate on a bus, and any friction between them
              and the number loses them. So the public surface takes identity out of the picture
              entirely: a random unguessable slug, its own no-auth router with a hand-picked response
              shape, and a WebSocket that carries the score without asking who is watching.
            </p>
            <p>
              Removing identity removes the thing most systems lean on for safety. The design has to
              be safe by construction instead. The socket is read-only, so there is nothing to
              authorize. The public router cannot leak organizer data because it never queries it.
              Discovery is prevented by about 49 bits of entropy in the slug rather than by a
              permission check.
            </p>

            <SystemMap />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Three sentences that explain most of it</h3>
            <p>
              An append-only event log in Postgres is the source of truth. A derived snapshot in
              Redis is the read cache. A socket fan-out pushes updates. Scoring happens over HTTP,
              never over the WebSocket. Everything that is not the log can be deleted and rebuilt by
              folding the log again.
            </p>
            <Note>
              If you remember one thing from this page: writes are HTTP, sockets are a read-only
              fan-out. That single split is what makes the realtime layer disposable.
            </Note>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-log"
            num="02"
            title="The event log is the only truth"
            standfirst="One score has to be consistent across Postgres, a Redis snapshot, the scorer's optimistic screen, every viewer screen, and the points table. When those disagree, the first problem is not fixing the number. It is knowing which version to trust."
          >
            <p>
              The answer is to make exactly one of them the truth and every other one a pure function
              of it. <code>BallEvent</code> is append-only and authoritative.{' '}
              <code>buildState</code> is a pure fold with no I/O, no <code>Date.now()</code>, and no
              randomness. Once that holds, the other five views stop being five implementations that
              must be kept in agreement. They are five callers of one function, agreeing by
              construction.
            </p>

            <LedgerLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What purity buys, concretely</h3>
            <p>
              The client renders an optimistic score by folding queued balls with the identical
              function the server will use, so the optimistic view is not an approximation. It is the
              same answer, early. A cold Redis becomes a latency problem and never a correctness one,
              which is why the snapshot can sit behind a TTL and stop being something anyone reasons
              about. And the whole domain tests in milliseconds with no database, which is why 45
              tests cover the part of the system where a bug would otherwise be silent.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Corrections are appends, not edits</h3>
            <p>
              A bad ball is expensive to live with when nothing can be edited. That is exactly why
              validation is aggressive and runs before anything is written. It is cheaper to refuse a
              ball than to live with it.
            </p>
            <p>
              Two event types repair a mistake, and both are appends. A <code>CORRECTION</code>{' '}
              carries replacement data and names the ball it supersedes. An <code>UNDO</code> names a
              ball and removes it. Nothing is deleted, so{' '}
              <code>GET /matches/:id/events</code> still shows the ball and its retraction. That is
              what you want when two people at a ground disagree, because the answer is "the scorer
              entered a six at 16:42 and undid it at 16:42". An undo carries its own{' '}
              <code>clientEventId</code>, so it is idempotent for free.
            </p>

            <Callout kind="trap" title="A correction is an instruction, not a delivery">
              <p>
                Corrections land at a later <code>seq</code>, so folding the log in raw order would
                put the fix at the end of the over instead of where the ball was bowled. Before the
                fold, <code>materializeEvents</code> walks the log in sequence order, resolves
                corrections and undos, and produces the effective list of deliveries. The replacement
                goes back in the original ball's position, and it keeps the original's{' '}
                <code>overNumber</code> and <code>ballNumber</code>, because those describe where in
                the innings the delivery happened. That is a fact about the past, and a correction is
                not allowed to move it. Everything else comes from the correction.
              </p>
            </Callout>

            <p>
              The result answers two different questions at once. The ticker reads in the order the
              balls were actually bowled. The log still records when the fix was made.
            </p>

            <Callout kind="gap" title="The supersede rule is implemented three times">
              <p>
                It lives in the reducer, in the standings' <code>fillInningsTotals</code>, and in the
                player-stats projection. The reducer is the reference implementation and the other
                two re-derive the same semantics because they aggregate over different shapes. That
                is the sharpest duplication in the codebase. The fix is for the stats projection to
                consume <code>buildState</code>, and the honest reason it does not is that it
                aggregates across both innings while the reducer is per innings. A shape problem, not
                a real obstacle. Until then the only thing keeping them honest is the exported{' '}
                <code>BOWLER_CREDITED</code> set.
              </p>
            </Callout>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-schema"
            num="03"
            title="The schema, sorted by who is allowed to lie"
            standfirst="Four clusters: identity, tournament setup, the match and its innings, and the read-side projections. The line that matters runs between the third and the fourth."
          >
            <TruthTable />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Recompute, never increment</h3>
            <p>
              Incrementing is not idempotent. Replay the event and a team gets four points for one
              win. Replay is not hypothetical here, because the trigger is a domain event and a
              correction to a finished match needs that event republished. Recomputing means a replay
              converges instead of double-counting, a manually repaired row heals on the next match,
              and a correction propagates without anyone remembering a second place to update. That
              is a whole class of bug bought out of existence for a few milliseconds of CPU.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">There is no role column on User</h3>
            <p>
              Someone can organize their own tournament and still be a scorer in someone else's
              match, so role is not a property of a person. It comes from a relationship. Tournament
              ownership makes someone an organizer. A <code>ScorerAssignment</code> makes them a
              scorer for one match.
            </p>
            <p>
              That runs all the way through authorization. There is no <code>requireRole</code>{' '}
              middleware anywhere in this codebase. Every authorization question is about a specific
              object: do you own this tournament, do you own this match's tournament, or do you hold
              an assignment for it. A coarse "is an organizer" gate would be either redundant with
              the object-level check or actively wrong.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">
              User, Player, and MatchPlayer are three tables for one person
            </h3>
            <p>
              <code>User</code> is the login account. <code>Player</code> is a person in a tournament
              squad and can exist without an account. <code>MatchPlayer</code> is the eleven selected
              for one match.
            </p>
            <p>
              Collapse any two and something real is lost. Without <code>Player</code> there is no
              squad member who lacks an account, which is the common case in club cricket. Those get
              a generated <code>guest_…</code> username so the UI has something stable and the scorer
              has something unambiguous to tap. Without <code>MatchPlayer</code> a squad cannot be
              larger than eleven and cannot field a different eleven next week, which is every real
              team.
            </p>
            <p>
              A guest gets no career profile. A career profile is the sum of{' '}
              <code>PlayerMatchStats</code> across every <code>Player</code> slot linked to an
              account, and a guest slot has no <code>userId</code>. Retro-linking a guest to an
              account later is an identity claim with no way to verify it, so if that person signs up
              their history starts from the squads they join afterwards. Inventing identity is worse
              than starting fresh.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What is denormalised, and why</h3>
            <p>
              Every <code>BallEvent</code> carries <code>strikerId</code>,{' '}
              <code>nonStrikerId</code>, and <code>bowlerId</code>. That is what keeps the reducer
              simple: the event names its own participants, so the reducer never infers who came in
              after a wicket or who is bowling this over. The scorer already declared it and the log
              describes itself in isolation. If the reducer inferred it, a correction mid-innings
              would silently change who was on strike for every ball after it. Three cuids per row is
              cheap for that.
            </p>
            <p>
              <code>Innings.oversQuota</code> is copied from the tournament at innings creation. If
              an organizer edits the tournament after a match, every finished innings' net run rate
              would otherwise move. <code>Player.username</code> is copied from <code>User</code> so
              the scoring console never joins on a hot path.
            </p>

            <Callout kind="why" title="PointsTable stores balls, not overs">
              <p>
                Decimal overs are a lie. 98 balls is 16.333… overs for arithmetic and "16.2" for
                display, and "16.2" parses as a perfectly valid float. Every wrong implementation
                compiles, runs, and is quietly off by a few percent in net run rate. The table sums
                balls, which are exact integers, and converts once at read time. Same reason{' '}
                <code>formatOvers</code> returns a string and <code>ballsToOvers</code> returns a
                number: two different types make the mistake unrepresentable.
              </p>
            </Callout>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">A notification is a stored row</h3>
            <p>
              A notification records something that happened, not what is true now. If someone was
              added to a squad and later removed, a query over the current squad loses the fact that
              they were notified. The copy is frozen at write time, because a notification that
              re-renders from live data can quietly start saying something the recipient was never
              sent. The context columns <code>tournamentId</code>, <code>teamId</code>, and{' '}
              <code>matchId</code> are nullable and deliberately not foreign-key constrained, so
              deleting a tournament does not delete the notice that you were once added to it.
            </p>
            <p>
              Delivery uses two channels and one write path. The row is durable and is what the bell
              reads. The email is a nudge on top, detached with{' '}
              <code>Promise.allSettled</code> after the row is written, because waiting on an SMTP
              round-trip per player puts a mail provider on the critical path of a database write. An
              organizer pasting eleven names must not get a 500 because Resend is having a bad
              afternoon.
            </p>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-write"
            num="04"
            title="One tap, end to end"
            standfirst="A scorer taps 4. Fifteen steps later a spectator two networks away sees it. This is the path everything else in the system exists to protect."
          >
            <p>
              On the client, the tap runs through the same <code>validateBall</code> the server runs.
              The console creates a UUID as <code>clientEventId</code>, saves the ball to IndexedDB
              first, then POSTs it if the device is online. The screen updates optimistically, so the
              scorer gets instant feedback even when the connection at the ground is slow.
            </p>

            <WritePathLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">
              Follow one ball through every store it touches
            </h3>
            <p>
              The swimlane above shows the order of operations. It does not show where the ball
              physically <em>is</em> at each moment, which is the thing that actually explains the
              design. Step through the next figure and watch four stores disagree, on purpose, and
              then converge.
            </p>

            <DataFlowLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">
              The two identifiers, and why they belong to different machines
            </h3>
            <p>
              A ball carries two identities and neither one can do the other's job.
            </p>
            <p>
              <strong>clientEventId</strong> is a UUID the phone generates before the first attempt,
              and it never changes across retries. Only the client knows that four requests are the
              same tap, so only the client can say so. It is also the IndexedDB key, which makes the
              outbox itself idempotent, and it is the column Postgres holds unique, which makes the
              write idempotent. The same string does both jobs, with no mapping in between to get
              wrong.
            </p>
            <p>
              <strong>seq</strong> is the position of the event inside its innings, and Postgres
              assigns it under the lock as <code>lastEventSeq + 1</code>. The phone cannot assign it,
              because the phone does not know what the server accepted while it was offline. Two
              devices would both guess 42 and one would be wrong.
            </p>
            <p>
              Follow <code>lastEventSeq</code> through the figure and you have most of the
              consistency model. It does not exist on the phone. Postgres mints it. The projection
              step copies it into the Redis snapshot, which is what lets{' '}
              <code>writeSnapshot</code> refuse a stale write. It rides the broadcast, which is what
              lets <code>isNewerSnapshot</code> refuse a stale render. And when a client's copy is
              more than one behind, <code>hasSequenceGap</code> gives up on patching and refetches.
              One integer, minted in one place, doing version control for the entire read side.
            </p>

            <Note>
              Every layer downstream of Postgres is allowed to be behind. None of them is allowed to
              go backwards. That distinction is the whole job of lastEventSeq.
            </Note>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">
              Which steps are allowed to fail without failing the ball
            </h3>
            <p>
              Everything after the Postgres insert. The snapshot write is wrapped in a try/catch that
              logs and continues, because Postgres already holds the ball and a cache failure should
              degrade the next read to a rebuild rather than fail a write that succeeded. The publish
              is caught inside <code>publishMatchEvent</code>, because a transport failure must never
              fail a durable write. The rate limiter fails open. Only auth, validation, and the
              insert itself can legitimately fail the request.
            </p>
            <Note>
              Fail open when a guard is about cost. Fail closed when it is about correctness. The
              rate limiter is about cost, so a Redis outage must not make a live match unscorable.
            </Note>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Rate limits, with real numbers</h3>
            <p>
              Ball writes are capped at 120 per minute per scorer per match. That is deliberately
              generous, because a fast over is six balls in under a minute and a draining offline
              queue is bursty, so the limit catches a runaway client rather than a busy one. OTP
              requests are 5 per hour per email and 30 per hour per IP, with the IP limit looser on
              purpose so shared ground wifi does not lock out a whole team.{' '}
              <code>incrementWindow</code> pipelines <code>INCR</code> and <code>TTL</code> in a{' '}
              <code>MULTI</code>, so it is one round trip and the 429 carries a truthful{' '}
              <code>Retry-After</code> instead of a guess.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">When the innings ends</h3>
            <p>
              The reducer checks three conditions in this order: target chased, all out, overs
              complete. Wickets allowed is <code>battingXI.length - 1</code>, so ten for a full
              eleven and correct for a short side rather than hard-coded.
            </p>
            <p>
              The order is not cosmetic. The last ball can satisfy two conditions at once, when the
              winning run is scored and the non-striker is run out completing it. That match is won.
              It is not an all-out innings. <code>endReason</code> feeds the net run rate
              calculation, so getting the order backwards charges the winning side its full quota of
              overs and corrupts their net run rate for the whole tournament.
            </p>
            <p>
              <code>closeInnings</code> runs inside the scoring lock, so no other ball lands
              mid-decision. It marks the innings complete with its <code>endReason</code>, then
              branches. After innings one it creates innings two with{' '}
              <code>targetRuns = runs + 1</code> and moves the match to <code>INNINGS_BREAK</code>.
              After innings two it calls <code>completeMatch</code>, which writes the winner and the
              result text and publishes <code>match:completed</code>. That event is the only trigger
              for the points table and every player's career stats. No cron, no polling.
            </p>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-lock"
            num="05"
            title="The lock reduces contention. The database guarantees correctness."
            standfirst="Never let a lock be your only defence. This chapter is the argument for that sentence, and the bench below is where you can break it yourself."
          >
            <h3 className="serif text-[1.5rem] text-primary">The exact race</h3>
            <p>
              Two requests arrive together when the last sequence is 41. Both read 41, both validate
              against the same old state, and both try to insert sequence 42.
            </p>
            <p>
              The collision is the obvious harm. The subtler harm is worse. Before either insert
              lands, both requests validated against a state that does not include the other's ball.
              So a ball that should have been rejected as the seventh delivery of an over gets
              accepted, because the over looked incomplete to both of them.
            </p>
            <p>
              The realistic trigger is not two scorers. It is one scorer's phone retrying a request
              that was still in flight, which is the normal condition on bad signal at a ground.
            </p>

            <LockLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Why the release needs a script</h3>
            <p>
              <code>SET key token NX PX 5000</code> gives atomic mutual exclusion with automatic
              expiry, so a crashed holder cannot deadlock the match. A ball write holds the lock for
              single-digit milliseconds, so a 5-second lease is three orders of magnitude of headroom.
            </p>
            <p>
              The random token exists because a plain <code>DEL</code> on release is dangerous. If my
              lease already expired and someone else acquired the lock, my <code>DEL</code> deletes
              their lock, and now two writers each believe they are exclusive. The Lua script makes
              "check that it is mine, then delete" one atomic operation. On failure the acquire backs
              off across 20 attempts over about 1.5 seconds and then returns a 409, which is honest
              and retryable.
            </p>

            <Callout kind="why" title="A single-node Redis lease is not a formal guarantee">
              <p>
                It has no fencing token, and a paused holder can outlive its lease. I would not
                pretend otherwise. So the lock is a contention optimiser and the correctness lives in
                Postgres. <code>@@unique([inningsId, seq])</code> makes two balls at the same position
                physically impossible to persist. <code>clientEventId</code> being unique turns a
                duplicate submission into a constraint violation that the service catches and
                converts into an idempotent success.
              </p>
              <p className="mt-2">
                The pathological case a fencing token would prevent surfaces one layer down as a{' '}
                <code>P2002</code> on a retryable request, not as a corrupted innings. Designing it
                the other way round, with the lock as the guarantee, is where distributed locks hurt
                people.
              </p>
            </Callout>

            <Callout kind="gap" title="One comment in the codebase overstates a guarantee">
              <p>
                <code>recordBall</code>'s docblock says step 3 is "transaction: read the log,
                validate, insert". It is not a database transaction. It is a read-validate-insert
                serialised by the Redis lock with a unique constraint as the backstop. The behaviour
                is defensible and the comment is not, because the next person will rely on it. It
                should say "under the lock".
              </p>
              <p className="mt-2">
                Putting the guarantee entirely in Postgres is the arguably better design:{' '}
                <code>SELECT … FOR UPDATE</code> on the innings row inside a transaction, and drop
                Redis from that path. What I would defend is having both a serialiser and a
                constraint. What I would not defend is having neither.
              </p>
            </Callout>

            <Callout kind="gap" title="Two scorers on one match is a real gap, not a mitigated one">
              <p>
                The lock serialises them, so the log stays structurally valid with monotonic sequence
                numbers and no collisions. But both are entering their own view of the same over, so
                you get double-scored balls. <code>clientEventId</code> does not help at all, because
                two people scoring the same six generate two different UUIDs. Idempotency
                deduplicates retries, not observations.
              </p>
              <p className="mt-2">
                The product assumes one scorer per match. I enforced authorization, meaning who may
                score, without enforcing exclusivity, meaning who is scoring right now. The fix is a
                single-writer claim: a Redis key holding the current scorer with a heartbeat TTL, an
                explicit handover when a phone dies, and the console showing "Peehu is currently
                scoring" with a take-over button. The log already records <code>createdBy</code> per
                ball, so a contested handover is auditable afterwards.
              </p>
            </Callout>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-idempotency"
            num="06"
            title="Idempotency is a contract, not a server trick"
            standfirst="Only the client knows that several requests represent the same tap. That is why the key comes from the client and the uniqueness comes from the database."
          >
            <p>
              The client creates a UUID as <code>clientEventId</code> before the first attempt and
              keeps it for every retry. The server has two nets. The common path is a lookup on{' '}
              <code>clientEventId</code>, and a hit short-circuits and returns the current snapshot.
              The second net catches <code>P2002</code> on the insert, because two requests carrying
              the same id can both pass the lookup before either commits.
            </p>
            <p>
              Both nets are load-bearing. The lookup alone is a 500 under concurrency. The catch
              alone turns every ordinary duplicate into an exception.
            </p>

            <IdempotencyLab />

            <p>
              A new ball returns 201 and a duplicate returns 200, with identical bodies. The status
              distinction is useful in logs and metrics. The identical body is deliberate: a client
              replaying its offline queue must not be able to tell the difference, because a
              different duplicate response means every consumer needs a branch for it and one of them
              eventually gets it wrong.
            </p>

            <Callout kind="why" title="POST is not idempotent by spec, and that is fine">
              <p>
                By spec, GET, PUT, DELETE, and HEAD are idempotent and POST is not. This POST is made
                idempotent by an application-level idempotency key with a uniqueness constraint
                behind it, which is the standard pattern for making an unsafe method safe to retry.
                Stripe does the same thing with <code>Idempotency-Key</code>. PUT was not an option,
                because the client does not choose the resource's location. <code>seq</code> is
                server-assigned, so POST is honest about who owns the URL.
              </p>
            </Callout>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What seq guarantees</h3>
            <p>
              <code>seq</code> is the server-assigned position of an event within an innings. Under
              the lock, the next event gets <code>lastEventSeq + 1</code>, so it is monotonic and
              gap-free. It is per innings because that is the unit the reducer processes.
            </p>
            <p>
              It carries three jobs. <code>@@unique([inningsId, seq])</code> is a correctness
              constraint and the backstop if the lock ever fails. On the client,{' '}
              <code>isNewerSnapshot</code> compares it to discard an out-of-order broadcast, so a
              delayed message cannot visibly rewind a viewer's score. And{' '}
              <code>hasSequenceGap</code> detects that more than one event was missed and triggers a
              refetch.
            </p>
            <p>
              A new innings restarts the sequence at 1. That is exactly why{' '}
              <code>isNewerSnapshot</code> compares <code>inningsNumber</code> before it compares{' '}
              <code>seq</code>. Chapter 12 has the bench where you can watch a naive comparison
              reject an entire second innings as stale.
            </p>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-redis"
            num="07"
            title="Redis, from first principles"
            standfirst="Four jobs, four data types, one test applied to each: if Redis disappeared, would I lose correctness, or would the system just get slower?"
          >
            <h3 className="serif text-[1.5rem] text-primary">The parts of Redis this system uses</h3>
            <p>
              Redis is a single-threaded, in-memory key-value store. Single-threaded matters more
              than it sounds: every command runs to completion before the next one starts, so a
              command like <code>SET … NX</code> is atomic without any locking of your own. That
              property is the foundation of everything below.
            </p>
            <ul className="flex flex-col gap-3 text-secondary">
              <li>
                <strong>Strings with expiry.</strong> <code>SET key value PX 5000</code> stores a
                value that Redis deletes on its own after five seconds. The snapshot cache, the
                authorization cache, and the lock are all strings with a TTL.
              </li>
              <li>
                <strong>SET with NX.</strong> "Set this only if the key does not exist," decided
                inside one command. Two callers race, one gets <code>OK</code>, the other gets{' '}
                <code>nil</code>. That is the whole lock.
              </li>
              <li>
                <strong>Counters.</strong> <code>INCR</code> creates the key at 1 or adds 1 to it,
                atomically. A fixed-window rate limiter is <code>INCR</code> plus a TTL on first
                write.
              </li>
              <li>
                <strong>Sorted sets.</strong> A set where every member carries a numeric score, kept
                in score order. Viewer counting uses socket ids scored by join time, so{' '}
                <code>ZREMRANGEBYSCORE</code> prunes anything older than fifteen minutes and{' '}
                <code>ZCARD</code> reads the count.
              </li>
              <li>
                <strong>Publish and subscribe.</strong> A message published to a channel is delivered
                to every currently subscribed connection, and to nobody afterwards. No durability, no
                replay. That is acceptable here because every message is a full snapshot and the next
                one repairs anything missed.
              </li>
              <li>
                <strong>Lua scripts.</strong> <code>EVAL</code> runs a script atomically on the
                server. Used once, for compare-and-delete on lock release.
              </li>
            </ul>

            <RedisKeyspace />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Two caching patterns, not a scattering of TTLs</h3>
            <p>
              Where a write path can refresh a value, the write path owns it. The snapshot is written
              by the ball write and the authorization cache is invalidated by an assignment change,
              with a <code>SCAN</code> over that match's authz keys the moment an assignment moves.
              Where there is no clean write path, the value is read-through with a TTL and allowed to
              be a few seconds stale. The TTL is the backstop, never the mechanism.
            </p>

            <Callout kind="trap" title="The adapter needs its own connections">
              <p>
                A Redis connection in subscriber mode is blocked on <code>SUBSCRIBE</code> and cannot
                issue ordinary commands. The socket.io adapter therefore gets two dedicated
                connections, separate from the general-purpose client. Share them and you get a
                client that intermittently refuses commands, which is a horrible bug to diagnose.
              </p>
            </Callout>

            <Callout kind="trap" title="Serverless leaks Redis connections unless you cache the client">
              <p>
                A reused warm instance must not open a new connection per invocation, or it leaks one
                per request until the provider's concurrent-connection cap cuts it off. The client is
                cached on <code>globalThis</code> for that reason. <code>lazyConnect</code> means a
                cold start does not open three TCP connections before it knows whether the request
                that woke it up needs Redis at all.
              </p>
            </Callout>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-dualwrite"
            num="08"
            title="Postgres and Redis are not written atomically"
            standfirst="There is no distributed transaction between them, and there is no attempt to pretend there is. The design makes the gap harmless instead."
          >
            <p>
              Postgres holds the truth. Redis holds a projection derivable from it. Every read goes
              through <code>getSnapshot</code>, which falls back to a rebuild on a miss, so a crash
              between the two writes costs a stale or missing snapshot that self-heals on the next
              read.
            </p>
            <p>
              The ordering is load-bearing. Postgres first, always. The opposite order lets the cache
              advertise a ball that is not durable.
            </p>

            <SnapshotGuardLab />

            <p>
              <code>writeSnapshot</code> reads the cached snapshot first and skips the write if the
              cached <code>lastEventSeq</code> is higher than the incoming one. That is optimistic
              concurrency with <code>lastEventSeq</code> as the version.
            </p>

            <Callout kind="gap" title="The read-then-write is not atomic either">
              <p>
                There is a residual window. The lock makes it narrow, since both writes for one match
                are serialised, but narrow is not closed. The fully correct version is a Lua
                compare-and-set that reads the stored seq and writes only if the incoming one is
                higher, in one script. Roughly eight lines, and worth taking. Stating the remaining
                gap precisely beats claiming the guard closes it.
              </p>
            </Callout>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-cache"
            num="09"
            title="Seven caches, none of them load-bearing"
            standfirst="A cache is a promise to be fast and a risk of being wrong. The only way to take the first without the second is to make sure every cached value can be thrown away and recomputed from the log."
          >
            <p>
              There is one rule behind every entry below. Nothing lives in Redis that Postgres
              cannot regenerate. Not a counter that only exists in memory, not a queue whose loss
              drops a write, not a session that logs everyone out when it evaporates. Follow that
              rule and a Redis outage is a latency incident, not a data incident, which is why every
              call site here is allowed to swallow its own error and carry on.
            </p>

            <CacheMap />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">
              Two patterns, chosen by whether a write path exists
            </h3>
            <p>
              <strong>Write-owned.</strong> Something in the system knows the exact moment the value
              changed, so that something refreshes or deletes the key. The snapshot is rewritten by
              the ball write. The standings and stats keys are deleted when a match completes. The
              authorization cache is deleted by a <code>SCAN</code> over{' '}
              <code>authz:match:{'{id}'}:user:*</code> when an assignment moves. The TTL on these
              keys is a backstop against a missed invalidation, never the mechanism.
            </p>
            <p>
              <strong>Read-through with a TTL.</strong> Where no write path can name the moment of
              change, the reader fills the key and accepts a few seconds of staleness.{' '}
              <code>getStandings</code> and <code>getTournamentStats</code> both work this way, and
              both also get an explicit delete on completion, so the TTL only covers the case the
              delete missed.
            </p>
            <Note>
              A TTL is not an invalidation strategy. It is what you fall back on when your
              invalidation strategy has a hole in it, and its length is a statement about how long
              you are willing to be wrong.
            </Note>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">
              Why the TTLs are the numbers they are
            </h3>
            <p>
              Sixty seconds on stats and authorization, five minutes on standings, six hours on a
              snapshot, twenty-four on a slug. The pattern is not arbitrary: the TTL tracks how
              wrong the value can get between the event that changes it and the delete that clears
              it. A slug never changes owner, so it can sit for a day. A snapshot is rewritten on
              every ball, so its TTL only matters for a match nobody has scored in six hours, which
              is a finished match. An authorization decision changes the moment an organizer
              reassigns a scorer, and a stale <code>0</code> locks a scorer out of a live match, so
              that one is short and also explicitly invalidated.
            </p>

            <Callout kind="why" title="Why the snapshot is a whole document, not a set of fields">
              <p>
                A hash of fields would let two writers update different parts of the same match and
                produce a scorecard that never existed. One JSON string per match means the value is
                always a coherent fold of the log at a known <code>lastEventSeq</code>, which is
                also what makes the stale-write guard a single integer comparison.
              </p>
            </Callout>

            <Callout kind="gap" title="A cold key under load is a stampede">
              <p>
                Nothing does single-flight. If a popular tournament's standings key expires while
                twenty people are refreshing, twenty requests all miss, all rebuild, and all write
                the same value back. The rebuild is a handful of queries, so the blast radius today
                is small, but the fix is standard and cheap: a short lock around the rebuild, or a
                stale-while-revalidate read that serves the old value while one caller refreshes.
              </p>
            </Callout>

            <Callout kind="trap" title="The slug cache is never invalidated, and that is a decision">
              <p>
                <code>slug:{'{publicSlug}'}</code> maps a public slug to a match id for a day with no
                delete anywhere. That is correct only because a slug is minted once and never
                reassigned. The moment anyone adds slug rotation or match deletion, this key becomes
                a way to serve one match's score under another match's link, and the invalidation
                has to be written in the same commit.
              </p>
            </Callout>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-standings"
            num="10"
            title="The points table is a fold, not a counter"
            standfirst="Nothing increments a team's points. A match finishing throws the tournament's whole table away and folds it again from every completed match, because a counter that drifts is a counter nobody can fix."
          >
            <p>
              When <code>completeMatch</code> publishes <code>match:completed</code>, a subscriber
              registered by <code>registerStandingsSubscriber</code> calls{' '}
              <code>recomputeStandings</code> for that tournament. There is no cron and no polling.
              The recompute loads every completed and abandoned match, folds each innings out of the
              ball log, aggregates the totals, upserts one <code>PointsTable</code> row per team in
              a single transaction, and deletes the standings cache key.
            </p>
            <p>
              Recomputing everything rather than adding two points to a winner is the entire design.
              A full fold is idempotent, so a duplicate event costs time and changes nothing. It is
              self-healing, so a correction to a ball bowled three matches ago fixes the table on
              the next completion rather than leaving a wrong number that nobody can trace back to a
              cause. And it needs no migration when the points rules change, because the rules live
              in one pure function rather than smeared across a history of increments.
            </p>

            <StandingsLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Net run rate, and the two rules that decide arguments</h3>
            <p>
              Net run rate is runs scored per over faced minus runs conceded per over bowled, across
              the tournament and not averaged per match. Everything is stored and summed in balls,
              then divided once at the end, because <code>7.3</code> overs is not seven and a third
              and adding decimal overs together is how run rates quietly go wrong.
            </p>
            <p>
              <strong>A side bowled out is charged its full quota.</strong>{' '}
              <code>chargeableBalls</code> returns the innings quota rather than the balls actually
              faced when <code>endReason</code> is <code>ALL_OUT</code>. Without that rule, being
              dismissed for 90 in twelve overs would give a better run rate than batting out twenty
              for 140, and losing badly would climb the table. This is the one place the standings
              code depends on the reducer picking the right <code>endReason</code>, which is why the
              order of the three end-of-innings checks in Chapter 04 matters here.
            </p>
            <p>
              <strong>A DLS match is charged par, not the score.</strong> <code>nrrInnings</code>{' '}
              substitutes the par score for the first innings and charges both sides the chasing
              side's overs. Par is by construction the score that ties over exactly those overs, so
              the two rows stay comparable. Using the real first-innings total against a shortened
              chase would punish a side for rain.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Ordering, and where it stops</h3>
            <p>
              <code>sortStandings</code> compares points, then net run rate, then head to head, then
              team name. The head-to-head step only runs when exactly two teams share both points
              and net run rate, because with three or more tied a pairwise comparison is not a valid
              ordering: A beats B, B beats C, C beats A is a real group stage, not a hypothetical.
              Rather than inventing a mini-league rule nobody asked for, the tie falls through to
              alphabetical, which is arbitrary but stable, and stable matters more than clever when
              the table is on a screen at the ground.
            </p>
            <p>
              The qualification endpoint sits on top of the same table.{' '}
              <code>qualificationScenarios</code> takes the current points, the remaining fixtures,
              and a number of qualifying spots, and enumerates the outcomes of the fixtures that
              matter to one team. It is a brute-force search over a bounded fixture list, which is
              honest about what it is: club tournaments have single-digit rounds left, so there is
              nothing to be clever about.
            </p>

            <Callout kind="why" title="Points and net run rate are stored, then sorted at read time">
              <p>
                <code>PointsTable</code> holds totals, not positions. Position is computed on every
                read by <code>sortStandings</code>, because a stored position is a derived value
                that goes stale the instant any other team plays, and there is no cheap way to know
                which stored positions a single result invalidated. Sorting eight rows costs
                nothing.
              </p>
            </Callout>

            <Callout kind="gap" title="A failed recompute is logged and forgotten">
              <p>
                <code>publishMatchEvent</code> wraps every subscriber in a try/catch so a broken
                listener cannot fail a durable write, which is right. The consequence is that if the
                standings recompute throws, the table silently stays one match behind until the next
                completion recomputes it anyway. Self-healing covers it in a tournament that is
                still running and covers nothing in the final. A retry, or a recompute triggered by
                the standings read when its cache is cold, would close it.
              </p>
            </Callout>

            <Callout kind="gap" title="The fold re-reads every ball of every match">
              <p>
                <code>fillInningsTotals</code> issues one query per innings across the whole
                tournament, so a completed match triggers work proportional to every match played so
                far. Fine at club scale and the first thing to hurt at any other scale. The fix is
                not incremental points, it is storing each innings' folded totals when that innings
                closes and summing stored rows here. Ranked in Chapter 18.
              </p>
            </Callout>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-realtime"
            num="11"
            title="Realtime: the connection, the room, the fan-out"
            standfirst="A WebSocket is a full-duplex TCP connection created by upgrading an HTTP/1.1 request. Everything after the 101 is framed messages with almost no per-message overhead."
          >
            <HandshakeLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Why not server-sent events or polling</h3>
            <p>
              Polling pays a full request, headers, and connection setup per check, and its latency
              is bounded by the interval. Server-sent events are a long-lived HTTP response streaming{' '}
              <code>text/event-stream</code>, server to client only, with automatic reconnection and{' '}
              <code>Last-Event-ID</code> built into the spec.
            </p>
            <p>
              Server-sent events are a fair alternative, because the score mostly travels one way. I
              chose WebSockets because the client sends <code>join</code> and <code>leave</code>,
              viewer counting depends on knowing when a connection closes, and a long-lived SSE
              request also consumes one of the browser's connections to the origin. If the product
              became purely one-way, switching to SSE would be a legitimate simplification, and the
              only thing holding it back is the viewer count.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Why socket.io rather than raw ws</h3>
            <p>
              The honest answer is the Redis adapter and rooms. With raw <code>ws</code> I would
              hand-roll room membership, the match-to-sockets map, cross-instance fan-out over Redis
              pub/sub including not re-delivering my own messages, client reconnection with backoff
              and jitter, heartbeats, dead-connection detection, and packet encoding. That is several
              hundred lines of infrastructure with subtle bugs, in a project whose value is the
              cricket domain. <code>@socket.io/redis-adapter</code> is one line and it is the entire
              horizontal scaling story.
            </p>
            <p>
              It costs about 40KB on the client bundle, a custom framing protocol you cannot{' '}
              <code>curl</code>, version coupling between both ends, and one default that actually
              bit me.
            </p>

            <Callout kind="trap" title="The default transport is process-sticky">
              <p>
                socket.io establishes the session over HTTP long-polling and then upgrades. That
                handshake lives in one instance's memory, so every subsequent poll must reach that
                same instance. Behind a load balancer that spreads requests, and certainly on
                serverless where consecutive requests routinely hit different instances, the second
                poll lands somewhere that has never heard of the session and the handshake dies with{' '}
                <code>session ID unknown</code>.
              </p>
              <p className="mt-2">
                Both ends pin <code>transports: ['websocket']</code>. One connection, established
                once, no affinity requirement. Pinning only one end does not help. Sticky sessions at
                the load balancer are the alternative, but that is infrastructure I do not control on
                this platform, and it degrades every scaling property I wanted.
              </p>
            </Callout>

            <FanoutLab />

            <p>
              Rooms are the addressing scheme. A room is a server-side set of socket ids you
              broadcast to by name, and this system uses exactly one pattern,{' '}
              <code>match:&lt;matchId&gt;</code>, produced by a shared <code>matchRoom()</code>{' '}
              helper so client and server cannot disagree about the string. A ball in one match costs
              nothing to viewers of any other match.
            </p>

            <Callout kind="why" title="Viewers are counted in a sorted set, not with fetchSockets()">
              <p>
                <code>fetchSockets()</code> broadcasts a request and waits for every subscribed
                instance to answer. On a platform that freezes idle instances, a frozen instance
                still holds its Redis subscription, so it is counted among the expected responders
                and never replies. The call stalls for its full timeout and then fails.
              </p>
              <p className="mt-2">
                Scoring by timestamp is what makes the sorted set self-healing. A plain set would
                count correctly and leak forever, because an instance killed without a clean
                disconnect leaves its socket ids behind and the count inflates permanently. Pruning
                on every join means ordinary traffic removes stale entries, with no cleanup job.
              </p>
              <p className="mt-2">
                The handler is on <code>disconnecting</code>, not <code>disconnect</code>. During{' '}
                <code>disconnecting</code> the socket's rooms are still attached, so the server can
                iterate them and decrement the right counters. By <code>disconnect</code> the rooms
                are gone. Get it wrong and nothing breaks visibly. The count just drifts upward over
                hours.
              </p>
            </Callout>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Why scoring never goes over the socket</h3>
            <p>
              Three reasons, and this is the most defensible decision in the project.
            </p>
            <p>
              <strong>Auth.</strong> HTTP gives a per-request <code>Authorization</code> header and
              middleware that already exists. A socket authenticates once at connect and then has to
              re-check authorization per message anyway, because assignments change mid-connection.
            </p>
            <p>
              <strong>Idempotency and retry.</strong> HTTP has status codes,{' '}
              <code>Retry-After</code>, and a client that already understands failure. Over a socket
              I would rebuild request-response correlation, timeouts, retries, and acks by hand. The
              offline queue's entire premise is safe replay, so that machinery is not optional.
            </p>
            <p>
              <strong>Disposability.</strong> Because nothing writes over the socket, the realtime
              layer is a read-only fan-out that could be deleted and replaced with polling in an
              afternoon without touching the write path. Delete{' '}
              <code>realtime/io.ts</code>, drop <code>attachRealtime</code> from both entrypoints,
              and the bus falls back to its no-op publisher. On the client, replace the subscription
              in <code>useLiveMatch</code> with a three-second poll of the snapshot endpoint it
              already calls.
            </p>
            <p>
              Look at the shared event map and there is no client-to-server event that mutates
              anything. <code>join</code> and <code>leave</code> are the entire surface, enforced by
              the type contract rather than by convention.
            </p>

            <Callout kind="why" title="The socket has no authentication, deliberately">
              <p>
                Ask what a socket grants: exactly one thing, receiving score updates for a room you
                named. Since nothing writes over it, authenticating it would protect a read that the
                share link already grants to anyone with the URL. What is protected is discovery. The
                only public address is a random slug with about 49 bits of entropy, 31 symbols to the
                tenth power, with ambiguous glyphs removed so it survives being read aloud at a
                ground. If private matches ever existed, the change is a signed token verified in a
                socket middleware at handshake. One function, because the room model already exists.
              </p>
            </Callout>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">The bus, and the seam it created</h3>
            <p>
              The write path calls <code>publishMatchEvent('ball', payload)</code> and never imports
              socket.io. The bus does two different things with that envelope. It hands it to a
              pluggable transport publisher, attached by <code>attachRealtime</code>, defaulting to a
              no-op that logs and drops. And it awaits any registered in-process subscribers. Pushing
              to browsers and recomputing the points table are genuinely different concerns, and a
              naive <code>io.emit</code> inside the service would have fused them permanently.
            </p>
            <p>
              The first payoff is that tests and any future worker run with the no-op publisher and
              need no socket server. The second payoff is Chapter 15, where a one-line change fixed a
              silent data-loss bug precisely because the seam existed.
            </p>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-client"
            num="12"
            title="The client reads snapshot-first"
            standfirst="Someone opens the share link mid-match. The page is useful before the socket is open, and a failed socket degrades to a static but correct score rather than a spinner."
          >
            <p>
              <code>useLiveMatch</code> loads the snapshot first and subscribes second. The HTTP
              request resolves the slug, reads or rebuilds the snapshot, and renders the current
              score before the socket exists. Then the socket joins the match room and the server
              adds it to the viewer set.
            </p>
            <p>
              On a drop, <code>disconnect</code> fires, the badge flips to "Reconnecting", and
              socket.io retries with backoff from 500ms to a 5-second ceiling. On{' '}
              <code>connect</code> the client does two things. It re-emits <code>join</code>, because
              a new socket id is not in the old room. And it refetches the snapshot, because what
              happened while it was away is unknowable and trusting stale local state is exactly how
              a score goes wrong.
            </p>

            <SnapshotGateLab />

            <p>
              The refetch is applied unconditionally while socket messages are gated, and the reason
              is provenance. A refetch is a fresh read of the source of truth, so it is by definition
              the most recent state, and gating it risks rejecting a newer state across an innings
              rollover. A socket message is a push that the network may have delayed or reordered, so
              it has to prove it is newer before it can move the score.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Whole snapshots, not deltas</h3>
            <p>
              Every broadcast carries the full snapshot, about 2 to 3KB. A client that misses one
              message is corrected by the next, so there is no replay protocol, no gap-filling
              request, and no server-side per-client buffer. Three pieces of machinery that do not
              exist because of this one decision. A mid-match join is instant, and the joining path
              and the steady-state path are the same code, so there is no separate catch-up mode to
              get wrong.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Two systems, kept apart on purpose</h3>
            <p>
              React Query owns server state for the scorer console, which is the writer and
              invalidates on every mutation. The viewer page uses <code>useLiveMatch</code>, which
              owns its snapshot in local state fed by the socket, with HTTP only for the initial load
              and for resync. Pushing socket payloads into the query cache would put two systems in a
              race to own one key, which is how a value starts flickering between two sources.
            </p>
            <p>
              <code>invalidateMatch</code> invalidates four keys at once, and that coarseness is
              deliberate. Any write to a match moves the header and the innings state, and those
              render on different screens. Precise per-mutation invalidation means six call sites
              each remembering which three keys to touch, and one of them eventually forgets,
              producing a stale screen that is hard to trace. One coarse function costs a few
              redundant refetches of small payloads.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Two hook details that matter</h3>
            <p>
              The latest snapshot is held in a ref, not read from state, inside the socket callbacks.
              If <code>snapshot</code> were a dependency of the subscription effect, the effect would
              tear down and rebuild the entire socket subscription on every ball. Unsubscribing and
              resubscribing six times an over is wasteful and drops messages in the gap.
            </p>
            <p>
              The socket is a module-level singleton, one per tab. A hook-owned socket opens a
              connection per mounted component, so a page showing several matches would hold several
              sockets, each with its own handshake, heartbeat, and reconnect timer. The singleton
              also survives route navigation. Cleanup emits <code>leave</code> and removes every
              listener, which is what keeps the viewer count honest.
            </p>

            <Callout kind="why" title="One in-flight refresh, not five">
              <p>
                A 401 on a request where a token existed means it expired mid-session, so{' '}
                <code>apiFetch</code> refreshes once and replays the original request. Concurrent
                401s all <code>??=</code> onto the same module-level <code>refreshInFlight</code>{' '}
                promise. That is not only efficiency. With rotation, only the first of five refreshes
                would succeed and the other four would look like token reuse, burn the family, and
                sign the user out. An internal <code>_retried</code> flag prevents the loop, and
                refresh is only attempted when a token existed, so an anonymous 401 does not trigger
                a pointless attempt.
              </p>
            </Callout>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Making the console fast for a weekly scorer</h3>
            <p>
              The common case is one tap. The run pad goes from 0 to 6 and commits immediately, with
              extras, wickets, and undo close by, plus keyboard shortcuts for a scorer on a laptop.
              The crease is inferred by the reducer, so the console only asks who is on strike or
              bowling when it genuinely changed, after a wicket or at an over boundary.
            </p>
            <p>
              Theming uses semantic CSS variables rather than Tailwind <code>dark:</code> classes,
              because <code>dark:</code> doubles every colour decision at every call site and a third
              theme would mean touching every component. A component says what a thing is and the
              theme layer says what it looks like. The theme follows the OS by default, a manual
              choice wins and survives a reload, and it is applied as a <code>data-theme</code>{' '}
              attribute on the root before first paint so there is no flash.
            </p>

            <Callout kind="gap" title="Live scores are not announced to screen readers">
              <p>
                Semantic elements, real buttons, full keyboard operation of the pad, and alt text are
                all in place. What is missing before anyone claims accessibility compliance is an{' '}
                <code>aria-live</code> region for score updates, so a ball is announced instead of
                silently mutating the DOM.
              </p>
            </Callout>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-offline"
            num="13"
            title="Offline: a durable outbox, not a background queue"
            standfirst="Call it what it is. A durable, ordered, at-least-once outbox with an event-driven drain. Overselling this layer would be the easiest way to lose an argument about it."
          >
            <p>
              Every ball is written to IndexedDB first, keyed by <code>clientEventId</code>, and
              marked pending. Online, the drain submits balls in <code>createdAt</code> order and
              removes each one after success. Offline, the ball stays there and the browser's{' '}
              <code>online</code> event starts the drain when connectivity returns.
            </p>

            <Callout kind="why" title="Every ball goes through the queue, even online">
              <p>
                <code>navigator.onLine</code> means there is a network interface, not that the
                request will succeed. At a ground on two bars, requests fail constantly while the
                browser insists you are online. If the online path bypassed the queue, every one of
                those failures would be a ball that existed only in a React state variable and died
                with the next re-render. Persist-then-send means the only difference between online
                and offline is how long the ball sits in the store. One code path, one set of bugs.
              </p>
            </Callout>

            <OutboxLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Why IndexedDB, keyed by clientEventId</h3>
            <p>
              <code>localStorage</code> is synchronous and blocks the main thread, which is
              unacceptable on a UI whose whole promise is that a tap feels instant. It is also
              string-only, so every read is a <code>JSON.parse</code> of the entire queue, capped
              around 5MB, with no indexes. IndexedDB is async, stores structured objects, and indexes
              by <code>matchId</code> and <code>createdAt</code>, which is exactly how the queue is
              read.
            </p>
            <p>
              Keying by <code>clientEventId</code> makes the store itself idempotent. Enqueueing the
              same ball twice is a <code>put</code> over one key, not a second row, and it is the
              same value the server enforces uniqueness on. The client key and the server constraint
              are literally the same identifier, with no mapping to get wrong. An in-memory{' '}
              <code>Map</code> fallback covers browsers where IndexedDB is unavailable, so the module
              degrades to "works but not durable" rather than throwing at import and taking the
              console down.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What is queued, and what is not</h3>
            <p>
              Ball submissions only: runs, extras, wicket details, player ids, and the
              client-generated <code>clientEventId</code>. Not queued: undo, corrections, toss,
              playing eleven, start match, resume innings, and every organizer action.
            </p>
            <p>
              Undo and corrections reference a server-side event id, and their meaning depends on
              what the server currently holds. Queueing an undo offline means queueing "remove the
              last ball" against a log that has since changed. The semantics are not well defined,
              and getting it wrong destroys data in an append-only store, which is the one place you
              cannot quietly repair.
            </p>
            <p>
              Setup actions happen once, before a match, when someone is almost certainly on signal,
              and they have downstream consequences like freezing the eleven, opening the event log,
              and moving the match to LIVE. None of that should be applied optimistically.
            </p>

            <Callout kind="gap" title="A scorer offline cannot undo, and that one I would fix">
              <p>
                The right design is not to queue a server undo. It is to make undo a local dequeue
                when the target ball is still sitting in the queue, which is trivially correct
                because the ball never reached the server. Fall back to a server-side{' '}
                <code>UNDO</code> only when the target was already accepted, which requires
                connectivity anyway. About thirty lines, and it covers the actual case: a scorer
                fixing a mistap five seconds later.
              </p>
            </Callout>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What this outbox does not have</h3>
            <p>
              No background worker, so nothing runs with the tab closed. No exponential backoff, no
              retry schedule, no dead-letter policy, no cross-tab coordination. The drain is triggered
              by exactly three things: an enqueue while online, the <code>online</code> event, and
              the user pressing retry. For a scorer looking at the phone for the whole match, that
              trigger set covers the real cases. For anything else it is genuinely insufficient, and
              the fix is a Service Worker with Background Sync.
            </p>
            <p>
              There is no manifest and no Service Worker in the shipped version, deliberately.
              Background Sync is Chromium-only, a Service Worker brings its own cache-invalidation
              problem on a fast-iterating app, and the actual user holds the phone with the console
              open for two hours. The queue is already structured for it, since the store and the
              drain function are both independent of React and take <code>submit</code> as a
              parameter.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">The optimistic fold, and two bugs it had</h3>
            <p>
              <code>foldQueuedBalls</code> takes the last server-confirmed <code>MatchState</code>{' '}
              and replays every queued ball through <code>applyBall</code>, the identical reducer the
              server runs. The console shows a real score, a real over ticker, real batsman figures,
              correct strike rotation, and correct end-of-innings detection, computed locally.
            </p>
            <p>
              The old version built each optimistic event's <code>seq</code> as{' '}
              <code>lastEventSeq + index + 1</code> from the original state for every item, but each
              fold step already advances <code>lastEventSeq</code>, so the sequence numbers were
              wrong once more than one ball was queued. Now each event is built from the current
              folded state. The second fix re-pointed the "clear the manual crease overrides" effect
              at the displayed sequence rather than the server's. Offline the server's sequence never
              moves, so a manual striker or bowler override would stick and freeze the crease for the
              rest of the innings.
            </p>

            <Callout kind="why" title="The fold also carries previousOverBowlerId">
              <p>
                The consecutive-overs rule needs to know who bowled the previous over, and the
                server's answer froze the moment the connection dropped. If the scorer bowls two full
                overs offline, a stale value offers the wrong bowler options at the over boundary and
                lets through a ball the server will reject with <code>CONSECUTIVE_OVERS</code> on
                sync. Because a failed ball halts the entire queue, that one stale value would strand
                every delivery behind it. So the fold watches for <code>currentOverNumber</code>{' '}
                changing and updates the value from the ball that completed the over.
              </p>
            </Callout>

            <Callout kind="gap" title="Two tabs both drain">
              <p>
                IndexedDB is shared across tabs on the same origin, so both tabs see the same queued
                balls. But <code>subscribeToBallQueue</code> is an in-memory <code>Set</code> per
                tab, so tab B does not re-render when tab A enqueues. Worse, when connectivity
                returns both tabs' <code>online</code> handlers fire and both start draining, and the{' '}
                <code>draining</code> guard is a React ref, so it is per tab and does not help.
              </p>
              <p className="mt-2">
                Idempotency saves the outcome. The loser's submissions come back 200 with the same
                snapshot and nothing is double-counted, so the result is correct while the ordering
                is uglier than it should be. The fix is a <code>BroadcastChannel</code> for
                subscriber notifications and a Web Lock via <code>navigator.locks</code> around the
                drain.
              </p>
            </Callout>

            <Note>
              Ordering uses <code>createdAt</code> from <code>Date.now()</code>, which only ever
              orders that device's own queue. A wrong absolute clock does not matter. A clock that
              jumps backwards mid-session would, and the robust version is a monotonic counter. The
              server never trusts it at all, because server-side ordering comes from{' '}
              <code>seq</code>.
            </Note>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-auth"
            num="14"
            title="Auth: short-lived in memory, long-lived and revocable"
            standfirst="The thing JavaScript can read is short-lived and low value. The thing that is long-lived is unreadable by JavaScript. That split is the whole design."
          >
            <p>
              Registration creates an unverified account and sends a six-digit code. Once the code is
              verified, the user is signed in. Login accepts a username or an email and returns a
              short-lived access JWT in the response body plus an httpOnly refresh cookie.
            </p>
            <p>
              The access token lives in a module-scoped variable in the SPA. Memory only, never{' '}
              <code>localStorage</code>, which any JavaScript on the page can read, so a single XSS
              in my code or in a dependency would exfiltrate a valid token. A closure variable is not
              reachable from an injected script without already having execution in that context, and
              it dies with the tab. It also expires in 15 minutes, so the window is small even in the
              worst case. On reload, <code>AuthProvider</code> calls <code>/auth/refresh</code>, the
              browser sends the httpOnly cookie automatically, and a fresh access token comes back.
            </p>
            <p>
              The refresh token is opaque rather than a JWT because it needs to be revocable. It is a
              random value stored server-side as a hash, and revoking the row invalidates it
              immediately. A 30-day stateless JWT cannot do that.
            </p>

            <AuthLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What the JWT deliberately does not contain</h3>
            <p>
              User id, email, issuer, expiry. No role, no list of matches you may score. Permissions
              are read per request, so revoking a scorer assignment takes effect immediately instead
              of waiting up to 15 minutes for a token to expire. Putting authorization claims in a
              bearer token hands the client a cache with no invalidation.
            </p>
            <p>
              <code>requireScorerForMatch</code> grants access two ways: an explicit{' '}
              <code>ScorerAssignment</code> row for the match and user, or ownership, since the
              organizer of a tournament may always score its matches. The result is cached in Redis
              for 60 seconds as a definite <code>'1'</code> or <code>'0'</code>, negatives included,
              and invalidated explicitly when an assignment changes.
            </p>
            <p>
              A revoked scorer keeps access for up to 60 seconds only if the explicit invalidation
              fails, since the TTL is the backstop rather than the mechanism. The worst case is mild:
              someone who was authorised sixty seconds ago enters balls into an append-only log that
              records exactly who they were, and every one is correctable. The alternative is a
              Postgres query with a relation load on every ball write, six times an over per live
              match, for a check whose answer changes maybe once a season. I would not cache a
              security decision this way if the action it guarded were irreversible.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Account enumeration</h3>
            <p>
              Login returns an identical message for an unknown user and a wrong password, and
              identical timing, via <code>burnPasswordComparison</code>. Without it, "no such
              username" returns in about a millisecond while "wrong password" takes 250ms, so an
              attacker learns which accounts exist from response time no matter how carefully the
              message is worded. When the user does not exist, that function burns an equivalent
              bcrypt comparison against a decoy generated lazily from a random value. A literal
              digest checked into source is a published hash of a known string, and a malformed one
              would be rejected instantly and defeat the purpose.
            </p>
            <p>
              OTP verification returns the same "that code is incorrect or has expired" for every
              failure path. Registration and forgot-password return 202 regardless of whether the
              address exists. Handle lookup, used when an organizer adds a player by username,
              requires a session, because an unauthenticated "does this handle exist" endpoint is an
              enumeration oracle by definition.
            </p>
            <p>
              Registration must still reject a duplicate username, and that signal cannot be closed.
              You cannot both enforce uniqueness and hide it. The mitigation is that usernames are
              public by design in this product, since they are the handle an organizer types and the
              stats URL. Email addresses, which are secret, are never confirmed or denied anywhere.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">XSS and CSRF are different attacks</h3>
            <p>
              XSS is attacker script running in my origin. Mitigated by React's escaping, no{' '}
              <code>dangerouslySetInnerHTML</code>, Helmet's headers, and keeping the access token
              out of <code>localStorage</code> so an injected script cannot simply read a long-lived
              credential.
            </p>
            <p>
              CSRF is a third-party site causing the browser to send an authenticated request with
              ambient credentials. <code>sameSite=strict</code> on the refresh cookie means the
              browser will not send it on any cross-site request, which kills CSRF against{' '}
              <code>/auth/refresh</code>. Every other authenticated endpoint uses the{' '}
              <code>Authorization</code> header, which a cross-site form or image tag cannot set, so
              there is no ambient-authority endpoint to forge against. CORS is an explicit origin
              allow-list, and <code>credentials: true</code> requires it to be explicit.
            </p>

            <Callout kind="trap" title="The cookie path bug, which looked like a server problem">
              <p>
                The refresh cookie was scoped to path <code>/auth</code>. Login worked, the session
                worked, and every reload came back signed out, only in the deployed environment. A
                cookie path is matched against the URL the browser requests, not the path your router
                thinks it is mounted at. The browser never asks for <code>/auth</code>. In
                development it asks for <code>/api/auth/refresh</code> through the Vite proxy, and in
                production the platform mounts the function under <code>/api</code>. The cookie was
                set, plainly visible in devtools, and never sent again. Path <code>/</code> fixed it,
                and the reasoning is now a comment in the code.
              </p>
            </Callout>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-serverless"
            num="15"
            title="What the platform forced"
            standfirst="One Vercel project. The SPA at /, the API under /api, the socket at /api/socket.io. Four decisions in this codebase exist only because of how that platform behaves."
          >
            <p>
              Same-origin buys three things. The refresh cookie stays first-party, which is what makes{' '}
              <code>sameSite=strict</code> viable. CORS disappears from the browser path. The socket
              connects to <code>window.location.origin</code>, so there is no separate socket host to
              configure per environment. The dev setup mirrors it through the Vite proxy on purpose,
              so development and production have the same origin topology rather than two different
              sets of bugs.
            </p>

            <FreezeLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">The four platform-forced changes</h3>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-secondary marker:text-muted">
              <li>
                <strong>WebSocket-only transport</strong>, because the polling handshake is
                process-sticky and consecutive requests hit different instances.
              </li>
              <li>
                <strong>Viewer counting in Redis</strong> rather than <code>fetchSockets()</code>,
                because frozen instances never answer.
              </li>
              <li>
                <strong>Awaiting event subscribers</strong> on the completion path, because the
                instance freezes when the response is sent.
              </li>
              <li>
                <strong>Bundling the API with tsup</strong>, because files under <code>api/</code>{' '}
                are transpiled individually and will not follow a relative TypeScript import out of
                that directory. So <code>api/server.ts</code> is a one-line re-export of the built
                bundle rather than of the source.
              </li>
            </ol>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">
              WebSockets under a 300-second function limit
            </h3>
            <p>
              The function exports an <code>http.Server</code>, so socket.io uses the normal HTTP
              upgrade path and the platform keeps the instance alive while the connection is active.
              The connection is then torn down at the function's maximum duration, 300 seconds on the
              free plan, so a live-match socket reconnects at least every five minutes.
            </p>
            <p>
              It does not matter, because the client is snapshot-first. On reconnect it rejoins the
              room and refetches, so the score is correct within a round trip and the user sees a
              "Reconnecting" badge flicker at most. I measured it rather than assuming: the
              connection held for 315 seconds, dropped with <code>transport close</code>, and
              reconnected 2 seconds later with the viewer count intact. "It reconnects fine" is a
              claim. That is evidence.
            </p>
            <p>
              Past a few hundred concurrent viewers I would split the socket layer onto a long-lived
              host and keep the API serverless. That split is cheap precisely because the realtime
              layer owns no truth. Its only state is room membership, which the Redis adapter already
              externalises.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Two database URLs</h3>
            <p>
              <code>DATABASE_URL</code> is the pooled Neon endpoint used by the running app.{' '}
              <code>DIRECT_URL</code> is the direct endpoint used by Prisma migrations, because
              migrations need operations a transaction-mode pooler does not support.
            </p>
            <p>
              A Postgres connection is expensive, since it forks a backend process with its own
              memory, so a pool amortises them. Serverless breaks the assumption a pool is built on:
              each instance has its own pool and the platform may run hundreds of instances, so you
              get pools of pools and exhaust <code>max_connections</code> under load. The fix is an
              external pooler that multiplexes many short-lived clients onto few real backends.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What a cold start does, in order</h3>
            <p>
              The module graph loads, env is parsed and validated, subscribers register, socket.io
              attaches, Redis is constructed but not connected, and Prisma connects on the first
              query. Env parsing happens at import time and throws rather than calling{' '}
              <code>process.exit(1)</code>. On serverless this runs during module init, where an exit
              is reported as an opaque crash with no output, while a thrown error carries the
              itemised zod message into the platform's logs. It logs with <code>console</code> rather
              than the logger, because the logger itself depends on env.
            </p>
            <p>
              Subscriber registration is at module scope in the serverless entry, so a cold start has
              its subscribers in place before the request that woke it reaches the write path. Lazy
              registration would mean the very first <code>match:completed</code> on a fresh instance
              has no listener and the points table silently does not rebuild. That bug appears only
              on the first request after a scale-up, which is the worst possible place to find one.
            </p>

            <Callout kind="trap" title="Two build-passes-deploy-fails bugs, both pinned in config">
              <p>
                The rewrite has to target a static <code>api/server</code> rather than a{' '}
                <code>[...path]</code> catch-all, because the catch-all matched only a single path
                segment. <code>/api/health</code> resolved and <code>/api/health/live</code> returned
                404 at the platform before ever reaching Express.
              </p>
              <p className="mt-2">
                Prisma needs <code>binaryTargets</code> including <code>rhel-openssl-3.0.x</code>,
                because the native query engine is per-platform. Without it the client builds
                perfectly and then fails at runtime with "Query Engine not found". Both are pinned
                with a comment explaining what happens if you remove them.
              </p>
            </Callout>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">
              createApp() does not call listen()
            </h3>
            <p>
              The factory only builds the Express app. The normal entrypoint creates a server and
              listens, the Vercel entrypoint exports it, and tests pass the app straight to supertest
              without opening a port.
            </p>
            <p>
              The two entrypoints differ in exactly three ways that cannot be expressed as
              conditionals. The serverless one exports rather than listens, because the platform owns
              the socket and hands over the upgrade. It mounts the app under <code>/api</code> on an
              outer Express instance, because the platform's rewrite preserves the original path, so{' '}
              <code>/api/health</code> arrives as <code>/api/health</code> and Express strips the
              prefix so every route stays mounted where it already expects to be. And it registers no
              signal handlers, because the platform freezes or discards instances instead of sending
              SIGTERM. Both call the same <code>createApp</code>, the same{' '}
              <code>attachRealtime</code>, and the same subscriber registration.
            </p>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-scale"
            num="16"
            title="What breaks first"
            standfirst="Not the ball writes. A ball is a small write and even a lot of simultaneous matches is a manageable rate for Postgres. Fan-out breaks first."
          >
            <FanoutChart />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Second to break: the standings recompute</h3>
            <p>
              Every match completion rebuilds an entire tournament from the event log. That is
              O(matches x innings x events) per completion, bounded and cheap at 49 matches, and
              quadratic misery at 49,000.
            </p>
            <p>
              I would defend the cost at this size. Incrementing is O(1) and not idempotent, and the
              cost here is bounded by the domain: 49 matches, roughly 130 events each, once per
              completed match, so about every twenty minutes. Milliseconds of CPU for a class of bug
              that stops existing. It is a good trade at this scale and a bad one at 49,000 matches.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What I would change, in order</h3>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-secondary marker:text-muted">
              <li>
                Deltas with a periodic keyframe. An order of magnitude off the per-message cost, and
                the client already tolerates gaps, so it is a small change.
              </li>
              <li>
                Put the snapshot behind a CDN with a one-second TTL and let the overwhelming majority
                of viewers poll that, keeping sockets for the small set that needs sub-second
                latency. At that population the right answer stops being "a better WebSocket" and
                starts being "cache the number".
              </li>
              <li>
                Scope the standings recompute to affected teams, or make it incremental with a
                periodic full reconciliation to preserve the idempotency property.
              </li>
              <li>
                Fix the N+1 in <code>fillInningsTotals</code> before any of that, because it is
                fifteen minutes of work.
              </li>
            </ol>

            <Callout kind="gap" title="fillInningsTotals queries ball events once per innings">
              <p>
                That is the clearest performance defect in the codebase. It should be one{' '}
                <code>findMany</code> with <code>inningsId: {'{'} in: [...] {'}'}</code> and a
                group-by in memory, or better, a single SQL aggregate applying the supersede logic in
                the query. It has not hurt because it runs once per match completion over a bounded
                set, and "it has not hurt yet" is not a defence.
              </p>
            </Callout>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">The connection ceiling is not the wall</h3>
            <p>
              On a long-lived Node host, tens of thousands of connections per instance. The limits
              are file descriptors and per-connection heap, and it is I/O bound rather than CPU
              bound. On this deployment it is a different question entirely, because the function has
              a hard 300-second ceiling regardless of connection count. Either way, connection count
              is not the bottleneck at any scale. Fan-out volume is.
            </p>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-ops"
            num="17"
            title="Tests, logs, and how to debug a wrong score"
            standfirst="Coverage sits where behaviour is complex and failure is quiet. A wrong net run rate looks like a number. A broken route fails loudly the first time anyone uses it."
          >
            <p>
              The tests cover the pure domain: the scoring reducer, fixture guarantees, net run rate
              including the bowled-out case, and career-stat aggregation. They run in{' '}
              <code>packages/shared</code> with no database and no mocks. Express routes, Prisma
              calls, and React components are not unit-tested, on purpose.
            </p>
            <p>
              That is also exactly the code that was made pure, which is not a coincidence. Purity is
              what makes it cheap to test, and cheap tests are the ones that actually get run.
            </p>
            <p>
              Two tests earn their place. The net run rate bowled-out case is written so it fails
              against the naive implementation rather than merely exercising the path, encoding a
              worked scenario with a hand-computed expected answer. And the over-boundary strike
              test, because an odd run off the last ball of an over must leave the same batsman on
              strike, and both wrong answers look plausible on screen.
            </p>

            <Callout kind="gap" title="There are no API integration tests">
              <p>
                A time trade-off, and the honest first three to write, in order: an idempotent
                re-post, concurrent balls under the lock, and cold-cache rebuild equivalence.
                Testcontainers with real Postgres and Redis, supertest against{' '}
                <code>createApp()</code>, which is already possible because <code>createApp</code>{' '}
                does not listen.
              </p>
              <p className="mt-2">
                The offline queue is the least tested and most fragile part, and it is testable
                today: <code>fake-indexeddb</code> for the store, a stubbed <code>submit</code>, a
                mocked <code>navigator.onLine</code>. The property that matters most is that{' '}
                <code>foldQueuedBalls</code> produces the same state the server produces for the same
                inputs, which is only testable because both sides call the same pure reducer.
              </p>
            </Callout>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Errors have one shape</h3>
            <p>
              Every failure is an <code>AppError</code> with a status, a machine-readable code, and a
              message, so the error middleware serialises exactly one shape:{' '}
              <code>{'{ error: { code, message, details? } }'}</code>. Anything else that escapes a
              handler is an unexpected bug and becomes a generic 500 with the detail logged and never
              leaked.
            </p>
            <p>
              <code>AppError</code> carries an <code>expected</code> flag defaulting to{' '}
              <code>status &lt; 500</code>, so a 404 or a validation failure logs at info rather than
              error. Otherwise you train yourself to ignore your own error log and an alert on
              error-level becomes meaningless.
            </p>
            <p>
              The client branches on the code, never on the message.{' '}
              <code>BAD_REQUEST</code> means "these are field errors" and{' '}
              <code>ApiError.fieldErrors</code> maps them onto form inputs. Domain rules come back as
              422 with messages written for a human, like "A bowler cannot bowl two overs in a row",
              and are shown verbatim because the scorer is the person who needs to act on them.
              Messages are for humans and can be reworded. Codes are the contract.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Two health endpoints, two questions</h3>
            <p>
              <code>/health/live</code> says the process is up and depends on nothing external, or a
              Redis blip would make an orchestrator kill a healthy process. <code>/health</code> pings
              Postgres and Redis and returns 503 when either is unreachable, which is what a load
              balancer should act on. Conflating them is how you get a cascading restart loop during
              a dependency outage.
            </p>
            <p>
              Logs are structured JSON with Pino, carrying match ids, event ids, user ids, durations,
              and error details, and never tokens, OTPs, password hashes, or authentication request
              bodies. Health checks are excluded so they do not drown out useful traffic. Before
              calling this production-ready I would add Sentry with source maps, latency and
              error-rate percentiles on the ball-write path, Redis and Postgres connection
              saturation, socket connection count and reconnect rate, and an alert on
              standings-recompute failures, which are otherwise silent by construction.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">"The score jumped backwards"</h3>
            <p>
              First question: did the server's score go backwards, or only the client's display?
              Three hypotheses, each with a distinct signature in the data.
            </p>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-secondary marker:text-muted">
              <li>
                Fetch <code>/public/matches/:slug/snapshot</code> and compare it against a fold of
                the event log. If they agree, the log is fine and it is a client ordering bug, which
                points at <code>isNewerSnapshot</code> and specifically at the innings rollover.
              </li>
              <li>
                If Redis disagrees with the log, a snapshot write lost a race, which points at the{' '}
                <code>lastEventSeq</code> guard and its non-atomic read-then-write window.
              </li>
              <li>
                If the log itself is non-monotonic, that is the serious one. It means the lock
                failed, and the next move is to look for <code>P2002</code>s and 409s clustered
                around that timestamp.
              </li>
            </ol>
            <p>
              For "my six was not counted", pull the innings' event log, because it is append-only so
              the answer is definitely in there. The ball was never submitted, so nothing is in the
              log and you check the client's IndexedDB queue and the ball-write rate limiter. Or it
              was submitted and undone, so an <code>UNDO</code> supersedes it with an author and a
              timestamp. Or it was recorded as something else, so the ball is there with different
              runs and a <code>CORRECTION</code> fixes it.
            </p>

            <Callout kind="gap" title="The evidence exists. A screen for it does not.">
              <p>
                <code>GET /matches/:id/events</code> returns the full log including undos and
                corrections, so the data is queryable today. What is missing is a screen that renders
                it for a human, which is the difference between the evidence existing and the
                evidence being usable. An append-only log whose main value is dispute resolution
                should have a dispute-resolution UI. Related: a correction to a finished match
                requires republishing <code>match:completed</code>, and today nothing republishes it.
                The data model supports it. The plumbing is not wired.
              </p>
            </Callout>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="ch-gaps"
            num="18"
            title="The gaps, ranked"
            standfirst="Everything in this codebase either does what it claims or documents why it does not. This is that list, in the order I would fix it."
          >
            <ol className="flex list-decimal flex-col gap-4 pl-5 text-secondary marker:text-muted">
              <li>
                <strong>Offline queue failure handling.</strong> A rejected ball blocks everything
                behind it, there is no backoff, two tabs can drain at once, and the UI does not show
                enough about the ball that failed. The design is right and the implementation is
                thin. One day of work: split transport failures from semantic rejections, backoff with
                jitter on the former, surface the ball and offer edit-or-discard on the latter, and a
                Web Lock around the drain.
              </li>
              <li>
                <strong>The player-stats projection re-implements the fold.</strong> Two places in
                this codebase know what a maiden is. That is exactly the drift the shared reducer
                exists to prevent, and I violated it. It aggregates across both innings while the
                reducer is per innings, which is a shape problem, not a real obstacle.
              </li>
              <li>
                <strong>No single-writer claim.</strong> Two assigned scorers can both score. The log
                stays structurally valid and the content can still be wrong.
              </li>
              <li>
                <strong>No Postgres advisory lock fallback.</strong> Redis going down is the one
                dependency failure that stops writes rather than slowing them.
              </li>
              <li>
                <strong>No event-log viewer, and no correction republish.</strong> The audit trail
                exists and nobody can read it.
              </li>
              <li>
                <strong>The N+1 in <code>fillInningsTotals</code>.</strong> Fifteen minutes.
              </li>
              <li>
                <strong>No <code>aria-live</code> region on the live score.</strong> Needed before
                anyone claims accessibility compliance.
              </li>
            </ol>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Where this system loses data</h3>
            <p>
              One place: the client outbox. A ball can sit in IndexedDB behind a rejected item and
              then disappear if the device is cleared or replaced before the scorer resolves it.
            </p>
            <p>
              Nowhere else. Once a ball reaches Postgres it is in an append-only table with a unique
              key, never updated and never deleted. Redis holds nothing that is not derivable. A
              failed snapshot write degrades a read to a rebuild. A failed publish loses a broadcast,
              which the next one corrects. Notification emails are fire-and-forget and can be lost,
              which is exactly why the durable in-app notice is a row written first.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What was left out, and how that was decided</h3>
            <p>
              The test was whether a feature needed data the system does not have, or introduced a
              large new rules system without improving basic scoring. Out by that test: venue-clash
              detection and calendar scheduling, which is why <code>scheduledAt</code> is nullable and
              the round-robin generator is a pure function of team ids. Super overs, powerplays, and
              bowler over-quotas, all of which are additions to <code>validateBall</code> that change
              nothing about storage, which is itself the argument that the storage model is right.
              Live commentary and video.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">What I would tell the next person</h3>
            <p>
              The decisions that mattered were about where responsibility lives, not about clever
              code. Making the reducer pure let it run in four places and agree by construction.
              Making Redis strictly derivable ended all reasoning about cache coherence. Making the
              event bus a seam turned a silent serverless data-loss bug into a one-line{' '}
              <code>await</code>. None of those are clever. They are placement decisions, and each
              removed a category of bug rather than fixing an instance of one.
            </p>
            <p>
              And be suspicious of framework defaults. socket.io's polling-first transport and
              Prisma's binary targets were both "works perfectly locally" bugs that appeared only on
              a platform, which is the most expensive place to find them.
            </p>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="appendix-cricket"
            num="A"
            title="The cricket rules the engine enforces"
            standfirst="Only the rules where breaking them produces a scorecard nobody can reconcile afterwards. The log is immutable, so a bad ball is expensive to live with."
          >
            <p>
              All of it lives in one pure <code>validateBall</code>, which runs on the server inside
              the lock and again on the client before a tap costs a round trip.
            </p>

            <StrikeLab />

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Legal deliveries and the over</h3>
            <p>
              Wides and no-balls do not advance the over. Everything else does. Six legal deliveries
              complete an over, and the same bowler may not bowl two in a row.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Who faced it, and who is charged</h3>
            <p>
              <code>facedDelivery = !isWide</code>. A batsman is credited with facing a no-ball,
              because he had to play it, and never a wide, which was never reachable.{' '}
              <code>bowlerRuns = runsOffBat + (isWide || isNoBall ? extraRuns : 0)</code>. Wide and
              no-ball extras hit the bowler's economy. Byes and leg-byes do not, because they are the
              batting side's runs and not the bowler's fault.
            </p>
            <p>
              A maiden is a completed over with zero bowler-runs. The <code>legalBalls &gt;= 6</code>{' '}
              clause exists so an over cut short by the end of an innings is not a maiden, however
              tidy it looked.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Dismissals</h3>
            <p>
              Which dismissals are possible differs off a wide and off a no-ball. A run-out needs a
              fielder. Only a batsman at the crease can be dismissed. Runs cannot come off the bat on
              a wide or a bye. When a ball is a wicket, the reducer sets whichever end the dismissed
              batsman occupied to null, so the UI prompts for a replacement. The scorer names them on
              the next ball, which is why the reducer never has to infer a new batsman.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Net run rate, and the trap in it</h3>
            <p>
              Net run rate is runs scored divided by overs faced, minus runs conceded divided by
              overs bowled, aggregated across the tournament rather than averaged per match. The
              aggregation is the first thing people get wrong.
            </p>
            <Callout kind="trap" title="The bowled-out rule">
              <p>
                A side dismissed inside its quota is charged the full quota of overs, not the balls
                it actually faced. The naive implementation sums what happened, which flatters a team
                that collapsed. Bowled out for 60 in 12 overs computes as a 5.00 run rate instead of
                the correct 3.00 over 20 overs. A team can miss a playoff spot on that.
              </p>
              <p className="mt-2">
                It is isolated in one function, <code>chargeableBalls</code>, so it cannot be applied
                inconsistently. A successful chase is not charged the full quota, because that innings
                ended by achievement rather than failure. So <code>chargeableBalls</code> keys off{' '}
                <code>endReason</code>: only <code>ALL_OUT</code> triggers the quota substitution.{' '}
                <code>OVERS_COMPLETE</code> gets actual balls, which is the same number anyway, and{' '}
                <code>TARGET_CHASED</code> gets what it used.
              </p>
            </Callout>
            <p>
              The API returns every net run rate input, meaning runs scored, overs faced, runs
              conceded, and overs bowled, not only the figure. A disputed number should be traceable
              by a human rather than require trust.
            </p>

            <h3 className="serif mt-4 text-[1.5rem] text-primary">Standings and ties</h3>
            <p>
              Sort order is points, then net run rate, then head-to-head, then team name.
              Head-to-head applies only when exactly two teams share the points-and-NRR key. With
              three or more the mini-table can be circular, where A beat B, B beat C, and C beat A,
              and there is no defensible answer, so it is skipped rather than guessed at.
            </p>
            <p>
              The team-name comparison at the end is not a tiebreak anyone cares about. It exists so
              the table never renders in a different order on two consecutive page loads, which is
              the kind of thing that makes users think the system is broken.
            </p>
          </Chapter>

          {/* ============================================================ */}

          <Chapter
            id="appendix-fundamentals"
            num="B"
            title="Fundamentals, answered against this codebase"
            standfirst="The definitions, each one tied to the place it shows up here."
          >
            <dl className="flex flex-col gap-5">
              {FUNDAMENTALS.map((item) => (
                <div key={item.q}>
                  <dt className="mb-1 font-semibold text-primary">{item.q}</dt>
                  <dd className="text-secondary">{item.a}</dd>
                </div>
              ))}
            </dl>
          </Chapter>

          <footer className="mt-24 border-t border-line pt-8">
            <p className="text-[0.8125rem] text-muted">
              Everything on this page is drawn from the codebase as it stands. The reducer in Figure
              2 is imported from <code className="mono">packages/shared</code> and folds in your
              browser. Where something is a plan rather than shipped code, it is marked as a gap.
            </p>
            <Link to="/" className="mt-4 inline-block text-[0.875rem] text-accent hover:underline">
              Back to Howzat
            </Link>
          </footer>
        </main>
      </ChapterProvider>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Preface() {
  return (
    <div className="eng-prose flex flex-col gap-8 pt-16 sm:pt-24">
      <div>
        <p className="eyebrow mb-4">Howzat · engineering</p>
        <h1 className="serif text-[2.75rem] leading-[1.05] text-primary sm:text-[4rem]">
          How one score stays true in five places at once
        </h1>
        <p className="serif mt-5 text-[1.25rem] leading-[1.5] text-secondary">
          A live cricket scoring system, taken apart. Every diagram on this page is interactive, and
          several of them run the production reducer in your browser. Read it top to bottom and you
          should be able to open a pull request against this codebase on your first day.
        </p>
      </div>

      <div className="rule" />

      <div>
        <h2 className="eyebrow mb-4">The ten sentences that answer most questions</h2>
        <ol className="grid gap-2 sm:grid-cols-2">
          <Law n={1}>
            The event log is the only truth. Everything else is a projection and can be deleted and
            rebuilt.
          </Law>
          <Law n={2}>
            Writes are HTTP. Sockets are a read-only fan-out. Auth, idempotency, validation, and
            retries live in one place, which makes the realtime layer disposable.
          </Law>
          <Law n={3}>
            socket.io was chosen for the Redis adapter and rooms. Horizontal scaling is one line, and
            I would have written the alternative worse.
          </Law>
          <Law n={4}>
            <code>transports: ['websocket']</code>, because the long-polling handshake is
            process-sticky and dies behind a load balancer.
          </Law>
          <Law n={5}>
            Viewers are counted in a Redis sorted set, not with <code>fetchSockets()</code>, because
            a frozen instance stays subscribed and never answers.
          </Law>
          <Law n={6}>
            Broadcasts carry whole snapshots, not deltas. Self-healing, and a mid-match join is
            instant.
          </Law>
          <Law n={7}>
            <code>clientEventId</code> makes the POST idempotent, so a bad connection at a ground
            cannot double-count a six.
          </Law>
          <Law n={8}>
            The Redis lock reduces contention. The database constraints guarantee correctness. Never
            let a lock be your only defence.
          </Law>
          <Law n={9}>
            Offline is a durable IndexedDB outbox plus an optimistic fold through the same reducer
            the server runs.
          </Law>
          <Law n={10}>
            <code>await publishMatchEvent</code> on the completion path, because serverless freezes
            the instance the moment the response is sent.
          </Law>
        </ol>
      </div>

      <div className="rounded-[var(--radius-md)] border border-line bg-sunken px-5 py-4">
        <p className="eyebrow mb-2">How to read this page</p>
        <p className="text-[0.875rem] text-secondary">
          Eighteen chapters and two appendices, ordered the way you would learn the system rather
          than the way the folders are laid out. Chapters 1 to 4 are the shape and the write path.
          Chapters 5 to 8 are correctness under concurrency. Chapters 9 and 10 are the derived
          layer: every cache, and the points table. Chapters 11 to 13 are the network and the edge.
          Chapters 14 to 18 are security, the platform, scale, and the honest list of what is
          missing. The cricket rules are in Appendix A, on purpose. Hover the right margin on a wide
          screen for the chapter index.
        </p>
      </div>
    </div>
  );
}

const FUNDAMENTALS = [
  {
    q: 'Idempotency',
    a: 'Repeating an operation has the same effect as doing it once. POST is not idempotent by default, so this codebase adds the property with a client-supplied key and a unique database constraint behind it.',
  },
  {
    q: 'Optimistic versus pessimistic concurrency',
    a: 'Pessimistic locks first and assumes conflict. Optimistic proceeds and detects conflict at write time using a version. This system uses pessimistic on the ball write, which is the lock, and optimistic on the snapshot cache, where lastEventSeq is the version.',
  },
  {
    q: 'CAP, and where this sits',
    a: 'Under a partition you choose availability or consistency. This is CP for writes, since a ball fails rather than being accepted possibly-conflicting, and AP for reads, since viewers get a slightly stale cached snapshot. The offline scorer is AP at the edge and gets away with it because the merge is trivial: append-only, idempotent, single writer.',
  },
  {
    q: 'What consistency does a viewer get',
    a: 'Eventual consistency with monotonic reads. A viewer may be slightly behind, and isNewerSnapshot prevents an older score from replacing a newer one.',
  },
  {
    q: 'Event sourcing and CQRS',
    a: 'Event sourcing means state derived by folding an append-only log, used here for the match domain and not for setup data. CQRS informally: the write model is the log and the read models are the snapshot, PointsTable, and PlayerMatchStats. No event store abstraction, no versioned event schema, no sagas. That scoping is deliberate.',
  },
  {
    q: 'What a projection is',
    a: 'A read model derived from the log. Three here: the Redis snapshot, which is one innings shaped for display, PointsTable, which is every completed match shaped for standings, and PlayerMatchStats, which is one match shaped per player.',
  },
  {
    q: 'At-least-once versus exactly-once',
    a: 'End-to-end exactly-once is not realistic across a network. This uses at-least-once submission with idempotent processing. Socket messages can be lost, and each one is a full snapshot, so the next read or broadcast repairs the client.',
  },
  {
    q: 'ACID, and what is actually atomic here',
    a: 'Atomicity, consistency, isolation, durability. Genuinely atomic: the standings upsert in one transaction so no reader sees a half-updated table, the player-stats upsert, refresh-token rotation, the XI replacement, and fixture generation. Explicitly not atomic: the Postgres write and the Redis snapshot write.',
  },
  {
    q: 'What an index is',
    a: 'A secondary B-tree structure that turns a scan into a logarithmic lookup, at the cost of write amplification. The ones that matter here are (inningsId, seq), which is also a correctness constraint, and clientEventId unique, which is the idempotency mechanism rather than an optimisation.',
  },
  {
    q: 'Connection pooling, and why serverless breaks it',
    a: 'A pool amortises expensive Postgres connections. Serverless gives each instance its own pool across potentially hundreds of instances, which exhausts max_connections. An external transaction-mode pooler fixes it, and then cannot do session-level operations, which is why migrations use DIRECT_URL.',
  },
  {
    q: 'When a distributed lock is the wrong tool',
    a: 'When the lock is treated as the guarantee. A paused holder can outlive its lease, so the database or the resource still has to enforce the invariant.',
  },
  {
    q: 'A race condition from this project',
    a: 'Two balls concurrently reading lastEventSeq = 41 and both writing 42, prevented by the lock and backstopped by the unique constraint. Also a slow snapshot write landing after a newer one, prevented by the seq guard. Also, not fully closed, two tabs draining the offline queue at once.',
  },
  {
    q: 'XSS versus CSRF',
    a: 'XSS is attacker script running in my origin, mitigated by React escaping, Helmet, and keeping the token out of localStorage. CSRF is a third party causing an authenticated request with ambient credentials, mitigated by sameSite=strict and by every other endpoint using an Authorization header a cross-site request cannot set.',
  },
  {
    q: 'Authentication versus authorization in this code',
    a: 'requireAuth verifies the JWT and attaches req.user, which answers who you are. requireScorerForMatch and the ownership checks read from the database, which answers whether you may do this to this object. The second deliberately does not live in the token, so revocation is immediate.',
  },
  {
    q: 'Why a JWT is hard to revoke',
    a: 'It is self-verifying, so there is no server-side record to delete and it stays valid until it expires. You work around it with a short expiry, a denylist that reintroduces the state you were avoiding, or by keeping the long-lived half stateful, which is what this system does.',
  },
  {
    q: 'Backpressure',
    a: 'Not much on the socket path, where socket.io can buffer for a slow client. The offline drain has a simple form of it, because it sends one request at a time. At larger scale I would drop intermediate snapshots for lagging viewers, since the latest full snapshot is enough.',
  },
];
