# Release checklist

## Required before release (not completed here)

- Reconcile `activity_events` migration prerequisites and rebuild migrations on a disposable clean database; keep migration history unchanged.
- Verify the deployed schema is compatible with the checked-in Prisma schema and generated client.
- Deploy in order: schema-compatible database change, backend, then web/mobile clients; verify rollback compatibility at each step.
- Set production API origin, CORS allowlist, cookie/JWT settings, and preview-host configuration; keep production defaults unchanged in code.
- Smoke-test the preview host at 320px and desktop through create → invite → guest join → predict → arrival → results, including pending results and location-hidden sharing.
- Prepare DNS rollback (previous target, TTL, owner, and health check) and execute only after preview acceptance.
- After cutover, create and consume a real invite, then verify expired, closed, private, encoded, and forwarded invite cases.
- Review concurrent finalization and all outside-transaction reward effects under production-like load.

## Completed in this branch

- Local auth/lifecycle regressions and build evidence are recorded in `commands.md`.
- Schema-derived disposable DB flow and concurrent finalization idempotency evidence are recorded in `commands.md` and `decisions.md`.
- Local Expo export and viewport artifacts are recorded in `visual-review-20261027.md`.

## Not run

Production/device/messaging checks, live preview-host smoke, DNS rollback, and migration rebuild remain NOT RUN/BLOCKED.


## Continuation evidence (2026-10-27)

- PASS locally: identifier-only RoomCreated/reload, valid-member forward attribution, browser guest prediction/start, HTTP verified arrival, real scored winner/error/reward reconciliation, creator Delivery ETA prediction persistence, result share at 320/1440. See `continuation-20261027.md` and `screenshots/scored/`.
- FAIL: inherited default-delete/cancel test contract in `rooms.service.spec.ts` (1 of 27 affected backend tests); no backend change made to mask it.
- OG hosted path remains unverified: renderer tests and standalone fixture-server curl are not actual preview-host acceptance.
- `2c3ad02` baseline/history-marking scripts excluded. Migration repair is still separate and blocked pending verified reconciliation.


## Follow-up at 5369746 (2026-10-27)

Latest status is in `reconciliation/checks-and-status.md`; earlier failures above remain historical evidence.

- RESOLVED: inherited deletion-contract mismatch. Tests now distinguish per-user removal from explicit shared cancellation and assert no shared-state writes on default removal.
- PASS locally: new external-effect rollback/contention tests and fixes; seven-step isolated candidate fresh migration replay with empty schema diff; actual packaged preview handler and compiled-browser same-origin API smoke.
- BLOCKED: terminal retry after post-completion failure, milestone scoring/reach recovery/contention and broader real-DB reward engine load/cap/account contention; existing DB migration reconciliation/data-transfer/rollback proof.
- NOT RUN: preview Docker image build and actual hosted HTTPS/edge/OG/API/CORS acceptance; real-device/native location and OS/messaging share tests. Sources/config/package/checklists are prepared; no deployment is authorized or claimed.
