# Storage and recovery

PostgreSQL owns match events, tournament membership, accounts and clock state. Redis holds disposable snapshots, viewer presence and request counters. IndexedDB owns unsent cricket submissions on the scoring device. Never clear browser storage while unsent balls remain.

## Release database changes

Run `npm run db:deploy` once as a release step before serving the new API. Build previews must not migrate a shared database. The persistence-safety migration adds match revisions, pending projection flags and refresh-token families, removes a duplicate index, and flags historical results for recalculation. Build and test with `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.

## Match writes

All participating database calls use the same transaction through an async-local transaction context. Writers acquire a PostgreSQL transaction-scoped advisory lock. Match writers acquire their tournament lock first, so fixture replacement, membership limits, match lifecycle and tournament-wide projections share one ordering. Locks end with the transaction rather than expiring during work. The tradeoff is that writes within one tournament serialize; move to a shared tournament lock and exclusive per-match locks only after measured contention warrants that complexity.

Redis snapshots and realtime events run only after a successful commit. Snapshots carry a persisted match revision and Redis compares versions atomically. Readers check the database revision, so a missed cache write cannot strand a public score. An old retry acknowledges its original request without replacing the current public snapshot.

## Retry derived work

A completed result sets `projectionPending` in the result transaction. The completion subscriber rebuilds standings, per-match player statistics, snapshots and playoff assignments. It clears the flag only within a successful database transaction. Tournament standings and statistics reads retry pending work. Run `npm run db:maintenance` from the scheduler to retry pending work independently of traffic and remove codes and tokens that expired more than 90 days ago. Match events are never removed by maintenance.

## Backup and restore exercise

Enable database-provider backups and point-in-time recovery with retention appropriate to tournament history. Keep an additional encrypted, access-restricted SQL archive if provider-independent recovery is required. Take a PostgreSQL custom-format archive using `pg_dump --format=custom --file=howzat.dump` against the intended database. Treat the archive as sensitive account and match data.

Restore into a separate empty database using `pg_restore --no-owner --no-acl --dbname=<restore-database> howzat.dump`. Apply committed migrations there. Check event counts, unique request IDs, innings transitions, match results and the ability to rebuild scorecards. Flag completed matches for projection rebuild and run maintenance. Compare a selected cricket match, a football match, a DLS result and their standings with the originals. Record the backup timestamp, restore duration and comparison results. Never rehearse a restore over the primary database.

## Offline recovery

Queue entries belong to an account and innings and receive a monotonic sequence in the same IndexedDB transaction. Save acknowledgements wait for transaction completion. Web Locks provide one drain owner across tabs; BroadcastChannel refreshes queue indicators. Temporary failures remain pending; invalid submissions stop the queue until reviewed. Open the scoring page online to resume synchronization. Assisted mode explains the controls without changing scoring rules.

Historical queue entries from versions before account ownership was stored are retained in IndexedDB, but are never silently attributed to whichever account signs in next. Review and export them through the recovery control before discarding them.

## Supported tournament formats

League and league with playoffs are supported. Standalone knockout creation is rejected rather than generating incorrect round-robin fixtures. League tables exclude playoff results. A tied or abandoned playoff requires an organizer to resolve the winner; no random winner is assigned.
