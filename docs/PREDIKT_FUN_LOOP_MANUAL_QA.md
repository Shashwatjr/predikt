# PREDIKT Fun Loop — Manual QA

Date: 2026-07-11

## Environment

- Backend: `http://localhost:3000` (or configured API base)
- Frontend: Expo web (`cd mobile && npx expo start --web`)
- Demo login: `test@predikt.ai` / `Password123!`
- Seed: `cd backend && npm run seed:engagement-demo`

## Required Flow Checklist

| Step | Flow | Expected | Result |
|------|------|----------|--------|
| 1 | Login | Demo user authenticates | Pending live run |
| 2 | Create Arrival room | Room created with invite code | Pending live run |
| 3 | Open seeded completed room (`HUBA1`) | Result data loads | Pending live run |
| 4 | View The Tea | Hero metrics + story card visible | Pending live run |
| 5 | Switch commentary personality | Regenerate returns new version (max 2) | Pending live run |
| 6 | React | POST reaction succeeds for participant | Pending live run |
| 7 | View badge unlock | Route Oracle / Bot Beater from API | Pending live run |
| 8 | View Moment Card | Badge + commentary punchline shown | Pending live run |
| 9 | Share/copy Moment | Native/text share works | Pending live run |
| 10 | Create Rematch | Navigates to create + analytics event | Pending live run |
| 11 | View Comeback | Playful copy for non-winners | Pending live run |
| 12 | View rivalry | Not implemented | N/A — gap documented |
| 13 | Weekly personality report | Not implemented | N/A — gap documented |
| 14 | View mission | Dashboard stubs only | N/A — gap documented |
| 15 | Turn AI commentary off | PATCH preference + deterministic copy | Pending live run |
| 16 | Report commentary | Not implemented | N/A — gap documented |
| 17 | Neutral closure safe tone | `HUBD4` shows fair-reset copy | Pending live run |

## API Verification (can run without UI)

```bash
# After login, with JWT:
GET /rooms/{HUBA1-roomId}/commentary
GET /rooms/{HUBA1-roomId}/badges
GET /rooms/{HUBD4-roomId}/commentary
PATCH /users/me/commentary-preference  { "aiOptOut": true }
POST /rooms/{roomId}/commentary/regenerate
```

## UX Observations (pre-run)

- Result screen now fetches persisted badges instead of category-only fallbacks.
- Commentary regeneration button disables when limit reached.
- `initialResult.momentCard` and `badges` from lifecycle end-room are honored when present.

## Fixes Made Before QA

- Persisted `RoomCommentary` with version history and `isCurrent`.
- Added `UserBadge` awards on room finalization.
- Seeded demo commentary/badges for completed and neutral rooms.
- Mobile types added in `mobile/src/types/engagement.ts`.

## Why Full Click-Through Was Not Completed Here

Automated backend build/tests were run in this session. Full Expo web click-through requires a running dev server and interactive browser session. Use the checklist above with seeded `HUBA1` (completed) and `HUBD4` (neutral) rooms for the fastest validation path.

## High-Impact Issues To Watch

- Ensure completed room status before commentary fetch (403 if room still live).
- Confirm badge fetch auth for participants only.
- Verify no betting-language terms appear in generated commentary templates.
