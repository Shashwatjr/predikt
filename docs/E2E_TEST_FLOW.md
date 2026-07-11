# PREDIKT — End-to-End Manual Test Flow

This document describes the full manual test flow for the PREDIKT MVP. Execute these steps in order to verify the complete prediction room lifecycle.

**Prerequisites**
- Backend API running at `http://localhost:3000`
- PostgreSQL running and migrations applied
- Seed data is optional; use the test accounts below

---

## Test Accounts (for manual testing)

| Role | Name | Email | Password |
|------|------|-------|----------|
| Creator | Shashwat | creator@predikt.test | Password123 |
| Viewer 1 | Anya | viewer1@predikt.test | Password123 |
| Viewer 2 | Rohan | viewer2@predikt.test | Password123 |

---

## Step 1 — Register Creator and Viewers

### 1a. Register Creator

```
POST /auth/register
{
  "name": "Shashwat",
  "email": "creator@predikt.test",
  "password": "Password123"
}
```

**Expected:** HTTP 201 — returns `accessToken` and `user` object without `passwordHash`.

### 1b. Register Viewer 1

```
POST /auth/register
{
  "name": "Anya",
  "email": "viewer1@predikt.test",
  "password": "Password123"
}
```

**Expected:** HTTP 201 — returns token and user.

### 1c. Register Viewer 2

```
POST /auth/register
{
  "name": "Rohan",
  "email": "viewer2@predikt.test",
  "password": "Password123"
}
```

**Expected:** HTTP 201.

---

## Step 2 — Login Users

### 2a. Login Creator

```
POST /auth/login
{
  "email": "creator@predikt.test",
  "password": "Password123"
}
```

**Expected:** HTTP 200 — `accessToken` returned. Save this as `CREATOR_TOKEN`.

### 2b. Login Viewer 1

**Expected:** HTTP 200 — save as `VIEWER1_TOKEN`.

### 2c. Login Viewer 2

**Expected:** HTTP 200 — save as `VIEWER2_TOKEN`.

---

## Step 3 — Creator Creates a Room

```
POST /rooms
Authorization: Bearer CREATOR_TOKEN
{
  "roomTitle": "Morning Journey",
  "eventType": "journey",
  "startingPointLabel": "Koramangala",
  "destinationLabel": "Airport",
  "predictionCloseTime": "<30 minutes from now>"
}
```

**Expected:** HTTP 201 — returns room object including `inviteCode` (5-char string) and `status: "predictions_open"`.

Save `roomId` and `inviteCode`.

---

## Step 4 — Viewers Join Using Invite Code

### 4a. Viewer 1 fetches room by invite code

```
GET /rooms/code/:inviteCode
```

**Expected:** HTTP 200 — returns safe room summary. Must **not** contain `startingLat`, `startingLng`, `destinationLat`, `destinationLng`.

---

## Step 5 — Viewers Submit Predictions

### 5a. Viewer 1 submits prediction

```
POST /rooms/:roomId/predictions
Authorization: Bearer VIEWER1_TOKEN
{
  "predictedArrivalTime": "<time 30 minutes after now>"
}
```

**Expected:** HTTP 201 — prediction saved.

### 5b. Viewer 2 submits prediction

```
POST /rooms/:roomId/predictions
Authorization: Bearer VIEWER2_TOKEN
{
  "predictedArrivalTime": "<time 45 minutes after now>"
}
```

**Expected:** HTTP 201.

### 5c. Duplicate prediction rejected

Attempt to POST a second prediction for Viewer 1 on the same room.

**Expected:** HTTP 409 or 400 — duplicate rejected.

### 5d. Late prediction rejected

After `predictionCloseTime` passes, attempt to submit another prediction.

**Expected:** HTTP 400 — prediction window closed.

---

## Step 6 — Creator Locks Predictions

```
POST /rooms/:roomId/lock-predictions
Authorization: Bearer CREATOR_TOKEN
```

**Expected:** HTTP 200 — room status becomes `predictions_locked`, all predictions have `lockedStatus: true`.

### 6a. Locked room rejects new predictions

Attempt to submit a prediction to a locked room.

**Expected:** HTTP 400 — room not open.

---

## Step 7 — Creator Starts Live Session

```
POST /rooms/:roomId/start
Authorization: Bearer CREATOR_TOKEN
```

**Expected:** HTTP 200 — room status becomes `live`, `startTime` is set.

---

## Step 8 — Creator Sends Progress Update

```
POST /rooms/:roomId/location-update
Authorization: Bearer CREATOR_TOKEN
{
  "rawLat": 12.9716,
  "rawLng": 77.5946,
  "progressPercentage": 47,
  "etaMinutes": 31
}
```

**Expected:** HTTP 201 — event stored. `rawLat` and `rawLng` stored server-side only.

---

## Step 9 — Viewer Fetches Live State (Privacy Check)

```
GET /rooms/:roomId/live-state
```

**Expected:** HTTP 200 — response must contain:

```json
{
  "roomId": "...",
  "status": "live",
  "progressPercentage": 47,
  "etaMinutes": 31,
  "locationDisplayMode": "approximate",
  "safetyMessage": "Exact location hidden"
}
```

**Must NOT contain:** `rawLat`, `rawLng`, `displayLat`, `displayLng`, `startingLat`, `startingLng`, `destinationLat`, `destinationLng`.

---

## Step 10 — Creator Ends the Room

```
POST /rooms/:roomId/end
Authorization: Bearer CREATOR_TOKEN
{
  "actualEndTime": "<ISO timestamp>"
}
```

**Expected:** HTTP 200 — room status becomes `completed`, winner calculated, Aura and Clout aggregated.

---

## Step 11 — Winner Is Calculated

Inspect the response from Step 10 or call:

```
GET /rooms/:roomId/leaderboard
```

**Expected:** Rankings ordered by `overallRank` with room Aura and room Clout totals present.

---

## Step 12 — Aura And Clout Are Awarded

Check each user's stats:

```
GET /users/me/stats
Authorization: Bearer VIEWER1_TOKEN
```

**Expected:** `totalAura`, `weeklyAura`, and `cloutBalance` increment as expected. Rank 1 user has `winsCount` incremented.

---

## Step 13 — Room Leaderboard Is Visible

```
GET /rooms/:roomId/leaderboard
```

**Expected:** Returns ranked list with `name`, `predictedArrivalTime`, `differenceFromActualMinutes`, `rankInRoom`, `pointsAwarded`. Must not expose user `email` or `passwordHash`.

---

## Step 14 — Weekly Leaderboard Is Visible

```
GET /leaderboard/weekly
```

**Expected:** Returns list of users sorted by `weeklyXp` descending. Contains `userId`, `name`, `weeklyXp`, `totalXp`, `winsCount`.

---

## Privacy Regression Checklist

After every run, confirm no viewer-facing response contains:

- [ ] `rawLat`
- [ ] `rawLng`
- [ ] `startingLat`
- [ ] `startingLng`
- [ ] `destinationLat`
- [ ] `destinationLng`
- [ ] `displayLat`
- [ ] `displayLng`
- [ ] `passwordHash`
