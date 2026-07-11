# PREDIKT Engagement Simulation Review

## 1. What Was Simulated
- Seeded a demo engagement scenario for `test@predikt.ai` with five active rooms spanning open, live, locked, and completed states.
- Exercised the new homepage hub with filters, pinning, and move up/down ordering.
- Validated quick actions for prediction, live view, and result view routing.
- Simulated a group-journey-flavored room using `roomType: "group_journey"` to confirm the hub can surface it without exposing unsafe data.

## 2. What Worked Well
- The active hub now exposes all ongoing rooms in one place with privacy-safe route summaries.
- Approximate progress and ETA labels make room state legible without raw coordinates.
- Immediate pin and reorder feedback makes the dashboard feel more controllable.
- Empty states now point users toward creating or joining a room instead of leaving the section blank.

## 3. What Felt Confusing
- “Waiting for Lock” can read like an action even though it is mostly a status cue.
- Result-ready and completed can blur together unless the CTA is explicit.
- A crowded card becomes harder to scan if status, ETA, route, and reorder controls all compete equally.

## 4. Broken Or Weak UX Points
- The older homepage layout only highlighted three rooms, which hid valuable active context.
- Reorder controls needed optimistic updates or the dashboard felt sluggish.
- Filtered states needed a dedicated empty message so users would not assume data failed to load.

## 5. Privacy Risks Observed
- Dashboard payloads needed strict exclusion of raw lat/lng, route polylines, emails, phone numbers, and hidden prediction values.
- Live progress wording had to avoid implying exact real-time tracking.

## 6. Data/API Issues Observed
- “Joined room” membership is currently inferred from prediction participation, not a dedicated membership model.
- Group journey requires target-specific persistence to fully support traveller opt-in and per-target predictions.

## 7. Performance Issues
- Homepage fetches multiple dashboard endpoints in parallel, so the new hub should stay lightweight and card-oriented.
- Reorder persistence is intentionally small and patch-based to avoid refetching the full dashboard on each move.

## 8. Recommended Fixes
- Add a real participant membership model so joined rooms appear before first prediction.
- Introduce dedicated `RoomTarget` and target-level prediction tables for full group journey support.
- Add room-level refresh controls and finer-grained skeleton states if the hub grows further.

## 9. Fixes Implemented In This Pass
- Added `GET /dashboard/active-predictions` with privacy-safe room cards and approximate live progress.
- Added `PATCH /dashboard/active-predictions/order` with persisted pin and display ordering.
- Added a new homepage “Live PREDIKTs” hub with filters, empty states, and optimistic reordering.
- Added a demo seed script for five active engagement scenarios.
- Added tests covering safe payload behavior, progress approximation, reorder persistence, and auth protection.

## 10. Remaining Gaps
- Full group journey traveller opt-in, target-specific predictions, reveal logic, and per-traveller results are still pending.
- Manual browser QA and end-to-end walkthrough validation still need to be completed against a running backend and Expo web session.
