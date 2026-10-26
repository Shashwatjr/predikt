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
