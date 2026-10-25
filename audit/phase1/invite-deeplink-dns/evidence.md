# Sanitized evidence

Date: 2026-10-25. Branch `fix/invite-deeplink-dns`. Baseline `44e1becec03f80f4f30a098188223ff9ad2c9a7a`.
No production invite lookup, database write, DNS edit, deploy, or message send.

## Commands

- `git worktree add ../predikt-invite-deeplink-dns -b fix/invite-deeplink-dns 44e1becec03f80f4f30a098188223ff9ad2c9a7a`
- Installed Expo is 57.0.4 from the existing `mobile/node_modules` (lockfile matches this baseline). No package was added.
- `node --test tests/invite-deeplink.test.mjs` in `mobile/` — pass.
- `npm test` in `mobile/` — pass (54 tests, including the existing invite source checks).
- `npx tsc --noEmit` in `mobile/` — fail only in untouched `LiveRoomScreen.tsx` (`setStarting` / `starting`). Owned files are not in that output.
- Local web: `npx expo start --web --port 8091 --host lan` (CI mode).
- Local HTML: `INVITE_PREVIEW_PORT=8096 node --experimental-strip-types src/share/serveInvitePreview.mjs`
- Read-only `dig` and `curl -I` for `myprediktion.com`, `www`, and `predikt-alpha.vercel.app`.
- `vercel domains inspect` for the apex and `www` (CLI 56.3.2, team `shashwatjroberts-9304s-projects`).
- `openssl s_client` issuer and subject only.

## Local app

| Check | Result |
|---|---|
| `http://127.0.0.1:8091/` and `/join?...` | HTTP 200, same 1258-byte Expo shell, title `PREDIKT`. Not a redirect. Shell has no `og:` tags and no `joinCode`. |
| Cold `/?joinCode=ZZZZZ&forwardedBy=user-1` | Join Room, code field `ZZZZZ`. Address bar still has both parameters after load. |
| `/join?joinCode=ab12&forwardedBy=abc` | Join Room, code field `AB12`. Query kept. |
| `/join/p15hx?forwardedBy=user-1` | Join Room, code field `P15HX`. Path and `forwardedBy` kept. |
| Reload of that `/join/p15hx` URL | Still Join Room, `P15HX`, same URL. |
| Reload after the app URL was cleared to `/` | Navigation type `reload`. Join Room restored `P15HX`. Session value kept the code and `forwardedBy` only. |
| `?joinCode=%50%31%35%48%58` | Code field `P15HX`. |
| `http://192.168.1.119:8091/` | HTTP 200 from this machine. |
| Invalid / expired / closed / private on a real room | NOT RUN in the browser. Port 3000 on this machine is a different site, and the web client sends localhost traffic there. Unit tests cover the four states. Production invite GET was not used. |

`http://localhost` is the viewing device, not the laptop, when opened from a phone. A second device was not used. Cross-device share: NOT RUN.

## Preview HTML

`http://127.0.0.1:8096/?joinCode=P15HX&forwardedBy=user-1` returns crawler-readable tags: `og:title`, `og:description`, `og:url`, `twitter:card`. Body says exact location is hidden. A planted destination query was not copied. No script and no token.

Hosted `https://predikt-alpha.vercel.app/?joinCode=TEST99&forwardedBy=abc123` is HTTP 200 with the query kept, 1212 bytes, title `PREDIKT`, and no `og:` tags. WhatsApp, iMessage, and native share sheets: NOT RUN.

## Public DNS and HTTP

Authoritative NS: `atlas.dns-parking.com`, `hyperion.dns-parking.com`. SOA serial `2026102201`.

| Name | Type | Value |
|---|---|---|
| apex | A | `2.57.91.91` |
| apex | AAAA | `2a02:4780:84::32` |
| `www` | CNAME | `myprediktion.com.` |
| apex | MX | `5 mx1.hostinger.com.` and `10 mx2.hostinger.com.` |
| apex | TXT | `v=spf1 include:_spf.mail.hostinger.com ~all` |
| `_dmarc` | TXT | `v=DMARC1; p=none` |
| `hostingermail-a/b/c._domainkey` | CNAME | `hostingermail-*.dkim.mail.hostinger.com.` |
| `autodiscover`, `autoconfig` | CNAME | Hostinger mail hosts |

These requests all end at `https://predikt-alpha.vercel.app/` with path and query removed. Hop 1 is `301` from `server: hcdn`. Hop 2 is Vercel `200`, ETag `5f3851ac252ba9a0048c6e2a8223e95b`.

- `https://myprediktion.com/?joinCode=TEST99&forwardedBy=abc123`
- `https://www.myprediktion.com/?joinCode=TEST99&forwardedBy=abc123`
- `http://myprediktion.com/?joinCode=TEST99&forwardedBy=abc123`
- `https://myprediktion.com/join?joinCode=TEST99&forwardedBy=abc123`

The same query on `https://predikt-alpha.vercel.app/` stays on that host (no redirect).

Apex certificate: Let's Encrypt, subject `CN=myprediktion.com`, SAN `myprediktion.com` and `www.myprediktion.com`, not after `Jan 8 2027`. `predikt-alpha.vercel.app` certificate is Google Trust Services for `*.vercel.app`.
