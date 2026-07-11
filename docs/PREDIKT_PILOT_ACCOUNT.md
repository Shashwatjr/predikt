# PREDIKT Pilot Account (First-Time MVP)

Use this account when sharing the app with pilot testers or walking through the real first-time experience. It has **no pre-seeded rooms, predictions, notifications, or hub data**.

## Credentials

| Field | Value |
|-------|-------|
| Email | `pilot@predikt.ai` |
| Password | `PilotMvp2026!` |
| Handle | `mvp.pilot` |
| Starting credits | 30 (same as self-registration) |

## Create / refresh the account

```bash
cd backend
npm run seed:pilot
```

Safe to re-run. Updates name, handle, and password without wiping rooms the pilot user may have created during testing.

## What the pilot sees

- Empty **Live PREDIKTs** hub with “Create your first PREDIKT”
- No fake demo cards or placeholder results on Home
- Dashboard onboarding tour on first login (same as a new registrant)
- Full create-room flow: category → route → invite

## Demo account (for internal QA only)

For a **pre-filled dashboard** with journey lifecycle edge cases and category rooms:

```bash
cd backend
npm run seed:engagement-demo
```

| Email | Password |
|-------|----------|
| `test@predikt.ai` | `Password123!` |

## Suggested pilot flow

1. Log in as `pilot@predikt.ai`
2. Complete the dashboard tour
3. **Create Room** → Arrival Time → set From / To → create
4. Share invite code with a second tester (or register a second account)
5. Join, submit predictions, run the journey lifecycle

## Environment

- Backend: `http://localhost:3000`
- Expo Web: `http://localhost:8081`
