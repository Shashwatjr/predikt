# myprediktion.com cutover runbook

Checked 2026-10-25. Read-only. Do not execute until local acceptance. The owner runs every change. This file does not change DNS, Hostinger, or Vercel.

An older copy under `audit/apex-cutover-runbook.md` lists different address records. This CLI session did not return those addresses. Use the records below.

## Verified project

- Vercel team: `shashwatjroberts-9304s-projects`
- Project: `predikt` (`prj_rBilGDAbApBIoC4IScgWOhBvtX3f` in local `.vercel/project.json`)
- `vercel domains inspect` shows `myprediktion.com` and `www.myprediktion.com` already on project `predikt`
- Both names are misconfigured. Registrar is third party. Current nameservers are `atlas.dns-parking.com` and `hyperion.dns-parking.com`
- Production alias already serving the Expo app: `https://predikt-alpha.vercel.app/`
- Do not attach the domains again, do not relink the Git repository, and do not deploy from this branch

## Recommended records from this CLI session

`vercel domains inspect` (CLI 56.3.2) marked option (a) as recommended:

| Host | Type | Value |
|---|---|---|
| `myprediktion.com` | A | `76.76.21.21` |
| `www.myprediktion.com` | A | `76.76.21.21` |

Option (b), optional: change nameservers to `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Stay on the current nameservers unless the owner explicitly chooses that. No AAAA value was recommended. No credential was printed or stored.

The CLI also said it would email a verification. That is Vercel's response to inspect. No record was edited.

## Owner steps

1. In Vercel, open the `predikt` domain settings and confirm both names are on this project, production, and not redirected at Vercel. Do not add them again.
2. In the current DNS provider (the Hostinger zone on the parking nameservers), delete the domain forward whose destination is `https://predikt-alpha.vercel.app/` for the apex and for `www`.
3. Remove conflicting website records, then add only the recommended rows:
   - Delete apex A `2.57.91.91`. Add apex A `76.76.21.21`. Do not also leave the old A in place.
   - Delete apex AAAA `2a02:4780:84::32`. Do not add an AAAA.
   - Delete `www` CNAME `myprediktion.com`. Add `www` A `76.76.21.21`. Do not keep both a CNAME and an A on `www`.
4. Do not edit NS, MX, SPF TXT, DMARC TXT, the three `hostingermail-*._domainkey` CNAMEs, `autodiscover`, or `autoconfig`.
5. Wait until `dig` at `atlas.dns-parking.com` shows the new A records and no old A or AAAA. Then recheck `1.1.1.1`.
6. Wait until HTTPS on both names presents a Vercel certificate, not the current Let's Encrypt certificate for the parking host.

## Rollback

Restore only the website records and the forward. Leave mail and nameservers as they are.

| Name | Type | Restore to |
|---|---|---|
| apex | A | `2.57.91.91` only |
| apex | AAAA | `2a02:4780:84::32` |
| `www` | CNAME | `myprediktion.com.` |

Turn the forward back on to `https://predikt-alpha.vercel.app/`. Rollback is done when the four URLs in `evidence.md` again return `301` to that host with the query removed, and MX, SPF, DMARC, and DKIM still match the table there.

## After cutover

NOT RUN. The owner should open each URL and confirm there is no `hcdn` redirect, the path remains `/join` where used, and `joinCode` and `forwardedBy` are still in the address bar when Join Room appears.

- `https://myprediktion.com/?joinCode=TEST99&forwardedBy=abc123`
- `https://www.myprediktion.com/?joinCode=TEST99&forwardedBy=abc123`
- `http://myprediktion.com/?joinCode=TEST99&forwardedBy=abc123`
- `https://myprediktion.com/join?joinCode=TEST99&forwardedBy=abc123`
- `https://myprediktion.com/join/TEST99?forwardedBy=abc123`

Use a code that is safe to open. Do not complete guest join against production during the check.

WhatsApp, iMessage, and a native share sheet are NOT RUN until a reachable preview host exists. The hosted Expo shell has no per-invite OG tags. Crawlers need the HTML from `mobile/src/share/invitePreviewHtml.ts` served before the SPA shell. That wiring is an integration change in hosting config, not part of this branch.
