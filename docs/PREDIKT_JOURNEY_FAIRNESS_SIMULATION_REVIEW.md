# PREDIKT Journey Fairness Simulation Review

## Scenarios Simulated
- Normal completed journey
- Journey live and auto-closing soon
- Journey overdue
- Journey cancelled before lock
- Journey cancelled after lock
- Journey abandoned / No-Show
- Journey auto-closed after expected duration plus grace

## Lifecycle Transitions
- Journey rooms now track a dedicated `journeyStatus` alongside broad room status.
- Start computes expected duration, grace, no-start cutoff, and auto-close timing.
- Rooms can move through `scheduled`, `started`, `live`, `inactive`, `overdue`, `completed`, `plan_changed`, `cancelled_by_host`, `auto_closed`, and `abandoned`.

## Fairness Outcomes
- Cancelled, abandoned, and auto-closed rooms use neutral closure messaging.
- Predictions in those rooms are not treated as losses.
- Participants can receive small recognition through idempotent closure compensation.

## Participant Impact
- Participants are protected from hanging rooms that never conclude.
- Closure cards explain that predictions were closed neutrally.
- No hidden prediction values or sensitive route data are exposed during closure flows.

## Reliability Impact
- Verified completion adds a small positive reliability event.
- Cancelling after lock applies a mild negative adjustment.
- Auto-close and No-Show create stronger negative adjustments.
- Repeated abandonment can trigger an additional penalty event.

## UX Observations
- “Overdue” and “Waiting for traveller update” need to be visually distinct from ordinary live status.
- Neutral closure copy is much easier to trust than generic “completed” copy for unresolved journeys.
- Reliability works best as explanatory context, not as a punitive headline.

## Fixes Implemented
- Added lifecycle timestamps, status tracking, and evaluation logic.
- Added creator controls for start, cancel/plan change, and arrival confirmation.
- Added lifecycle-aware hub/live/result/profile messaging.
- Expanded demo scenarios to include fairness and closure cases.

## Remaining Gaps
- User-facing notifications are still limited to status surfaces rather than push/inbox delivery.
- Dispute resolution does not yet restore reliability automatically from a dedicated moderation flow.
- Group-journey-specific traveller reliability remains a follow-up after target-level persistence is completed.
