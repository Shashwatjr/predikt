# PREDIKT

> **Predict what’s next.**

PREDIKT is the interactive layer for real-world live events, where every journey, challenge, or stream becomes a prediction game among friends, followers, and communities.

Current MVP: milestone-based journey prediction. A creator opens a room, adds milestones, viewers predict reached times, the app awards Aura for accuracy and Clout for activity, and eligible Drops can be unlocked after play.

v0.3 MVP+ foundations now also include safety-delayed viewer movement, social add-on share kits, room categories, movement avatars, sponsorship metadata, creator profiles, plans, campaign/admin foundations, audit logging, consent records, and privacy requests.

---

## Repository Structure

```
predikt/
├── backend/        NestJS REST API (Node.js / TypeScript)
├── mobile/         React Native Expo mobile app
├── docs/           Product and technical documentation
├── infra/          Infrastructure configs (future)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Quick Start

### 1. Copy environment variables

```bash
cp .env.example .env
```

Edit `.env` and set a strong `JWT_SECRET` and `POSTGRES_PASSWORD`.

### 2. Start the database and pgAdmin

```bash
docker compose up -d postgres pgadmin
```

- PostgreSQL is available at `localhost:5432`
- pgAdmin is available at **http://localhost:5050**
  - Email: `admin@predikt.local`
  - Password: value of `PGADMIN_DEFAULT_PASSWORD` in your `.env`

### 3. Run database migrations

```bash
cd backend
npm install
npx prisma migrate dev
npx prisma generate
```

### 4. (Optional) Seed test data

```bash
npx prisma db seed
```

### 5. Start the API

**Option A — Docker (recommended)**

```bash
docker compose up api
```

**Option B — Local Node.js**

```bash
cd backend
npm run start:dev
```

API is available at **http://localhost:3000**

Health check: `GET http://localhost:3000/health`

### 6. Start the mobile app

```bash
cd mobile
npm install
npx expo start
```

Expo environment:

- copy `mobile/.env.example` to `mobile/.env` when you want an explicit client API target
- set `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000` for local web/simulator use
- for physical devices, point `EXPO_PUBLIC_API_BASE_URL` at your laptop LAN IP (for example `http://192.168.1.100:3000`)

CI / automation note:

- backend verification currently relies on `npm run build` and `npm test -- --runInBand`
- mobile verification currently relies on `npx tsc --noEmit`
- add a CI workflow to run those commands on every push/PR if you want continuous guardrails

---

## Documentation

| Document | Description |
|----------|-------------|
| [Audit Report](docs/AUDIT_REPORT.md) | Current repository audit against latest product requirements |
| [MVP Spec](docs/MVP_SPEC.md) | Current product concept, scope, and vocabulary |
| [Tech Architecture](docs/TECH_ARCHITECTURE.md) | System design and component overview |
| [Privacy Architecture](docs/PRIVACY_ARCHITECTURE.md) | GPS privacy rules and enforcement |
| [API Spec](docs/API_SPEC.md) | All REST endpoints with examples |
| [E2E Test Flow](docs/E2E_TEST_FLOW.md) | Manual end-to-end test cases |
| [Build Status](docs/BUILD_STATUS.md) | Current build state and known limitations |
| [v0.3 Audit Report](docs/V0_3_AUDIT_REPORT.md) | Current v0.3 implementation status and gaps |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native / Expo |
| API | NestJS (Node.js / TypeScript) |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | JWT (passport-jwt) |
| Infrastructure | Docker / Docker Compose |

---

## Privacy

Exact creator location is **never** exposed to viewers. Viewer-facing APIs return only:

- `progressPercentage`
- `etaMinutes`
- `status`
- `locationDisplayMode`
- `safetyMessage: "Exact location hidden"`

See [docs/PRIVACY_ARCHITECTURE.md](docs/PRIVACY_ARCHITECTURE.md) for full details.
