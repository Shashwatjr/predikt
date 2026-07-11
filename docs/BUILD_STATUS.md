# PREDIKT — Build Status

## Guided Creation UX And Web Side Wings — July 9, 2026

- Guided creator UX polish completed:
  - Start/Destination search inputs now show loading, empty, and error states.
  - Search selection copy no longer exposes internal place IDs.
  - Route preview placeholder now presents Start → Destination, a dotted route line, travel mode icon, distance, ETA, suggested moments, and the privacy-safe label `Map preview · exact live location hidden`.
  - Create Room draft now clearly shows room title, prediction question, answer type, selected option, example, route summary, lock time, privacy mode, and safety delay.
  - Preview/create failures now show short inline error copy in addition to alerts.
- Participant prediction UX polish completed:
  - Exact-time prediction explains seconds support, Closest Guess, hidden predictions, and the 2-minute edit/revoke window.
  - Duration prediction clarifies that users are guessing journey duration and keeps quick chips plus Custom duration.
  - Yes/No prediction uses large selected states and adds Before ETA / After ETA helper labels.
  - Route-room prediction screen repeats that no exact live location is shown and progress is privacy-safe/delayed where applicable.
- Route preview placeholder status:
  - Still a styled MVP placeholder, not a rendered map.
  - No raw coordinates are displayed.
- Web side-wing sponsored placeholders status:
  - Added web-only side wings for wide screens (`>=1024px`) on public landing, authenticated dashboard, Help, and Results.
  - Mobile/narrow screens remain uncluttered and show no side-wing sponsored cards.
  - Login/register, route setup, prediction input, privacy/data request, report/block/dispute, and admin-style flows do not receive side-wing placements.
- Static placement/config approach:
  - `mobile/src/config/sponsoredPlacements.ts` contains local static placement config.
  - `SponsoredPlacementCard` renders labelled Partner/Sponsored/Promoted cards with no tracking pixels, no SDK, no popups, no autoplay, and no interstitials.
  - `WebSideWingLayout` gates rendering by platform and width.
- Privacy safeguards for sponsored placements:
  - Placements are separate from PREDIKT results.
  - Placements do not affect predictions, results, Aura, Clout, Credits, leaderboards, Drops, or scoring.
  - Placements use only static page placement context and do not use exact location, route history, private rooms, prediction content, sensitive profiling, or raw GPS.
- Files changed:
  - `mobile/App.tsx`
  - `mobile/src/components/PredictionInputDuration.tsx`
  - `mobile/src/components/PredictionInputExactTime.tsx`
  - `mobile/src/components/PredictionInputYesNo.tsx`
  - `mobile/src/components/PredictionOptionCard.tsx`
  - `mobile/src/components/RoutePlaceSearchInput.tsx`
  - `mobile/src/components/RouteSummaryCard.tsx`
  - `mobile/src/components/SponsoredPlacementCard.tsx`
  - `mobile/src/components/WebSideWingLayout.tsx`
  - `mobile/src/config/sponsoredPlacements.ts`
  - `mobile/src/screens/CreateRoomScreen.tsx`
  - `mobile/src/screens/HelpScreen.tsx`
  - `mobile/src/screens/HomeScreen.tsx`
  - `mobile/src/screens/LandingScreen.tsx`
  - `mobile/src/screens/PredictionScreen.tsx`
  - `mobile/src/screens/ResultScreen.tsx`
  - `mobile/src/screens/RoomCreatedScreen.tsx`
  - `mobile/src/components/DashboardOnboardingOverlay.tsx`
  - `docs/BUILD_STATUS.md`
  - `docs/MVP_SPEC.md`
  - `docs/USER_EXPERIENCE_NOTES.md`
  - `docs/PRIVATE_BETA_TEST_CHECKLIST.md`
  - `docs/PRIVACY_AND_SAFETY.md`
  - `docs/GOVERNANCE_COMPLIANCE.md`
- Tests run:
  - `cd mobile && npx tsc --noEmit` passed.
  - IDE lints reported no errors for changed mobile files.
- Manual QA status:
  - Browser/device visual QA remains pending because this agent session cannot operate Chrome DevTools.
  - Checklist items to verify manually: wide-web side wings, mobile no-side-wing behavior, route preview card layout, prediction option selected state, duration/yes-no participant inputs, and post-create privacy copy.
- Known limitations:
  - Route preview is still a polished placeholder rather than full map rendering.
  - Duration and yes/no prediction choices still bridge to the timestamp-compatible backend model for MVP compatibility.
  - Sponsored CTAs are visual placeholders with `targetType: "none"` in this pass.
- Next recommended step:
  - Run a real Chrome/Expo Web visual QA pass at mobile width and desktop width, then capture screenshots for landing, dashboard, Help, route creation, prediction input, and Results.

## Help And Onboarding Update — July 9, 2026

- Help section added:
  - New `HelpScreen` explains what PREDIKT is, how Prediction Rooms work, Aura, Clout, Credits, hidden predictions until lock, edit/revoke rules, result reveal, route privacy, safety tools, and FAQ.
  - Help is reachable from public landing, authenticated dashboard, and profile/settings.
- Guided onboarding added:
  - First authenticated dashboard visit now shows a guided bubble-style overlay with next, back, skip, and done actions.
  - Tour covers welcome, Aura, Clout, Credits, leaderboard, active rooms, create room, route privacy, daily challenge and Drops, plus Help and safety.
  - Help and profile both expose replay entry points for the dashboard tour.
- Storage approach for completion status:
  - Local-only in this sprint.
  - Key: `predikt.onboarding.dashboard.v1.completed`
  - Native storage: `expo-secure-store`
  - Web storage: `@react-native-async-storage/async-storage`
- Screens and components changed:
  - Added `mobile/src/screens/HelpScreen.tsx`
  - Added `mobile/src/components/DashboardOnboardingOverlay.tsx`
  - Added `mobile/src/components/InfoTip.tsx`
  - Added `mobile/src/services/onboardingStorage.ts`
  - Updated landing, home, profile, create room, prediction, result, and navigation files
- Contextual tips added:
  - Create Room tip explains room types, lock timing, and route privacy.
  - Prediction tip explains submit-before-lock, 2-minute edit/revoke, and hidden predictions.
  - Result tip explains Aura, Dot Bonus, and Rematch.
- Test results:
  - `cd mobile && npx tsc --noEmit` pending until final verification section below is refreshed.
- Manual QA status:
  - Implementation completed in code.
  - Manual Expo Web and device walkthrough still pending for visual/interaction confirmation.
- Known limitations:
  - Tour completion is persisted locally only; server-side preference sync is not implemented in this sprint.
  - Dashboard tour uses a lightweight centered overlay rather than per-element measured callouts to preserve Expo Web compatibility and keep risk low.
- Next recommended steps:
  - Add optional backend preference sync with `dashboardOnboardingCompletedAt`, `helpViewedAt`, and `onboardingVersion`.
  - Upgrade the tour to anchor precisely to measured dashboard elements if product wants tighter spotlighting later.

## Guided Prediction Setup Update — July 9, 2026

- Guided prediction options added:
  - Journey room creation now suggests `Arrival Time`, `Journey Duration`, and `Beat ETA` after route preview.
  - A future-facing `Delay Range` card is shown disabled rather than pretending multi-choice is fully supported.
- Start → Destination selection status:
  - Added search-first Start and Destination inputs backed by `GET /routes/place-search`.
  - Expo Web-safe route preview placeholder remains in use instead of a native map render.
- Route preview status:
  - Route preview still uses backend-safe fallback route summaries with distance, estimated duration, travel mode, and privacy delay.
  - `POST /rooms/from-route` now accepts `primaryPrediction` and stores the selected guided `answerType`.
- Participant prediction UX changes:
  - `exact_time` rooms show a guided time input with quick `-5`, `-1`, `+1`, `+5` minute adjustments.
  - `duration` rooms show quick chips plus a custom duration field.
  - `yes_no` rooms show large `Before ETA` and `After ETA` choices.
- Privacy guardrails verified:
  - Public/participant route summaries still rely on safe labels, ETA-style summaries, delay messaging, and no raw GPS.
  - Guided route setup does not expose live or precise participant coordinates.
- Tests run:
  - `cd mobile && npx tsc --noEmit` pending final verification below.
  - Backend build/test commands should be run if final verification includes backend compilation for the new DTO/service change.
- Manual QA status:
  - Code path implemented.
  - Visual and flow QA for search suggestions, room creation, and participant answer-type rendering remains manual.
- Known limitations:
  - Search results still use the backend fallback suggestion engine unless a real places provider is configured.
  - `duration` and `yes_no` answers currently map into the existing time-based prediction engine for MVP compatibility.

## Expo Web Browser QA Attempt — July 9, 2026

- Browser used:
  - No controllable Chrome/DevTools/browser automation tool was available in this Cursor agent session.
  - Hands-on browser clicks, visual inspection, DevTools Network headers, and Console capture remain pending for a human browser session.
  - HTTP/API checks below were run against the same local Expo/backend environment used by the browser.
- Environment:
  - Backend URL: `http://localhost:3000`
  - Health: `GET /health` returned `200` with `{ "status": "ok", "app": "predikt-api" }`
  - Expo Web URL: `http://localhost:8081`, HTTP smoke returned `HTTP/1.1 200 OK`
  - Mobile API base URL: no `mobile/.env*` exists; app uses `process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:3000'`
- Public landing QA result:
  - Public `LandingScreen` is the unauthenticated initial route by code path.
  - Demo prediction state is local-only in `LandingScreen`; no prediction API call is wired to the demo buttons.
  - Join with Code preview, Create Room login gate, Profile login gate, and bottom-nav gated actions are implemented.
  - Visual match, tap behavior, and console status still need real browser inspection.
- Login QA result:
  - Requested test user `test@predikt.ai` / `Password123!` logged in successfully.
  - `POST /auth/login` returned `accessToken`, `accessTokenExpiresAt`, `refreshToken`, `refreshTokenExpiresAt`, and `user`.
  - `GET /auth/me` worked with `Authorization: Bearer <accessToken>` and did not include `passwordHash`.
  - Dashboard endpoints for summary, recommendations, active rooms, daily challenge, daily spin, drops, activity, and suggested follows returned `200`.
- Reload persistence result:
  - Mobile web storage path is implemented through `@react-native-async-storage/async-storage` under `predikt.auth.session.v1`.
  - `AuthContext` restores stored sessions on app boot and refreshes expired access tokens when refresh tokens remain valid.
  - Actual browser reload persistence remains pending because this session cannot operate the browser.
- Refresh-token result:
  - `POST /auth/refresh` succeeded and returned rotated tokens.
  - Reusing the old refresh token returned `401`.
  - Mobile API client has one-request retry protection (`_retry`) plus in-flight refresh de-dupe.
  - Visual DevTools confirmation of automatic refresh retry remains pending.
- Logout result:
  - `POST /auth/logout` succeeded.
  - Refresh token reuse after logout returned `401`.
  - Mobile logout code clears local state, persisted storage, and the default Authorization header even if backend logout fails.
- Dashboard/profile/route-room result:
  - Profile stats loaded.
  - Profile handle update endpoint succeeded.
  - Route preview returned `approximate_delayed` privacy mode.
  - Route-based room creation succeeded and returned invite code `6YDNA` in this QA run.
  - Public invite preview and participant room detail did not expose `passwordHash` or non-null raw GPS fields in scripted checks.
- Prediction edit/revoke result:
  - Prediction submission succeeded.
  - Edit using mobile-compatible `predictedArrivalTime` succeeded on the active `3000` backend.
  - Revoke within the edit window succeeded.
- Security/privacy network checks:
  - CORS preflight from `http://localhost:8081` to `POST /auth/login` returned `204` with `access-control-allow-origin: http://localhost:8081`.
  - Checked auth/public/participant responses did not include `passwordHash`.
  - Checked public/participant route responses did not include non-null raw GPS coordinate fields or raw GPS trail keys.
  - Normal user token was rejected from `/admin/dashboard` with `401`.
- Console errors/warnings:
  - Browser console could not be inspected from this agent session.
  - No CORS failures were observed in HTTP/API checks.
- Bugs fixed:
  - No new bugs were found or fixed in this pass.
  - Previously fixed prediction edit compatibility was confirmed on the active backend.
- Tests run:
  - `cd mobile && npx tsc --noEmit` passed.
- Remaining gaps:
  - Human Chrome DevTools QA is still needed for visual landing, tap states, login route transition, browser reload persistence, automatic `/auth/refresh` retry visibility, logout UI routing, Network request headers, and Console warnings/errors.
  - Full UI verification for result reveal, reactions, report/block/dispute entry points, and post-lock edit/revoke blocking remains manual.

## Auth Session Expo Web QA Readiness — July 9, 2026

- Active environment:
  - Active browser backend port: `http://localhost:3000`
  - Health endpoint: `GET http://localhost:3000/health` returned `200` with `{ "status": "ok", "app": "predikt-api" }`
  - `http://localhost:3001/health` was initially not reachable; a temporary updated backend was later started on `3001` only to verify the prediction-edit fix, then stopped.
  - Mobile API base URL used by code: `process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:3000'`
  - No `mobile/.env*` file was present, so Expo Web uses the `localhost:3000` fallback in this session.
  - Expo Web URL: `http://localhost:8081`; HTTP smoke returned `HTTP/1.1 200 OK`.
- Landing QA result:
  - Public landing is registered as the unauthenticated initial route.
  - Landing demo is local UI state in `LandingScreen` and does not call prediction APIs.
  - Join with Code preview, Create Room gate, and Profile gate are implemented in the public landing UI.
  - Visual/browser click QA still requires hands-on browser verification because this agent session cannot inspect DevTools or interact with the rendered page.
- Login/session QA result:
  - `POST /auth/login` succeeded with seeded users and returned `accessToken`, `accessTokenExpiresAt`, `refreshToken`, `refreshTokenExpiresAt`, and `user`.
  - Auth response and `GET /auth/me` did not include `passwordHash`.
  - Protected `GET /auth/me`, dashboard summary/recommendations/active rooms/suggested follows, and profile stats accepted the Bearer `Authorization` header.
  - Mobile code stores sessions under `predikt.auth.session.v1` using `expo-secure-store` natively and `@react-native-async-storage/async-storage` on web.
  - Browser reload persistence is supported by code inspection and storage implementation, but visual reload confirmation remains a manual browser gap.
- Refresh-token QA result:
  - `POST /auth/refresh` succeeded and returned rotated access/refresh tokens.
  - Reusing the old refresh token returned `401`.
  - A protected dashboard request succeeded with the new access token.
  - Invalid refresh token returned `401`; mobile client code clears local session on refresh failure and avoids infinite loops with a single `_retry` guard and in-flight refresh de-dupe.
  - Browser DevTools confirmation of the automatic 401 retry path remains pending because access-token expiry was not shortened in the active browser backend.
- Logout QA result:
  - `POST /auth/logout` returned `{ "success": true }` for the current refresh token.
  - Refresh after logout returned `401`.
  - Mobile logout code clears local state, persisted storage, and the default `Authorization` header even if backend logout fails.
- Core flow regression result:
  - Route preview fallback returned `approximate_delayed` privacy mode and no non-null raw coordinate fields.
  - Route-based room creation succeeded and returned an invite code.
  - Public invite preview and participant room detail did not include `passwordHash` or non-null raw coordinate fields in scripted checks.
  - Prediction submit, edit, revoke, and hidden-list endpoints were exercised.
  - Result reveal, reactions, reports, blocks, disputes, and full browser profile/route UI flows remain manual regression items.
- Console/network issues found:
  - CORS preflight from `http://localhost:8081` to `POST /auth/login` passed with `access-control-allow-origin: http://localhost:8081`.
  - No failed CORS behavior was seen in scripted HTTP checks.
  - Browser console errors could not be inspected from this agent session.
- Fixes made:
  - `backend/src/predictions/dto/update-prediction.dto.ts` now accepts the mobile-compatible `predictedArrivalTime` field as well as `predictedReachedTime`.
  - `backend/src/predictions/predictions.service.ts` maps either field to `predictedReachedTime` and returns a clear `400` if neither timestamp is provided.
- Tests run:
  - `cd mobile && npx tsc --noEmit` passed.
  - `cd backend && npx prisma generate` passed.
  - `cd backend && npm run build` passed.
  - `cd backend && npm test -- --runInBand` passed with 8 suites / 18 tests.
  - Updated backend verification on temporary `3001` passed submit/edit/revoke for prediction edits.
- Remaining manual gaps:
  - Open Expo Web and manually confirm visual landing, tap states, login transition, browser reload persistence, DevTools Network headers, automatic `/auth/refresh` retry, logout navigation, and console warnings/errors.
  - Complete hands-on dashboard/profile/route room/result reveal/reactions/report/block/dispute QA in the browser.

## Mobile Session Follow-Through — July 9, 2026

- Mobile refresh-token support status:
  - login/register now store `accessToken`, `accessTokenExpiresAt`, `refreshToken`, `refreshTokenExpiresAt`, and `user`
  - app reload restores persisted session and refreshes if the access token is expired but the refresh token is still valid
  - invalid or expired refresh tokens clear local state and return the user to the public landing flow
- Files changed:
  - `mobile/package.json`
  - `mobile/package-lock.json`
  - `mobile/src/context/AuthContext.tsx`
  - `mobile/src/services/api.ts`
  - `mobile/src/services/authStorage.ts`
  - `mobile/src/navigation/AppNavigator.tsx`
  - `mobile/src/navigation/types.ts`
  - `mobile/src/screens/LoginScreen.tsx`
  - `mobile/src/screens/RegisterScreen.tsx`
  - `mobile/src/screens/JoinRoomScreen.tsx`
  - `mobile/src/screens/LiveRoomScreen.tsx`
  - `mobile/src/screens/LandingScreen.tsx`
  - `docs/BUILD_STATUS.md`
  - `docs/SECURITY_GUARDRAILS.md`
  - `docs/API_SPEC.md`
  - `docs/PRIVATE_BETA_TEST_CHECKLIST.md`
  - `docs/USER_EXPERIENCE_NOTES.md`
- Storage approach:
  - native: `expo-secure-store`
  - web: `@react-native-async-storage/async-storage`
  - session key: `predikt.auth.session.v1`
- Refresh retry behavior:
  - authenticated requests attach the current access token
  - if the access token is near expiry, the client attempts one proactive refresh
  - on `401`, the client attempts one refresh for non-auth endpoints, retries the original request once on success, and clears the session on failure
  - auth endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`) do not trigger refresh loops
- Logout cleanup behavior:
  - mobile calls `POST /auth/logout` with the refresh token when available
  - local access token, refresh token, expiry metadata, stored session, and default Authorization header are cleared even if backend logout fails
  - app returns to unauthenticated landing routing after cleanup
- Expo Web QA result:
  - `curl -I http://localhost:8081` returned `HTTP/1.1 200 OK`
  - interactive browser QA remains manual pending in this agent session
- Commands run:
  - `cd mobile && npm install @react-native-async-storage/async-storage expo-secure-store`
  - `cd mobile && npx tsc --noEmit`
  - `curl -I http://localhost:8081`
- Pass/fail status:
  - `npx tsc --noEmit` passed in `mobile`
  - Expo Web HTTP smoke check on `8081` passed
- Known limitations:
  - no browser automation was available to verify actual refresh/reload flows visually
  - `EXPO_PUBLIC_API_BASE_URL` is supported, but developers still need to point it at `3000` or `3001` based on the running backend
  - logout route handling is state-driven; no explicit navigation action is fired beyond auth-state reset
- Next recommended steps:
  - complete manual Expo Web QA for reload, refresh retry, logout cleanup, and route-first room creation against the current backend port
  - add a lightweight mobile integration or component test harness around session restore and refresh behavior

## Phase 1 Enterprise Hardening — July 9, 2026

- Hardening changes made:
  - added short-lived access tokens plus refresh and logout endpoints
  - added `UserSession` persistence with hashed refresh tokens and rotation on refresh
  - removed fallback-secret behavior from runtime auth paths and added startup env validation
  - enabled Helmet secure headers and environment-driven CORS parsing
  - added DTO validation for high-risk write endpoints across routes, auth refresh/logout, profile, privacy, moderation, and admin writes
  - added integration coverage for hidden predictions, safe projections, admin auth, credit idempotency, route privacy, and refresh/logout
- Files changed:
  - `backend/prisma/schema.prisma`
  - `backend/src/app.bootstrap.ts`
  - `backend/src/config/env.validation.ts`
  - `backend/src/main.ts`
  - `backend/src/app.module.ts`
  - `backend/src/auth/*`
  - `backend/src/common/guards/jwt-auth.guard.ts`
  - `backend/src/routes/*`
  - `backend/src/predictions/*`
  - `backend/src/privacy/*`
  - `backend/src/moderation/*`
  - `backend/src/users/*`
  - `backend/src/admin/*`
  - `backend/src/security.integration.spec.ts`
  - `.env.example`
  - `docs/API_SPEC.md`
  - `docs/SECURITY_GUARDRAILS.md`
  - `docs/PRIVACY_AND_SAFETY.md`
  - `docs/GOVERNANCE_COMPLIANCE.md`
  - `docs/SOLUTION_REVIEW_ENTERPRISE_READINESS.md`
  - `docs/BUILD_STATUS.md`
- Env vars added/changed:
  - `CORS_ORIGINS`
  - `ADMIN_JWT_SECRET`
  - `JWT_ACCESS_TTL_SECONDS`
  - `JWT_REFRESH_TTL_DAYS`
  - `ADMIN_JWT_TTL_SECONDS`
- Tests added:
  - backend integration suite for refresh/logout rotation, hidden predictions, safe projections, admin auth boundaries, credit ledger idempotency, and route privacy
- Commands run:
  - `cd backend && npm install helmet`
  - `cd backend && npx prisma generate`
  - `cd backend && npx prisma db push`
  - `cd backend && npm run build`
  - `cd backend && npm test -- --runInBand`
  - `cd mobile && npx tsc --noEmit`
- Pass/fail status:
  - `npx prisma generate` passed
  - `npx prisma db push` passed
  - `npm run build` passed in `backend`
  - `npm test -- --runInBand` passed in `backend` with 8 suites / 18 tests
  - `npx tsc --noEmit` passed in `mobile`
- Remaining gaps:
  - mobile client does not yet store/rotate refresh tokens
  - privacy request fulfillment remains intake-first rather than queue/workflow-driven
  - admin auth still lacks MFA and session inventory
  - route preview is still fallback data, not provider-backed
  - production observability, queueing, and incident response remain future work
- Manual QA still needed:
  - Expo Web/browser verification for CORS and auth refresh behavior
  - authenticated mobile session persistence and logout flows
  - route-first room creation and result reveal flows on device/browser
  - admin workflow regression checks in a browser/client

## Public Landing UI Redesign — July 9, 2026

- Public landing UI redesign completed for the unauthenticated mobile/web entry screen.
- Files changed:
  - `mobile/src/screens/LandingScreen.tsx`
  - `mobile/src/navigation/AppNavigator.tsx`
  - `docs/BUILD_STATUS.md`
  - `docs/USER_EXPERIENCE_NOTES.md`
  - `docs/MVP_SPEC.md`
- Demo behavior:
  - Try a PREDIKT is local UI state only.
  - Demo delivery Challenge supports Yes, No, and Exact time choices.
  - Selecting an option shows `Your demo guess: 34 mins` and a sample `#3` rank without calling prediction APIs or writing data.
  - Live PREDIKTs, Join with Code, Popular ways to play, and Recent Results render from static public demo content.
- Auth gating behavior:
  - Unauthenticated users start at the public landing screen first.
  - Explicit navigator initial route is `Landing` without a token and `Home` with a token.
  - Create Room, Profile, notifications, real room participation, and saved progress actions show login/signup prompts.
  - Existing authenticated dashboard flow remains on `HomeScreen`.
- Test results:
  - `npx tsc --noEmit` passed in `mobile`.
  - IDE lints reported no errors for `mobile/src/screens/LandingScreen.tsx` or `mobile/src/navigation/AppNavigator.tsx`.
- Manual QA status:
  - Existing Expo Web server on `8081` responded with `HTTP/1.1 200 OK`.
  - A second `npx expo start --web --clear` was not started because an Expo server for `mobile` was already associated with port `8081`.
  - Browser interaction QA still needs hands-on verification for tap states, console output, login transition, and authenticated route-first room creation.
- Known gaps:
  - Aura crystal is an original gradient/emoji placeholder until final illustration assets are available.
  - Bottom navigation is a public landing visual/navigation affordance, not a full unauthenticated tab navigator.
  - Sample public rooms/results are static demo content.

## Enterprise Review Update — July 8, 2026

- Review completed: enterprise-readiness review finished and documented in `docs/SOLUTION_REVIEW_ENTERPRISE_READINESS.md`.
- Files reviewed: backend auth, rooms, routes, predictions, lifecycle, dashboard, privacy, moderation, admin, shared privacy/user utilities, Prisma schema, core mobile screens, and key docs.
- Comments added: privacy boundary, fairness rule, AI governance, result integrity, and credit ledger intent comments were added in business-critical backend paths.
- Bugs fixed:
  - auth now normalizes email casing/whitespace before register/login lookup
  - self-profile responses now include self-only email again for mobile profile display
  - admin credit reversal now returns `400` for invalid amount instead of `401`
  - prediction submission copy now uses Aura terminology and explains hidden predictions plus edit/revoke timing
- Recommendations summary:
  - harden auth/session/CORS/secrets posture
  - replace `any` write payloads with DTO validation
  - rebuild route-first mobile creation UX
  - add structured observability, pagination, indexing, and queue-backed workflows
  - expand integration coverage around privacy, scoring, and admin controls
- Test status:
  - `npx prisma generate` passed on July 8, 2026
  - `npm run build` passed in `backend`
  - `npm test -- --runInBand` passed in `backend` with 7 suites / 13 tests
  - `npx tsc --noEmit` passed in `mobile`
- Manual QA gaps:
  - no browser/device automation evidence for full Expo Web flows
  - route-first creation, join flow, edit/revoke, result reveal, privacy request UX, and admin workflows still need hands-on QA
  - poor-network/offline behavior remains largely unverified

## Features

- Added reusable public-safe user, room, route, location privacy, and content-policy helpers.
- Added anti-betting keyword blocking for room/profile/result text with audit events.
- Added hidden-until-lock prediction lists, two-minute edit/revoke endpoints, second-level scoring tiers, Dot Bonus flexes, comeback/rematch/Moment Card/reaction result metadata.
- Added Credits as a separate non-cash ledgered currency with progressive signup, first prediction, first room, and result-declared events.
- Added reports, blocks, disputes, result reactions, policy endpoints, data export/deletion request aliases, and AI personalization opt-out.
- Added admin reports, rooms, disputes, credit ledger, suspend, remove room, reverse credits, and resolve dispute endpoints.
- Added public mobile landing/demo before login, unauthenticated join-code preview, legal policy screens, profile privacy actions, and result reactions/copy.
- Added MVP rate limiting with `@nestjs/throttler` for register, login, room creation, route-room creation, prediction submission, invite-code lookup, daily spin claim, report submission, and handle availability.

## Files Changed

- Backend: `backend/prisma/schema.prisma`, `backend/src/app.module.ts`, `backend/src/auth/auth.service.ts`, `backend/src/rooms/*`, `backend/src/routes/routes.service.ts`, `backend/src/predictions/*`, `backend/src/lifecycle/*`, `backend/src/leaderboards/leaderboards.service.ts`, `backend/src/users/*`, `backend/src/privacy/*`, `backend/src/admin/*`, `backend/src/moderation/*`, `backend/src/common/constants/*`, `backend/src/common/utils/*`.
- Backend dependency files: `backend/package.json`, `backend/package-lock.json`.
- Mobile: `mobile/src/navigation/AppNavigator.tsx`, `mobile/src/context/AuthContext.tsx`, `mobile/src/screens/LandingScreen.tsx`, `mobile/src/screens/LegalScreen.tsx`, `mobile/src/screens/JoinRoomScreen.tsx`, `mobile/src/screens/ProfileScreen.tsx`, `mobile/src/screens/ResultScreen.tsx`.
- Docs: `docs/API_SPEC.md`, `docs/MVP_SPEC.md`, `docs/BUILD_STATUS.md`, `docs/PRIVATE_BETA_TEST_CHECKLIST.md`, `docs/USER_EXPERIENCE_NOTES.md`, `docs/PRIVACY_AND_SAFETY.md`, `docs/SECURITY_GUARDRAILS.md`, `docs/ABUSE_PREVENTION.md`, `docs/GOVERNANCE_COMPLIANCE.md`, `docs/ADMIN_CONTROL_CENTER.md`.

## Models And Endpoints

- New/updated models: `CreditLedger`, `Report`, `UserBlock`, `RoomDispute`, `ResultReaction`, user consent/preference/status/asset fields, room prediction/result/privacy fields, prediction edit/revoke/diff-second fields.
- New endpoints: `PATCH /predictions/:predictionId`, `POST /predictions/:predictionId/revoke`, `POST /reports`, `POST|DELETE /users/:userId/block`, `GET /users/me/blocked`, `POST /rooms/:roomId/disputes`, `POST /rooms/:roomId/reactions`, `GET /policies/*`, `POST /privacy/data-export-request`, `POST /privacy/data-deletion-request`, `PATCH /privacy/ai-personalisation-opt-out`, and admin moderation/credits endpoints.

## Security And Privacy Guardrails

- No `passwordHash` in auth, public, leaderboard, room, or admin list/detail responses.
- Participant room and route projections omit raw coordinates and route history.
- Route rooms default to delayed/approximate participant presentation with safety delay copy.
- Hidden predictions do not expose values before lock.
- Reports/blocks/disputes and admin actions create audit logs where implemented.
- Credits copy and ledger preserve non-cash, non-transferable, non-withdrawable semantics.
- Rate limiting returns HTTP `429` with `Too many requests. Please slow down and try again in a minute.`

Rate limit defaults:

- Global fallback: 300 requests/minute per endpoint/IP tracker.
- `POST /auth/register`: 5/minute.
- `POST /auth/login`: 10/minute.
- `POST /rooms` and `POST /rooms/from-route`: 20/minute.
- `POST /rooms/:roomId/predictions` and `POST /rooms/:roomId/milestone-predictions`: 60/minute.
- `GET /rooms/code/:inviteCode`: 30/minute.
- `POST /dashboard/daily-spin/claim`: 10/minute.
- `POST /reports`: 10/minute.
- `GET /users/handle-available/:handle`: 60/minute.

## Tests Run

- `npx prisma generate` passed.
- `npx prisma db push` passed against local PostgreSQL.
- `npx prisma db seed` passed and reported seeded demo users, `DEMO1`, and local admin credentials.
- `npm run build` passed in `backend` after rate limiting and route projection fix.
- `npm test -- --runInBand` passed: 7 suites, 13 tests.
- `npx tsc --noEmit` passed in `mobile`.
- IDE lints reported no errors for `backend/src` and `mobile/src`.

## Curl Evidence

- Fresh API was started on `PORT=3001 npm run start` to avoid disturbing an existing API on `3000`.
- First API run passed 75 checks and failed participant route safety because `GET /rooms/:roomId` returned `route: null` for participants.
- Fixed participant safe route projection in `backend/src/rooms/rooms.service.ts`.
- Full rerun passed 76/76 checks.

Verified API areas:

- Auth/profile: register, login, me, profile update, handle availability, handle suggestions.
- Dashboard: summary, following leaderboard, recommendations, active rooms, daily challenge, daily spin, daily spin claim, drops near unlock, activity feed, suggested follows.
- Routes/rooms: place search/details, route preview, route room creation, custom room creation, join by code, participant room detail.
- Predictions/results: submit, hidden-before-lock list, edit, revoke, lock, visible-after-lock list, edit/revoke blocked after lock, result declaration, leaderboard, result metadata, reactions.
- Security/privacy: no `passwordHash`, no public/dashboard/participant email, no non-null raw coordinate keys in checked public/participant/dashboard responses, safe participant route fields, anti-betting block, reports, blocks, disputes, data export/deletion, AI opt-out, admin auth required.
- Credits: signup, first prediction, first room, result declared, duplicate prevention for first room/first prediction, credit reversal.
- Policies: privacy, terms, community guidelines, anti-betting.
- Admin: users, rooms, reports, credit ledger, disputes, audit logs, suspend user, remove room, reverse credits, resolve dispute.
- Rate limiting: 429 verified on handle availability with clear message.

## Manual QA Status

- Expo Web port check: `8081` is already served by `node` PID `1203`.
- Expo HTTP smoke check: `curl -I http://localhost:8081` returned `HTTP/1.1 200 OK`.
- `npx expo start --web --clear` cannot start a second server while `8081` is occupied; Expo asks whether to use `8082`, but non-interactive execution cannot answer.
- To restart manually: stop PID `1203` or the existing Expo terminal, then run `cd mobile && npx expo start --web --clear`.
- Interactive browser QA was not completed because this session has no browser/console automation tool. Public landing, demo prediction, authenticated flows, CORS, and browser console checks still need manual verification in a browser.

## Known Limits

- Credits events for “room gets 3 trusted players” and “first result shared” are scaffolded in policy/docs but not implemented.
- Report/block/dispute workflows are MVP foundations without reviewer queues beyond admin endpoints.
- Route preview remains deterministic fallback data, not a map provider integration.
- Browser QA remains manually blocked as noted above.
- `npm install @nestjs/throttler` reported 2 high-severity npm audit findings; audit remediation was not run in this pass.

## Next Steps

- Complete interactive browser QA for landing/demo, route room creation, participant privacy, results, reactions, report/block/dispute access, legal/privacy actions, CORS, and browser console errors.
- Add automated contract tests for no raw GPS/no `passwordHash`/hidden predictions/admin auth.
- Implement remaining progressive Credit events for 3 trusted players and first result shared.
