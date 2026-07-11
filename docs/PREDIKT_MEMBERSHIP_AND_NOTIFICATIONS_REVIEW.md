# PREDIKT Membership And Notifications Review

## Summary
- Added explicit `RoomMembership` so users can join rooms before predicting.
- Added `UserNotification` inbox support for room and journey lifecycle updates.
- Added simple mobile notification access through Home and Profile.

## Membership Behavior
- Creator membership is created when rooms are created.
- `POST /rooms/:roomId/join` creates or restores joined membership without submitting a prediction.
- `POST /rooms/:roomId/leave` marks participant membership as left without deleting old predictions.
- Joined rooms appear in the active hub before prediction and remain marked as needing a prediction.
- Private room details require membership; public invite preview remains safe.

## Notification Behavior
- Notifications support unread, read, and archived statuses.
- Supported inbox endpoints include list, unread count, read one, and read all.
- Room join creates `room_joined`, `room_invite_accepted`, and `prediction_needed` notifications.
- Lifecycle transitions create friendly notifications for locked predictions, journey start, overdue, cancellation, neutral closure, arrival, result ready, reliability updates, and participation recognition.
- Notification metadata is sanitized to avoid raw GPS, coordinates, route history, emails, phones, password hashes, and hidden prediction values.

## UI Review
- Home uses a compact bell badge instead of a text-heavy notification block.
- Notifications screen uses short rows, severity labels, and one action link per item.
- Invite preview copy was shortened and Join now creates membership first.
- External consumer apps were treated as pattern inspiration only; no copied assets, copy, slogans, layouts, or brand identity were added.

## Issues Found And Fixes
- Existing membership was inferred from predictions; fixed with `RoomMembership`.
- Joined-before-prediction rooms were absent from the hub; fixed through membership-aware dashboard queries.
- Notification center did not exist; fixed with backend endpoints and mobile screen.
- Placeholder Home bell routed to Help; fixed to route to Notifications.
- Manual QA found that `UserRoomPreference` could keep a left joined-only room in the hub; fixed so active hub inclusion requires creator status or active joined membership.
- Visible app copy contained restricted real-money/betting phrasing and one third-party brand-like demo reference; fixed with neutral, original PREDIKT copy.

## Verification
- `npx prisma generate`: passed.
- `npx prisma db push`: passed.
- `npm run build`: passed.
- `npm test -- --runInBand`: passed, 12 suites / 38 tests.
- `npm run seed:engagement-demo`: passed.
- `npx tsc --noEmit`: passed for mobile.
- Scripted local web/API QA: passed after the active-hub leave fix.

## Remaining Gaps
- Full group journey expansion remains deferred until membership and notifications are stable.
- Notification delivery is in-app only; push/email channels are not implemented.
- Lifecycle auto-close notifications still depend on lifecycle evaluation being triggered by dashboard/live/admin polling.
- Real browser visual QA and DevTools console capture remain recommended.
