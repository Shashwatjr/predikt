# User Experience Notes

## Beginner Help And Onboarding

- Public users can open Help before login from the landing header and footer links.
- Authenticated users can open Help from the dashboard and profile/settings.
- Help uses short card-based sections to explain Prediction Rooms, Closest Guess, Aura, Clout, Credits, hidden predictions until lock, result reveal, route privacy, and safety tools in beginner language.
- First authenticated dashboard visit now opens a replayable onboarding overlay with welcome, stats, leaderboard, active rooms, create room, route privacy, daily challenge and Drops, and Help/safety guidance.
- Journey room creation now uses a guided flow: choose Start and Destination, preview the route summary, then pick Arrival Time, Journey Duration, or Beat ETA instead of manually deciding every field first.
- Participant prediction entry now adapts to the room answer type with guided exact-time, duration, or yes/no inputs rather than opening with a blank raw form.
- Replay guided tour is available from Help and profile when the user is logged in.
- Create Room, Prediction, and Result screens now include dismissible contextual tips to reduce first-time confusion without blocking core actions.

## Public Before Login

- Landing opens before login and presents a premium public home: PREDIKT wordmark, "Turn everyday moments into predictions", notification/profile entry points, dark gradient hero, Aura crystal-style visual, public bottom navigation, sample rooms, sample results, and Create Room CTA.
- Try a PREDIKT is local-only. Users can answer the demo delivery Challenge with Yes, No, or Exact time and see a sample rank/Aura result without login or API writes.
- Join with Code opens a public preview input. Users can inspect a sample Prediction Room preview, but joining and submitting real guesses requires login/signup.
- Live PREDIKTs and Results are public demo content only. Tapping room participation, Create, Profile, or other saved actions shows a login/signup prompt.
- Real prediction submission, room creation, private rooms, saved Aura/Clout/Credits, follows, leaderboards, Streaks, Flexes, Drops, Comebacks, Rematches, and paid/unlock features require login.

## Session UX

- Authenticated sessions persist across reloads when stored tokens remain valid or refreshable.
- If an access token expires during normal use, the mobile client attempts one silent refresh before prompting the user again.
- Logout clears both local session state and backend refresh-token state where available, then returns the user to the public landing flow.
- If refresh fails because the session was revoked or expired, the app clears local state rather than looping on failed requests.
- Focused API QA verified login payload shape, refresh-token rotation, logout revocation, and protected dashboard/profile requests. Visual browser reload and DevTools confirmation remain manual QA items.
- Latest Expo Web QA attempt confirmed the same browser environment through HTTP evidence, but hands-on Chrome DevTools inspection remains required for visual reload persistence, automatic refresh retry visibility, and console status.

## Core Loop

Predict -> Result -> Recognition -> Comeback/Rematch -> Share -> Return.

Result reveal should show actual outcome, winner, user prediction when visible, diff in seconds/minutes, rank, Aura earned, Dot Bonus, comeback prompt, rematch CTA, Moment Card CTA, and friendly reactions.

## Guided Journey Rooms

- Creator setup should feel search-first: choose Start, choose Destination, preview the route, then choose what people predict.
- Route preview may be a styled placeholder for MVP, but it should feel intentional with Start -> Destination, travel mode, distance, ETA, suggested moments, and privacy-safe delay copy.
- The setup must clearly ask "What should people predict?" and explain Arrival Time, Journey Duration, and Yes/No in beginner language.
- Participant prediction entry should match the answer type: exact time with seconds guidance, duration with quick chips and Custom, and Yes/No with clear selected states.
- Route-room participant copy should repeat that no exact live location is shown and progress is privacy-safe/delayed where applicable.

## Web Sponsored Placements

- Side-wing sponsored placements are web-only and wide-screen only.
- Mobile and narrow layouts remain uncluttered and do not show side-wing placements.
- Placements are clearly labelled Sponsored, Partner, or Promoted.
- Placements are separate from PREDIKT results and do not affect predictions, Aura, Clout, Credits, leaderboards, Drops, scoring, or result reveal.
- Placements use static local config only. No third-party ad SDK, sensitive profiling, exact-location targeting, private-room targeting, prediction-content targeting, tracking pixels, popups, autoplay, or interstitials are used.

## Copy Rules

- Use Prediction Room, Challenge, Closest Guess, Aura, Clout, Credits, Comeback, Rematch, Moment Card, Dot Bonus, Streaks, Flexes, Drops.
- Avoid humiliating loser cards. Banter is opt-in and friendly.
- Do not use betting/cash prize wording in UI.

## Visual Assets

Use predefined avatar, overlay, background, and room theme keys. Do not generate custom AI avatars per user.
