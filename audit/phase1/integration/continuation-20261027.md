# Integration continuation — 2026-10-27 (Asia/Kolkata)

Continued `fix/phase1-integration` at `8047f58` in its existing clean worktree. The initial workspace was another branch; its untracked files and worktrees were preserved. Local commit only. No production/Neon/DNS writes, push, deployment, or migration-history edits.

## Commit review and selection

- `merge-base(8047f58, 3d24155) = 7aa032d`. Cursor is one sibling commit, not an ancestor of integration HEAD. Reviewed its complete mobile diff and `audit/phase1/ui-acceptance/proposed-shared-changes.md` from the commit before applying changes.
- Selected the ten mobile file changes: local API override, normal linking fallback and forwarded intent restoration, defensive place/duration handling, narrow live layout, scored-result suppression and privacy-safe sharing. Three-way application preserved `starting`/`setStarting` from `7aa032d` and the later audit work. No backend code or reward/eligibility rule was replaced.
- Cursor screenshots/claims are historical only, not current verification. Current evidence below supersedes the old splash/static-page captures. Shared proposals are resolved by identifier-only RoomCreated and a valid-member attribution retest.
- `merge-base(8047f58, 2c3ad02) = eb2bd27`. `2c3ad02` is not an ancestor; inspected its four-file diff. Imported **none** of its files. Its SQL-only scenarios cannot establish Arrival service success. `baseline-setup.sh` manually inserts synthetic migration history; excluded, never executed. Statements about Neon history/provenance are unverified, not adopted.
- Independently inspected the first checked-in migration: it alters `activity_events` without creating the base table. Migration repair remains separate and BLOCKED pending verified schema/history reconciliation. No scripts that resolve/mark existing migrations applied were used.

## Fixes

- Every RoomCreated navigation now passes `{roomId}`. The screen loads through authenticated `GET /rooms/:id`, with loading/error/retry and cancellation on unmount. The URL no longer contains `room=[object Object]`. Browser create → RoomCreated, reload, direct restored authenticated URL, and Go to Room all passed. Auth data remains in existing session storage, not URL params.
- Delivery ETA creator submission now calls the ordinary predictions endpoint after creation. Failure routes to prediction recovery for the already-created room. Metadata alone no longer masquerades as a submitted guess.
- Scored result headline joins revealed persisted prediction details to scored leaderboard identities; a reopened final result now displays the winning guess/error. Predictions alone still cannot manufacture a winner/reward.
- Clipped StartupSpark decorative glow to its overlay: it caused a transient 29px horizontal overflow at 320px. Scoreboard overflow is confined to its horizontal scroller.

## Runtime evidence and limits

Backend from this worktree ran on `127.0.0.1:3410`; Expo web export ran on `127.0.0.1:8211` with SPA fallback. A pre-existing IPv6 localhost server on 8191 and backend on 3400 were discovered during harness setup; discarded those attempts and used independent ports. Export required `--clear` once to remove a stale environment transform; final bundle used 3410.

DB: existing disposable `predikt_ui_acceptance_pg`, loopback port 55444, schema-derived `predikt_ui`. Standard reward-rule seed populated 14 rules locally before scoring. No migrations were deployed or marked applied. This proves runtime behavior against this local schema, not migration deployability or hosted parity.

Journey: create and host/forwarder prediction through HTTP; invite open/reload, unauthenticated guest join/predict, and creator start through actual browser UI. Awaited the real three-minute start delay. Browser Geolocation supplied simulated local destination coordinates to `POST /journey/confirm-arrival` via browser fetch (not SQL or a direct service call). This explicitly tests HTTP behavior; automatic physical-device movement and native GPS remain unverified. Arrival returned 201 with actualOutcome, winner and rankings. Browser reopened Result and refreshed it normally.

`arrival-http.json`, `scored-db-evidence.json`, `results-browser.txt`, `join-browser-http.json`, `start-browser-http.json`, `delivery-browser-http.json`, `attribution-controls.json`, `result-share-browser.json`, and `viewport-share-evidence.json`, and `room-created-browser.json` contain concrete evidence; credentials were removed. Screenshots: `screenshots/scored/` (320 and desktop).

Valid forwarder: a newly seeded registered user who joined this room before forwarding. Browser URL retained its UUID after reload and join submitted it; exactly one `invite_forwards` row links creator → forwarder → guest. `user-1` and creator-as-forwarder control joins succeeded without attribution rows, as expected. No backend rule was changed and attribution is not used as reward authority. Rewards are reconciled to persisted predictions/ledger entries. Default `FEATURE_CHECKPOINT_LEADERBOARD_V2=false`: creator predictions remain eligible under existing v1 rules. Optional v2 late-tier exclusions are not claimed as runtime-tested here.

`verify-local-scored.cjs` is a read-only, loopback/test-DB-guarded verifier for the HTTP-created data. It checks actual arrival and start-before-cutoff, each prediction's error, rank/Aura formula, Aura ledger, legacy submission/milestone/participation/winner Clout, valid attribution row, winner identity, and Delivery ETA creator persistence. It writes no scoring or migration history.

Share verification clicks the actual Result Share receipt control at both widths and captures the browser share-adapter payload. It contains the real winner display identity, invite URL and hidden-location disclosure; no private place labels/coordinates/session credentials. OS share-sheet delivery is not verified.

## Checks

- PASS: mobile typecheck; affected mobile API/invite/journey/result tests (34); Expo web export.
- PASS: backend build; lifecycle/prediction/arrival benchmark tests (26 combined with room tests below); reward tests (13).
- FAIL: inherited `rooms.service.spec.ts` deletion case expects default `remove` to cancel for everyone; current implementation requires explicit `cancelForEveryone=true`. One failure / 27 tests in the four-suite run. Unchanged backend/test behavior; do not misreport the suite as green.
- OG: affected unit test imports `invitePreviewHtml.ts` directly. Earlier integration curl exercised **only** `serveInvitePreview.mjs`, a standalone fixture server. Neither exercised a hosted actual preview request path; `mobile/vercel.json` still rewrites requests to index.html. Hosted preview/OG is NOT RUN/unverified.

## Remaining release blockers

Verified migration/schema/history reconciliation and clean deployability; inherited backend deletion-test contract mismatch; real hosted preview and crawler path acceptance; production-like reward failure/retry/load review (outside-transaction effects); native device/GPS/OS share/messaging checks. Production, Neon, DNS and deployment checks remain NOT RUN. See existing `release-checklist.md`; nothing here authorizes release.


Final reconciliation: started 06:01:55 IST, arrived 06:02:09 IST, cutoff 07:57:47 IST. Winner ScoredGuest (`b15a08ec-55e0-4017-bbfc-8f35e394fea2`, displayed as `@scoredguest`, persisted handle null) missed by 38 seconds and earned 144 Aura / 210 total legacy Clout / 50 first-win Gems. Host missed by 202 seconds: 94 Aura / 50 Clout. Forwarder missed by 338 seconds: 6 Aura / 40 Clout. Clout includes the 20-point submission award; RoomResult Clout only stores the milestone component. Negative-control joiners had no scored/reward rows. Formula, recipient and idempotency-key checks passed against actual ledger entries.

Final viewport bounds: 320/320 and 1440/1440 (client/scroll width). Result hero and scoreboard/share screenshots were visually inspected. Scoreboard scrolls horizontally inside its card; paired captures show identity and reward/error columns. Early create/guest step captures precede the StartupSpark glow clipping fix; final delivery-created and results captures show the final build.
