# PREDIKT — Private Beta Test Checklist

## Latest Automated Evidence

- Guided creation polish pass added loading/empty/error states for route search, an intentional privacy-safe route preview placeholder, clearer room draft fields, participant answer-type helper copy, and web-only static side-wing sponsored placements.
- Expo Web browser QA attempt on July 9 confirmed backend `3000`, Expo `8081`, API fallback `localhost:3000`, requested `test@predikt.ai` login, refresh rotation, logout revocation, dashboard/profile/route-room/prediction edit-revoke API paths, CORS preflight, and safe response checks through HTTP/API evidence.
- No controllable browser/Chrome DevTools tool was available in the agent session, so visual rendering, click states, browser reload persistence, Network tab headers, and Console tab errors still require hands-on Chrome QA.
- Focused auth/session API QA passed on active local API port `3000`: health, CORS preflight from `8081`, login response shape, protected Authorization requests, dashboard/profile endpoints, refresh rotation, old refresh-token rejection, invalid refresh-token rejection, logout revocation, route preview/create, safe public/participant projections, and prediction submit/list checks.
- A temporary updated API on `3001` verified the prediction edit compatibility fix: submit, edit with `predictedArrivalTime`, and revoke all passed.
- Expo Web HTTP smoke passed on `8081` with `HTTP/1.1 200 OK`.
- Mobile TypeScript, backend Prisma generate, backend build, and backend Jest tests passed after the QA fix.
- Interactive browser QA is still required because UI rendering, click flows, browser reload persistence, DevTools Network headers, and browser console errors were not inspectable in the agent session.
- Existing Expo process on `8081`: stop PID `1203` or its terminal, then restart with `cd mobile && npx expo start --web --clear` if a clean web session is needed.

## Account And Identity

- Register a new user with no handle.
- Register a new user with a valid `prediktHandle`.
- Confirm duplicate handles are rejected.
- Confirm login stores access token, refresh token, expiry metadata, and user.
- Reload the app and confirm session restores without dropping to login.
- Expire or revoke the refresh token and confirm reload clears the session back to Landing.
- Update profile name and handle from the mobile profile screen.
- Confirm auth responses and profile responses do not include `passwordHash`.
- Confirm profile anti-betting/cash wording is blocked.

## Dashboard

- Log in and confirm the first authenticated screen is the dashboard.
- Confirm the first authenticated dashboard visit shows the onboarding overlay.
- Confirm next, back, skip, and done all work.
- Confirm the tour does not reappear after completion unless replayed.
- Confirm dashboard loads summary, recommendations, active rooms, and follow suggestions.
- Claim daily spin once and confirm second claim is blocked for the same day.
- Follow a suggested user and confirm they disappear from the suggested list.

## Route-first Room Creation

- Open `Create Room` from the dashboard.
- Confirm the dismissible beginner tip appears with room type, lock, and route privacy guidance.
- Confirm Start and Destination can be chosen through search suggestions or the fallback search-first flow.
- Enter start and destination route labels and preview the route.
- Confirm preview shows route summary, duration estimate, milestone suggestions, and privacy mode.
- Confirm the route preview placeholder shows Start → Destination, travel mode, distance, ETA, suggested moments, and `Map preview · exact live location hidden`.
- Confirm the app asks what people should predict after the route preview.
- Confirm Arrival Time, Journey Duration, and Beat ETA option cards appear.
- Confirm selected prediction option state is visually obvious.
- Confirm Room draft shows room title, prediction question, answer type, lock time, route summary, privacy mode, and safety delay.
- Create a room with `POST /rooms/from-route`.
- Confirm the created room returns an invite code and destination labels.
- Confirm route room participant copy says location is delayed for safety.

## Privacy And Live Progress

- Confirm route preview does not reveal raw coordinates to the client.
- Confirm viewer-facing room detail and live state do not expose exact GPS.
- Confirm live progress still returns safety delay messaging.
- Confirm participant/dashboard/public responses do not expose route history, current raw GPS, or live trails.

## Scoring And Social

- Submit milestone predictions from a joined room.
- Confirm the dismissible prediction tip explains lock timing, hidden predictions, and edit/revoke.
- Confirm `exact_time` rooms show guided time entry with quick adjustment buttons.
- Confirm `exact_time` rooms communicate seconds support.
- Confirm `duration` rooms show duration chips and a custom duration input.
- Confirm `yes_no` rooms show large Before ETA / After ETA choices.
- Confirm prediction values are hidden from other users before lock.
- Edit a prediction within 2 minutes and confirm success.
- Revoke a prediction within 2 minutes and confirm success.
- Confirm edit/revoke fail after lock or deadline.
- Confirm leaderboard language uses Aura rather than XP.
- Confirm Clout-related rewards are described as virtual and non-cash.
- Declare a result and verify diff in seconds/minutes, winner, Aura earned, Dot Bonus, comeback/rematch copy, Moment Card CTA, and reactions.
- Confirm the dismissible result tip explains Aura, Dot Bonus, and Rematch.

## Trust, Safety, And Governance

- Create a room title with banned betting/cash wording and confirm it is blocked with the PREDIKT anti-betting message.
- Submit `POST /reports` for harassment, spam, betting_or_cash, unsafe_location, inappropriate_content, fake_result, and other.
- Block and unblock a user; confirm blocked users cannot follow each other.
- Submit a room dispute and confirm room reward finality is marked for review.
- Open privacy, terms, community guidelines, and anti-betting policy endpoints/screens.
- Submit data export and deletion requests.
- Toggle AI personalization opt-out.
- Confirm admin endpoints require admin auth.
- As admin, list users/rooms/reports/credit ledger/disputes/audit logs and confirm no `passwordHash` appears.
- As admin, suspend user, remove room, reverse credits, and resolve a dispute; confirm audit logs are written.

## Public Landing

- Launch web/mobile without login and confirm the public landing appears first.
- Open Help from landing and confirm it explains the app clearly before login.
- Try the demo prediction without login.
- Use Join with Code without login and confirm room preview works.
- Attempt real prediction without login and confirm login prompt appears.
- Confirm Create Room is unavailable or redirects/prompts for login while unauthenticated.
- Log in, reload, and confirm dashboard still loads with no CORS errors.
- Open Help after login and confirm Replay Guided Tour is available.
- Force a protected API call after access-token expiry and confirm one refresh attempt succeeds without a visible auth break.
- Log out and confirm backend logout is called when possible and local session state is cleared.
- Confirm no blocking browser console errors and no CORS failures.

## Web Side-Wing Sponsored Placements

- On mobile/narrow width, confirm side-wing placements are hidden.
- On desktop/wide web, confirm landing side cards render without moving or overlapping the main app.
- Confirm dashboard side cards render without affecting dashboard actions.
- Confirm Help side card renders if implemented.
- Confirm Results side placement remains subtle and separate from result reveal.
- Confirm prediction input, login/register, route setup, privacy/data request, report/block/dispute, and admin-style flows do not show side-wing placements.
- Confirm placements are labelled Sponsored, Partner, or Promoted.
- Confirm placements do not affect Aura, Clout, Credits, predictions, leaderboards, Drops, scoring, or results.
- Confirm placements use no private APIs, raw location, route history, sensitive profile data, or prediction-content targeting.
