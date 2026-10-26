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

POSTGRES_USER=predikt_test POSTGRES_PASSWORD=predikt_test_password POSTGRES_DB=predikt_test \
  docker compose up -d postgres -> PASS (local container, host port 55433)
DATABASE_URL=postgresql://predikt_test:***@127.0.0.1:55433/predikt_test?schema=public \
  npx prisma migrate deploy -> FAIL/BLOCKED (P3018: first migration alters missing relation activity_events)
```
```

No secrets, personal data, production writes, schema migrations, lockfile changes, or deployment actions were performed.
