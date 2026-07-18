# PREDIKT UX + Functional Test Cases

Date: 2026-07-14

Purpose: cover end-to-end user experience, button behavior, and consistency across the main app surface.

Execution note:
- Automated verification was run in this session.
- Full button click-through across rendered UI still requires an interactive Expo Web or device session.
- Use these cases as the master checklist for hands-on QA.

## Test Environment

- Backend: local Nest API
- Mobile: Expo React Native app
- Accounts:
  - Demo: `test@predikt.ai` / `Password123!`
  - Pilot: `pilot@predikt.ai` / `PilotMvp2026!`
- Guest flow:
  - Join room as a guest with display name only

## Automated Checks Run

| Check | Result |
|---|---|
| `cd mobile && npx tsc --noEmit` | Pass |
| `cd backend && npm test -- --runInBand` | Pass |
| `cd backend && npx prisma validate` | Pass |

## Core Flows

### 1. Public Landing

| ID | Test case | Expected result |
|---|---|---|
| L-01 | Launch app logged out | `Landing` is first screen |
| L-02 | Tap `Help` | Help screen opens |
| L-03 | Tap `Sign In` | Login screen opens |
| L-04 | Tap hero `Create Lobby` while logged out | User is routed to auth/create gate |
| L-05 | Tap hero `Play Solo` while logged out | User is routed to login |
| L-06 | Tap play-mode cards | Friends, Solo, and Bot cards trigger the intended action or gate |
| L-07 | Tap a live feed card | Opens join flow with room code context |
| L-08 | Use `Join with code` input and tap `Open Lobby` | Join screen opens with the typed code preserved |
| L-09 | Open invite preview CTA from landing | Join flow opens with invite code |
| L-10 | Tap each legal footer link | Correct legal/help screen opens |

### 2. Authentication

| ID | Test case | Expected result |
|---|---|---|
| A-01 | Log in with valid credentials | Session stored and user lands in authenticated app |
| A-02 | Log in with invalid credentials | Friendly error shown, no partial session |
| A-03 | Toggle password visibility | Icon/button works without losing input |
| A-04 | Register with valid fields | Account created and user logged in |
| A-05 | Register with missing required fields | Inline or alert validation shown |
| A-06 | Navigate Login -> Register -> Login | Back-and-forth navigation feels consistent |
| A-07 | Reload app with valid session | Session restores |
| A-08 | Logout from authenticated area | Session clears and app returns to public state |

### 3. Home Dashboard

| ID | Test case | Expected result |
|---|---|---|
| H-01 | First authenticated load | Home loads summary, active predictions, and recommendations |
| H-02 | Onboarding overlay next/back/skip/done | All actions function and state persists |
| H-03 | Header notification button | Notifications screen opens |
| H-04 | Header profile button | Profile screen opens |
| H-05 | Primary create CTA | Create Room opens |
| H-06 | Secondary join CTA | Join Room opens |
| H-07 | Active prediction card primary action | Routes to Prediction, LiveRoom, or Result correctly |
| H-08 | Pin / move up / move down on active prediction card | Reordering controls work and persist |
| H-09 | Bottom nav tabs | Tabs switch consistently and state is clear |
| H-10 | Today’s Tea overlay dismiss | Dismiss action works cleanly |

### 4. Create Room

| ID | Test case | Expected result |
|---|---|---|
| C-01 | Open Create Room from Home | Screen loads with category-first flow |
| C-02 | Only one enabled mode | Mode step is skipped visually |
| C-03 | Use current location | Permission flow behaves gracefully |
| C-04 | Search `From` and `To` | Suggestions appear and selection updates route |
| C-05 | Preview arrival route | Preview renders with ETA/privacy-safe info |
| C-06 | Expand `More options` | Advanced settings reveal and collapse cleanly |
| C-07 | Create arrival room with valid data | Room is created and Room Created screen opens |
| C-08 | Create weather room with valid data | Room is created successfully |
| C-09 | Create placeholder/food room | Room is created successfully |
| C-10 | Invalid lock time | Friendly validation shown |

### 5. Room Created / Sharing

| ID | Test case | Expected result |
|---|---|---|
| R-01 | Tap `Share` | Native share action opens |
| R-02 | Tap `Go to Room` | LiveRoom opens as creator |
| R-03 | Tap `Copy Code` | Copy/share fallback works |
| R-04 | Tap `Copy Invite Link` | Copy/share fallback works |
| R-05 | Tap `WhatsApp` | WhatsApp deep link opens |
| R-06 | Toggle `More ways to share` | Manual share panel expands/collapses |
| R-07 | Toggle `See room details` | Room details expand/collapse |
| R-08 | Tap `Back to Home` | Returns to Home |

### 6. Join Room

| ID | Test case | Expected result |
|---|---|---|
| J-01 | Enter valid invite code and tap `Find Room` | Room preview loads |
| J-02 | Enter invalid code | Friendly error shown |
| J-03 | Guest join with name | Guest session created and user lands in the correct next screen |
| J-04 | Logged-in join | Joined state succeeds and target screen is correct |
| J-05 | Tap `Already have an account? Log in` | Login opens with join intent preserved |
| J-06 | Tap `Enter a different code` | Screen resets cleanly |

### 7. Prediction

| ID | Test case | Expected result |
|---|---|---|
| P-01 | Exact-time room loads | Benchmarks and time picker render |
| P-02 | Snap-to-benchmark chips | Chips update selected time |
| P-03 | Adjustment chips | Time moves correctly |
| P-04 | Duration room loads | Duration chips/input render |
| P-05 | Yes/No room loads | Binary choice UI renders and selection is obvious |
| P-06 | Multiple-choice room loads | Options render and selected state is obvious |
| P-07 | Tap `Lock it in` with valid data | Prediction submits and routes to LiveRoom |
| P-08 | Submit with missing required choice | Friendly validation shown |

### 8. Live Room

| ID | Test case | Expected result |
|---|---|---|
| LV-01 | Creator opens live room pre-start | Start Journey controls shown |
| LV-02 | Creator taps `Start Journey` | Journey starts and delay logic is applied |
| LV-03 | Non-creator opens room before delayed visible start | Screen shows waiting state |
| LV-04 | Milestone banner at 50/80/100 | Banner copy appears and auto-dismisses |
| LV-05 | Guess range summary after prediction | Range and user guess line updates |
| LV-06 | Arrival visualization | Car icon moves along path |
| LV-07 | Food ETA visualization | Scooter marker is visible and updates |
| LV-08 | Creator taps `Confirm Arrival` near destination | Confirmation succeeds |
| LV-09 | Creator taps `Confirm Arrival` far from destination | Soft confirmation prompt appears |
| LV-10 | Creator taps `Cancel / Plan Changed` | Neutral closure path succeeds |

### 9. Result / The Tea

| ID | Test case | Expected result |
|---|---|---|
| T-01 | Completed room opens Result | Winner, commentary, and actions render |
| T-02 | Winner card animation | Plays once and remains readable |
| T-03 | Commentary share button | Share/copy action works |
| T-04 | Reaction strip | Selecting a reaction updates state |
| T-05 | `Run it back` | Rematch path succeeds |
| T-06 | `Start a Comeback` | Routes to Create Room |
| T-07 | Empty rankings state | `All Rankings` section is hidden entirely |
| T-08 | Neutral closure result | Copy is fair and non-leaky |

### 10. Profile / Settings / Legal

| ID | Test case | Expected result |
|---|---|---|
| PR-01 | Open Profile | Hero, stats, and form render |
| PR-02 | Save profile | Name/handle save succeeds |
| PR-03 | Expand advanced settings | Section toggles cleanly |
| PR-04 | Notifications button | Notifications screen opens |
| PR-05 | Help / replay tour / legal buttons | Each routes correctly |
| PR-06 | Data export / deletion / AI opt-out | Each action shows confirmation |
| PR-07 | Log Out | Session clears and app resets |

### 11. Notifications

| ID | Test case | Expected result |
|---|---|---|
| N-01 | Open Notifications | List renders or empty state is clear |
| N-02 | Tap `Mark all` | Notifications marked read |
| N-03 | Tap individual notification CTA | Routes to correct screen |

### 12. Cross-Cutting UX Consistency

| ID | Test case | Expected result |
|---|---|---|
| X-01 | Primary buttons | Consistent size, press feel, and disabled/loading behavior |
| X-02 | Back paths | No dead ends after auth/join/result flows |
| X-03 | Error language | Human-readable, not internal/system strings |
| X-04 | Privacy language | “delayed / approximate / hidden” wording stays consistent |
| X-05 | Guest messaging | No contradiction between “no account needed” and gated actions |
| X-06 | Auth entry surfaces | Landing, Login, and Register feel like one coherent onboarding arc |
| X-07 | Responsive layout | No broken cards or clipped CTAs on narrow/mobile widths |

## Recommended Manual Execution Order

1. Public Landing
2. Login and Register
3. Home
4. Create Room
5. Room Created
6. Join Room
7. Prediction
8. Live Room
9. Result
10. Profile, Notifications, Help, Legal

## Session Conclusion

- Automated quality gates passed.
- Full rendered-button confirmation across the entire app is still a manual QA step because this session does not have browser/device interaction tooling.
