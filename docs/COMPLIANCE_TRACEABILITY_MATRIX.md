# Compliance Traceability Matrix

| Requirement | Source standard | Control description | System module | Database table/model | API endpoint | Evidence | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| Privacy by design | GDPR | Viewer live-state excludes exact coordinates and uses delay | Live Progress | `prediction_rooms`, `live_location_events` | `GET /rooms/:roomId/live-state` | service logic + tests | Engineering | Implemented |
| Data minimization | GDPR | Invite code and viewer room responses omit exact coordinates | Rooms | `prediction_rooms`, `room_milestones` | `GET /rooms/:roomId`, `GET /rooms/code/:inviteCode` | room sanitization | Engineering | Implemented |
| Consent capture | GDPR | Consent records stored with version and timestamps | Privacy | `consent_records` | `POST /consents`, `GET /consents/me` | API + schema | Product/Engineering | Implemented |
| Access/export/delete requests | GDPR | Privacy request intake and admin workflow | Privacy/Admin | `privacy_requests` | `POST /privacy/requests`, `/admin/privacy-requests` | API + audit trail | Privacy Officer | Implemented |
| Auditability/accountability | NIST | Admin and privacy actions written to audit logs | Audit/Admin | `audit_logs` | `/admin/*` | tests + audit service | Compliance | Implemented |
| Location privacy/safety | Internal safety control | Safety-delayed movement and hidden exact GPS | Live Progress | `prediction_rooms`, `live_location_events` | `GET /rooms/:roomId/live-state` | service logic + docs | Engineering | Implemented |
| Admin RBAC foundation | Internal control | Admin roles and status with guarded routes | Admin | `admin_roles`, `admin_users` | `/admin/*` | seeded roles + auth guard | Platform Ops | Implemented |
| AI governance readiness | EU AI Act readiness | Placeholder system inventory for planned AI features | Admin | `ai_system_inventory` | `/admin/ai-systems` | schema + endpoints | AI Governance | Implemented |
