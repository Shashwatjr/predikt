# PREDIKT — MVP Specification

## Positioning

PREDIKT is the interactive layer for real-world live events, where every journey, challenge, or stream becomes a prediction game among friends, followers, and communities.

Product copy:

- Turn everyday moments into predictions.
- Create prediction rooms with friends and see who gets closest.
- Play with friends. Closest guess wins Aura.

## MVP Loop

A creator opens a private or invite-only journey room from a Starting Point to a Destination, optionally adds milestones, and shares the invite code. Viewers join, predict the reached time for each milestone before the cut-off, watch privacy-safe approximate progress, and earn Aura and Clout as milestones are reached and final results are computed.

## Core Terms

- `Aura`: accuracy and reputation score
- `Clout`: virtual non-cash balance
- `Credits`: non-cash, non-transferable feature unlock currency
- `Drops`: unlockable perks or vouchers
- `Flexes`: achievement badges
- `Streaks`: consecutive participation

## MVP Requirements

1. Invite-only room creation and join flow
2. Optional native PREDIKT handles for every user, not just creators
3. Dashboard-first logged-in home with recommendations, active rooms, suggested follows, daily challenge, and daily spin
4. Route-first room creation flow using start and destination route inputs
5. Milestone-based prediction submission
6. Final destination milestone always present
7. Safety-delayed viewer movement by default
8. Creator-controlled prediction locking, live start, milestone reach, room end, and cancel
9. Viewer-safe live progress with no exact coordinates
10. Milestone-level Aura scoring
11. Clout earnings for participation and winning outcomes
12. Weekly Aura leaderboard
13. Follow graph for users and creators
14. Drop unlock and redeem flow
15. Social add-on room metadata and share kit copy
16. Movement avatar, sponsorship, creator, plan, campaign, admin, and privacy foundations
17. Public landing/demo before login with login required for real participation
18. Hidden predictions until lock by default
19. Two-minute edit/revoke window before lock
20. Reports, blocks, disputes, result reactions, anti-betting keyword blocking, and audit logs
21. Progressive Credits ledger foundation
22. Beginner Help screen available before and after login
23. First-dashboard onboarding overlay with replay support and local completion persistence
24. Contextual beginner tips in room creation, prediction, and result flows
25. Guided route-first prediction setup with Start → Destination selection and suggested prediction options
26. Participant prediction UI that adapts to `exact_time`, `duration`, or `yes_no`
27. Web-only static side-wing Partner/Sponsored/Promoted placements that stay separate from game mechanics

Public landing requirements:

- Unauthenticated users land on a polished public PREDIKT home before any login wall.
- Public home explains the product with the approved copy, sample Prediction Rooms, Popular ways to play, a sample Recent Result, and a visible mobile-style bottom navigation.
- Demo predictions are local UI state only and must not call real prediction APIs or write user data.
- Sample rooms/results are clearly demo/public previews; real participation prompts login/signup.
- Public users can open a Help / How PREDIKT Works screen without logging in.
- Authenticated users continue to land on the personalized dashboard with real rooms, Aura/Clout progress, leaderboards, daily Challenge, Drops, and suggested follows.

Onboarding requirements:

- First authenticated dashboard visit shows a guided overlay by default.
- Tour must support next, back, skip, done, and replay.
- Tour completion must persist locally at minimum.
- Help must expose replay for authenticated users and login prompting for public users.

Route-first prediction setup requirements:

- Journey rooms should suggest Arrival Time, Journey Duration, and Beat ETA after Start and Destination are selected.
- Search-first Start and Destination selection is acceptable for MVP if full map rendering is not practical on Expo Web.
- Route preview may be a styled placeholder in the MVP, but it must clearly show Start → Destination, distance/ETA, travel mode, suggested moments, and privacy-safe delayed-location copy.
- Participant route views must remain privacy-safe and never expose raw GPS or exact live movement.

Web sponsored placement requirements:

- Side-wing placements are web-only and wide-screen only; mobile prediction flows remain uncluttered.
- Placements must be clearly labelled as Sponsored, Partner, or Promoted.
- Placements must not affect predictions, results, Aura, Clout, Credits, leaderboards, Drops, or scoring.
- Placements use static local config only, with no third-party ad SDK, no tracking pixels, no sensitive profiling, and no exact-location targeting.
- Placements must not use private room data, prediction content, route history, or raw GPS.

User identity rules:

- `prediktHandle` is optional
- if present, it is displayed as `@prediktHandle`
- Instagram, Facebook, and YouTube handles are optional creator metadata only

## Privacy Rule

Viewer-facing state must never expose raw or exact coordinates. Only progress, ETA, milestone summary, location display mode, and the safety message may be returned.

Route preview and room creation responses may contain labels, distance estimates, duration estimates, milestone suggestions, and safety delay defaults, but they must not expose raw GPS to viewers.

## Economy Separation

- Aura is reputation and accuracy. It is not spendable, purchasable, or transferable.
- Clout is hosting/social influence and must not reward spam creation meaningfully.
- Credits unlock optional non-cash features such as extra rooms, premium result cards, larger rooms, private leagues, premium themes, avatar frames, advanced results, and group recaps.
- Credits are non-transferable, non-refundable, non-withdrawable, not betting, and not usable for leaderboard advantage.

Marketing line: `Unlock up to 100 free PREDIKT Credits as you play.`

## Safety Defaults

- Ghost Mode and approximate delayed route presentation are the default product posture.
- Route participants see labels, progress, delayed status, broad route context, and safety copy.
- Participants must never see start/destination/current raw coordinates, live trail, or route history.
- Public route rooms use higher delays, with travel contexts defaulting up to 30 minutes.
