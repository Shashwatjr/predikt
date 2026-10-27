# Reward retry and concurrency review

Existing passing evidence is reused: `../commands.md` and `../decisions.md` record the two-connection `result_finalization` race, transaction rollback and retry (one claim and one Clout set); `../scored-db-evidence.json` verifies actual HTTP-scored predictions, Aura formula/ledger, legacy Clout components and first-win Gems. The 13 passing RewardService tests cover the fake-backed engine, duplicate grants/P2002 handling, caps, self-action rejection, rollback and account merge. Those checks were not rewritten or rerun as proof of new coverage. The completed scored browser journey is unchanged.

## New evidence and narrow fixes

`backend/scripts/verify-finalization-external.ts` exercises real services and real Postgres transactions on loopback `predikt_ui` only, with fresh synthetic fixtures. It calls internal helpers to isolate effects outside the existing finalization transaction; it is not a new scoring endpoint or a substitute for HTTP acceptance. No predictions/results are manufactured as journey evidence. Test fixtures are retained in this disposable DB for inspection.

| Previously uncovered path | Before | Result/fix |
|---|---|---|
| Creator credit balance update then ledger failure | Balance stayed +15 with no ledger | Balance increment + ledger are one transaction; injected failure leaves 0, retry/retry yields +15 and one ledger row |
| Eight creator-credit contenders | Unique-key errors after independently committed balance updates | Existing deterministic key plus advisory transaction lock; all return successfully, one +15 ledger/balance effect |
| Eight flex contenders | Eight rows for one award | Transaction lock per beneficiary/type/room/milestone before check/create; one row including retry |
| Two beneficiaries, eight Drop contenders, maxWinners=1 | Eight awards despite shared cap | Shared room/drop lock, deterministic drop ordering; one total award |
| Eight badge contenders and post-award failure | Existing unique constraint raised duplicate errors | Lock badge identity inside transaction; all see one badge; retry after downstream failure returns the same badge |
| Eight notification contenders and partial fanout retry | Eight notifications to one recipient | Lock recipient/type/room/idempotency key around lookup/create; one per recipient, retry can deliver a missing recipient |

Evidence: `external-effects-before.txt`, `notifications-before.txt`, `external-effects-after.txt`. Six targeted safety checks pass after changes. Advisory locks are parameterized and transaction-scoped. Keys are domain/recipient-scoped; the existing room-finalization claim remains room-scoped. No scoring formula, winner order, reward amount/cap, eligibility rule, client attribution or backend authorization was changed. Badge audit logging remains best-effort as before; no financial grant is authorized by a notification or share payload. The existing RewardService remains the writer of Aura/RIZZ/Gems.

The supplemental tests exercise the real new locks, not a mocked transaction that merely mirrors implementation. Existing badge/notification unit mocks were extended only to support transaction callbacks; their privacy, identity and award assertions remain intact.

## Explicit unresolved release blockers

Superseded for the terminal-retry and partial-score paths by `recovery-20261027.md` (local disposable DB). The paragraph below is the pre-fix finding.

`terminal_retry_gap_reproduced_not_fixed` was a **passing reproduction of a defect**, not a recovered lifecycle. The test injects a `result_ready` notification failure after public `LifecycleService.end` persisted `completed` and credits. The first call throws; a subsequent normal `end` is rejected as terminal. Thus the safe internal helper retries above do not establish a reachable HTTP recovery mechanism. A durable per-step recovery/outbox or explicitly authenticated terminal recovery design remains required. Do not reset a completed room or remove terminal guards to replay rewards.

Milestone reach/scoring is still outside the finalization claim and marks reached before all scoring completes. Partial score recovery and simultaneous reach/arrival serialization require a separate tested design. The new checks do not claim atomicity for the entire journey. Winner-Gem/badge/rematch keys reuse existing engine guarantees and prior scoped tests; arbitrary real-DB cross-source engine-cap/account contention and production-like load were not retested here. The engine's mock-backed race test is not a real-DB load test. These broader lifecycle/engine contention gates remain open; do not infer release readiness from helper test success.

Review new lock ordering with all writers before broad rollout. Drop/flex helpers now serialize their own award paths; schema-level uniqueness/global cross-writer enforcement is not added. The independent Drop purchase path writes roomId=null and is distinct from these room awards. Keep transaction timeouts/load monitoring in the later staging rehearsal. No production load or writes were performed.
