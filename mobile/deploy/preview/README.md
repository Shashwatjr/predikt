This is an opt-in Node preview package, not the current Vercel static deployment. Do not deploy `mobile/dist` under the existing SPA-only rewrite and claim OG acceptance.

Build from `mobile/` with a dedicated non-production origin. Choose a fresh output directory for each package; the packager rejects an existing output to prevent stale bundles. `Dockerfile` accepts `PREVIEW_WEB_ORIGIN` as a build argument. The equivalent local package build is:

```sh
EXPO_PUBLIC_PREVIEW_WEB_ORIGIN=http://127.0.0.1:8221 \
EXPO_PUBLIC_WEB_BASE_URL=http://127.0.0.1:8221 EXPO_PUBLIC_API_BASE_URL= \
npx expo export --platform web --clear --output-dir /tmp/predikt-preview-export
EXPO_PUBLIC_PREVIEW_WEB_ORIGIN=http://127.0.0.1:8221 \
node deploy/preview/package.mjs /tmp/predikt-preview-export /tmp/predikt-preview-package
PREVIEW_WEB_ORIGIN=http://127.0.0.1:8221 PREVIEW_API_ORIGIN=http://127.0.0.1:3410 \
PORT=8221 node /tmp/predikt-preview-package/server.mjs
```

`PREVIEW_API_ORIGIN` is a fixed upstream for `/api/*`. Set backend CORS_ORIGINS and WEB_BASE_URL to the exact preview origin; set its DB and JWT secrets independently. The client is pinned to the package origin plus `/api` and fails closed if loaded on another origin. No production API fallback is used by a preview build. Ordinary builds retain their existing defaults. The origin is public configuration; no database/JWT secrets belong in Expo public variables.

On a hosting platform, terminate TLS, forward all paths to this Node server, and set PREVIEW_BIND_HOST=0.0.0.0. Do not put a SPA catchall in front of it. Health is `/healthz`. An immutable build manifest fixes the origin; rebuilding is required to change it. `/api` errors remain API errors, never SPA responses. The proxy preserves bearer auth and Origin, accepts only same-origin browser requests, rejects upstream redirects and does not cache authenticated responses. Existing JWT/eligibility/write-authority guards stay in the backend.

All invite URL shapes receive generic, escaped, crawler-readable metadata in the initial HTML before Expo scripts. The same response goes to humans and bots. No room API request or private room fields are used for OG. Client attribution stays in the browser URL; metadata omits it. Invalid/expired/private/closed gating remains the normal app/API responsibility, not an OG claim.

Run `PREVIEW_PACKAGE_DIR=/tmp/predikt-preview-package node --test deploy/preview/server.test.mjs` against the actual artifact. This tests the shipped entry-point routing locally with a test upstream; it is stronger than the historical renderer/standalone fixture checks but is not hosted acceptance. See the integration preview/device acceptance checklist for release gates.


Prepared Docker build command (not executed here):

```sh
docker build -f deploy/preview/Dockerfile \
  --build-arg PREVIEW_WEB_ORIGIN=https://phase1-preview.example.test \
  -t predikt-phase1-preview:local .
```

Supply PREVIEW_WEB_ORIGIN and PREVIEW_API_ORIGIN at runtime from the reviewed environment file. Docker image build and all hosted runtime behavior must still be tested before deployment acceptance.
