# Invite, deeplink, and DNS diagnosis

Baseline: `44e1becec03f80f4f30a098188223ff9ad2c9a7a` (`44e1bec`) on branch `fix/invite-deeplink-dns`.
Sibling branches `fix/account-status` (`eb2bd27`) and `fix/journey-room-render` (`19c65da`) were not merged into this worktree.

## Baseline check

Present and intended:

- `mobile/src/utils/shareRoom.ts` builds `?joinCode=` and optional `&forwardedBy=` on `https://myprediktion.com` unless `EXPO_PUBLIC_WEB_BASE_URL` or the web origin says otherwise.
- `mobile/src/utils/inviteIntent.ts` reads those query keys.
- `mobile/src/screens/JoinRoomScreen.tsx` loads `GET /rooms/invite/:code`.
- `mobile/src/navigation/AppNavigator.tsx` calls `resolveInviteJoinCode()` once navigation is ready.
- `mobile/vercel.json` rewrites every path to `/index.html` for the hosted app.

Mismatches, not rewritten as if they were already fixed:

- `audit/phase1-fix-report.md` says `AppNavigator.tsx` gained a web `linking` config. That config is absent on `44e1bec`, `eb2bd27`, and `19c65da`. This branch does not edit `AppNavigator.tsx`.
- Mounted `LandingScreen.v2.tsx` does not read the URL. Unused `LandingScreen.tsx` does. No second parser was added there.
- Share URLs are query-only. Nothing in the client reads `/join` or `/join/:code`.
- `expo-linking` is not installed. SDK 57 documents it as a separate package. It was not added.

## Defects

| Item | Class | Evidence |
|---|---|---|
| Cold `?joinCode=` / `forwardedBy` are removed with `history.replaceState` | Reproducible | Sequential simulation returns both values and leaves `/`. Refresh search is empty. |
| Parallel URL readers | Reproducible | Each reader copies the original query and deletes only its own key. The last `replaceState` can drop the other key. |
| `/join` path | Reproducible in the client | Parser uses `window.location.search` only. Hostinger also 301s `/join?...` to `https://predikt-alpha.vercel.app/` with an empty path and query. |
| Single-encoded `joinCode` | Already correct | `URLSearchParams` yields `P15HX` for `%50%31%35%48%58`. Double encoding stays literal. |
| Invalid, expired, closed, private | Reproducible in the client | One error alert. Preview `status` / `visibility` does not choose a distinct blocked state. Private rooms still offer join; the API rejects them later. |
| Local share base | Existing behavior, kept | `EXPO_PUBLIC_WEB_BASE_URL`, then the page origin, then `http://localhost:8081` on native. Canonical host stays `https://myprediktion.com`. |
| OG tags | Reproducible | `https://predikt-alpha.vercel.app/?joinCode=TEST99&forwardedBy=abc123` is 1212 bytes, title `PREDIKT`, and has no `og:` or `twitter:` tags and no code. Client-only tags cannot fix that. |
| DNS query loss | Reproducible, not an app defect | Apex and `www` answer from `hcdn` with `Location: https://predikt-alpha.vercel.app/`. |

Production `GET /rooms/invite/:code` was not called. That handler writes an audit row after a hit.

## Files this branch may change

- `mobile/src/navigation/inviteRouting.ts` (new)
- `mobile/src/share/shareCard.ts` (new)
- `mobile/src/share/invitePreviewHtml.ts` (new)
- `mobile/src/share/serveInvitePreview.mjs` (new, local HTML only)
- `mobile/src/utils/inviteIntent.ts`
- `mobile/src/utils/shareRoom.ts`
- `mobile/src/screens/JoinRoomScreen.tsx`
- `mobile/tests/invite-deeplink.test.mjs`
- `mobile/tests/invite-deeplink.runner.ts`
- `audit/phase1/invite-deeplink-dns/`

Not edited: backend, journey and result screens, shared navigation and types, `featureFlags.ts`, lockfiles, `vercel.json`, `app.json`.

## Result

The client no longer deletes `joinCode` or `forwardedBy`. `/join` and `/join/:code` parse in the owned router. Refresh keeps the URL, and a reload after a cleared URL restores the code and forwarder for that tab. Share text and the local preview document omit place labels and tokens unless a caller sets `revealPlaces`. Join blocks expired, closed, and private previews with separate copy. Evidence and the cutover steps are in this directory.
