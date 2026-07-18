# PREDIKT Admin Portal — Manual QA

Use a desktop browser at `/admin` with the local seeded admin account unless otherwise noted.

## Preconditions

- Backend running with migrated database
- `FEATURE_ADMIN_PORTAL_ENABLED=true`
- Seeded admin: `admin@predikt.local` / `Admin123!` (local only)

## Checklist

1. [ ] Normal registered user cannot open `/admin` (403 or redirected to admin login without consumer session granting access)
2. [ ] Guest user cannot open `/admin` with guest JWT
3. [ ] Admin login succeeds with seeded local credentials
4. [ ] Overview metrics load without full-page crash
5. [ ] Date filter changes summary numbers or period label
6. [ ] Invite funnel numbers are plausible (non-negative, ordered roughly by stage)
7. [ ] Rooms list paginates and shows code/category/status columns
8. [ ] Room detail contains no raw GPS, guestKey, or hidden prediction fields in network response
9. [ ] Users list does not expose email in list rows
10. [ ] Feedback status can be updated to `reviewing` and persists after refresh
11. [ ] Moderation report can be resolved and disappears or updates status
12. [ ] Account disable requires confirmation and succeeds
13. [ ] Audit event appears after disable/resolve actions
14. [ ] Health page loads with no secrets, connection strings, or stack traces
15. [ ] Feature flags display backend values read-only
16. [ ] Empty states render when queues have no rows
17. [ ] One failed analytics endpoint shows section error without blanking entire portal
18. [ ] Mobile layout remains usable (sidebar + scrollable content)
19. [ ] No console-critical errors during navigation across all sections
20. [ ] Network responses for admin endpoints contain no passwordHash, guestKey, token, or coordinate fields

## Security spot checks

- `GET /admin/analytics/summary` without token → 401
- Same endpoint with user JWT → 403
- Same endpoint with admin JWT → 200
- `PATCH /admin/feedback/:id` creates an audit log entry

## Notes

Record environment, build SHA, tester, and date when completing this checklist for the private beta launch packet.
