# PREDIKT — Privacy Architecture

## Core Boundary

PREDIKT accepts creator location input for internal progress tracking, but viewer-facing APIs must never expose exact coordinates.

Viewer-visible movement is safety-delayed by default.

Viewer-safe responses may include only:

- `roomId`
- `status`
- `progressPercentage`
- `etaMinutes`
- `locationDisplayMode`
- `currentMilestone` summary
- `safetyMessage: "Exact location hidden"`

They must never include:

- `rawLat`
- `rawLng`
- `displayLat`
- `displayLng`
- `startingLat`
- `startingLng`
- `destinationLat`
- `destinationLng`
- `milestoneLat`
- `milestoneLng`

## Enforcement

`POST /rooms/:roomId/location-update`

- Creator-only endpoint
- Accepts raw creator coordinates for internal storage
- Stores them in `live_location_events`

`GET /rooms/:roomId/live-state`

- Viewer-facing endpoint
- Returns safety-delayed progress, ETA, room status, movement avatar, sponsor summary, current milestone summary, and safety copy only
- Never returns exact coordinates

Safety delay model:

- viewer visible time = current time minus `safetyDelayMinutes`
- the API returns the latest stored movement event at or before that delayed time
- actual scoring still uses actual milestone reach timestamps, not delayed viewer state

Recommended defaults:

- private rooms: 5 minutes
- invite_only rooms: 10 minutes
- public rooms: 15 minutes
- sponsored or creator rooms: 15 minutes
- travel rooms: allow 30 minutes

Prediction close safety recommendation:

- leave enough buffer between prediction cut-off and live movement visibility so viewers cannot infer exact location from timing

`GET /rooms/:roomId`

- Creator receives full room detail
- Non-creators receive a sanitized room response with route coordinates removed

`GET /rooms/code/:inviteCode`

- Public summary endpoint
- Returns milestone labels only, never milestone coordinates

## Code Guardrail

The live-state service includes this required boundary comment:

`Privacy boundary: viewer-facing live state must never expose raw GPS coordinates.`

## Current Risk Assessment

- `live-state` is aligned after the refactor and does not expose raw or display coordinates.
- Room join and invite-code flows are aligned for viewers because they only return milestone labels and metadata.
- Exact creator coordinates still exist in storage for internal use, so any future websocket or admin endpoint must reuse the same sanitization rules.
- No exact map is exposed in MVP+.

## Follow-up Recommendations

1. Add request/response contract tests for `GET /rooms/:roomId/live-state`.
2. Add a serializer layer for sanitized room responses so privacy rules are centralized.
3. If real GPS smoothing is added later, compute approximate progress server-side and keep coordinate derivation out of viewer payloads.
