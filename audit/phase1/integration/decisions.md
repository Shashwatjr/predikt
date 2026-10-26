# Phase 1 integration evidence

Baseline candidate: `eb2bd27348039e33dd12cebb7ee6bc85238758e6` (parent `44e1bec03f80f4f30a098188223ff9ad2c9a7a`).

Lane resolution:

- Lane B `a12ef4ddc358b00223b23f9d37e40f48b117ed49` resolves from reported `00df37ad479b206c2396550bd46ada07082f7140`; it is not descended from the candidate. Its five-file mobile fix was applied selectively. `ResultScreen.tsx` conflicted because the candidate contains newer result/share UI; the candidate layout and sharing code were retained, while B's null winner, neutral closure, safe date, and narrow podium safeguards were carried over. The B audit and regression test were retained.
- Lane C `6c98f35ee2b0077011c6b33c3464cb8c9fecd519` resolves from reported `44e1becec03f80f4f30a098188223ff9ad2c9a7a`, the candidate's parent. It applied cleanly and was transferred in full because all twelve files are required for invite routing/share preview behavior.
- No backend/schema/contract files from either lane were transferred.

Auth status matrix (candidate implementation): active login/refresh/JWT request accepted; disabled, suspended, review, missing, and deleted users are rejected by login/refresh/JwtStrategy; previously issued access tokens are rejected after a status change because `validate` reads current status; admin disable/suspend revokes open refresh sessions. Password checks remain before login status rejection. Revocation is database-backed and request-time; already issued JWTs are not revoked cryptographically but fail on the next authenticated request. Cache/session limits were not observed.

Journey resolution review: lifecycle scoring filters ineligible predictions, sorts by absolute actual-arrival difference with stable query order, and leaves unscored rows out of winner results. Neutral closures suppress winners. RewardService/audit idempotency exists for Aura and result-declared credits; direct clout writes in `finalizeRoom` are repeated on a concurrent duplicate-finalization path. This is a confirmed static risk but was not changed without a disposable DB/concurrency reproduction.

Invite/share review: `inviteStateFromPath` is wired into NavigationContainer linking and preserves `joinCode` plus `forwardedBy`; URL parsing handles `/join/:code`, query codes, encoded values, reload storage, and invalid/expired/closed/private states. Local preview HTML emits crawler-readable OG tags before SPA behavior. Exact place data is hidden by default; live messaging previews were not exercised.

Potential schema follow-up (not applied): add an atomic room-finalization claim/idempotency record so all clout and winner side effects are single-shot under concurrent arrival requests.

Local acceptance blocker: the documented disposable Postgres was started successfully, but the six-migration history cannot rebuild an empty database. `20260713000000_admin_portal_beta` is first and immediately alters `activity_events`, which has no creating migration. `prisma migrate deploy` stopped with P3018 / PostgreSQL 42P01. `db push`, migration edits, and schema edits were intentionally not used. Therefore concurrent finalization, duplicate reward observation, and create→invite→guest→predict→arrival→results against a real DB are NOT RUN. The only evidence for the duplicate-finalization risk remains static inspection of `finalizeRoom` direct clout writes.

Visual acceptance is limited to the existing static mobile regression contracts (pending winner, safeClock, 320px podium sizing) and local crawler preview. Expo browser/device screenshots were NOT RUN because mobile installation could not complete reliably and the inherited TypeScript errors block a clean app build.
