# PREDIKT UI/UX Audit

Date: 2026-07-11

## Summary

PREDIKT had strong per-screen styling but inconsistent design language. Landing felt premium while Create/Live felt operational. This sprint introduced a unified design system and shared components, then refactored primary flows.

## Screen Classification

| Screen | Before | After | Notes |
|--------|--------|-------|-------|
| Landing | Premium, isolated styles | **Consistent** | Hero promise, category carousel, sample Tea, trust copy |
| Home | Duplicated landing chrome | **Refactored** | AppHeader, Quick Start tiles, weekly card, unified BottomNav |
| Create Room | Form-heavy chips | **Refactored** | Step progress, CategoryTile, ModeCard, collapsed advanced |
| Join | Plain form | **Refactored** | Category theme card, excitement copy, lock pill |
| Live Room | Dense text header | **Refactored** | LiveStatusCard, category theme, privacy preserved |
| Result / The Tea | Fun but isolated | **Refactored** | TeaCard, CommentaryBubble, ReactionStrip hierarchy |
| Profile | Enterprise settings stack | **Refactored** | Badges, weekly title, commentary toggle; legal lower |
| Prediction | Functional | Needs refactor | Still uses legacy inputs |
| Room Created | Functional | Needs refactor | Share flow OK, styling not unified |
| Login/Register | Adequate | Needs refactor | Auth screens not restyled |
| Leaderboard | Functional | Needs refactor | Aura-focused, not story-first |
| Notifications | Functional | Needs refactor | List styling legacy |
| Help/Legal | Admin-like | Acceptable | Intentionally plain |

## Findings

### Consistent (post-sprint)
- Deep navy background (`#030816`) + elevated card surfaces
- Category color families via `categoryTheme.ts`
- Shared buttons (PrimaryButton), pills (StatusPill), chips (BadgeChip, AuraChip)
- Max content width on web (720–980px)
- Bottom nav: Home · Create · Activity · Profile

### Duplicate styling removed
- Home/Landing no longer duplicate full hero crystal art
- Category chips consolidated into `CategoryTile`
- Mode selectors consolidated into `ModeCard`
- Result metrics consolidated into `TeaCard`

### Broken hierarchy (fixed)
- Result: Tea headline → winner metrics → commentary → reactions → share
- Home: greeting + next action before filters
- Create: step indicator before form fields

### Too much text (improved)
- Live room status collapsed into `LiveStatusCard`
- Home hero replaced with compact `AppHeader`

### Confusing CTA (improved)
- Primary CTA standardized: **Start a PREDIKT**
- Secondary: **Join with Code**

### Poor empty state (fixed)
- Home empty hub uses `EmptyState` component

### Privacy wording
- No regression: live rooms still show approximate progress messaging
- Trust line on landing: no betting, no live location sharing

### Enterprise-looking (reduced)
- Profile commentary/badges moved above legal wall
- Dashboard filters retained but visually secondary

### Fun/social enough (improved)
- Sample Tea + Moment Card on landing
- Weekly personality card on Home/Profile
- Category-themed join preview

## Remaining Inconsistencies

1. PredictionScreen, RoomCreatedScreen, Login/Register not yet on design system
2. Leaderboard still Aura-table style, not story cards
3. Landing bottom nav still uses old 5-tab public preview (Home/Explore/Create/Results/Profile)
4. MomentCard component not fully aligned with new `palette` tokens
5. Advanced create options still verbose inside cards
6. No skeleton loading states yet
7. Reduced-motion preference not wired globally

## Recommended Next Sprint

1. Restyle Prediction + RoomCreated + Auth screens
2. Align MomentCard with design system tokens
3. Add skeleton loaders for Home/Result commentary fetch
4. Unify public landing bottom nav with authenticated BottomNav pattern
5. Weekly story share CTA on Home (when backend endpoint exists)
