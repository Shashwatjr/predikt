# Abuse Prevention

## Implemented MVP Foundation

- Anti-betting/cash keyword blocking with user-facing rewording message.
- Reports: harassment, spam, betting_or_cash, unsafe_location, inappropriate_content, fake_result, other.
- Blocks: block, unblock, list blocked users; blocked users cannot follow each other.
- Disputes: room disputes mark result finality for review and suppress reward finality until admin release.
- Result reactions are limited to friendly preset reactions.
- Admin can review reports/disputes, suspend users, remove rooms, reverse Credits, and resolve disputes.
- MVP rate limiting protects register, login, room creation, prediction submission, invite-code lookup, daily spin claim, report submission, and handle availability checks.

## Risk Signals To Monitor

- Rapid room creation
- Repeated same participants
- Repeated host-declared wins
- Invite spam
- Credit farming
- Suspicious edits
- Repeated reports

## Known Limits

Automated risk signal aggregation is not fully implemented yet. Do not add ML decisioning for fraud or moderation without deterministic rules, auditability, and human review.

## Verification Evidence

Scripted API acceptance passed report creation, block/list blocked users, dispute creation, anti-betting keyword blocking, admin auth requirement, admin suspend, room remove, credit reversal, dispute resolution, and 429 rate-limit response.
