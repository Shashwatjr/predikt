# Preview deployment plan — not executed

No image was pushed, no host was changed, and no DNS or production config was written. Hosted HTTPS, OG, deep-route, API, CORS, and physical-device checks stay NOT RUN. Passing local recovery evidence stays in `recovery-20261027.md`.

The earlier image build failed while resolving `node:24-alpine` metadata (`DeadlineExceeded`). That was an infrastructure timeout, not an application error. One retry pulled the base image and completed the Dockerfile: local tag `predikt-preview-local:phase1`, id `sha256:2ff5d5e934f3f796b5946d76752068eb8a44bf7b2214d65293d7906417b5f72e`. The build argument was `http://127.0.0.1:8221`, so this image is not the HTTPS preview artifact and was not deployed.

## Config

Build from `mobile/` only. Use `deploy/preview/preview.env.example` with the approved origin substituted for `https://phase1-preview.example.test` and `https://phase1-api.example.test`. The build origin and the runtime `PREVIEW_WEB_ORIGIN` must be identical. `PREVIEW_API_ORIGIN` is the isolated test API, never the production API. Runtime: `PORT=8080`, `PREVIEW_BIND_HOST=0.0.0.0`. Backend, separately: `CORS_ORIGINS` and `WEB_BASE_URL` equal to that same preview origin, `DATABASE_URL` on the reconciled isolated test database, and new `JWT_SECRET` and `ADMIN_JWT_SECRET`. Do not put secrets in Expo public variables. Leave `mobile/vercel.json` unchanged. Do not put a SPA catchall in front of this Node process. Terminate TLS and forward every path to it.

```sh
docker build -f deploy/preview/Dockerfile \
  --build-arg PREVIEW_WEB_ORIGIN=https://phase1-preview.example.test \
  -t predikt-phase1-preview:local .
```

Replace the example origin before any future build. A local `http://127.0.0.1:8221` package is not valid for the HTTPS host. Equivalent non-Docker steps are in `mobile/deploy/preview/README.md`.

## Test plan after a later authorized deploy

Record git commit, image digest, manifest hashes, and the isolated database name.

- `GET /healthz` returns the process liveness response.
- Initial HTML for `/?joinCode=...`, `/join?joinCode=...`, `/join/:code`, an encoded code, and a forwarded link contains escaped OG and Twitter tags before the SPA scripts and contains no private place, user, reward, or forwarder fields. Repeat with a browser and with Facebook, WhatsApp, and Twitter user agents.
- Cold and reloaded RoomCreated, LiveRoom, and Result routes render. Missing assets return 404. Invalid, expired, private, and closed invites stay gated by the API.
- Browser calls go to `/api` on the preview origin. Preflight succeeds only for that origin. A foreign Origin and the production API are rejected. API errors stay JSON, not SPA HTML. Authorization is forwarded and authenticated responses are not cached.
- One scored create, invite, guest join, prediction, start, arrival, and result journey on the isolated test database, at 320px and desktop.
- Rollback is the previous image and the previous origin env. It must not restore or rewrite the database.

Do not mark any of those hosted or device checks passed from the local package tests. Device GPS, OS share sheet, and WhatsApp or iMessage delivery remain pending in `preview-device-acceptance.md`.
