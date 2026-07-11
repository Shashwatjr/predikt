# Governance And Compliance

## Phase 1 Hardening Update — July 9, 2026

- Admin authentication now uses a dedicated validated secret and explicit token expiry.
- Admin write endpoints now pass through DTO validation for status changes, room removal, credit reversal, dispute resolution, drop/sponsor/campaign writes, privacy-request updates, and AI-system writes.
- Credit reversal continues to require admin auth and now rejects invalid `amount` input with `400`.
- Privacy request intake and consent/audit records remain in place; case-management workflow depth is still a future requirement.

## Alignment

PREDIKT MVP foundations align to:

- GDPR and India DPDP Act: privacy requests, consent records, data export/deletion request intake, minimization, AI personalization opt-out.
- EU AI Act principles: low-risk AI copy only, no AI for scoring, winner selection, Credits, fraud decisions, sensitive profiling, or leaderboard manipulation.
- NIST AI RMF: AI inventory foundation and human oversight notes.
- NIST CSF and OWASP: auth guards, audit logs, validation, security hardening backlog.
- Child safety and anti-betting: reports, blocks, anti-betting policy, no cash wagering mechanics.
- ISO/SOC2 readiness later: audit logs, admin actions, privacy request records, retention docs.

## Policy Surfaces

- `GET /policies/privacy`
- `GET /policies/terms`
- `GET /policies/community-guidelines`
- `GET /policies/anti-betting`

## Sponsored Placement Governance

- Web side-wing sponsored placements are static local-config surfaces, not third-party ad network integrations.
- Placements are labelled Sponsored, Partner, or Promoted and stay separate from PREDIKT results and scoring.
- Placements must not use exact location, route history, private room data, prediction content, sensitive profiling, or raw GPS.
- Placements must not affect Aura, Clout, Credits, leaderboards, Drops, result reveal, or winner selection.

## User Rights Foundation

- `POST /privacy/data-export-request`
- `POST /privacy/data-deletion-request`
- `PATCH /privacy/ai-personalisation-opt-out`
- `POST /consents`

## AI Governance

Allowed AI/local personalization is limited to low-risk copy: room title, avatar/background suggestion explanation, result message, comeback prompt, group recap, safe banter, and nudges.

Do not use AI for scoring, winner selection, Credits, fraud decisions without deterministic rules, employment judgement, political persuasion, health inference, sensitive profiling, or leaderboard manipulation.

If AI copy is used, send only privacy-safe minimal data: handles, room type, category, result numbers, and tone.

## Operational Placeholders

- Breach response plan: placeholder required before production beta.
- Vendor/subprocessor list: placeholder required before production beta.
- Retention jobs: policy exists elsewhere, operational jobs remain future work.
