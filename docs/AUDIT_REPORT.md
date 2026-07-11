# PREDIKT Audit Report

## 1. What Exists Today

- NestJS backend with auth, rooms, predictions, lifecycle, live progress, leaderboards, users, and drops modules
- Prisma schema upgraded to milestone rooms, Aura transactions, Clout transactions, Drops, and Flexes
- Expo mobile app with create, join, prediction, live room, results, leaderboard, and profile flows
- Seed script for a milestone demo room

## 2. What Is Aligned With Latest Spec

- Invite-only room flow
- Milestone-aware room model with guaranteed final destination milestone
- Privacy-safe live-state payload
- Aura and Clout terminology in core backend and mobile flows
- Room lifecycle endpoints for lock, start, reach milestone, end, and cancel
- Weekly leaderboard and user stats aligned to Aura
- Drops endpoints added

## 3. What Is Missing

- Automated tests for milestone scoring, privacy filtering, and drops
- True milestone-aware creator controls in mobile for marking specific milestones reached
- Flex surfacing in API responses and mobile UI
- Robust streak logic beyond the current MVP increment path
- Formal data-preserving migration from the old single-prediction schema

## 4. What Used Old Terminology

- Prisma user totals and transaction tables were previously XP-based
- Result and leaderboard mobile screens displayed XP copy
- MVP, API, and build docs still described arrival-only predictions and XP awarding

## 5. What Needed Refactoring

- Room creation and invite-code lookup now expose milestone metadata
- Prediction storage moved from one room-level prediction to per-milestone predictions
- Lifecycle scoring moved from end-of-room-only ranking to milestone-first Aura and Clout calculation
- Weekly leaderboard and profile stats now read Aura and Clout fields

## 6. Privacy Boundary Risks

- Raw creator coordinates still exist in persistence, so any future realtime channel or admin export can accidentally bypass sanitization if it skips the current service layer
- Creator room detail still exposes exact route coordinates by design, so role checks must stay intact
- There are no automated contract tests yet to lock the privacy boundary

## 7. Recommended Implementation Sequence

1. Add backend tests for live-state privacy, milestone prediction rules, milestone scoring, and room completion rewards.
2. Add a proper Prisma migration or documented reset flow for existing local databases.
3. Upgrade the mobile creator journey so milestones can be marked reached individually from the app.
4. Expose Flexes and unlocked Drops in profile and result experiences.
5. Add centralized serializers for viewer-safe room and live-state responses.
