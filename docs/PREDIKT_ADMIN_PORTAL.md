# PREDIKT Admin Portal

Private-beta operations portal for monitoring the MVP invite-to-result loop, reviewing rooms and users safely, triaging feedback and moderation, and checking deployment health.

## Purpose

Answer within five minutes:

- Is the beta working?
- Where are people dropping off?
- Are guests successfully predicting?
- Are results being viewed and shared?
- Are rematches happening?
- Are rooms resolving correctly?
- Are there safety or privacy problems?
- Is the platform healthy?

## Intended users

- Product owner / platform ops (`platform_ops`, `super_admin`)
- Privacy and compliance reviewers (`privacy_officer`, `compliance_auditor`)
- Campaign operators with limited admin access (`campaign_manager`)

## Access

- Web route: `/admin`
- Separate admin JWT (`ADMIN_JWT_SECRET`, `tokenType: admin_access`)
- Normal user and guest JWTs receive **403**
- Unauthenticated requests receive **401**

### Promote a user to admin (safe procedure)

Admin access uses the separate `admin_users` table, not the consumer `users` table.

1. Create or select an `admin_roles` row with the appropriate `role_name`.
2. Insert an `admin_users` record with a bcrypt `password_hash`, `status = active`, and the role FK.
3. Do **not** hardcode production credentials in seed scripts.
4. Record the promotion in audit logs.
5. Recommend MFA before public launch (`mfa_enabled` field exists but is not yet enforced).

Local development seed only:

- Email: `admin@predikt.local`
- Password: `Admin123!`

## Role model

| Backend role | Portal label | Access |
|---|---|---|
| `super_admin` | SUPER_ADMIN | Full portal |
| `platform_ops` | ADMIN | Full portal |
| `privacy_officer` | ADMIN | Full portal |
| `compliance_auditor` | ADMIN | Full portal |
| `campaign_manager` | ADMIN | Full portal |

Consumer users have no admin role. Room `creator` / `participant` roles are room-scoped only.

## Screens

| Screen | Path / nav | Purpose |
|---|---|---|
| Overview | `/admin` → Overview | Beta health, funnel, guest journey, sharing, moderation summary |
| Rooms | Rooms | Paginated operational room list and safe detail |
| Users | Users | Limited user operations list and detail |
| Feedback | Feedback | User feedback queue |
| Moderation | Moderation | Reports queue |
| Audit | Audit | Read-only audit search |
| System Health | System Health | Safe operational health |
| Feature Flags | Feature Flags | Read-only backend flag visibility |

## Endpoint list

### Auth
- `POST /admin/auth/login`
- `GET /admin/me`

### Analytics
- `GET /admin/analytics/summary`
- `GET /admin/analytics/funnel`
- `GET /admin/analytics/categories`
- `GET /admin/analytics/guest-journey`
- `GET /admin/analytics/room-health`
- `GET /admin/analytics/sharing`
- `GET /admin/analytics/errors`

### Operations
- `GET /admin/operations/rooms`
- `GET /admin/operations/rooms/:roomId`
- `POST /admin/operations/rooms/:roomId/mark-review`
- `GET /admin/operations/users`
- `GET /admin/operations/users/:userId`
- `POST /admin/operations/users/:userId/disable`
- `POST /admin/operations/users/:userId/enable`
- `POST /admin/operations/users/:userId/mark-review`

### Feedback
- `GET /admin/feedback`
- `PATCH /admin/feedback/:feedbackId`
- `POST /feedback` (user submission)

### Moderation
- `GET /admin/moderation/queue`
- `PATCH /admin/moderation/reports/:reportId`
- `POST /admin/moderation/rooms/:roomId/commentary-fallback`

### Audit / system
- `GET /admin/audit-logs/search`
- `GET /admin/system/health`
- `GET /admin/system/version`
- `GET /admin/system/feature-flags`

## Metric definitions

All analytics use server-side aggregation over `activity_events` and room tables for the selected period.

**Invite-to-prediction conversion** =
unique sessions with `prediction_submitted` (or guest/registered variants)
÷
unique sessions with `invite_preview_loaded`

**Preview-to-prediction-started conversion** =
sessions with `guest_prediction_started` or `guest_join_started`
÷
sessions with `invite_preview_loaded`

**Prediction-started-to-submitted conversion** =
sessions with prediction submitted events
÷
sessions with prediction started events

**Submitted-to-result-viewed conversion** =
sessions with `result_viewed` / `tea_viewed`
÷
sessions with prediction submitted events

**Result-viewed-to-shared conversion** =
sessions with `result_shared` / `moment_card_shared`
÷
sessions with result viewed events

**Result-viewed-to-rematch conversion** =
sessions with `rematch_created`
÷
sessions with result viewed events

**Guest upgrade conversion** =
`guest_upgrade_completed` events
÷
`guest_upgrade_started` events

**Room completion rate** =
rooms with `status = completed`
÷
rooms created in period

**Rematch rate by category** =
rooms with `rematch_of_room_id` set
÷
rooms in category

## Privacy boundary

Admin access does **not** mean unrestricted data access.

Never returned in list endpoints by default:

- password hashes, refresh tokens, guest keys
- raw GPS, route coordinates, exact private addresses
- hidden predictions before lock
- full feedback or commentary text in analytics
- auth tokens or guest keys

Room detail uses `safeRoomProjection`. User list hides email; detail may show email for support when authorized.

## Moderation workflow

1. Reports appear in moderation queue with type, priority, status.
2. Admin reviews context via safe room/user references.
3. Admin may resolve, dismiss, or force safe commentary fallback.
4. Account disable requires confirmation and creates an audit record.
5. No automatic punishment from a single report.

## Feedback workflow

1. Users submit via `POST /feedback`.
2. Safety/privacy feedback is prioritized to `high`.
3. Admin updates status, priority, and internal notes.
4. Internal notes are never exposed to users.

## Audit behavior

All admin mutations write `audit_logs` with actor, action, target, before/after snapshots (sanitized), and optional reason. Audit log view is read-only; no deletion through the portal.

## Feature flags

Centralized only — no database-backed runtime flag editor.

Backend: `backend/src/config/feature-flags.ts`  
Frontend: `mobile/src/config/featureFlags.ts`

Admin portal flags:

- `ADMIN_PORTAL_ENABLED`
- `ADMIN_ANALYTICS_ENABLED`
- `ADMIN_FEEDBACK_QUEUE_ENABLED`
- `ADMIN_MODERATION_ENABLED`
- `ADMIN_SYSTEM_HEALTH_ENABLED`

## Limitations

- No public leaderboards, revenue tooling, or campaign CRM in this sprint
- No winner/prediction editing
- No user impersonation
- No permanent deletion through the portal
- No MFA enforcement yet (recommended pre-public launch)
- No exportable analytics or cohort retention yet

## Future roadmap

- SSO and MFA
- Exportable analytics
- Retention cohorts
- Creator insights
- Automated anomaly detection
- Advanced observability / incident tooling
