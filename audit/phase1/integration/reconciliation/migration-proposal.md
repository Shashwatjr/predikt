# Migration reconciliation proposal — candidate only

Status: local fresh-database rehearsal PASS; existing-database reconciliation/upgrade BLOCKED. No repository historical migration was changed. No manual `_prisma_migrations` inserts, resolves, DB push, or production/Neon access were used. Prisma and client remain pinned to 5.22.0; this is not a Prisma major-version migration.

## Evidence and missing prerequisites

The six checked-in migrations are deltas, not a complete initial schema. `20260713000000_admin_portal_beta` immediately alters `activity_events`, `reports` and references `admin_users` and `users`; none has a creating migration. The checkpoint migration requires `prediction_rooms`; subsequent deltas also require `milestone_predictions`. Core users/rooms/milestones/memberships/ledgers, enums, constraints and reward account/rule/ledger tables are missing from the existing history's creation steps. This proves a history gap, not how any deployed database was created.

Read `migration/rehearse-fresh.py`, `prerequisites-candidate.sql`, `rehearsal.json`, `deploy-result.txt`, `history-readonly.txt`, and `schema-diff.sql`. The candidate is inferred from today's checked-in Prisma schema by excluding the four tables and the columns introduced by the six deltas. It includes schema objects not otherwise created by these deltas. It is not a recovered historical schema or evidence of production parity.

A prerequisite SQL preload followed by migrate deploy failed locally with P3005 (schema not empty); retained in `failed-prerequisite-preload.txt`. That is not the recommended strategy.

## Reproducible fresh strategy

`python3 audit/phase1/integration/reconciliation/migration/rehearse-fresh.py` uses only the named local disposable Postgres container at loopback port 55444. It always creates a new uniquely named test database, never resets or drops an existing one. It:

1. Generates DDL from the checked-in schema without consulting an external database; derives the candidate prerequisites with explicit reverse-delta exclusions.
2. Copies the schema and original six migration directories byte-for-byte into a temporary lab directory. Inserts the candidate prerequisite migration **in that isolated lab history only** before the six deltas. Nothing is added to `backend/prisma/migrations`.
3. Runs Prisma migrate deploy against the initially empty database. Prisma executes all seven migrations and writes its own genuine completion records. It does not merely mark them applied.
4. Reads completion history and compares the resulting schema to the checked-in datamodel. Observed: seven completed steps, empty schema diff. Original six SHA-256 checksums and prerequisite checksum are recorded in `rehearsal.json`.

Candidate adoption would require a separately reviewed history/bootstrap decision and another clean reproduction from the approved artifacts. The current application repository's six-migration chain alone remains unable to initialize an empty database. The candidate is a reviewable repair proposal, not a silent replacement for it.

## Existing database upgrade implications

Do not run the candidate CREATE statements on a populated database: enum/table/constraint collisions are expected. Do not infer completion from table existence. Before choosing any upgrade method, obtain authorized read-only inventory: schema-only dump, exact Prisma version, full history rows/checksums/failure logs if the table exists, migration-file checksums, table/column types and defaults, enum values, indexes, FK/check/unique constraints, extensions/triggers/functions/views and ownership. Record missing history as missing, rather than inventing it. Compare each original delta's actual effects, including partially applied statements, and diff the whole schema against the candidate end state. No such external inventory was obtained here.

A path that avoids history fabrication is **rebuild-and-transfer into a new database** using the reviewed fresh history. Rehearse with an approved non-production copy: transfer application data only (exclude migration history), preserve IDs/timestamps/ledger idempotency keys, order FK loads, validate enums/constraints, reconcile sequence values if any, and compare row counts, per-user currency balances versus ledgers, room status/predictions/results, and orphan/duplicate checks. Run the same HTTP acceptance with fresh JWT secrets. No production-like data transfer was performed here.

For a future authorized cutover: establish an application-compatible write freeze, take a recoverable backup, apply a validated final delta/copy, verify integrity and exact app/schema/client versions, then switch connection configuration. If in-place reconciliation is required instead, it remains blocked until each historical delta and the actual schema are verified and a narrowly reviewed history policy is authorized. There is no blanket resolve command in this proposal.

## Rollback and gates

Before any cutover, the new database is disposable: abandon it and leave the old database untouched. Do not drop old tables or run destructive down migrations. After new writes begin, pointing back to the old database can lose writes and duplicate rewards; rollback requires an audited write freeze plus validated replay of the new ledger/data delta (or restore within an agreed RPO). If that replay/restore cannot be proven, rollback is blocked. Never replay reward events without their original idempotency keys.

Required gates still open: inventory/reconciliation, candidate history approval, data-transfer rehearsal, row/ledger integrity, backup restore and post-write rollback rehearsal, compatibility/locking/runtime measurements, and separate authorization for any non-local action. No production/Neon operations are authorized by this document.

Prisma's [baselining guidance](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining) distinguishes existing-data onboarding from fresh replay; its [migration-history guidance](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/migration-histories) explains file/history consistency. Those general principles support keeping the originals intact. Actual command behavior here is proven using the repository's 5.22.0 CLI, not inferred from newer CLI instructions.
