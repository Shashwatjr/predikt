# Prepared preview package and remaining acceptance

Status: package prepared and request handler tested locally. **Hosted acceptance NOT RUN**. No upload, push, deployment or DNS action was performed.

## Concrete package

Sources: `mobile/deploy/preview/{Dockerfile,server.mjs,package.mjs,preview.env.example,README.md,server.test.mjs}`. Runtime package: `/tmp/predikt-preview-package-final`; archive/checksum and copied manifest are recorded beside this checklist. The local build uses http://127.0.0.1:8221; an actual HTTPS preview origin requires a fresh build with that exact origin. This local-bound archive is not directly deployable under a different hostname.

The supplied Dockerfile builds from `mobile/`, exports Expo with an explicit preview origin, then emits a dependency-free Node >=24 runtime package. Docker image build itself is NOT RUN; local export, packaging, HTTP handler tests and browser checks are recorded separately. Existing production `mobile/vercel.json` remains unchanged and is not the preview configuration. A static Vercel SPA catchall alone cannot satisfy this package's OG requirement.

Routing order: `/api/*` fixed-upstream proxy → static assets (missing assets 404) → invite metadata injection into the original Expo HTML → ordinary SPA deep-route fallback. `/healthz` is web liveness. Origin-specific preview builds call their own `/api`, fail closed on a different host, and never select the production API. Ordinary builds retain existing behavior. Preview metadata uses the shared escaped renderer with a generic title, code-only URL and hidden-location disclosure. It fetches no room data and omits user identity, forwarder ID, rewards, private labels and coordinates. The actual browser URL still retains attribution for the existing join flow.

Runtime prerequisites: HTTPS termination and all-path forwarding to Node; exact PREVIEW_WEB_ORIGIN matching build manifest; explicit isolated PREVIEW_API_ORIGIN; test database reconciled separately; independent JWT/admin secrets; backend CORS_ORIGINS and WEB_BASE_URL set to exact preview origin. Preserve Authorization and Origin in the proxy, no authenticated caching, no redirects to arbitrary upstream hosts. The proxy rejects cross-site browser origins, emits CSP allowing same-origin API, no-referrer and geolocation=(self). API errors must remain JSON/status errors, not SPA HTML. Do not put credentials in Expo public variables or logs.

## Hosted checklist — every item remains NOT RUN

- Start with a new package built for the approved HTTPS preview origin; record git commit, full manifest hashes, image digest, web/backend versions and isolated test DB identity. Confirm production host/API defaults are not in use. Verify deployment health and rollback to previous image/config without DB mutation.
- Fetch initial HTML without executing JS for `/?joinCode=...`, `/join?joinCode=...`, `/join/:code`, encoded and forwarded links. Repeat normal browser, Facebook/WhatsApp crawler and Twitter agents. OG title/description/url and Twitter tags must precede SPA scripts, be escaped, and expose no planted private fields. Record response status/headers/body. Confirm proxy/CDN/rewrite ordering and cache isolation on the actual host.
- Open and refresh RoomCreated/LiveRoom/Result deep routes in cold and restored authenticated sessions. Assets return correct MIME; missing assets return 404; invalid/expired/private/closed invites retain backend gating and disclose no hidden location. Preserve joinCode/forwardedBy in the real browser join request.
- Confirm all browser API calls use preview `/api`; check real test-backend authentication, preflight/CORS exact allowlist, unauthorized and disallowed origins, no production calls, no secrets in HTML/storage URLs/logs, and no API-error-to-SPA fallback. Unit CORS and local proxy tests do not prove deployed reverse-proxy headers.
- Repeat the real local-style scored create→invite→guest→predict→start→arrival→results journey before cutoff with seeded valid IDs, creator Delivery ETA persistence, winner/errors/eligible rewards, private sharing, 320px and desktop. The completed 5369746 local journey remains valid evidence and is not being rerun merely for this checklist.
- Capture hosted screenshots, crawler HTML and network evidence; mark PASS only after observing the hosted behavior. Real messaging caches and link scanners require their own evidence.

## Device evidence boundaries

| Surface | Existing evidence | Remaining device check |
|---|---|---|
| Responsive layout | PASS: Chromium viewport 320 and 1440, no horizontal page overflow; result/share screenshots at 5369746 | Real small Android/iPhone browser text scaling, keyboard/safe areas, touch scrolling and wheel picker accessibility |
| Location | PASS: simulated browser coordinates via Playwright Geolocation, real local HTTP arrival and persisted finish | Real hardware GPS accuracy, precise/approximate permission, denied/revoked permission, permission recovery, near-start/1km boundary, stale samples, loss/recovery, and actual movement after the safety delay |
| Lifecycle | PASS: local HTTP/browser scored journey; no physical journey claimed | Device background/foreground, screen lock, network disconnect/retry, browser reload/tab restoration and battery constraints; arrival must not disclose exact live position |
| Sharing | PASS: Result button invoked browser share adapter with safe text; adapter was instrumented | Actual iOS/Android share sheet success/cancel/unavailable, clipboard fallback, WhatsApp/iMessage recipient preview and received-link opening; forwarded URL preservation across those apps |
| Native app | NOT RUN | Expo native builds, real-device deep/universal links, guest/account restoration and platform location permissions; no simulator result substitutes for hardware |

Use only the isolated test backend/accounts for later checks. Record OS/browser/app versions and whether location was real, simulated or denied for each run. Hosted, real-device GPS, native share-sheet and messaging delivery remain explicit release gates.
