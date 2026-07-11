# PREDIKT — Technical Architecture

## High-Level Diagram

```
┌──────────────────────────────────┐
│         Mobile App               │
│   React Native / Expo (v0.1)     │
│                                  │
│  Screens: Login, Register,       │
│  Home, Create Room, Join Room,   │
│  Predict, Live Room, Results,    │
│  Leaderboard, Profile            │
└──────────────┬───────────────────┘
               │  HTTPS / REST (v0.1)
               │  Socket.io (future)
               ▼
┌──────────────────────────────────┐
│         NestJS API               │
│   Node.js / TypeScript           │
│   Port 3000                      │
│                                  │
│  Modules:                        │
│  auth · rooms · predictions      │
│  lifecycle · live-progress       │
│  leaderboards · users            │
│                                  │
│  Auth: JWT (passport-jwt)        │
│  Validation: class-validator     │
└──────────────┬───────────────────┘
               │  Prisma ORM
               ▼
┌──────────────────────────────────┐
│         PostgreSQL 16            │
│   Container: predikt_postgres    │
│   Database: predikt_db           │
│   Port: 5432                     │
└──────────────────────────────────┘
```

---

## Component Details

### Mobile App — React Native / Expo

- **Framework:** React Native with Expo SDK
- **Language:** TypeScript
- **Navigation:** React Navigation (native stack + bottom tabs)
- **HTTP client:** axios
- **Auth state:** React Context API (v0.1); consider Zustand or Redux post-MVP
- **API base URL:** configurable constant (`src/services/api.ts`)

**Note for physical device testing:** When testing on a real Android/iOS device on the same LAN, set `API_BASE_URL` to the laptop's LAN IP address (e.g., `http://192.168.x.x:3000`), not `localhost`.

### Backend — NestJS

- **Framework:** NestJS v10+
- **Language:** TypeScript
- **Runtime:** Node.js 20+
- **Auth:** JWT via `@nestjs/jwt` and `passport-jwt`
- **Validation:** `class-validator` + `class-transformer` with global validation pipe
- **Configuration:** `@nestjs/config` with `.env` file
- **ORM:** Prisma
- **Password hashing:** bcrypt

### Database — PostgreSQL 16

- Managed via Docker Compose in local development
- Schema managed by Prisma migrations
- Admin UI: pgAdmin 4 at `http://localhost:5050`

### ORM — Prisma

- Schema at `backend/prisma/schema.prisma`
- Migrations in `backend/prisma/migrations/`
- Seed script at `backend/prisma/seed.ts`
- Commands:
  - `npx prisma migrate dev` — apply migrations in development
  - `npx prisma generate` — regenerate Prisma client
  - `npx prisma db seed` — run seed script
  - `npx prisma studio` — visual database browser

### Infrastructure — Docker Compose

Services defined in `docker-compose.yml`:

| Service | Image | Port |
|---------|-------|------|
| `postgres` | postgres:16 | 5432 |
| `pgadmin` | dpage/pgadmin4 | 5050 |
| `api` | ./backend (Dockerfile) | 3000 |

### REST API (v0.1)

All communication between mobile and backend is REST over HTTP in v0.1. JSON request/response bodies. JWT in `Authorization: Bearer <token>` header.

---

## Deferred — Future Milestones

### Socket.io (real-time)

Socket.io will be added after the REST MVP is stable and tested. It will provide:

- Live progress broadcast to viewer channels
- Room status change events

The same privacy boundary applies: socket events to viewer rooms must never emit `rawLat` or `rawLng`.

### Google Maps API

Google Maps will be added post-MVP for:

- Route visualisation (start → destination)
- Approximate progress marker (not real-time creator location)

Raw creator GPS will still not be exposed to viewers even with Maps enabled.

### Push Notifications

Expo Notifications or FCM will be used post-MVP for:

- Prediction cut-off reminders
- Room start alerts
- Result announcements

---

## Environment Variables

Documented in `.env.example` at repository root.

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |
| `PGADMIN_DEFAULT_EMAIL` | pgAdmin login email |
| `PGADMIN_DEFAULT_PASSWORD` | pgAdmin login password |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port (default 3000) |
| `DATABASE_URL` | Prisma connection string |
| `JWT_SECRET` | Secret for JWT signing |

---

## Directory Structure

```
predikt/
├── backend/                # NestJS API
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── rooms/
│   │   ├── predictions/
│   │   ├── live-progress/
│   │   ├── leaderboards/
│   │   ├── prisma/
│   │   ├── common/
│   │   └── health/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── Dockerfile
│   └── package.json
├── mobile/                 # Expo React Native app
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── navigation/
│   │   ├── services/
│   │   └── context/
│   └── package.json
├── docs/                   # Documentation
├── infra/                  # Future Terraform / Helm / k8s
├── docker-compose.yml
├── .env.example
└── README.md
```
