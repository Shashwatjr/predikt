# PREDIKT Deployment — Option 2 (managed backend + GoDaddy page)

Goal: a real, WhatsApp-tappable invite link — `https://kriviksha.com/predikt?joinCode=CODE`
— that opens the join/predict flow in mobile Safari, mobile Chrome, and desktop Chrome.

**Architecture**
- **Frontend** (Expo web export, static files) → GoDaddy hosting at `kriviksha.com/predikt`
- **Backend** (NestJS) → managed host (Render used below; Railway/Fly equivalent) at `api.kriviksha.com`
- **Database** (Postgres) → Neon free tier

Steps marked **[you]** need your accounts/credentials; everything else is prepared in the repo.

---

## 1. Database — Neon **[you]**
1. Create a free project at neon.tech → a database named `predikt_db`.
2. Copy the **Prisma** connection string (Dashboard → Connect → Prisma). It ends with `?sslmode=require`.
3. Push the schema (run locally, one time — the project uses `db push`, no migration files):
   ```bash
   cd backend
   DATABASE_URL="<neon-prisma-url>" npx prisma db push
   # optional demo data:
   DATABASE_URL="<neon-prisma-url>" npx prisma db seed
   ```

## 2. Backend — Render **[you]**
1. Push this repo to GitHub (Render deploys from a repo). New → **Web Service** → pick the repo → root `backend/`.
2. Environment: **Docker** (a `backend/Dockerfile` already exists). Render auto-detects it.
3. Add env vars from [`backend/.env.production.example`](../backend/.env.production.example):
   `NODE_ENV=production`, `PORT=3000`, `DATABASE_URL` (Neon), `JWT_SECRET` + `ADMIN_JWT_SECRET`
   (`openssl rand -hex 48`), `CORS_ORIGINS=https://kriviksha.com,https://www.kriviksha.com`,
   `WEB_BASE_URL=https://kriviksha.com/predikt`.
4. Instance type: **Starter (always-on, ~$7/mo)** for demos — the free tier cold-starts ~30–60s,
   which breaks a freshly-tapped link. Free is fine for internal testing.
5. Deploy. Confirm `https://<service>.onrender.com/health` returns `200`.
6. Custom domain: Render → Settings → Custom Domain → add `api.kriviksha.com`. Render shows a target host.

## 3. DNS — GoDaddy **[you]**
- In GoDaddy → `kriviksha.com` → DNS: add a **CNAME** record `api` → the target host Render gave you.
- Wait for propagation, then confirm `https://api.kriviksha.com/health` → `200` (Render auto-issues TLS).

## 4. Frontend — Expo web export → GoDaddy `/predikt`
1. Set the web export base path so assets resolve under `/predikt`. In `mobile/app.json`, add inside `"expo"`:
   ```json
   "experiments": { "baseUrl": "/predikt" }
   ```
   (Kept out of the committed file so local `expo start` stays at `/`. Add it only for the export,
   or keep it on a `app.config.js` build variant.)
2. Build with production env:
   ```bash
   cd mobile
   cp .env.production.example .env.production   # then edit if needed
   npx expo export --platform web
   ```
   Output lands in `mobile/dist/`.
3. **[you]** Upload the **contents** of `mobile/dist/` to the `predikt` folder of your GoDaddy hosting
   (cPanel File Manager → `public_html/predikt/`, or the Website hosting file upload).
4. SPA fallback: this app reads `?joinCode=` from the URL and has no server-side routes, so no rewrite
   rules are needed — every visit to `/predikt` (with or without `?joinCode=`) loads `index.html`.

---

## 5. Verify — real invite link **[you + me]**
Run through this on **mobile Safari, mobile Chrome, and desktop Chrome**:

1. Open `https://kriviksha.com/predikt` → landing loads, no console errors.
2. Register an account, create an **Arrival Time** room, open the share sheet → copy the WhatsApp link.
   It must be `https://kriviksha.com/predikt?joinCode=XXXXX`.
3. Send it to yourself on WhatsApp; **tap it from inside WhatsApp**. It must open the browser directly
   on the **join/predict** screen for that room (not the landing page).
4. Enter a guest name → **Join and Predict** → submit a prediction (no account) → you land on Home.
5. As the creator, lock → start → end the room. Guest returns to the room → sees **the Tea**
   (winner, commentary, badge, reactions) → taps **Rematch** → a new room opens with a new invite code.
6. Confirm disabled surfaces are hidden: no Leaderboard tab, no notifications bell, only
   Arrival Time + Food ETA categories, only "Play with Friends".

If cold-starts appear on step 3, switch the Render instance to the always-on tier.

## Rollback / reversibility
- Everything non-MVP is disabled by flags in `src/config/feature-flags.ts` (backend) and
  `src/config/featureFlags.ts` (mobile) or by env overrides (`FEATURE_*`, `EXPO_PUBLIC_FEATURE_*`).
  Flip a value to re-enable; nothing was deleted.
- To take the site down, remove the `/predikt` folder from GoDaddy; the backend/DB are independent.
