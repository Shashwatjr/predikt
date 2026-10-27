# Commands and results

All commands ran in `/Users/krivikshaaitech/predikt-phase1-integration`; no production URL or database write was used.

```text
git rev-parse --verify eb2bd27348039e33dd12cebb7ee6bc85238758e6
eb2bd27348039e33dd12cebb7ee6bc85238758e6

git rev-parse --verify a12ef4d  -> a12ef4ddc358b00223b23f9d37e40f48b117ed49
git rev-parse --verify 6c98f35 -> 6c98f35ee2b0077011c6b33c3464cb8c9fecd519
git merge-base --is-ancestor candidate lane-B -> false
git merge-base --is-ancestor candidate lane-C -> false (Lane C is based on the candidate's parent)

mobile: npm test -- --test-name-pattern='invite|journey-room-render' -> PASS (69 passed, 0 failed)
mobile: npm run typecheck -> NOT RUN (dependencies absent: tsc: command not found)
backend: npm test -- --runInBand account-status.spec.ts -> NOT RUN (dependencies absent: jest: command not found)
backend: npm run build -> NOT RUN (dependencies absent: nest: command not found)
Production/device/DNS/messaging checks -> NOT RUN

```text
INVITE_PREVIEW_PORT=18096 node mobile/src/share/serveInvitePreview.mjs
curl http://127.0.0.1:18096/?joinCode=ab%2B12&forwardedBy=user-7
PASS: crawler response contained OG title/description/url before SPA fallback;
place disclosure remained "Exact location is hidden" and the encoded code was preserved.
```

```text
backend: npm ci --ignore-scripts -> PASS (lockfile install; generated dependencies)
backend: npx prisma generate -> PASS (Prisma Client 5.22.0)
backend: npm test -- --runInBand auth/account-status.spec.ts -> PASS (14 passed, 0 failed)
backend: npm run build -> PASS
mobile: npm run typecheck -> FAIL (inherited LiveRoomScreen.tsx: setStarting/starting undefined at lines 509, 523, 1595, 1750)
mobile: npm ci --ignore-scripts -> BLOCKED (registry tarballs repeatedly reported corrupted/missing; tsc was nevertheless present for the typecheck)

After restoring the intended `starting` in-flight state in `LiveRoomScreen.tsx`:

```text
mobile: npm run typecheck -> PASS
mobile: npm test -- --test-name-pattern='invite|journey-room-render' -> PASS (69 passed, 0 failed)
mobile: npm ci --ignore-scripts --cache /tmp/predikt-mobile-cache-20261026 \
  --fetch-retries=1 --fetch-timeout=30000 -> PASS (562 packages; lockfile unchanged)
npm config get registry -> https://registry.npmjs.org/
initial install evidence -> expo-modules-core@57.0.3 missing/corrupt in cache; fresh cache fetched it successfully
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3300 npx expo export --platform web -> PASS (web bundle emitted)
```

POSTGRES_USER=predikt_test POSTGRES_PASSWORD=predikt_test_password POSTGRES_DB=predikt_test \
  docker compose up -d postgres -> PASS (local container, host port 55433)
DATABASE_URL=postgresql://predikt_test:***@127.0.0.1:55433/predikt_test?schema=public \
  npx prisma migrate deploy -> FAIL/BLOCKED (P3018: first migration alters missing relation activity_events)

```text
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script \
  > /tmp/predikt-schema-derived-20261026.sql -> PASS (1,365 lines; CREATE TABLE activity_events present)
docker exec ... psql < /tmp/predikt-schema-derived-20261026.sql -> PASS (47 public tables; activity_events present)
Schema-derived label: runtime database created from checked-in schema SQL, not migration history or production parity.

Static reproduction before fix -> 2 clout rows, user clout 20 for one result.
Concurrent + retried finalizeRoom after fix -> 1 clout row [10], user clout 10, one result_finalization claim.
Injected downstream failure then retry -> first call failed; clout/claim remained atomic; retry did not duplicate clout.
Aura in this exact-result-finalization path -> unchanged; milestone Aura remains governed by existing reward idempotency.

Local Nest via ts-node on port 3300 + schema-derived DB -> PASS /health.
HTTP create -> invite preview -> guest -> join (forwardedBy) -> milestone prediction -> start -> end/results -> PASS.
Invite preview location fields -> hidden (null); no production URL used.
```
```
```

No secrets, personal data, production writes, schema migrations, lockfile changes, or deployment actions were performed.


## Continuation at 8047f58 (2026-10-27)

See `continuation-20261027.md` and JSON evidence in this directory. Final local API 3410, SPA 8211, disposable DB 55444. No migration-history writes.

```text
git merge-base 8047f58 3d24155 -> 7aa032d
git merge-base 8047f58 2c3ad02 -> eb2bd27
git diff 3d24155^ 3d24155 -- mobile | git apply --3way -> clean (later start-state fix preserved)
mobile: npm run typecheck -> PASS
mobile: node --test tests/api-base-url.test.mjs tests/invite-deeplink.test.mjs tests/journey-room-render.test.mjs tests/journey-functional-review.test.mjs -> PASS (34)
mobile: EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3410 npx expo export --platform web --output-dir /tmp/phase1-integration-web -> PASS
backend: npm run build -> PASS
backend: npm test -- --runInBand rooms/rooms.service.spec.ts rooms/arrival-benchmarks.spec.ts lifecycle/lifecycle.service.spec.ts predictions/predictions.service.spec.ts -> FAIL (26 passed, 1 inherited deletion contract failure)
backend: npm test -- --runInBand rewards/reward.service.spec.ts -> PASS (13)
Browser guest join + prediction and creator journey/start -> 201
Browser fetch with Geolocation destination: POST journey/confirm-arrival -> 201, actualOutcome + real winner/rankings
Browser Delivery ETA create -> POST /rooms 201; POST predictions 201; RoomCreated refresh PASS
Browser Result refresh and Share receipt at 320/1440 -> PASS (share adapter captured; native OS sheet not tested)
Read-only verify-local-scored.cjs -> PASS (arrival, scores, rewards, attribution and delivery persistence)
```

Verifier usage after an HTTP journey, with a loopback disposable test DB:

```sh
DATABASE_URL="$LOCAL_TEST_DATABASE_URL" TEST_ROOM_ID="$SCORED_ROOM_ID" \
TEST_DELIVERY_ROOM_ID="$DELIVERY_ROOM_ID" TEST_EVIDENCE_PATH=/tmp/scored-evidence.json \
node audit/phase1/integration/verify-local-scored.cjs
```

OG unit test imports the renderer; prior HTTP curl targets a standalone fixture server. Actual hosted preview request path remains NOT RUN.


## Follow-up at 5369746

See `reconciliation/checks-and-status.md` for affected commands/results and `reconciliation/preview-artifact.json` for the concrete local preview archive/hash. Existing passing journey/finalization checks were reused. The deletion expectation is resolved; six additional real-DB external-effect safety checks pass, while a seventh test reproduces the unresolved terminal-retry blocker. Migration rehearsal used a scratch candidate prerequisite migration plus six unchanged original files; no historical file, manual history insert or resolve was used. Hosted/device acceptance remains NOT RUN.
