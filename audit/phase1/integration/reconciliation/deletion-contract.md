# Deletion contract diagnosis

Conclusion: the inherited test expectation was stale. `de7322c` deliberately changed `RoomsService.remove` to per-user removal by default and added an explicit internal cancellation flag. The test retained the older `2612c8b` cancellation expectation without setting that flag.

Evidence at 5369746:

- `mobile/src/screens/HomeScreen.tsx:425` says: “This removes the journey from your list. Everyone else keeps theirs.” It calls DELETE with no cancellation flag.
- `RoomsController.remove` forwards only room ID and authenticated user. It exposes no cancelForEveryone body/query option.
- `RoomsService.remove` comments and default `false` flag implement that contract with a user-specific `UserRoomPreference` upsert, leaving shared room state intact. Outsiders are forbidden. Explicit creator cancellation has its own branch.
- `LifecycleController` separately exposes creator-only journey/cancel with lifecycle/reliability/neutral-closure behavior. Dashboard removal is not room erasure or an account privacy-deletion request. Privacy/data-retention documents do not authorize erasing other participants' records through dashboard DELETE.

Fix: existing cancellation test now explicitly requests the internal cancellation branch (`true`) and retains assertions on the room/milestone writes, cancellation reason, notification and response. Added creator/member default-removal assertions on the exact user-scoped preference, unchanged live status, no shared room/milestone writes and no notification/transaction. Added outsider denial for both removal/cancellation with no writes. API_SPEC now states the distinction. No production service behavior was changed merely to make the test green.

Affected room/lifecycle/badge/notification tests passed (27 across four suites), and the separate strict-preview-CORS check passed (1). The earlier deletion-contract failure is resolved; it is no longer a release blocker.
