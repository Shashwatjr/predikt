# Journey — Full Functional Review

Branch: `feat/journey-home-redesign` · Reviewed from `de7322c`
Date: 2026-08-06

## Summary

| | |
|---|---|
| Overall result | 9 issues found, 8 fixed, 1 deferred with root cause |
| Screens/states tested | 27 (desktop 1440×1200 and mobile 390×844) |
| Release blockers found | 2 (one fixed in-app, one infrastructure) |
| Blocked tests | Preview URL unreachable (Vercel SSO) — reproduced locally instead |
| Merge recommendation | **Ready for final device QA**, gated on the DNS fix below |

The branch diff (`master...HEAD`) contains only Journey UX work — 119 files, all under
`mobile/`. No schema changes, no new categories, currencies, map SDKs, or push
notifications were added by this review.

### Two things to action before release

1. **`myprediktion.com` destroys every invite link.** Infrastructure, not code — see J-02.
2. **A room can end with two rank-1 winners.** Backend scoring — see J-09, deferred.

## Environment

The supplied preview `predikt-e4in4hqhf-…vercel.app` returns `302 → vercel.com/sso-api`
and cannot be reached unauthenticated, so the full lifecycle was exercised against a
local stack (Expo web on `:8081`, Nest API on `:3000`, Postgres in Docker) driven by
headless Chromium at both viewports, with a signed-in creator and a separate clean
browser context as the guest. Test data used public landmarks (Bengaluru → Mysuru) and
throwaway `@example.test` accounts. No credentials, tokens, invite codes, or
coordinates appear in this report or the screenshots.

## Screen matrix

| Screen / state | Desktop | Mobile | Result | Notes |
|---|---|---|---|---|
| Landing (signed out) | ✔ | ✔ | passed | Watermark bleeds through body copy on mobile (J-08) |
| Landing example card | ✔ | ✔ | **failed → fixed** | Tapped through to a fabricated invite code (J-05) |
| Landing side rail | ✔ | n/a | **failed → fixed** | Dead "Streams"/"Messages", empty panels (J-06) |
| Sign in / Register | ✔ | ✔ | passed | Errors were silent on web (J-04) |
| Home (first load of the day) | ✔ | ✔ | **failed → fixed** | Every control unclickable (J-01) |
| Home (subsequent loads) | ✔ | ✔ | passed | Correct empty state, ≤3 cards, newest first |
| Home journey cards | ✔ | ✔ | passed | Status, CTA, winner and completion time all correct |
| My Journeys | ✔ | ✔ | passed | Grouping and ordering correct; no stale/duplicate rooms |
| Start journey → route search | ✔ | ✔ | passed | Google Places live; 1-of-3 stepper clear |
| Travel mode | ✔ | ✔ | passed | |
| Route summary / preview | ✔ | ✔ | passed | |
| Creator prediction | ✔ | ✔ | passed | Maps/bot benchmarks and offset shortcuts work |
| Create → duplicate submit | ✔ | ✔ | **failed → fixed** | Second tap could file a duplicate (J-03) |
| Room created / share | ✔ | ✔ | passed | Invite code, copy, WhatsApp, preview all present |
| Join by invite link | ✔ | ✔ | passed | `?joinCode=` opens the join flow directly |
| Join by invite code | ✔ | ✔ | passed | Normalised (trim + upper-case) at every entry point |
| Invalid invite | ✔ | ✔ | **failed → fixed** | Silent failure on web (J-04) |
| Guest name entry | ✔ | ✔ | passed | No login required |
| Guest prediction / lock | ✔ | ✔ | passed | Locks, appears in the room as "Locked in" |
| Guest session across refresh | ✔ | ✔ | passed | Session and prediction both survive |
| Pre-start countdown | ✔ | ✔ | passed | Rendered `02:35`, never blank |
| Live creator controls | ✔ | ✔ | passed | Start / Finish / Cancel present only while active |
| Viewer live view | ✔ | ✔ | passed | Delayed progress, no raw GPS |
| Finish confirmation | ✔ | ✔ | passed | Duplicate finish rejected `400 Room is already completed` |
| Result / The Tea | ✔ | ✔ | **failed → fixed** | Placeholder values and RIZZ clutter (J-07a/b) |
| Completed room reopened | ✔ | ✔ | passed | No active controls after refresh + reopen |
| Result scoreboard ranks | ✔ | ✔ | **failed — deferred** | Two rank-1 winners possible (J-09) |
| Back navigation / Run It Back | ✔ | ✔ | passed | |
| Refresh mid-room | ✔ | ✔ | partial | Returns Home, not the room — no web routing (J-08) |

## Issues

| ID | Sev | Screen | Root cause | Fix | Verification |
|---|---|---|---|---|---|
| J-01 | **Blocker** | Home | `TodaysTeaOverlay` rendered inside a React Native `Modal`, which creates a full-viewport pointer-capturing layer on RN-Web and native, so its inner `pointerEvents="box-none"` never applied. Compounding it, the auto-hide `setTimeout` lived in the show-effect whose cleanup flipped an `active` flag the timer closed over; any dashboard refetch re-ran the effect, so the timer fired into a dead closure and the banner never hid. Keyed per user **per day**, so it recurred on the first Home load daily. | Render as an absolutely-positioned `box-none` overlay instead of a `Modal`; drop the dimming scrim; move auto-hide into an effect keyed on `[teaVisible, todaysTea]`. | Hit-tested and click-tested at both viewports: before, the element at the CTA centre was the Tea wrapper and the click did nothing; after, the CTA is the hit target and navigates while the banner is still visible. |
| J-02 | **Blocker** | Invite links | `myprediktion.com` is served by a registrar-level 301 forward to `predikt-alpha.vercel.app` that discards path **and** query. `buildInviteUrl` correctly emits `https://myprediktion.com?joinCode=XXXXX`, but every shared link arrives with no code, dropping the guest on a bare landing page. This matches the reported "guest could not lock a prediction". | **Not fixable in code** — the app builds the URL correctly. The domain must be attached to the Vercel project as a real domain (A/CNAME) rather than a forwarding rule. | `curl -I 'https://myprediktion.com/?joinCode=TEST99'` → `301 location: https://predikt-alpha.vercel.app/` (no query). Verified the app end of the contract instead: `?joinCode=` on a working origin opens the join flow at both viewports. |
| J-03 | High | Creator/guest prediction | `handleSubmit` reset `loading` in a `finally` that ran **before** the confirm animation and the `journey/start` round-trip that precede navigation, re-enabling the button mid-flight. | Re-entry guard on a ref (state is too stale to gate this), no `finally` on the success path, guard released on screen `focus` so returning to the screen does not strand the button. | Regression test asserts the guard, the absence of the `finally`, and the focus release. |
| J-04 | High | Join, Live, Create, Share, Sign-in | 60+ raw `Alert.alert` calls. `react-native-web` does not implement it — it is a silent no-op, so an invalid invite, a failed lock and every validation message produced no feedback in a browser. | Migrated the seven Journey-path screens to the existing `appAlert` helper and removed the now-unused imports. | Invalid invite now raises "Room unavailable — Room not found" on desktop and mobile; previously `NONE (silent failure)` with only a `404` in the network log. |
| J-05 | Medium | Landing | A hardcoded `socialProofExample` was titled "Recent Journeys", badged **LIVE**, and wired to `handleJoinLobby('ARR4K2')` — a code that has never existed. | Made the card non-interactive, retitled to "What a journey looks like", re-badged `EXAMPLE`. | Regression test; no navigation target remains. |
| J-06 | Medium | Landing rail | `NAV_ITEMS` offered "Streams" and "Messages" whose handler fell through to a `// Simplified nav actions for v2` no-op; the right rail rendered two titled panels over empty arrays. | Removed the two dead destinations; panels render only when they have rows. | Regression test. |
| J-07a | High | Result / The Tea | `actualDate` and `formatActualOutcome` read the finish time **only** from the navigation param, which exists solely when arriving straight from confirming arrival. Reopening a settled room from Home, My Journeys or an invite link lost it, so `ACTUAL FINISH`, the `ACTUAL` column and every `DIFFERENCE` cell degraded to the `Result recorded` placeholder — the exact fallback the brief calls out. | Fall back to `room.actualEndTime`, which the screen already fetches and which survives a reopen. | Before: `ACTUAL FINISH — Result recorded`. After: `ACTUAL FINISH — 10:24 AM`, and the scoreboard shows real margins (`147 min late`, `161 min late`). |
| J-07b | Low | Result / The Tea | A `RIZZ` stat tile whose own note read "Prediction outcomes do not mint RIZZ" — a tile that existed to say it does nothing. | Removed the tile and its now-dead `myRizzStatus`. | Regression test asserts the tile and note are gone and the Aura tile stays. |
| J-09 | High | Result scoreboard | **Deferred.** `assignOverallRanks` in `backend/src/lifecycle/lifecycle.service.ts` (~line 991) orders by `totalRoomAura` and assigns a shared rank on equal Aura. Two players with different accuracy but equal Aura both become rank 1 with a 🥇 — ranks read `1, 1, 3, 4` — contradicting the locked "deterministic winner" rule. | Add a deterministic accuracy tiebreak (`differenceFromActualSeconds` ascending) to the ordering and to the shared-rank condition. **Not applied**: that file carries a large uncommitted reward-system refactor from another workstream, and committing it would sweep those unrelated changes in. | Reproduced in the browser: two participants at 147 min and 161 min off both shown as rank 1 with 5 Aura and the label "Closest". |

### Not fixed by design

| ID | Screen | Observation |
|---|---|---|
| J-08 | All | The web build registers no react-navigation `linking` config, so the URL never changes. Browser Back leaves the app and refresh always returns Home rather than the current room. Rooms remain reachable via My Journeys and invite code, so no flow is blocked. Adding deep linking is a larger change than this review's scope. Also on mobile landing, the `PREDIKT` watermark sits behind the body copy and hurts legibility. |
| — | Home | `GET /dashboard/drops-near-unlock` returns 404 on every Home load. Caused by the uncommitted deletion of the drops module in the reward workstream, not by this branch. The mobile caller needs removing when that work lands. |
| — | Room payload | `GET /rooms/:id` ships a ~300-point route polyline inside `creationMeta.baselineSnapshot`. Harmless for privacy (it is the declared public route, already drawn on the map preview) but heavy. This is why the live-room poll deliberately does **not** re-fetch the room record. |

## End-to-end results

**Creator flow** — `Register → Home → Create a Room → Route (Google Places) → Mode →
Creator prediction → Create Journey → Share → Countdown → Start → Finish → The Tea →
Home`. Completes once, produces one room and one invite code. The creator's prediction
persists and appears as "Host guess". The pre-start countdown rendered `02:35` and never
blanked. `POST /rooms/:id/end` returns `201`; an immediate repeat returns
`400 Room is already completed`, so duplicate finalisation is prevented server-side.

**Guest flow** — Opening `?joinCode=…` in a clean browser goes straight to the join
screen with no login. Name entry, prediction and lock all succeed; the guest appears in
the room as "Locked in" alongside the host. After a full page refresh the guest session
survives and their journey card reads "Prediction locked / Open Journey". Invalid codes
now produce a visible error (previously silent — J-04).

**Closed-room flow** — After finishing, the Home card switches to "Result ready /
Journey complete / Winner / Completed 10:17 AM / 1 participant / View Result". Reopening
the room after a refresh shows **no** active controls (`Start Journey`, `I've arrived`,
`Lock now & reveal`, `Cancel journey` all absent).

**Privacy** — `GET /rooms/:id/live-state`, the endpoint that drives the viewer's live
view, contains **no** position-shaped fields at all. The only coordinates served to a
viewer are the planned route polyline, which is the public declared route the map
preview already renders. No traveller GPS reaches viewers.

**Polling and lifecycle** — Now hardened: a terminal `status`/`journeyStatus` latches on
a ref and clears the 5s interval; every polled fetcher stamps its request and discards a
reply once a newer one has been applied, so a slow "still live" response can no longer
overwrite terminal state.

## Verification

| Check | Result |
|---|---|
| `mobile: npm run typecheck` | pass |
| `mobile: npm test` | **53/53 pass** (37 pre-existing + 16 new) |
| `backend: nest build` | pass |
| `backend: npx jest` | 135/136 — same single failure as baseline |
| `git diff --check` | clean |

The one backend failure is `security.integration.spec.ts › ledgers signup, first room…`.
It is **pre-existing and unrelated to this branch**: the uncommitted reward refactor in
the working tree removed the signup credit grant from `auth.service.ts`
(`creditBalance: 30` and the `creditLedger` write), which is exactly what the assertion
`expect(creatorSignupCredits).toBe(1)` checks. It fails identically before and after the
changes in this review, none of which touch backend code.

## Evidence

`docs/audit-assets/journey-functional-review/`

| File | Shows |
|---|---|
| `01-home-blocked-by-tea-desktop.png` | Home with every control behind the Tea overlay |
| `02-home-blocked-by-tea-mobile.png` | The same block at 390×844 |
| `03-home-usable-after-fix-desktop.png` | Create Room reached while the banner is still visible |
| `04-home-usable-after-fix-mobile.png` | The same, mobile |
| `05-guest-invite-landing.png` | Guest arriving via `?joinCode=` |
| `06-guest-locked-in.png` | Guest locked in, privacy-safe room view |
| `07-the-tea-real-values.png` | The Tea with a real finish time and margins |
| `08-completed-room-terminal.png` | Completed room reopened, no active controls |

## Recommendation

**Ready for final device QA.**

The one change that must land outside this branch is J-02: until `myprediktion.com`
resolves to the Vercel deployment directly instead of forwarding, every invite shared
from the app arrives without its code and the guest flow is dead on the canonical
domain. J-09 should be scheduled with the reward-system work that already owns
`lifecycle.service.ts`.
