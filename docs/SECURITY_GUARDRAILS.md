# Security Guardrails

## Phase 1 Hardening Update — July 9, 2026

- Access tokens now have explicit expiry and refresh/logout endpoints exist.
- Refresh tokens are session-backed, rotated on refresh, stored hashed in `UserSession`, and revoked on logout.
- `JWT_SECRET`, `ADMIN_JWT_SECRET`, `DATABASE_URL`, `PORT`, and `NODE_ENV` are validated at startup.
- Development/default secrets are rejected in production-like environments.
- Helmet secure headers are enabled in bootstrap.
- CORS is environment-driven through `CORS_ORIGINS` and no wildcard-with-credentials path is used.
- High-risk write paths now use DTO validation across auth refresh/logout, route preview/create, profile update, privacy, moderation, and admin writes.
- Integration coverage now verifies hidden predictions, safe projections, admin auth boundaries, credit idempotency, route privacy, and refresh/logout behavior.
- Mobile clients now persist session state with secure native storage and web-safe fallback storage, attempt one refresh on `401`, and clear local session state on refresh failure.

## Implemented MVP Guardrails

- Safe user/room/route projections for public and participant responses.
- No `passwordHash` in auth, leaderboard, room, or admin list/detail responses.
- Prediction values hidden until lock by default.
- Two-minute edit/revoke window enforced before lock.
- Anti-betting keyword detection on user-generated public text paths implemented in this pass.
- MVP rate limiting is enabled with `@nestjs/throttler`.
- Admin auth guard required for admin endpoints.
- Audit logs for key privacy, moderation, admin, and policy events.

## Rate Limits

- Global fallback: 300 requests/minute.
- Register: 5/minute.
- Login: 10/minute.
- Room creation and route-room creation: 20/minute.
- Prediction submission: 60/minute.
- Invite-code lookup: 30/minute.
- Daily spin claim: 10/minute.
- Report submission: 10/minute.
- Handle availability: 60/minute.
- 429 message: `Too many requests. Please slow down and try again in a minute.`

## Required Follow-Ups

- Complete hands-on browser DevTools QA for reload persistence, Authorization headers, refresh retry behavior, logout cleanup, CORS, and console errors before production beta.
- Add dependency scanning, secret rotation runbook, and breach response drills.
