# Local visual review (2026-10-27)

## Evidence

Screenshots are in `screenshots/` at 320x800 and 1440x900 for landing, create, guest-join, live-journey, and results. They were captured from the checked-in Expo web export with Chrome headless and a local static server.

## Findings

- The export renders the branded startup splash at both viewports without horizontal overflow.
- The static server returned 404 for deep paths (`/join`, `/create`, `/live`, `/results`) because it did not provide SPA fallback. This is a harness limitation; it is not a confirmed application defect. A fallback server was also tested.
- Without a running API and authenticated session, create/live/results cannot reach their data states. Loading, API error, pending, final-result, duration, and location-hidden share states are therefore NOT RUN in this capture.
- No mobile source change was made from this review; no affected test rerun was needed.

## Commands

`npx expo export --platform web` (existing passing evidence); `python3 -m http.server 38111 --directory mobile/dist`; Chrome headless screenshots at `--window-size=320,800` and `--window-size=1440,900`.

## Finalization review

Both HTTP end paths call `finalizeRoom`; its `pg_advisory_xact_lock(hashtextextended(roomId, 0))` and unique `result_finalization:<roomId>` claim serialize the ranking/clout writes. The prior two-connection race test produced one participation clout set and one claim; retry remained idempotent. Transaction-bound writes use `tx`.

Milestone scoring (`reachMilestone`, `scoreMilestone`, and multiple-choice scoring), room status/arrival updates, creator result credit (`result_declared:<roomId>:<creatorUserId>`), notifications, badges, rematch Rizz, and some winner rewards execute outside the finalization transaction. The advisory lock releases on transaction failure, but these outside-transaction effects can be visible after a later failure and require idempotency/retry review before release. Reward keys remain recipient-scoped where applicable (`gem_first_win:<userId>`, `aura_mc:<milestoneId>:<userId>`); the room claim is intentionally room-scoped.
