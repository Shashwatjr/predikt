# Google Maps setup (PREDIKT)

PREDIKT uses Google Maps **only on the backend**. The web/mobile clients call Nest routes; they never load the Maps JavaScript SDK or hold the server key.

## What Google powers

| Feature | Backend route / path | Google API |
|---------|----------------------|------------|
| Place autocomplete | `GET /routes/place-search` | Places API (New) + legacy Places Autocomplete fallback |
| Place details | `GET /routes/place-details/:placeId` | Places Details |
| Reverse geocode | `GET /routes/reverse-geocode` | Geocoding |
| Route ETA / geometry | `POST /routes/preview` | Directions |
| Live checkpoint ETA re-reads | live-progress service | Directions (capped) |
| Provider status | `GET /routes/maps-config` | (config only; no billable call) |

If `GOOGLE_MAPS_API_KEY` is unset, search falls back to OpenStreetMap (Photon + Nominatim) and ETA falls back to approximate / OSRM.

## Google Cloud project checklist

Project in use today: `predikt-mvp` (`676327407919`).

1. Enable billing on the GCP project.
2. Enable these APIs:
   - **Places API (New)** — `places.googleapis.com`
   - **Places API** (legacy) — `places-backend.googleapis.com` (fallback)
   - **Geocoding API** — `geocoding-backend.googleapis.com`
   - **Directions API** — `directions-backend.googleapis.com`
3. Create an API key used **only by the Nest server** (Cloud Run + local).
4. Key restrictions (important):
   - **Do not** use HTTP referrer restrictions on this key (server-side Directions/Places reject referer-restricted keys).
   - Prefer **Application restrictions → None** for MVP, or IP allowlisting if you pin Cloud Run egress.
   - Under API restrictions, allow at least Places (New), Places, Geocoding, Directions.
5. Store the key in Secret Manager as `GOOGLE_MAPS_API_KEY` and mount it on Cloud Run (already wired).

Optional split keys (same restriction rules):

- `GOOGLE_PLACES_API_KEY` — Places + Geocoding
- `GOOGLE_DIRECTIONS_API_KEY` — Directions only  
  If unset, both fall back to `GOOGLE_MAPS_API_KEY`.

Optional browser Embed key (only if you wire `JourneyMapPreview.web.tsx`):

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — Maps Embed API, **HTTP referrer** restricted to:
  - `https://myprediktion.com/*`
  - `https://www.myprediktion.com/*`
  - `https://predikt-alpha.vercel.app/*`
  - `http://localhost:8081/*`
  - `http://localhost:8082/*`

Never put the server key in `EXPO_PUBLIC_*` or Vercel frontend env.

## Production (Cloud Run + myprediktion.com)

Required Cloud Run env / secrets:

```bash
MAPS_PROVIDER=auto
GOOGLE_MAPS_API_KEY=<secret>
WEB_BASE_URL=https://myprediktion.com
CORS_ORIGINS=https://myprediktion.com,https://www.myprediktion.com,https://predikt-alpha.vercel.app,<other preview origins>
```

Smoke checks:

```bash
curl -sS "$API/routes/maps-config"
# expect googleConfigured:true, placeSearchProvider:"google", routeProvider:"google"

curl -sS "$API/routes/place-search?query=Indiranagar"
# expect suggestions with provider:"google"
```

CORS preflight from the branded origin must succeed for both apex and `www`.

### Domain note (Hostinger → Vercel) — required for seamless brand URLs

Registrar: **Hostinger**. Current nameservers are still parking (`atlas` / `hyperion.dns-parking.com`), and Hostinger’s forward sends both apex and `www` to `https://predikt-alpha.vercel.app/` **without preserving the query string**.

That means links like `https://myprediktion.com?joinCode=ABC12` currently open the landing page with **no join code**. Maps APIs are fine on the Vercel origin; invites through the brand domain are not.

**Do this in Hostinger hPanel (Domains → myprediktion.com → DNS / Nameservers):**

1. Turn off / delete any **domain forwarding / redirect** to `predikt-alpha.vercel.app`.
2. Preferred: **Change nameservers** to:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. Or keep Hostinger DNS and set records:
   - Apex `A` `@` → `76.76.21.21`
   - `www` `CNAME` → `cname.vercel-dns.com` (or the exact target Vercel shows)
4. In Vercel → project `predikt` → Domains, confirm `myprediktion.com` and `www.myprediktion.com` show as **Valid**.
5. After DNS propagates, set Cloud Run back to:
   - `WEB_BASE_URL=https://myprediktion.com`
   - Keep both apex and `www` in `CORS_ORIGINS`

**Interim (already applied):** Cloud Run `WEB_BASE_URL` points at `https://predikt-alpha.vercel.app` so WhatsApp invite links keep working until Hostinger DNS is fixed.

## Local development

1. Copy the server key into `backend/.env` (gitignored):

```bash
MAPS_PROVIDER=auto
GOOGLE_MAPS_API_KEY=<same server key as Cloud Run>
```

Or pull from GCP:

```bash
gcloud secrets versions access latest --secret=GOOGLE_MAPS_API_KEY
```

2. Restart the Nest API (`cd backend && npm run start:dev`).
3. Point the mobile/web client at that API via `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env`.
4. Confirm:

```bash
curl -sS http://localhost:3000/routes/maps-config
curl -sS "http://localhost:3000/routes/place-search?query=Indiranagar"
```

Local CORS already allows `localhost` / `127.0.0.1` on any port in development.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `maps-config` shows `googleConfigured:false` | Key missing from env / secret not mounted |
| Place search empty / OSM fallback | Places APIs disabled, billing off, or key restricted incorrectly |
| Directions → approximate ETA / OSM | Referer-restricted key, Directions API disabled, or quota |
| Browser CORS errors from `www.myprediktion.com` | `www` missing from Cloud Run `CORS_ORIGINS` |
| `REQUEST_DENIED` in Cloud Run logs | Key restriction or API not enabled |

Logs intentionally surface Google `status` + `error_message` for Directions so referer-restriction failures are visible instead of silent fake ETAs.
