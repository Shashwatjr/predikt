# Privacy And Safety

## Route Privacy UX

- Journey room setup may use exact Start and Destination internally for route creation.
- Participant-facing and public-facing views must only expose privacy-safe labels, approximate progress, estimated duration, delayed status, and the safety message.
- Guided prediction setup and participant prediction entry must not reveal raw GPS, start/destination coordinates, current coordinates, route history, or exact live movement trails.
- Default route posture remains approximate and delayed with safety copy: `Location shown with delay for safety.`
- Route preview placeholders may show a stylized Start → Destination line, travel mode, distance, ETA, and suggested moments, but must not expose raw coordinates.

## Sponsored Placement Privacy

- Web side-wing sponsored placements are static, local-config placements only.
- Placements may use page placement context such as landing, dashboard, Help, or Results.
- Placements must not use exact location, route history, private rooms, prediction content, sensitive profiling, raw GPS, or participant identity targeting.
- Placements do not affect predictions, results, Aura, Clout, Credits, leaderboards, Drops, or scoring.
- No third-party ad SDK, tracking pixel, autoplay media, popup, or interstitial is used.

## Phase 1 Hardening Update — July 9, 2026

- Participant/public privacy projections remain free of email, password hashes, and raw route coordinates in integration tests.
- Self-only profile responses may include the signed-in user email, but public-safe projections still exclude contact fields.
- Refresh-token sessions are revocable, which reduces long-lived session exposure after logout.
- Consent recording now captures request IP/user-agent from the server boundary instead of trusting client-submitted metadata.
- Privacy request intake remains request-based; fulfillment automation is still a follow-up gap.

## Location Principle

Use location to verify outcomes, not broadcast movement.

Defaults:

- Ghost Mode/product privacy posture is on.
- Exact viewer location is off.
- No public live route map, live trail, route history, or raw GPS in result cards.
- Route participant APIs expose labels, approximate progress, delayed status, broad route context, and safety copy only.

Safety delay defaults:

- Private: 5 minutes
- Invite-only: 10 minutes
- Public/sponsored: 15 minutes
- Public travel: 30 minutes where appropriate

Participant copy: `Location shown with delay for safety.`

## Public-Safe Responses

Public, participant, dashboard, leaderboard, follow, room, and admin list/detail responses must not expose password hashes, phone, exact location, full legal name unless chosen as display name, age, gender, workplace, address, contacts, route history, auth/session/security fields, or private admin fields.

## User Controls

MVP supports report, block, data export request, data deletion request, consent tracking foundation, and AI personalization opt-out.

## Verification Evidence

Scripted API acceptance verified:

- no `passwordHash` in collected responses
- no email in public/dashboard/participant APIs
- no non-null raw coordinate keys in public/participant/dashboard responses
- participant route detail includes safe route fields and safety copy
- hidden prediction values before lock
- prediction values visible after lock
- edit/revoke blocked after lock
- data export/deletion request and AI opt-out endpoints
- refresh token rotation and logout revocation
- public/participant/leaderboard/admin-safe projections through integration tests

Interactive browser verification remains pending because the current agent session cannot inspect Expo Web UI or console output.
