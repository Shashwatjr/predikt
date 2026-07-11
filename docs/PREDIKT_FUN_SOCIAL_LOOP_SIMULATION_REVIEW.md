# PREDIKT Fun Social Loop — Simulation Review

Date: 2026-07-11

## Scenarios Simulated

| # | Scenario | Seed / Path | Status |
|---|----------|-------------|--------|
| 1 | Arrival result with Route Oracle | `HUBA1` completed journey + `route_oracle` badge | Seeded |
| 2 | Arrival where Oracle Bot loses | `HUBA1` + `bot_beater` badge for @shashwat | Seeded |
| 3 | Weather Forecast Beater | `CATR1` category room (open) | Room seeded |
| 4 | Weather Oracle Bot wins | `CATR1` oracle benchmark present | Room seeded |
| 5 | Food ETA humorous miss | `CATF2` beat_bot room | Room seeded |
| 6 | Who's Late friendly group | `CATL3` friends room | Room seeded |
| 7 | Gym comeback | `CATG4` challenge_self room | Room seeded |
| 8 | Neutral cancelled journey | `HUBD4` plan_changed + neutral commentary | Seeded |
| 9 | Auto-closed no-show | `HUBG7` auto_closed journey | Seeded |
| 10 | Rematch created | Client CTA + `rematch_created` analytics event | UI wired |
| 11 | Rivalry scenario | Not persisted yet | Documented gap |
| 12 | Weekly summary | Not persisted yet | Documented gap |
| 13 | Secret mission completed | Dashboard stubs only | Documented gap |
| 14 | Reported commentary example | Endpoint not built | Documented gap |
| 15 | AI opt-out scenario | User preference fields + deterministic fallback | Implemented |

## Emotional Engagement Observations

- Completed arrival room (`HUBA1`) now ships persisted Chaos commentary with winner handle and badge context.
- Neutral closure room (`HUBD4`) uses Oracle-only safe copy; no roasting language.
- Badge titles surface on Result screen via `GET /rooms/:roomId/badges` instead of hardcoded fallbacks.
- Rematch and Comeback CTAs remain playful ("Run it back?", "Comeback unlocked.").

## Humor Safety Review

- Guardrails block betting, harassment, health, politics, and appearance terms.
- Cancelled/auto-closed/abandoned rooms force neutral commentary even if personality is Chaos.
- Templates sanitize handles and truncate badge labels.
- No raw GPS, addresses, or contact data enter commentary input.

## Shareability Review

- Moment Card uses persisted badge + commentary punchline.
- Share text excludes private participant details.
- 9:16 image export remains future work; text share works for MVP.

## Rematch / Comeback Behavior

- Frontend fires analytics and navigates to create flow.
- Backend clone endpoint (`POST /rooms/:roomId/rematch`) not yet implemented.
- Comeback copy is cosmetic only; no forced notifications.

## Badge Clarity

- `UserBadge` model stores `badgeKey`, `title`, `description`, `icon`, `category`.
- Category winner badges map deterministically (`route_oracle`, `rain_oracle`, etc.).
- Idempotent unique constraint: `userId + roomId + badgeKey`.

## Rivalry / Weekly / Mission UX

- Not implemented in this sprint; dashboard endpoints exist but no dedicated UI.

## Privacy Review

- Commentary input minimized to handles, labels, counts, and category metadata.
- Badge and commentary endpoints are participant-only.
- Public projections still exclude email/phone.

## Enterprise Guardrail Validation

| Control | Status |
|---------|--------|
| AI commentary opt-out | User field + deterministic fallback |
| Provider audit trail | `commentary.generated` audit events |
| Regeneration limit | `AI_COMMENTARY_MAX_REGENERATIONS` default 2 |
| Safe-mode neutral closures | Enforced server-side |
| No AI winner selection | Commentary isolated from scoring |
| Feature flags | Env vars for provider/enable/max regen |

## Issues Found

1. Commentary previously keyed by `(roomId, personality)` — fixed with versioned `isCurrent` rows.
2. Result screen ignored backend `momentCard` / `badges` — now consumes persisted badges.
3. Commentary context was generic — now hydrates winner, outcome, badge, and bot comparison.
4. No `UserBadge` persistence — added dedicated model and award service.

## Fixes Implemented

- Upgraded `RoomCommentary` schema with versioning, moderation metadata, and `isCurrent`.
- Added `UserBadge` model and `BadgeService` with deterministic awards in `finalizeRoom`.
- Hydrated commentary generation from room results and milestone predictions.
- Seeded demo commentary, badges, and reactions for completed/neutral rooms.
- Wired mobile Result screen to persisted badges and regeneration limits.

## Remaining Gaps

- `POST /rooms/:roomId/rematch` server-side clone
- `POST /rooms/:roomId/commentary/report`
- Rivalry and weekly story endpoints/UI
- Daily/secret missions persistence
- Commentary personality unlock progression
- Full group identity backend
- Image-based Moment Card export

## Recommended Next Sprint

1. Rematch API with safe category/template copy
2. Commentary report queue + admin review
3. Weekly personality report endpoint + share card
4. Lightweight rivalry summary (`GET /users/me/rivalries`)
5. Mission anti-farming rules with `UserMission` persistence
