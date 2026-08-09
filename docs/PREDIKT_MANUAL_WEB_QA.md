# PREDIKT Manual Web QA

## Environment
- Backend: `http://localhost:3000` (local) or Cloud Run alpha API
- Expo Web: `http://localhost:8081` (local) or `https://predikt-alpha.vercel.app`
- Login: `test@predikt.ai` / `Password123!` (QA demo; seed with `npm run seed:demo`) or `pilot@predikt.ai` / `PilotMvp2026!` (first-time MVP pilot)
- Invite base URL: production-like APIs must set `WEB_BASE_URL` (alpha: `https://predikt-alpha.vercel.app`)
- Date: July 19, 2026

## Checklist Results
- Landing loads: passed by Expo Web HTTP smoke at `http://localhost:8081`.
- Login works: passed with `test@predikt.ai`.
- Dashboard loads: passed across summary, recommendations, active rooms, leaderboard, challenge, Drops, activity, suggested follows, active predictions, and profile stats APIs.
- Live PREDIKTs hub shows seeded rooms: passed.
- Filters work: passed by seeded `needs_prediction` data.
- Pin/move order works: passed through `PATCH /dashboard/active-predictions/order`.
- Refresh keeps order: passed through repeated active hub fetch.
- Open room routes correctly: passed by room detail/status checks.
- Live room shows lifecycle panel: API status passed; visual panel check remains browser/manual.
- Overdue room has distinct status: passed.
- Auto-closed room explains neutral closure: passed.
- Cancelled room explains plan changed: passed.
- Result screen does not treat neutral closure as a normal win/loss: API routing/status passed; visual result copy remains browser/manual.
- Profile shows reliability explanation: profile reliability data passed; visual text remains browser/manual.
- No console error mentions `YOUR_MAC_IP`: no checked payload contained it; real browser console remains manual.
- No raw GPS/email/phone/passwordHash appears: passed for checked dashboard, invite, room, and notification payloads.
- No disallowed real-money language appears: passed for checked API payloads and updated source copy.
- Active hub shows joined-before-prediction room: passed with `HUBJ8`.
- Invite preview Join creates membership before prediction: passed.
- Notification bell shows unread count: passed by unread-count API.
- Notifications screen loads: passed by notifications API.
- Mark notification read updates unread count: passed.
- Notification action routes correctly: passed for `room:<id>:prediction|live|result` targets.

## Issues Found
- Leaving a joined-only room initially did not remove it from the active hub because `UserRoomPreference` was still treated as participation.

## Fixes Implemented
- Active hub membership query now requires creator status or active `RoomMembership`; preferences only control ordering and pinning.
- Replaced visible restricted money/betting copy with neutral social prediction and virtual reward language.
- Replaced third-party brand-like demo copy with generic original PREDIKT examples.

## Remaining Gaps
- A real browser visual/console pass is still recommended because this agent session cannot operate Chrome DevTools directly.
- Scripted QA covered HTTP/API behavior and Expo Web availability, not pixel-level layout, tap feel, or browser console capture.
