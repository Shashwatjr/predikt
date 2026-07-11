# PREDIKT UI/UX Manual QA

Date: 2026-07-11

## Automated Checks

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (mobile) | **Pass** |
| Business logic / endpoints | **Unchanged** |
| Privacy controls | **Preserved** |

## Manual Click-Through (pending live session)

Run: `cd mobile && npx expo start --web --clear`

Login: `test@predikt.ai` / `Password123!`

| Flow | What to verify | Status |
|------|----------------|--------|
| Landing | Hero “Make your group chats playable”, category carousel, sample Tea, trust copy | Pending |
| Login | Auth still works | Pending |
| Home | AppHeader greeting, Quick Start tiles, Live section, weekly card, BottomNav | Pending |
| Create Arrival | Step 1–3 progress, CategoryTile, ModeCard, route setup | Pending |
| Create Weather/Food/Late/Gym | Category theme visible, essential fields only | Pending |
| Join room | Category theme card, “Prove it” line, lock pill | Pending |
| Live room | LiveStatusCard, privacy pill, no exact GPS | Pending |
| Result / The Tea | TeaCard hierarchy, commentary bubble, reactions, Moment Card | Pending |
| Profile | Badges, weekly title, commentary toggle, legal lower | Pending |
| Commentary prefs | Toggle off → deterministic copy on result | Pending |
| Moment Card share | Text share works | Pending |
| Rematch CTA | Navigates to Create | Pending |
| Responsive web | Centered layout, no stretched cards | Pending |
| Keyboard nav (web) | Focus visible on buttons/tiles | Pending |
| Restricted language scan | No bet/wager/gambling in new copy | Pass (review) |

## UX Observations (code review)

- Unified palette: deep navy bg, violet/cyan accents
- Category identity consistent across Join, Live, Result, Create
- Home reduced clutter: removed duplicate crystal hero
- Result emotional peak uses dedicated TeaCard component
- Profile identity-first: badges + commentary before legal stack

## Issues Found & Fixed in Sprint

- Duplicate imports in LandingScreen (TS errors) — fixed
- Duplicate `trustCopy` style key — fixed
- Home/Result used isolated inline styles — migrated to shared components
- Profile missing commentary preference UI — added

## Remaining Gaps

- Full Expo web click-through not executed in CI environment
- Prediction and auth screens still legacy styling
- Landing public nav tabs differ from authenticated BottomNav

## Sign-off

**TypeScript/build:** Ready  
**Visual unity (core flows):** Ready for human QA  
**Privacy/safety regression:** None intended
