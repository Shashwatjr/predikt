# PREDIKT UX Audit Report

Date: 2026-07-14

Scope:
- Main user-facing mobile app flows
- UX consistency
- Button and navigation behavior
- Functional confidence from local automated checks plus code-path review

What was verified in this pass:
- `mobile` TypeScript compile
- `backend` Jest suite
- `backend` Prisma schema validation
- Screen-by-screen code-path review
- Existing QA docs and prior manual QA notes

What was not fully verified in this pass:
- Full rendered click/tap execution in a live browser or device session
- Console warnings, visual regressions, and responsive behavior in real runtime

## Findings

### 1. Landing “Open Lobby” loses the typed invite code

Severity: High

File: [mobile/src/screens/LandingScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/LandingScreen.tsx:434)

Why it matters:
- A user can type a room code on the landing page, tap `Open Lobby`, and expect the join screen to carry that code forward.
- The current navigation call does not pass `joinCode`, so the UX can feel broken or inconsistent.

Recommendation:
- Navigate with `navigation.navigate('JoinRoom', { joinCode })`.

### 2. LiveRoom always shows “View Results,” even before results exist

Severity: High

File: [mobile/src/screens/LiveRoomScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/LiveRoomScreen.tsx:479)

Why it matters:
- This creates a premature path into the result screen during active journeys.
- From a user perspective, it weakens lifecycle clarity and can lead to an empty or confusing result state.

Recommendation:
- Show `View Results` only when the room is completed or neutral-closed.
- For live rooms, replace it with context-aware secondary actions or hide it entirely.

### 3. Login and Register no longer feel like one onboarding system

Severity: Medium

Files:
- [mobile/src/screens/LoginScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/LoginScreen.tsx:32)
- [mobile/src/screens/RegisterScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/RegisterScreen.tsx:16)

Why it matters:
- Login now uses the newer landing palette, but Register still uses the older theme token path.
- That creates a visible UX seam exactly where trust and continuity matter most.

Recommendation:
- Move Register onto the same landing/onboarding palette and card language as Login.
- Keep CTA tone, spacing, and visual hierarchy aligned.

### 4. Public landing promises easy solo play, but the solo path still gates to login

Severity: Medium

Files:
- [mobile/src/screens/LandingScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/LandingScreen.tsx:156)
- [mobile/src/screens/LandingScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/LandingScreen.tsx:262)

Why it matters:
- The hero and mode copy frame solo as lightweight and instant.
- The actual unauthenticated solo action routes to login, which is a product/UX mismatch rather than a code crash.

Recommendation:
- Either let guests start a solo experience, or make the landing copy clearer that solo requires sign-in.

### 5. Unauthenticated and authenticated navigation models still feel like different products

Severity: Medium

Files:
- [mobile/src/components/LandingDashboardLayout.tsx](/Users/krivikshaaitech/predikt/mobile/src/components/LandingDashboardLayout.tsx:31)
- [mobile/src/components/BottomNav.tsx](/Users/krivikshaaitech/predikt/mobile/src/components/BottomNav.tsx:1)
- [docs/PREDIKT_UI_UX_MANUAL_QA.md](/Users/krivikshaaitech/predikt/docs/PREDIKT_UI_UX_MANUAL_QA.md:36)

Why it matters:
- The public desktop landing uses a faux dashboard shell with `Home / Lobbies / Streams / Messages`.
- The authenticated app uses a different mental model and navigation structure.
- This raises orientation cost at the exact moment a guest becomes a user.

Recommendation:
- Unify the IA language and nav affordances between the public shell and authenticated shell.
- At minimum, align labels and expected destinations.

## What’s Good

### 1. Core lifecycle structure is coherent

- The app has a clear journey: Landing -> Join/Create -> Prediction -> Live -> Result.
- Navigation types are explicit and mostly well-structured.

### 2. Guest join is a strong product decision

File: [mobile/src/screens/JoinRoomScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/JoinRoomScreen.tsx:71)

- Guest participation is thoughtfully implemented.
- The post-auth intent handoff is especially strong and reduces dropped flow risk.

### 3. Privacy language is consistently prioritized

Files:
- [mobile/src/screens/JoinRoomScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/JoinRoomScreen.tsx:144)
- [mobile/src/screens/LiveRoomScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/LiveRoomScreen.tsx:296)
- [mobile/src/screens/RoomCreatedScreen.tsx](/Users/krivikshaaitech/predikt/mobile/src/screens/RoomCreatedScreen.tsx:162)

- The product consistently reinforces delayed/hidden/private location behavior.
- That’s good UX and good trust-building.

### 4. Component reuse is improving

- `PrimaryButton`, `SectionHeader`, onboarding overlays, and shared cards are helping bring order to the app.
- The recent landing and result work moves the app toward a more intentional visual system.

### 5. Automated confidence is solid

- Mobile compile passed.
- Backend tests passed.
- Prisma schema validation passed.
- That does not replace hands-on QA, but it does raise confidence in flow integrity.

## What Needs To Change

Priority 1:
- Fix landing invite-code handoff.
- Remove or gate the premature `View Results` action in live rooms.
- Run full browser/device click QA against the attached test matrix.

Priority 2:
- Unify Login and Register visual language.
- Reconcile guest/solo messaging on the landing page.
- Align public and authenticated navigation language.

Priority 3:
- Capture screenshots and runtime notes for responsive behavior, keyboard/focus states, and error handling.
- Add a lightweight smoke E2E layer later for the highest-value flows: login, create, join, predict, result.

## Overall Assessment

Current state:
- Functionally promising
- Architecturally organized enough to QA effectively
- UX consistency is improving, but still uneven at the seams between public, auth, and in-app flows

Release confidence:
- Good confidence in core code paths
- Moderate confidence in real-world UX until manual rendered click-through is completed
