# PREDIKT — REST API Specification

Base URL: `http://localhost:3000`

Auth: `Authorization: Bearer <accessToken>`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Auth responses include `prediktHandle` when present.

Register/login/refresh responses return:

- `accessToken`
- `accessTokenExpiresAt`
- `refreshToken`
- `refreshTokenExpiresAt`
- `user`

Access tokens are short-lived JWTs. Refresh tokens are rotated session-backed tokens with explicit expiry. Logout revokes the supplied refresh-token session; already-issued access tokens remain valid until their short expiry window ends.

Mobile client behavior:

- stores access token, refresh token, expiry metadata, and user
- attaches access token to authenticated requests
- attempts one refresh on `401` for non-auth endpoints
- retries the failed request once after successful refresh
- clears local session state if refresh fails or the refresh token is expired

Public and participant responses use safe user projections. They must not include `passwordHash`, phone, raw security/session fields, exact GPS, route history, or private admin fields.

`prediktHandle` rules:

- stored without `@`
- always lowercase
- unique across users
- allowed characters: lowercase letters, numbers, underscores, dots
- length: 3 to 30 characters
- sanitized before validation

## User Profile

- `PATCH /users/me/profile`
- `GET /users/handle-available/:handle`
- `GET /users/handle-suggestions`
- `GET /users/me/stats`
- `POST /users/:userId/follow`
- `DELETE /users/:userId/follow`
- `GET /users/me/following`
- `GET /users/me/followers`

Example update:

```json
{
  "name": "Aarav Kapoor",
  "prediktHandle": "aarav.kapoor",
  "profileImage": null
}
```

Availability example response:

```json
{
  "handle": "aarav.kapoor",
  "available": true
}
```

Duplicate handle conflict response:

```json
{
  "message": "PREDIKT handle is already taken.",
  "statusCode": 409
}
```

## Rooms

### Route-first creation

- `GET /routes/place-search?query=airport`
- `GET /routes/place-details/:placeId`
- `POST /routes/preview`
- `POST /rooms/from-route`

`/routes/*` currently provides a backend fallback preview flow for the MVP. Viewer privacy mode is always returned as approximate and delayed, and exact coordinates are not exposed to clients.

`POST /routes/preview` and `POST /rooms/from-route` now validate request shapes with DTOs.

`POST /rooms/from-route` supports guided prediction selection with:

```json
{
  "startPlaceId": "koramangala-home-1",
  "destinationPlaceId": "airport-terminal-2-1",
  "travelMode": "driving",
  "visibility": "invite_only",
  "predictionClosesAt": "2026-07-09T09:00:00.000Z",
  "primaryPrediction": {
    "type": "arrival_time",
    "answerType": "exact_time",
    "question": "When will I arrive?"
  }
}
```

Supported guided `answerType` values in this flow:

- `exact_time`
- `duration`
- `yes_no`

Local Expo Web API routing may be configured with `EXPO_PUBLIC_API_BASE_URL`, for example `http://localhost:3000` or `http://localhost:3001`.

### `POST /rooms`

Creates a room and optionally accepts milestones, safety settings, social mode metadata, movement avatar metadata, and sponsor placeholders.

If no milestones are supplied, the backend auto-creates one final-destination milestone.

Request shape:

```json
{
  "roomTitle": "Airport Dash",
  "eventType": "journey",
  "roomCategory": "travel",
  "startingPointLabel": "Koramangala",
  "destinationLabel": "Airport",
  "predictionCloseTime": "2026-07-08T09:00:00.000Z",
  "safetyDelayMinutes": 10,
  "socialMode": "instagram_live",
  "creatorSocialHandle": "@creator",
  "movementAvatarType": "flight",
  "isSponsored": true,
  "sponsorName": "Travel Partner",
  "milestones": [
    {
      "milestoneName": "Hebbal Flyover",
      "locationLabel": "Hebbal"
    }
  ]
}
```

### `GET /rooms/:roomId`

- Creator sees full room detail
- Non-creators get a sanitized response with exact route coordinates removed

### `GET /rooms/code/:inviteCode`

- Returns room summary and milestone labels
- Never returns milestone or route coordinates

### `GET /rooms/:roomId/share-kit`

Returns:

- roomId
- inviteCode
- roomLink placeholder
- pinnedCommentText
- instagramStoryText
- facebookPostText
- qrCodePayload placeholder
- resultShareText
- creatorSocialHandle
- socialMode

## Predictions

### Primary

- `POST /rooms/:roomId/milestone-predictions`
- `GET /rooms/:roomId/milestone-predictions`

Submit shape:

```json
{
  "predictions": [
    {
      "milestoneId": "uuid",
      "predictedReachedTime": "2026-07-08T08:35:00.000Z"
    }
  ]
}
```

Rules:

- One prediction per user per milestone
- Room must be `predictions_open`
- Submission must happen before the room or milestone cut-off
- Default `predictionVisibilityMode` is `hidden_until_lock`; before lock, list responses expose submitted/revoked state but not prediction values.
- Each submitted prediction gets `editDeadline = min(submittedAt + 2 minutes, room.predictionCloseTime)`.
- `PATCH /predictions/:predictionId` edits a prediction before lock/deadline.
- `POST /predictions/:predictionId/revoke` revokes a prediction before lock/deadline.
- Completing all required milestones grants `+20 Clout`
- Aura is awarded only when a milestone is marked reached

### Compatibility Alias

- `POST /rooms/:roomId/predictions`
- `GET /rooms/:roomId/predictions`

This legacy path is retained for older clients and maps to final-destination milestone behavior.

## Lifecycle

- `POST /rooms/:roomId/lock-predictions`
- `POST /rooms/:roomId/start`
- `POST /rooms/:roomId/milestones/:milestoneId/reached`
- `POST /rooms/:roomId/end`
- `POST /rooms/:roomId/cancel`

Milestone reach returns the milestone leaderboard. Room end returns the room winner and aggregated rankings.

Scoring records second-level differences and tiers: exact second, within 10 sec, within 30 sec, within 1 min, within 2 min, within 5 min, and outside 5 min. Result declarations may include `outcomeSource` (`host_declared`, `participant_confirmed`, `screenshot_evidence`, `gps_verified`, `api_verified`, `admin_verified`) and `confidenceLevel` (`low`, `medium`, `high`, `verified`).

## Live Progress

- `POST /rooms/:roomId/location-update`
- `GET /rooms/:roomId/live-state`

Live-state response includes:

```json
{
  "roomId": "uuid",
  "status": "live",
  "currentTime": "2026-07-08T08:45:00.000Z",
  "displayedProgressTimestamp": "2026-07-08T08:35:00.000Z",
  "safetyDelayMinutes": 10,
  "progressPercentage": 48,
  "etaMinutes": 22,
  "locationDisplayMode": "approximate",
  "movementAvatarType": "flight",
  "sponsor": {
    "name": "Travel Partner",
    "logoUrl": null,
    "brandColor": "#0ea5e9",
    "tagline": "Powered travel experiences"
  },
  "currentMilestone": {
    "milestoneId": "uuid",
    "milestoneName": "Hebbal Flyover",
    "milestoneOrder": 1,
    "status": "reached"
  },
  "safetyMessage": "Exact location hidden"
}
```

## Leaderboards

- `GET /rooms/:roomId/leaderboard`
- `GET /leaderboard/weekly`

Weekly leaderboard is ordered by `weeklyAura`.

## Dashboard

- `GET /dashboard/summary`
- `GET /dashboard/following-leaderboard`
- `GET /dashboard/recommendations`
- `GET /dashboard/active-rooms`
- `GET /dashboard/daily-challenge`
- `GET /dashboard/daily-spin`
- `POST /dashboard/daily-spin/claim`
- `GET /dashboard/drops-near-unlock`
- `GET /dashboard/activity-feed`
- `GET /dashboard/suggested-follows`

Daily spin responses include the disclaimer: `Virtual rewards only. No cash value.`

## Drops

- `GET /drops`
- `GET /users/me/drops`
- `POST /drops/:dropId/unlock`
- `POST /users/me/drops/:userDropId/redeem`

Unlocking requires `cloutBalance >= cloutCost`.

## Creators

- `POST /creators/me`
- `GET /creators/me`
- `PATCH /creators/me`

## Plans

- `GET /plans`

## User Stats

- `GET /users/me/stats`

Returns:

- `totalAura`
- `weeklyAura`
- `cloutBalance`
- `lifetimeCloutEarned`
- `winsCount`
- `predictionsMadeCount`
- `roomsCreatedCount`
- `predictionAccuracyScore`
- `currentStreak`
- `longestStreak`

## Privacy

- `GET /policies/privacy`
- `GET /policies/terms`
- `GET /policies/community-guidelines`
- `GET /policies/anti-betting`
- `POST /privacy/requests`
- `POST /privacy/data-export-request`
- `POST /privacy/data-deletion-request`
- `PATCH /privacy/ai-personalisation-opt-out`
- `GET /privacy/requests/me`
- `POST /consents`
- `GET /consents/me`

## Moderation

- `POST /reports`
- `POST /users/:userId/block`
- `DELETE /users/:userId/block`
- `GET /users/me/blocked`
- `POST /rooms/:roomId/disputes`
- `POST /rooms/:roomId/reactions`

Reports support: `harassment`, `spam`, `betting_or_cash`, `unsafe_location`, `inappropriate_content`, `fake_result`, `other`.

Room titles, questions/descriptions, public profile text, and result text are checked for anti-betting/cash wording. Blocked requests return: `PREDIKT is for social predictions, not betting or cash wagering. Please reword this room.`

## Credits

Credits are a non-cash feature unlock currency. They are non-transferable, non-refundable, non-withdrawable, not betting, and not usable for leaderboard advantage.

Progressive MVP ledger events:

- signup: `+30`
- first prediction: `+10`
- first room: `+15`
- result declared: `+15`

Every mutation writes `CreditLedger` with `eventType`, `delta`, `balanceAfter`, `sourceId/sourceType`, optional `idempotencyKey`, `metadata`, and timestamps.

## Admin

- `POST /admin/auth/login`
- `GET /admin/me`
- `GET /admin/dashboard`
- `GET /admin/users`
- `GET /admin/rooms`
- `GET /admin/reports`
- `GET /admin/credit-ledger`
- `GET /admin/disputes`
- `PATCH /admin/users/:userId/status`
- `POST /admin/users/:userId/suspend`
- `POST /admin/rooms/:roomId/remove`
- `POST /admin/credits/reverse`
- `POST /admin/disputes/:disputeId/resolve`
- `GET /admin/creators`
- `PATCH /admin/creators/:creatorProfileId/status`
- `GET /admin/drops`
- `POST /admin/drops`
- `PATCH /admin/drops/:dropId`
- `GET /admin/sponsors`
- `POST /admin/sponsors`
- `GET /admin/campaigns`
- `POST /admin/campaigns`
- `GET /admin/privacy-requests`
- `PATCH /admin/privacy-requests/:privacyRequestId`
- `GET /admin/audit-logs`
- `GET /admin/ai-systems`
- `POST /admin/ai-systems`
- `PATCH /admin/ai-systems/:aiSystemId`
