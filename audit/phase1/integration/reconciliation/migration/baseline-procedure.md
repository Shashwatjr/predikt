# Local baseline procedure — 2026-10-27

Prisma 5.22.0. Local loopback databases only. The six historical migration files were not edited. Their checksums match `upgrade-rehearsal.json`. No row was inserted into `_prisma_migrations` by SQL. Production and Neon were not contacted. This is not production parity.

## Why deploy returned P3005

`migrate deploy` refuses a non-empty database that has no `_prisma_migrations` table before it runs any SQL (`baseline-existing-p3005.txt`). The recorded local fixture already matches the checked-in datamodel, so replaying the six files is also unsafe: several statements are not idempotent. The empty-database failure is different: those six files alter or create objects that do not exist until the prerequisite schema exists.

## Procedure

1. Confirm the target is the intended disposable database. Stop application writes first (below).
2. Fresh database: `prisma migrate deploy` from `backend/`. It executes `20260712000000_inferred_prerequisites` and then the six original files. Prisma records each one only after it runs. The prerequisite file is the reviewed candidate SQL, checksum `f38c4740c88c18819d207f2a103ead4f358e6742ae5982a05497735ed9226005`, copied unchanged. It is inferred from the current datamodel by excluding objects the six files add. It is not a recovered production history.
3. Database that already has the schema: take a snapshot, then require an empty `migrate diff` against `prisma/schema.prisma`. `rehearse-baseline.py` checks each migration's tables, columns, indexes, and foreign keys. If any object is missing, it exits before `migrate resolve`. When every check passes, it runs `prisma migrate resolve --applied <migration_name>` once per migration, in history order. That is Prisma's baseline command, not a manual insert and not a mark-all of an unverified directory. Then `migrate deploy` finds nothing pending and does not execute the non-idempotent SQL.
4. Run `migrate deploy` a second time. It must report no pending migrations.

`python3 audit/phase1/integration/reconciliation/migration/rehearse-baseline.py` does this on new databases named `predikt_baseline_*`. It clones local `predikt_ui` and never runs migrate against that source.

## Rehearsal

| Database | What happened | Result |
|---|---|---|
| `predikt_baseline_fresh_1793070323` | Deploy executed all 7 migrations. Schema diff empty. Catalog checks passed. A second deploy did not change the fixture user (credit 15, clout 40, aura 5, one credit row, one reward row). | PASS |
| `predikt_baseline_existing_1793070323` | `pg_dump` of local `predikt_ui` (125 users, 71 rooms, 40 predictions, credit sum 1042, clout sum 2890, aura sum 359, ledger sum 1264). Those rows include local acceptance and recovery fixtures, not a production extract. P3005 first. Catalog checks passed. Resolve, deploy, and redeploy left every count and sum unchanged. Schema diff stayed empty. | PASS |

Evidence: `baseline-rehearsal.json`, `baseline-fresh-deploy.txt`, `baseline-fresh-redeploy.txt`, `baseline-existing-p3005.txt`, `baseline-existing-resolve.txt`, `baseline-existing-deploy.txt`, `baseline-existing-redeploy.txt`.

## Recovery

History-only reconciliation does not change columns on a database that already matches the datamodel. The current application and the previous application binary use that same schema. Rolling the app back does not require a database restore. Do not restore a snapshot merely to undo `migrate resolve`.

Forward repair: Prisma runs each PostgreSQL migration in one transaction. A failed statement rolls that migration back. `migrate deploy` will then refuse until `prisma migrate resolve --rolled-back <name>` is used, and only after the catalog shows that migration's objects are absent. Fix the migration forward and deploy again. Do not delete history rows by hand and do not replay reward events.

Snapshot restoration loses every write committed after the snapshot. Pause writes before the snapshot and keep them paused until the migration result is accepted: stop the backend and web processes that use the database, revoke `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` from the application role, and confirm `pg_stat_activity` has no application sessions. Take the dump, then run the procedure. If later writes happened anyway, do not restore that dump over the live database. Restore it beside the live database and copy only missing primary keys. Copy credit and reward rows only when their original idempotency key is absent. Stop if the same key has a different amount or if user balances do not match their ledger sums. If that comparison is not proven, keep the newer database and leave rollback blocked.

Hosted inventory, adoption, and cutover remain NOT RUN. The passing room-recovery and concurrency evidence was not rerun: `../recovery-20261027.md` and `../recovery-after.json`.
