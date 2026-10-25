# Mobile Journey Results — Diagnosis & Fix Notes

**Branch:** fix/mobile-journey-results  
**Base SHA:** 00df37a (master)  
**Date:** 2026-10-25

## Baseline verification

Worktree created from master (00df37a). Journey rendering implementation confirmed present in:
- mobile/src/screens/ResultScreen.tsx
- mobile/src/screens/LiveRoomScreen.tsx
- mobile/src/components/ArrivalWaitingRoom.tsx
- mobile/src/components/ArrivalJourneyViz.tsx
- mobile/src/components/CheckpointLeaderboard.tsx
- mobile/src/components/ProgressBar.tsx

## Defects found and classified

### 1. REPRODUCIBLE — Fake @closest-guess winner handle (ResultScreen.tsx:582)

`formatWinnerHandle` returned `@closest-guess` when a ranking row had no
`prediktHandle` and no `name` — the literal string "closest-guess" was the
hardcoded fallback. This fake handle surfaced in TeaCard `metrics[0]` and
`shareMomentCard()` unconditionally, including for unscored journeys where
`rankings[0]` exists but has no user identity resolved yet.

**Fix:** Return `null` when no handle or name is available. Suppress entirely
for neutral/cancelled closures (`isNeutralClosure`). All call sites coalesced
to `'Pending'` or `''` at the prop boundary.

### 2. REPRODUCIBLE — Narrow-screen podium overflow (ResultScreen.tsx:702)

`podiumCol: { width: 96 }` × 3 columns + 2×8px gaps = 304px inside a
container with 20px horizontal padding on each side. Available width on iPhone
SE (320px) = 280px — the third column was clipped.

**Fix:** `podiumCol: { flex: 1, minWidth: 0, maxWidth: 96 }` — columns share
available space proportionally; maxWidth caps the gold column on wide screens.
Gap reduced from 8 to 6px.

### 3. REPRODUCIBLE — predCard minWidth overflow (ArrivalWaitingRoom.tsx:343)

`predCard: { minWidth: 140 }` in a 2-column flexWrap grid. Two 140px cards +
8px gap = 288px. Container padding at spacing.xl (~24px each side) leaves
272px usable — cards couldn't fit and overflowed.

**Fix:** `minWidth: 0` — flex basis of 46% handles sizing; no hard floor needed.

### 4. REPRODUCIBLE — Invalid Date display in CheckpointLeaderboard (lines 42, 85)

`new Date(null)` and `new Date(undefined)` produce Invalid Date; passed to
`formatClock` → displayed as `NaN:NaN` for projected arrival and each player's
guess when API fields are absent.

**Fix:** Added `safeClock(dateStr)` helper that returns `'—'` for null,
undefined, empty string, or unparseable values.

## Fields not available client-side (Lane A coordination needed)

- Authoritative `winner` identity when `initialResult.winner` is absent and
  leaderboard returns rows without resolved user handles — displayed as
  "Pending" rather than fabricated. Lane A should populate `winner.prediktHandle`
  in the leaderboard/result response.

## Evidence paths

- Tests: mobile/tests/journey-room-render.test.mjs (15 pass, 0 fail)
- Typecheck: pre-existing baseline errors only (TS7006, TS18046, TS2741 on
  unrelated lines); no new errors introduced.

## Visual verification

Not performed — no Expo dev server in this isolated worktree. Integration owner
should visually verify on iPhone SE simulator after combining branches.
