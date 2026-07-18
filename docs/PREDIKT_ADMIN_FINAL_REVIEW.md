# PREDIKT Admin Portal — Final Engineering Review

_Production-readiness review + completion sprint. Verdicts are from reading the
actual repository, not prior summaries. Date context: 2026-07-13._

---

## 1. Executive Summary

The Admin Portal is a self-contained, web-only surface (`/admin`) backed by a NestJS
admin module. Independent verification found the prior hardening sprint to be **largely
real and well-built** — dedicated admin identity/JWT, a working RBAC decorator+guard,
PII-safe projections, sanitized audit logs, a default-OFF kill switch, code-split
frontend bundle, per-tab session with idle timeout, and env-driven seeding. Several
claimed-incomplete items were genuinely incomplete and are now finished in this sprint;
two additional real defects surfaced during review (a coordinate PII leak on a legacy
endpoint, and missing per-endpoint permissions on non-MVP surfaces) and were fixed.

**Bottom line:** Ready to ship as a **flag-gated private-beta / internal admin tool**
with the documented deploy steps. **Not** ready as a public, multi-admin surface until
super-admin enforcement is code-level (not seed-config-dependent) and a DB-backed e2e
suite exists. Overall: **7.5 / 10**.

---

## 2. Claims Verified — PASS / PARTIAL / FAIL

| # | Claim | Verdict (as found) | After this sprint |
|---|-------|--------------------|-------------------|
| 1 | `AdminFeatureEnabledGuard` gates all admin endpoints | PASS | PASS |
| 2 | Granular `RequireAdminPermission` enforced | PARTIAL (non-MVP mutations ungated) | **PASS** (decorators added) |
| 3 | Safe admin projections strip PII | PARTIAL (legacy `rooms()` leaked coords) | **PASS** (select added) |
| 4 | `guestKey` removed from responses | PASS | PASS |
| 5 | Sanitized audit logs | PASS | PASS |
| 6 | Lazy-loaded admin bundle | PASS | PASS (verified: 0 bytes in main chunk) |
| 7 | Admin feature flag default OFF | PASS | PASS |
| 8 | Admin login throttling | PASS (5/min) | PASS |
| 9 | `sessionStorage` admin auth | PASS | PASS |
| 10 | Idle timeout | PASS (15 min, activity-reset) | PASS |
| 11 | Logout on 401 | PARTIAL (no 403 handling) | **PASS** (403 portal-revocation logout added) |
| 12 | Secure admin seeding | PASS | PASS |
| 13 | No default production credentials | PASS (misleading log print) | PASS (print corrected) |

**Previously-admitted incomplete items:**

| Item | Verdict (as found) | After this sprint |
|------|--------------------|-------------------|
| Credit reversal transaction safety | FAIL | **FIXED** (`$transaction`) |
| Idempotency | FAIL | **FIXED** (`idempotencyKey`, unique) |
| Negative balance protection | FAIL | **FIXED** (balance check, rejects overdraft) |
| Expo web confirmation UX | FAIL | **FIXED** (`AdminConfirmDialog`, 3 screens) |
| Pagination correctness | FAIL | **FIXED** (bounded Next, users + rooms) |
| Audit pagination | FAIL | **FIXED** (page controls) |
| Integration coverage | PARTIAL | PARTIAL (unit/guard tests added; no DB e2e) |
| Full feature-flag integration tests | PARTIAL | PARTIAL (guard unit-tested; no HTTP e2e) |

### FAIL details (as originally found)

- **Credit reversal (`admin.service.ts` `reverseCredits`)** — non-atomic (`user.update`
  then `creditLedger.create` unwrapped), no negative-balance guard, no idempotency.
  _Impact:_ money-integrity — a mid-call failure decrements balance with no ledger; a
  retry double-decrements; a large reversal drives balance negative. _Fixed:_ single
  `$transaction`, balance read + overdraft rejection, unique `idempotencyKey` with
  replay + P2002 race handling, retained audit + permission gate.
- **Legacy `GET /admin/rooms` (`admin.service.ts` `rooms()`)** — returned raw
  `PredictionRoom` rows including `startingLat/Lng`, `destinationLat/Lng`, labels.
  _Impact:_ location-privacy leak to any admin token. _Fixed:_ explicit non-PII `select`.
- **Non-MVP mutations** (creators/drops/sponsors/campaigns/ai-systems) — carried no
  `@RequireAdminPermission`, so any portal role could mutate. _Fixed:_ granular
  permissions added (effectively super-admin-only, since only `all:true` holds them).

---

## 3. Security Review

**Strong:** dedicated `AdminUser` table + `ADMIN_JWT_SECRET` (≥16 chars, prod-validated);
`admin_access` token type explicitly rejects user access/refresh tokens; guard fails
closed on missing secret and inactive admins; `AdminFeatureEnabledGuard` returns 404
(hides existence) when off; login throttled 5/min; global `ValidationPipe`
`whitelist + forbidNonWhitelisted`; audit metadata recursively sanitized
(`sanitizeAuditJson`); no raw SQL (only a tagged `SELECT 1`).

**Residual risks (see §10):** super-admin not code-enforced for money/privacy actions
(relies on seed role config); admin token in `sessionStorage` is XSS-readable (mitigated
by per-tab scope + 15-min idle); no account lockout beyond the rate limit; some legacy
list endpoints still return unprojected rows (no coordinates, but includes internal
columns).

---

## 4. Privacy Review

Ghost-Mode discipline now extends to the admin surface: coordinates and place labels are
stripped from room projections and the legacy rooms list; `guestKey`, password hashes,
tokens, email, and phone are stripped from user projections and audit metadata. Email is
revealed only in the authorized single-user detail view (intended, and access is
audit-logged server-side). Remaining hygiene gap: legacy `reports/disputes/creditLedger/
privacyRequests` list endpoints return raw rows (low sensitivity, no coordinates).

---

## 5. RBAC Review

Model (`utils/admin-roles.ts`) is sound: 5 portal roles + `permissions.all` super shortcut;
`AdminRoleGuard` first requires `isAdminPortalRole`, then enforces any
`@RequireAdminPermission` via `Reflector`. After this sprint, **every** mutating endpoint
on both controllers carries a specific permission. **Gap:** `isSuperAdminRole` /
`SUPER_ADMIN_ROLES` remain unused — the most destructive actions (credit reversal,
privacy actions, user disable) are gated by granular permission only, which today maps to
super-admin **by seed configuration coincidence**, not by code. Recommended: an explicit
super-admin requirement for money/privacy endpoints.

---

## 6. UX Review

Login, dashboard (partial-failure tolerant via `allSettled`), filters, tables, loading and
error states are present. Fixed this sprint: destructive actions now use a real,
web-compatible confirmation dialog (`Alert.alert` was a silent no-op on Expo web);
pagination "Next" is bounded on users/rooms; the audit log is now pageable. Remaining
polish (non-blocking): error states lack a retry affordance; list refetches show a
full-pane spinner instead of an inline indicator.

---

## 7. Performance Review

Admin is low-traffic and queries are bounded (page size capped at 100, analytics windows
capped at 90 days, list `take` limits). Count aggregations per list row are acceptable at
admin scale. The frontend admin code is code-split (44 KB chunk) so it imposes **zero**
first-load cost on normal users. No performance blockers.

---

## 8. Code Quality Review

Guards, projections, and DTOs are cohesive and reusable; controllers are thin. Two concerns:
(a) two overlapping admin controllers (`AdminController` legacy + `AdminPortalController`)
duplicate concepts and double the surface to keep hardened in lockstep — consider
consolidating; (b) `updateDrop` uses `data: body` (mass-assignment shape, mitigated by the
global ValidationPipe). Feature flags are centralized; env validation is enforced.

---

## 9. Production Readiness Review

- **Migrations:** project uses `prisma db push` (no migration files). Admin tables must be
  synced to Neon via a manual `npx prisma db push` at deploy (documented click-op).
- **Env:** requires `ADMIN_JWT_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
  `EXPO_PUBLIC_API_BASE_URL` (admin API throws if unset — no localhost fallback),
  `FEATURE_ADMIN_PORTAL_ENABLED` (default off).
- **Production defaults:** portal flag OFF by default (backend + mobile); default local
  admin creds refused outside development. Rotate/set real seed creds before enabling.
- **Bundle:** admin lazy-loaded and verified split out of the user bundle.
- **Rollback:** flip `FEATURE_ADMIN_PORTAL_ENABLED=false` → all admin endpoints 404 and the
  route stops mounting. Clean kill switch.

---

## 10. Remaining Risks

1. **Super-admin not code-enforced** for credit reversal / privacy / user-disable — relies
   on seed role config. Mis-granting a permission to a lesser role would silently authorize
   it. _Recommend before multi-admin use._
2. **No DB-backed e2e/integration suite** — coverage is unit + guard level. A `supertest`
   suite (flag-off → 404, RBAC deny, guestKey absence over HTTP) would harden regressions.
3. **Admin token in `sessionStorage`** — XSS-readable; mitigated (per-tab, 15-min idle,
   distinct key). httpOnly cookie is the stronger long-term posture.
4. **Legacy list endpoints return raw rows** (low-sensitivity) — project them for consistency.
5. **Two admin controllers** increase maintenance/attack surface — consider consolidation.
6. **No login lockout** beyond 5/min throttle.

---

## 11. Recommendations

- Add explicit super-admin enforcement (guard/decorator) for money + privacy endpoints.
- Add a `supertest` e2e suite: flag-off 404, RBAC denial, guestKey/coord absence, credit
  reversal negative + idempotency over HTTP.
- Project the remaining legacy list endpoints; consider retiring the legacy controller.
- Serve `/admin` from a restricted host/allowlist for production.
- Move to an httpOnly cookie session and add failed-login lockout when the portal opens to
  more admins.

---

## 12. Scorecard

| Dimension | Score /10 |
|-----------|-----------|
| Security | 8 |
| Architecture | 7 |
| Maintainability | 7 |
| Scalability | 7 |
| Developer Experience | 8 |
| Performance | 8 |
| Privacy | 8 |
| **Overall** | **7.5** |

**Would you ship this?** Yes — as a **flag-gated private-beta / internal admin tool**,
with real `SEED_ADMIN_*` creds set and the portal served on a trusted host. **Do not**
open it to multiple admins or the public until super-admin enforcement is code-level and a
DB-backed e2e suite is in place.
