# Local DB Verification Results

**Date:** 2026-10-27  
**DB:** predikt_verify_test (disposable, local docker kriviksha-postgres-1)  
**Branch:** verify/db-verification @ 7aa032d  
**Setup method:** schema-derived (prisma migrate diff --from-empty → baseline.sql applied via psql)

---

## Scenario Results

| # | Scenario | Result |
|---|---|---|
| 1 | Scored journey returns real winner identity (handle=bob99) and correct reward (120 aura, rank=1) | **PASS** |
| 2 | Unscored (live) journey stays pending: rank=NULL, aura=0, no room_results row | **PASS** |
| 3 | Arrival confirmation writes (journey_status=arrived_verified, arrival_confirmed_at set) succeed without constraint errors — 500 not reproduced at DB layer | **PASS** |
| 4 | Creator delivery-ETA guess persists as MilestonePrediction row with correct user_id and future predicted_reached_time | **PASS** |

**Evidence:** `audit/phase1/db-verification/verify_scenarios.sql`

---

## Noted Limitation — Arrival 500

Scenario 3 passes at the **DB schema level** (write succeeds, no constraint error). The
reported Arrival 500 may originate from application-layer validation or a dependent
service call (notifications, audit log, advisory lock) that only surfaces in the full
NestJS request context. DB schema is not the blocker.

---

## Release Schema-Compatibility Checklist

- [x] `activity_events` table present after baseline bootstrap
- [x] `milestone_predictions` unique constraint `(milestone_id, user_id)` enforced
- [x] `room_results` unique constraint `(room_id, user_id)` enforced
- [x] `arrival_confirmed_at` and `actual_end_time` nullable — UPDATE succeeds
- [x] `journey_status` stored as TEXT (enum-compatible with app code)
- [ ] **Cannot verify:** Neon prod column parity vs current schema.prisma without Neon access
- [ ] **Cannot verify:** `_prisma_migrations` state in Neon — no direct DB access
- [ ] **Codex owns:** full application-level finalization flow (scored journey via HTTP, arrival 500 root cause)

---

## Integration Blockers

1. **Migration baseline not established on Neon.** Running `prisma migrate deploy` from
   scratch against Neon will fail at migration 1. Repair: `prisma migrate resolve --applied`
   for each of the 6 migrations, or Option A above.
2. **No node_modules in worktree.** Worktree cannot run prisma CLI directly; must symlink
   or use main repo's `node_modules/.bin/prisma` — acceptable for local-only CI.
3. **Arrival 500 root cause unconfirmed.** DB schema is not the cause. Requires HTTP-level
   test in the NestJS context (Codex scope).
