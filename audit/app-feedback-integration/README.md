# MyPrediktion Wave-1 integration — 29 October 2026

Release status: **BLOCKED** by the existing first-room credit security assertion and outstanding hosted/device acceptance. Work is confined to `fix/app-feedback-integration`; no merge, deployment, DNS change or non-disposable database write was performed. The original checkout and all its untracked work are untouched. The supplied patch remains in this worktree as an untracked input.

## Provenance

Deployed base: `9dd1e04bf22c87280ca96f4edbd44f6c38b958ee`.
Starting integration: `e130f0040d3280b26d983a94e6f220db434987be`.

| Included source | Integration commit | Purpose |
| --- | --- | --- |
| `5b0c3fa9a0a3d8914963e2552a2e995472e038d6` | `ed411a1d66b123c9f43e98f423e522e35af1aeeb` | Existing LiveRoom fixes |
| PR #4 `235d6e7993e8a016c96e1b6e6766c888a7c22047` | `f565d0ef0578d0c6b94611804a49589547fdaa77` | Existing neutral results and sharing |
| Patch header `c9823d2bc256224f7dcaf6ac5dc1a2350f0576b2` | `2a83265` | Public invite allowlist, private/ghost privacy, OG HTML and PNG |
| PR #3 prerequisite `94821864ba8803f8078af09d5cd8ae0e8ed26996` | `d8a16e4` | Start proximity, traffic worker and UI ETA contract |
| Exact corrected PR #3 head `d3d5ee0dc7996bb83de36b91705241411c2c7585` | `8c5035b` | Atomic provider claims and delayed guest snapshots |

Patch SHA-256: `49478641faf5e262bae49f6b9850bd2cc918936fca4a9ddb9b9625ca64cfa382`.
`git apply --check` passed before `git apply --3way`; the original patch applied cleanly. Cherry-picking the head alone exposed its missing prerequisite; that incomplete cherry-pick was aborted, then both PR #3 commits were cherry-picked with `-x`, cleanly. No newer file was replaced wholesale. PRs #3 and #4 were confirmed open/unmerged at the supplied heads.

No Prisma schema or migration changes exist relative to the deployed base. There is no `prediction_rooms.checkpoint_etas` field. The existing tables remain authoritative.

## Integration changes and privacy contract

LiveRoom now passes the participant-safe `checkpointEtas` and `etaMinutes` contract into every CheckpointLeaderboard, including the desktop creator layout, which previously omitted checkpoint boards entirely. Creator movement starts on the creator's own start time. Guest live-state and both leaderboard endpoints apply the safety delay, with no fallback to freshly recomputed provider duration. Provider-attempt rows are excluded from displayed snapshots and standings.

The coordinate audit was reproduced against the retained pre-change export: raw labels `12.345678, 76.543219` and `23.456789, 87.654321` appeared visually and in accessibility/neutral summaries. See `privacy-before.log` and `privacy-findings-before.json`. After normalization all four probes (LiveRoom and neutral summary at 390/1440) pass in `privacy-findings.json`.

The server normalizes new labels before generated titles/questions and room creation, projects old labels in room responses, and applies a response interceptor to nested consumer data. The client API interceptor and direct share-card builder provide defensive fallbacks. Plain pairs, labelled pairs, cardinal/degree strings, geo/loc strings, decimal space-separated pairs, WKT points and DMS pairs become neutral labels. Human addresses remain intact, including `12/34` and full addresses in hover/tap bubbles. No map tiles were added. Public invite responses retain the strict allowlist, reject private previews and hide ghost host identity; no route geometry or coordinates are added to public responses.

A real PostgreSQL race uncovered a ping trying a skipped 20% provider read while the post held the 40% claim. The worker now respects the highest reached mark. Reconstructed earlier rows cannot overwrite existing canonical readings/claims. Concurrent posts and pings produce one provider call and one canonical snapshot/checkpoint reading. In-flight rows never appear in viewer live-state.

**Correction to stale PR #3 description/test-plan claims:** provider failures are persisted as `provider-failed` with a derived ETA; the attempt is consumed, counts toward the five-attempt cap, and is not automatically retried. They do not remain unwritten/retryable. Paid marks are 20/40/60/80/95; 90 is derived, 100 is zero without a provider call.

The static metadata and preview handler compose without duplicate OG tags. The packaged image returns `image/png` with the real PNG signature; missing image routes do not fall back to SPA HTML.

## Validation

| Check | Result / evidence |
| --- | --- |
| Fresh disposable PostgreSQL 16 on `127.0.0.1:55439`, DB `wave1_test`; existing migrations replay | PASS — `postgres-migrations.log` |
| All backend unit/integration tests, including security and actual PostgreSQL concurrency | **FAIL: 194 passed, 1 failed / 195**, 31/32 suites pass — `backend-tests.log` |
| Security integration suite | 9 pass, 1 fails at line 537: expected one `first_room` CreditLedger entry, observed zero |
| Backend e2e | PASS, 1/1 — `backend-e2e.log`; stale Nest starter `/` assertion updated to the existing `/health` contract; initial failure retained in `backend-e2e-before.log` |
| Backend build | PASS — `backend-build.log` |
| Mobile typecheck | PASS — `typecheck.log` |
| All mobile tests, including privacy, invite routing and metadata | PASS, 94/94 — `mobile-tests.log` |
| Expo web export with cleared cache, then static metadata postprocessing | PASS — `export.log` |
| Final actual preview artifact tests | PASS, 1/1 — `preview-tests.log` |
| Chromium at 390px and 1440px | PASS — `live-browser.log`, `result-share-browser.log`, `result-share-browser-1440.log`, `og-browser.log` |
| No migration/schema diff; no checkpoint_etas field | PASS |
| `git diff --check` | PASS |

Browser fixtures verify terminal Start suppression, current creator illustration, guest countdown and delayed illustration, current creator versus withheld/finally delayed guest milestone ETAs, full human-readable location tap/hover bubbles, coordinate sanitization including accessibility and neutral cancelled summaries, all share targets and fallbacks, completed scoreboard preservation, generic public/private/ghost crawler metadata and genuine image responses. Server invite unit/security tests separately verify actual public/private/ghost projection behavior. Browser API fixtures are not live-provider or hosted edge acceptance. Shares are intercepted and do not send messages or establish native delivery.

The first-room security failure is a real unresolved contract mismatch, not suppressed or changed to pass. The deployed-base test has the same assertion, while its RoomsService has no `first_room` grant. Resolving the credit contract is outside these ETA/privacy integrations. Remaining assertions later in that failed test are not reached; their coverage must be rerun after resolution.

## Reproduction and handoff

Install dependencies with `npm ci` in backend and mobile. Start a fresh local PostgreSQL cluster on port 55439, create `wave1_test`, and run `DATABASE_URL=postgresql://USER@127.0.0.1:55439/wave1_test npx prisma migrate deploy` from backend. Run backend `npm test -- --runInBand` and `npm run test:e2e -- --runInBand` with `NODE_ENV=test`, `PORT=3000`, the local DATABASE_URL and test-only JWT_SECRET/ADMIN_JWT_SECRET of at least 16 characters; run `npm run build`.

From mobile run `npm run typecheck`, `npm test`, and `EXPO_PUBLIC_PREVIEW_WEB_ORIGIN=http://localhost:18790 npx expo export --platform web --clear`, followed by `EXPO_PUBLIC_WEB_BASE_URL=http://localhost:18790 node scripts/postprocess-web.mjs dist`. Package into a fresh directory with `EXPO_PUBLIC_PREVIEW_WEB_ORIGIN=http://localhost:18790 node deploy/preview/package.mjs dist /tmp/NEW_PACKAGE`; set PREVIEW_PACKAGE_DIR to that directory for `node --test deploy/preview/server.test.mjs` and `og-browser.cjs`.

Serve mobile/dist at `http://localhost:18790`. Browser runners require Playwright (set PLAYWRIGHT_MODULE if needed) and local Google Chrome. `result-share-browser.cjs` defaults to 390px; also run with `VIEWPORT_WIDTH=1440`. Screenshots remain in `/tmp/app-feedback-integration`; final package is `/tmp/wave1-preview-release`. The original failed coordinate reproduction used the previous artifact at `/tmp/app-feedback-integration/web` on port 18792. No repository source from another branch was modified.

## Exact remaining release blockers

1. Resolve the missing `first_room` credit versus security/API contract, then rerun the entire failed test and full backend suite. Do not release with this failure hidden.
2. Physical iOS/Android acceptance: real GPS/start proximity/arrival and background/resume behavior; native share sheets, clipboard, and installed WhatsApp/Telegram/SMS/Email/Instagram/WeChat/X/Facebook handoffs. **NOT RUN**; browser interception cannot establish them.
3. Actual hosted HTTPS/edge/CORS invite/OG/image acceptance and production-like reward/lifecycle recovery/load checks inherited from the release checklist remain **NOT RUN**. Local artifact checks do not satisfy hosted acceptance. This task authorizes no deployment to perform them.

No production, DNS, merge or non-disposable database activity is part of this handoff. Open the integration PR against `release/deployed-9dd1e04`, keep it unmerged, and retain PRs #3/#4 open.
