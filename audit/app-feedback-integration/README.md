# App feedback integration — 29 October 2026

Release status: BLOCKED. Prepared and verified locally; no merge, production PR, or deployment requested or performed.

## Provenance

Branch: `fix/app-feedback-integration`.
Exact parent baseline: `9dd1e04bf22c87280ca96f4edbd44f6c38b958ee` (`origin/release/deployed-9dd1e04`).

Cherry-picks, in order, both clean and recorded with `-x`:

1. `5b0c3fa9a0a3d8914963e2552a2e995472e038d6` → `ed411a1d66b123c9f43e98f423e522e35af1aeeb`.
2. PR #4 `235d6e7993e8a016c96e1b6e6766c888a7c22047` → `f565d0ef0578d0c6b94611804a49589547fdaa77`.

No conflict resolution or application-code edits were necessary. No PR #3 changes were selected. The subsequent audit commit contains verification evidence only.

## Missing privacy/OG patch

`git cat-file -t c9823d2` fails: object absent. A full local object scan (`git fsck --full --no-reflogs --unreachable`) also contains no matching commit. All worktrees share this object store. The patch was not recreated or substituted. Its privacy tests could not be run because the commit and its tests are missing. Obtain the original commit/patch before release.

Two browser probes fail the requested coordinate privacy gate: coordinate-like route labels are rendered in LiveRoom (including accessibility labels) and neutral cancelled summaries. Numeric latitude/longitude object properties are excluded, and tested invite share payloads omit both numeric coordinates and coordinate-like route labels. Those narrower successes do not satisfy the overall privacy gate. See `privacy-findings.json` and `live-browser.log`. OG/privacy tests already present in the baseline pass, but do not establish acceptance of the missing patch or of hosted Vercel OG behavior.

## Combined verification

- Mobile `npm run typecheck`: PASS.
- Mobile `npm test`: 91 passed, 0 failed, 0 skipped (includes 19 result/sharing tests).
- `npx expo export --platform web --clear`: PASS.
- Existing mobile preview artifact test: 1 passed, 0 failed. Built a separate localhost preview export and packaged it with the existing packager before running `PREVIEW_PACKAGE_DIR=... node --test deploy/preview/server.test.mjs`. An initial invocation without the required package variable was a setup error; the final artifact-backed run passes.
- Chromium, 390px and 1440px: 16 terminal creator cases offer no Start and retain View Result. Cases cover cancelled, completed, result_ready and terminal journey states auto_closed, abandoned, plan_changed, cancelled_by_host and arrived_verified. Creator and guest delay views remain distinct at both widths; guests retain their waiting room and have no Start control.
- Chromium: all five neutral closures contain route labels, known participants and submitted predictions; winner, rewards, podium and pending result UI are absent. Completed journeys retain the deployed scored scoreboard.
- Chromium: primary Web Share, Copy Code, Copy Invite Link, WhatsApp, Telegram, SMS, Email, X/Twitter, Facebook, Instagram copy-before-open, WeChat copy-only, Native Share and manual WhatsApp actions pass. Blocked popup and failed share-sheet fallbacks pass. Browser launches are intercepted; this verifies payloads and requested actions, not native app delivery or posting.
- No browser page errors. Two privacy gate probes fail as described above. Browser runner exit code zero indicates the checks finished; it does not mean those recorded privacy findings passed.
- `git diff --check`: PASS.

## PR #4 status

PR #4 remains open and unmerged at `235d6e7993e8a016c96e1b6e6766c888a7c22047`. GitHub's commit status reports **Vercel: success**, finished before completion of this audit:
https://vercel.com/shashwatjroberts-9304s-projects/predikt/GkpVMymG3MuLjmhrLtrTf3QDT6ea

## Browser reproduction

Serve the ordinary exported artifact on `http://localhost:18789`. Install Playwright separately and set `PLAYWRIGHT_MODULE` to its module directory if it is not resolvable. The runners use local Google Chrome at its standard macOS application path, mock API requests to localhost:3000, and write screenshots/findings under `/tmp/app-feedback-integration`. Create that directory first. Run each committed `.cjs` script with Node. No live API or deployment is used. Screenshot artifacts remain local; textual evidence is committed here.
