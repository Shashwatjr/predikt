# Migration Rebuild Diagnosis — P3018 / 42P01

**Date:** 2026-10-27  
**Branch:** verify/db-verification @ 7aa032d  
**Scope:** read-only analysis + disposable-DB trial only

---

## Root Cause

The first checked-in migration (`20260713000000_admin_portal_beta`) opens with:

```sql
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "room_id" TEXT;
```

This assumes `activity_events` already exists. Against a blank database the statement
raises `ERROR 42P01: relation "activity_events" does not exist`, which Prisma surfaces
as **P3018** (migration failed to apply).

**Why it happened:** Production schema was built with `prisma db push`, not
`prisma migrate deploy`. The `activity_events` table (and all other base tables)
were created outside migration history. The first migration was authored against an
already-populated Neon database, so locally-reproduced `migrate deploy` from zero
always fails at step 1.

**Confirmed locally:**
```
$ docker exec … psql -d predikt_verify_test -c \
  "ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS room_id TEXT;"
ERROR:  relation "activity_events" does not exist
```

---

## Migration History Gaps

| Migration | Assumes pre-existing | Pre-created by |
|---|---|---|
| `20260713000000_admin_portal_beta` | `activity_events`, `reports`, `admin_users` | `prisma db push` (Neon prod) |
| `20260714000000_room_checkpoints` | `prediction_rooms` + others | same |
| All subsequent | depend on rooms/milestones tables | same |

No baseline migration exists. `_prisma_migrations` was never seeded in Neon.

---

## Repair Proposal (smallest evidence-backed fix)

### Option A — Schema-derived baseline (recommended for local/CI)

1. Run `prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script`
   to generate a full DDL snapshot (1 365 lines — verified working).
2. Apply that DDL to a fresh DB as the baseline schema.
3. Insert rows into `_prisma_migrations` marking all 6 existing migrations as already
   applied (`applied_steps_count=1`, `checksum='baseline'`).
4. Future `prisma migrate deploy` will only apply new migrations going forward.

**Proven locally:** see `verify_scenarios2.sql` results — all 4 scenarios passed on
a DB bootstrapped this way.

### Option B — Neon production parity (cannot be proven without Neon access)

Production already has all tables from `db push`. The repair there is only to seed
`_prisma_migrations` via `prisma migrate resolve --applied <name>` for each of the 6
migrations, so Prisma stops complaining about unapplied history.

**Claim:** cannot be verified without Neon access — per task constraints this is NOT done.

### What cannot be proven

- Whether Neon's live `activity_events` schema exactly matches the prisma-derived DDL
  (no Neon access, no `pg_dump` to diff against).
- Whether any post-`db-push` column drift exists between prod and the current
  `schema.prisma` representation.
