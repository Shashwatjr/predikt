# Reward System — Phase 1: Model + Rules + API Contract

Status: **DESIGN — awaiting approval before implementation.**
Decisions locked (Step 1 audit): (1) Fresh RIZZ + Gems in a new unified spine; legacy **Clout + Credit + Drops shop untouched**. (2) Keep **RIZZ** as the new social currency; rename the existing **"Rizz-tier"** prediction concept → **"Late-tier"**.

Three currencies, cleanly separated:
- **Aura** — prediction skill. Existing. Not spendable. Wrapped by RewardService going forward.
- **RIZZ** — social influence. New. Not spendable. Never from prediction outcomes.
- **Gems** — spendable. New. Never grants prediction advantage. No shop / real-money / gifting in Phase 1.

---

## 1. Data Model

### 1.1 New enum
```prisma
enum RewardType {
  AURA
  RIZZ
  GEMS
}
```

### 1.2 RewardAccount — one row per user, canonical balances for RIZZ/Gems
```prisma
model RewardAccount {
  rewardAccountId String   @id @default(uuid()) @map("reward_account_id")
  userId          String   @unique @map("user_id")

  auraBalance     Int      @default(0) @map("aura_balance")   // MIRROR of User.totalAura (kept in-tx)
  rizzBalance     Int      @default(0) @map("rizz_balance")   // canonical
  gemBalance      Int      @default(0) @map("gem_balance")    // canonical

  lifetimeAura    Int      @default(0) @map("lifetime_aura")
  lifetimeRizz    Int      @default(0) @map("lifetime_rizz")
  lifetimeGems    Int      @default(0) @map("lifetime_gems")

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt      @map("updated_at")

  user User @relation(fields: [userId], references: [userId])
  @@map("reward_accounts")
}
```
**Aura source-of-truth note:** `User.totalAura` / `weeklyAura` stay canonical (existing leaderboards read them). `RewardAccount.auraBalance` is kept in lockstep *inside the same transaction* whenever Aura is granted through RewardService. RIZZ and Gems live **only** in RewardAccount. This satisfies "extend existing, don't create a second Aura truth."

### 1.3 RewardLedgerEntry — generalized from the proven `CreditLedger` shape
```prisma
model RewardLedgerEntry {
  rewardLedgerEntryId String     @id @default(uuid()) @map("reward_ledger_entry_id")
  userId              String     @map("user_id")
  rewardType          RewardType @map("reward_type")
  amount              Int                                // signed: + grant, - spend/reversal
  balanceAfter        Int        @map("balance_after")   // of that rewardType, post-apply
  reasonCode          String     @map("reason_code")     // FK-ish to RewardRule.reasonCode
  sourceType          String?    @map("source_type")     // 'room'|'milestone'|'membership'|'reaction'|'share'|'referral'|'badge'|'prediction'|'admin'
  sourceId            String?    @map("source_id")
  idempotencyKey      String     @unique @map("idempotency_key")
  metadata            Json?                              // NO PII / NO GPS
  createdAt           DateTime   @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [userId])

  @@index([userId, rewardType, createdAt])
  @@index([reasonCode, createdAt])
  @@map("reward_ledger_entries")
}
```

### 1.4 RewardRule — config, not hardcoded
```prisma
model RewardRule {
  reasonCode  String     @id @map("reason_code")
  rewardType  RewardType @map("reward_type")
  baseAmount  Int        @default(0) @map("base_amount")  // 0/ignored for dynamic (Aura scoring)
  enabled     Boolean    @default(true)
  dailyCap    Int?       @map("daily_cap")     // max cumulative amount per user per UTC day (null = uncapped)
  perSourceCap Int?      @map("per_source_cap") // max cumulative amount per (user, sourceType, sourceId) (null = uncapped)
  configJson  Json?      @map("config_json")   // rejectSelf, requiresOtherUser, badgeKeys[], cooldownSec, publicVisible, dynamic, etc.
  label       String                            // public human label
  description String                            // public description
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt      @map("updated_at")
  @@map("reward_rules")
}
```
Rules seeded via a versioned seed script (idempotent upsert), NOT hardcoded in service logic.

### 1.5 User relation additions
Add `rewardAccount RewardAccount?` and `rewardLedgerEntries RewardLedgerEntry[]` to `User`. No column changes to `User` (Aura columns already exist).

---

## 2. RewardService (central engine — controllers never compute amounts)

```ts
grant(input: {
  userId: string
  rewardType: RewardType
  reasonCode: string
  amount?: number            // required only for dynamic rules (Aura scoring); else rule.baseAmount
  sourceType?: string
  sourceId?: string
  idempotencyKey: string     // caller-constructed, deterministic (see §3)
  actorUserId?: string       // the user who triggered it — for self-action rejection
  metadata?: Json
  tx?: PrismaTx              // participate in an outer $transaction (room finalize batches)
}): Promise<{ applied: boolean; skippedReason?: string; amount: number; balanceAfter: number; ledgerEntryId?: string }>
```

**Algorithm (all inside a `$transaction`):**
1. Load `RewardRule(reasonCode)`. If missing or `!enabled` → `{applied:false, skippedReason:'rule_disabled'}` (no throw).
2. `amount = input.amount ?? rule.baseAmount`.
3. **Self-action:** if `rule.configJson.rejectSelf` and `actorUserId === userId` → `{applied:false, skippedReason:'self_action'}`.
4. **Idempotency:** rely on the `idempotencyKey` UNIQUE constraint. Attempt insert; on `P2002` → look up existing entry, return it as `{applied:false, skippedReason:'duplicate'}`. (No double-grant, replay-safe.)
5. **perSourceCap:** sum existing entries for `(userId, reasonCode, sourceType, sourceId)`; if `+amount` exceeds cap → skip.
6. **dailyCap:** sum today's (UTC) entries for `(userId, reasonCode)`; if `+amount` exceeds cap → skip (do not partial-clamp in Phase 1; skip-and-log for clean audit trail).
7. Ensure `RewardAccount` (lazy create at 0/0/0).
8. Apply: `increment` the matching balance + lifetime (lifetime only for positive amounts). For **AURA**, also `increment` `User.totalAura` (+ `weeklyAura`) in the same tx. Compute `balanceAfter` from the updated row.
9. **Negative-balance guard:** if resulting balance `< 0` → **throw** (roll back) unless `rule.configJson.allowNegative` (admin only). RIZZ/Aura never negative.
10. Insert `RewardLedgerEntry` with `balanceAfter`. Return.

`grantMany(inputs, tx)` — batches several grants in one outer transaction (room finalize awards Aura+Gems together). Row-level `increment` keeps concurrent grants safe.

**Migration of existing grants:** the currently-unguarded `lifecycle.service` Aura grants (`scoreMilestone`, `scoreMultipleChoiceMilestone`, `compensateParticipants`) route through `grant()` with deterministic idempotency keys — **this closes the existing double-grant-on-retry bug**. Clout/Credit paths are **left as-is** (frozen legacy) in Phase 1.

---

## 3. Phase 1 Rule Table

Idempotency key = the value that makes a grant unique & replay-proof. `actor` = triggering user; `beneficiary` = who receives.

### AURA (wrap existing; preserve current scoring math exactly)
| reasonCode | amount | beneficiary | idempotencyKey | notes |
|---|---|---|---|---|
| `AURA_MILESTONE_SCORE` | dynamic (existing scorer) | predictor | `aura_ms:{milestoneId}:{userId}` | configJson.dynamic=true; baseAmount ignored |
| `AURA_MC_SCORE` | dynamic | predictor | `aura_mc:{milestoneId}:{userId}` | multiple-choice path |
| `AURA_COMPENSATION` | 5 | participant | `aura_comp:{roomId}:{userId}` | neutral-closure comp |

### RIZZ (new — social; never from prediction outcomes). Defaults below; tune before build.
| reasonCode | baseAmount | beneficiary | trigger | idempotencyKey | perSourceCap | dailyCap | guards |
|---|---|---|---|---|---|---|---|
| `RIZZ_UNIQUE_JOIN` | 5 | room creator | distinct user joins creator's room (RoomMembership) | `rizz_join:{roomId}:{joinerUserId}` | 1×/(room,joiner) | 100 | rejectSelf (joiner≠creator); leave+rejoin can't re-earn (key is per joiner) |
| `RIZZ_REACTION_RECEIVED` | 2 | room creator | another user reacts to creator's result | `rizz_react:{roomId}:{reactorUserId}` | 1×/(room,reactor) | 50 | rejectSelf; reaction is upsert → one grant per reactor regardless of emoji changes |
| `RIZZ_REMATCH_COMPLETED` | 10 | rematch creator | rematch room (rematchOfRoomId set) completes with ≥1 other participant | `rizz_rematch:{rematchRoomId}` | 1×/room | 50 | requiresOtherUser (≥2 distinct participants) |
| `RIZZ_VERIFIED_SHARE` | 3 | sharer | share-event logged (existing share audit) | `rizz_share:{roomId}:{sharerUserId}` | 1×/(room,sharer) | 9 (3 shares) | **See §6 caveat** — Phase 1 shares are client-asserted; hard caps blunt farming |

### GEMS (new — spendable; no shop). 
| reasonCode | baseAmount | beneficiary | trigger | idempotencyKey | guards |
|---|---|---|---|---|---|
| `GEM_FIRST_PREDICTION` | 20 | user | first completed prediction ever | `gem_first_pred:{userId}` | once per user (lifetime) |
| `GEM_FIRST_WIN` | 50 | user | first win ever | `gem_first_win:{userId}` | once per user |
| `GEM_MILESTONE_BADGE` | per-badge (configJson.badgeAmounts) | user | earns an allowlisted milestone badge | `gem_badge:{userId}:{badgeKey}` | badgeKey must be in configJson.badgeKeys allowlist; once per badgeKey |
| `GEM_REFERRAL_COMPLETED` | 100 | referrer | approved referral completion | `gem_referral:{referralId}` | **See §6** — no referral pipeline exists yet; endpoint/hook stubbed |
| `GEM_ADMIN_ADJUSTMENT` | dynamic (signed) | target user | admin endpoint | `gem_admin:{adminActionId}` | admin role; allowNegative; not in public /rules |

No Gem rule is tied to prediction *skill/rank* → no prediction advantage. ✓

---

## 4. API Contract

All under `/rewards`, JWT-auth, operate on the authenticated user (except admin adjust).

### GET /rewards/me
```jsonc
{
  "aura": { "balance": 1240, "weekly": 180, "lifetime": 1240, "rank": 42 },
  "tier": null,                       // no formal Aura tier exists today; nullable, reserved
  "rizz": { "balance": 65, "lifetime": 65 },
  "gems": { "balance": 70, "lifetime": 120 },
  "recentEntries": [                  // last 10 across all types
    { "id": "...", "rewardType": "GEMS", "amount": 50, "balanceAfter": 70,
      "reasonCode": "GEM_FIRST_WIN", "label": "First win", "createdAt": "..." }
  ],
  "nextMilestone": {                  // next unearned Gem milestone, derived; null if none
    "reasonCode": "GEM_FIRST_WIN", "label": "Win your first room",
    "reward": 50, "rewardType": "GEMS"
  }
}
```

### GET /rewards/history?type=RIZZ&limit=25&cursor=<opaque>
Cursor-paginated (createdAt+id), filterable by `type` (AURA|RIZZ|GEMS, omit = all). Own entries only.
```jsonc
{
  "entries": [
    { "id": "...", "rewardType": "RIZZ", "amount": 5, "balanceAfter": 65,
      "reasonCode": "RIZZ_UNIQUE_JOIN", "label": "New participant joined your room",
      "sourceType": "membership", "createdAt": "..." }
  ],
  "nextCursor": "<opaque|null>"
}
```
`metadata` is **not** returned raw (may hold internal fields). `sourceId` returned only when non-sensitive.

### GET /rewards/rules
Public, safe summaries only. **No caps, no thresholds, no anti-abuse config, no admin rule.**
```jsonc
{
  "rules": [
    { "reasonCode": "GEM_FIRST_WIN", "rewardType": "GEMS", "reward": 50,
      "label": "First win", "description": "Win your first prediction room." },
    { "reasonCode": "RIZZ_UNIQUE_JOIN", "rewardType": "RIZZ", "reward": 5,
      "label": "New participant", "description": "Someone new joins a room you created." }
  ]
}
```
Only `enabled && configJson.publicVisible !== false` rules. Dynamic-amount rules (Aura scoring) show `reward: null` with a descriptive label.

### POST /admin/rewards/adjust  (admin-guarded, existing admin auth stack)
Body: `{ userId, rewardType, amount (signed), reason, idempotencyKey }` → routes to `RewardService.grant` with `GEM_ADMIN_ADJUSTMENT` (or per-type admin reason). Audit-logged.

---

## 5. "Rizz-tier" → "Late-tier" rename (decision 2)

Field name `MilestonePrediction.auraEligible` / `lockedCheckpoint` stay (no "rizz" in identifiers). Touchpoints to update:
- **Backend comments:** `predictions.service.ts:17,138`; `lifecycle.service.ts:680,882`; `schema.prisma:582-586`; `config/feature-flags.ts:36` — replace "Rizz-tier" → "Late-tier".
- **Mobile display copy:** `RoomPredictionList.tsx:77-79,132-133` "Rizz-tier · no Aura" → "Late-tier · no Aura"; `config/featureFlags.ts:32` comment.
- **Mobile share/framing copy that conflates late-guess with the new currency:** `shareRoom.ts:67` ("Late heat is pure Rizz"), `RoomCreatedScreen.tsx:183`, `CreateRoomScreen.tsx` "gems_rizz" framing — reword so "RIZZ" only ever means the social currency.
- **Stored value `rewardMode: 'gems_rizz_no_aura'`:** recommend **keeping the stored string as-is** (avoids a data migration on existing rooms); change only user-facing copy. Flag for later cleanup.

---

## 6. Open items (defaults chosen so we're not blocked — confirm or override)

1. **Amounts/caps** in §3 are proposed defaults. They're config (RewardRule), trivially tunable later.
2. **Verified shares:** current shares are **client-asserted** (`rooms.trackShareEvent` → AuditLog only; no attribution). Phase 1 plan: grant on the logged share-event with hard per-room + daily caps. True verification (deep-link click attribution) is out of scope — flagged as follow-up. Alternatively, hold `RIZZ_VERIFIED_SHARE` **disabled** until real verification exists. **Default: enabled with hard caps.**
3. **Referrals:** no referral pipeline exists in the codebase. Plan: ship the `GEM_REFERRAL_COMPLETED` rule + service hook + admin-approval entry point, but leave the earning path **disabled** until a referral system lands. **Default: rule seeded, disabled.**
4. **Aura `tier`:** no formal tier system exists; `/rewards/me` returns `tier: null` (field reserved). Confirm we're not expected to invent tiers in Phase 1.
5. **Account merge:** guest→real currently mutates the same row (balances carry free). A true two-row merge has no code today; the merge helper + tests are built in the backend step (sum balances, re-parent ledger, dedupe once-per-user idempotency keys).

---

## 7. Rollout notes
- New tables only + rule seed → additive migration via `prisma db push` (prod convention — see broken migration-history note). No changes to existing currency columns.
- RewardAccount lazily created on first grant or first `/rewards/me`; a backfill dry-run (Step 6) creates accounts at 0/0/0 and mirrors `auraBalance = totalAura`. **RIZZ/Gems initialize at 0 — no inference from historical events.**
