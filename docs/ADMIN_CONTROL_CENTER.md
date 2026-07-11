# Admin Control Center

PREDIKT v0.3 includes a backend admin foundation under `/admin`.

Current capabilities:

- separate admin login
- dashboard metrics
- users list and review placeholder
- user suspension
- rooms list and remove/suppress action
- reports review
- disputes review and resolution
- credit ledger review and credit reversal
- creators review
- drops create/update
- sponsors create/list
- campaigns create/list
- privacy request review
- audit log viewing
- AI system inventory management
- user profile records now include optional native `prediktHandle`
- creator profiles allow optional Instagram, Facebook, and YouTube metadata

Security baseline:

- separate admin auth from user auth
- hashed admin password
- admin JWT using `ADMIN_JWT_SECRET` or fallback `JWT_SECRET`
- auth guard on all admin routes except login
- no `passwordHash` in admin list/detail responses
- admin actions create audit logs

Moderation endpoints:

- `GET /admin/rooms`
- `GET /admin/reports`
- `GET /admin/credit-ledger`
- `GET /admin/disputes`
- `POST /admin/users/:userId/suspend`
- `POST /admin/rooms/:roomId/remove`
- `POST /admin/credits/reverse`
- `POST /admin/disputes/:disputeId/resolve`

Seeded admin:

- `admin@predikt.local`
- password: `Admin123!`
