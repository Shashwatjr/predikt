# Local invite privacy and link previews

Base: deployed `9dd1e04bf22c87280ca96f4edbd44f6c38b958ee`.
Branch: `fix/local-invite-privacy`. Local changes only; no push/deployment/DNS/DB writes.

## Reproduction and changes

- New service regressions failed on both unauthenticated invite endpoints: raw
  baselineSnapshot and creationMeta carried geometry; route and milestone labels
  exposed exact places; private previews returned data; ghost previews named host.
- Public responses now use a dedicated allowlist. Private endpoints return 403;
  ghost host identity is omitted; exact place labels, geometry/provider bags and
  milestone locations are not returned. Authenticated room projection is unchanged.
  Room titles and prediction questions remain creator-authored public content.
- Join screen recognizes a body-free 403 as private.
- Vercel previously used an all-path SPA fallback. Generic static OG metadata is
  now injected during `npm run export:web`, before Expo scripts. The existing brand
  wordmark is copied as a real `og.png`. The SPA rewrite excludes image/asset paths.
  No room API call or query attribution is included in metadata.
- Existing standalone/packaged preview also references and serves the real image.

## Executed verification

- BEFORE fix: `npm test -- --runInBand invite-privacy.spec.ts`: 5 failing regressions.
- AFTER fix: backend `npm test -- --runInBand invite-privacy.spec.ts rooms.service.spec.ts`:
  21 passing tests. Uses mocked Prisma, no database connection.
- Backend `npm run build`: PASS.
- Mobile `npm test`: 74 passing tests.
- Mobile `npm run typecheck`: PASS.
- Mobile `npm run export:web`: PASS.
- Local HTTP smoke of actual exported files using configured SPA rewrite regex:
  `/`, `/join`, `/join/AB123`, `/room/test`: initial OG tags before app scripts,
  app root retained, no reflected attribution. `/og.png`: image/png and PNG magic.
- `git diff --check`: PASS.

## Run/review on the owner's computer

Apply the supplied git patch onto a clean worktree based on the deployed release.
Install locked dependencies; backend Prisma generation does not need a live DB.
Run the verification commands above. For local metadata image URLs, export with
`EXPO_PUBLIC_WEB_BASE_URL=http://127.0.0.1:8231 npm run export:web`.
Use explicit local/test API configuration for app interactions; ordinary hosted
builds preserve the existing production API default. Never use production DB
credentials for local testing.

## Remaining boundaries

- Hostinger forwarding/DNS is unchanged. Local code cannot repair the branded
  redirect that discards path/query; the existing domain cutover remains required.
- Generic static previews reveal no room-specific title/result. This is deliberate;
  richer per-room crawler metadata requires reviewed server-side authorization.
- Vercel deployment/config acceptance, real phones, WhatsApp/iMessage and live
  post-fix API verification: NOT RUN.
- Full authenticated browser/scored journey regression: NOT RUN in this workspace.
- This workspace is separate from `/Users/krivikshaaitech/predikt-phase1-integration`.
