# Follow-up at 5369746 — 2026-10-27

Scope: existing `fix/phase1-integration` worktree, initially clean. Preserved prior UI/HTTP/scoring evidence. Local commit only; no production/Neon/DNS writes, push or deployment. No historical migration file/schema edits, manual migration-history inserts or resolve commands. The candidate rehearsal was confined to a new local disposable database and a temporary copied history, with genuine Prisma execution/completion records.

## Results

| Check | Result | Evidence |
|---|---|---|
| Deletion contract | PASS; stale expectation corrected with stronger per-user isolation/outsider assertions | `deletion-contract.md`, room tests, API_SPEC |
| Backend affected tests | PASS: rooms, lifecycle, badges, notifications: 27; strict preview CORS: 1 | Commands below; no unrelated suite expansion |
| Backend build | PASS | `npm run build` |
| New real-DB external-effect checks | PASS: six new helper safety cases; plus one successful reproduction of the unresolved terminal-retry defect | `external-effects-before.txt`, `notifications-before.txt`, `external-effects-after.txt`, supplemental script |
| Existing scoring/finalization/engine checks | Reused passing evidence; not rerun | `../commands.md`, `../decisions.md`, `../scored-db-evidence.json`; engine tests are mock-backed, not load proof |
| Fresh candidate migration replay | PASS; seven genuinely executed migrations, empty resulting schema diff | `migration/` |
| Existing DB migration reconciliation | BLOCKED; inventory/upgrade/rollback unverified | `migration-proposal.md` |
| Mobile typecheck and export | PASS | Commands below |
| Affected API origin tests | PASS: 3 | `preview-api-url-tests.txt` |
| Packaged preview request handler | PASS: actual packaged server path (OG, SPA, assets, proxy, privacy) | `preview-handler-tests.txt`; upstream is a local HTTP stand-in |
| Packaged CLI/browser/test Nest API | PASS: compiled client uses /api, real login 201 and room GET 200; no page errors or production requests | `preview-browser.json`; actual CLI, not fixture renderer |
| Hosted preview, TLS, edge routing/caches, real upstream CORS, crawler/messaging | NOT RUN | `preview-device-acceptance.md` |
| Docker image build, native app/device/GPS/OS sharing | NOT RUN | Device checklist distinguishes browser responsiveness and simulated adapters |

## Commands

All application commands ran in the relevant integration worktree directory; DB credentials were supplied privately from the named local container, never logged or committed.

```text
backend:
npm test -- --runInBand rooms/rooms.service.spec.ts lifecycle/lifecycle.service.spec.ts badges/badge.service.spec.ts notifications/notifications.service.spec.ts -> 27 PASS
npm test -- --runInBand app.bootstrap.spec.ts -> 1 PASS
npm run build -> PASS
TEST_DATABASE_URL=<loopback disposable predikt_ui DB> node -r ts-node/register scripts/verify-finalization-external.ts -> six safety checks PASS, terminal retry gap REPRODUCED

root:
python3 audit/phase1/integration/reconciliation/migration/rehearse-fresh.py -> candidate replay PASS, schema diff empty

mobile:
npm run typecheck -> PASS
node --test tests/api-base-url.test.mjs -> 3 PASS
EXPO_PUBLIC_PREVIEW_WEB_ORIGIN=http://127.0.0.1:8221 EXPO_PUBLIC_WEB_BASE_URL=http://127.0.0.1:8221 EXPO_PUBLIC_API_BASE_URL= npx expo export --platform web --clear --output-dir /tmp/predikt-preview-export -> PASS
EXPO_PUBLIC_PREVIEW_WEB_ORIGIN=http://127.0.0.1:8221 node deploy/preview/package.mjs /tmp/predikt-preview-export /tmp/predikt-preview-package-final -> PASS
PREVIEW_PACKAGE_DIR=/tmp/predikt-preview-package-final node --test deploy/preview/server.test.mjs -> PASS

PREVIEW_WEB_ORIGIN=http://127.0.0.1:8221 PREVIEW_API_ORIGIN=http://127.0.0.1:3410 PORT=8221 node /tmp/predikt-preview-package-final/server.mjs
Chromium compiled-package smoke through /api against existing loopback test Nest -> PASS
```

Local browser setup caught a symlink-sensitive CLI entry-point comparison (`/tmp` versus `/private/tmp`); fixed using realpath before the successful actual CLI check. Output packaging now requires a fresh directory to avoid retaining obsolete bundles. Docker context excludes .env files and node_modules. Package server rejects production origins and redirects. A preview build is origin-bound and requires a rebuild for an HTTPS hosting origin; local tar/manifest hashes are in `preview-artifact.json` and `preview-package-manifest.json`.

The migration preload P3005 is retained as rejected evidence; the successful proposal instead creates an isolated candidate history and lets Prisma run every SQL step. No migration repair was applied to any existing database.

## Exact remaining release gates

1. Lifecycle recovery: local creator retry for completed-but-partial scoring and `result_ready` fanout is covered in `recovery-20261027.md`. Broader production-like reward-engine load remains NOT RUN.
2. Local baseline: fresh deploy executed all 7 migrations; the existing-schema clone was catalog-checked, resolved with Prisma, then deploy and redeploy were no-ops with balances unchanged (`migration/baseline-procedure.md`). Hosted cutover remains NOT RUN.
3. Local preview image build PASS for `http://127.0.0.1:8221` only (`preview-deploy-plan.md`). The earlier registry timeout was infrastructure, not an app failure. No deploy. Hosted HTTPS/OG/deep-route/API/CORS and device checks remain NOT RUN.
4. Real Android/iPhone/native permissions/location, background/network recovery, OS share-sheet/clipboard and WhatsApp/iMessage delivery/deep links. Responsive Chromium, simulated geolocation and an instrumented share adapter do not satisfy these gates.
