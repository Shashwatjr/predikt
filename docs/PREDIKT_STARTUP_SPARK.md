# PREDIKT Startup Spark

## Purpose
`Today's Spark` is a premium 4-6 second startup experience shown once per calendar day. It adds emotional identity during launch without becoming onboarding, blocking navigation, or depending on network data.

## Animation Timeline
- `0.0s`: dark premium background with soft glows
- `0.3-1.2s`: PREDIKT logo fades and scales into place
- `1.7-2.4s`: glass Spark card enters with a soft rise
- `2.4-5.0s`: one Spark prompt or occasional vote prompt is visible
- `exit`: fades naturally when app readiness is known

## Rotation Logic
- Spark templates are bundled locally in `mobile/src/data/dailySparkTemplates.ts`
- `mobile/src/utils/sparkRotation.ts` picks the day’s item deterministically from the calendar date
- about 10% of days become a vote prompt instead of a standard Spark
- state is local-only and stored in `mobile/src/services/startupSpark.ts`
- once shown on a given date, Spark is skipped for the rest of that day

## Accessibility
- reduced motion shortens and simplifies animation timing
- screen reader users get a concise accessibility label and supporting copy
- colors and glass card styling use high-contrast text on dark surfaces
- users can disable `Today's Spark` from Profile settings

## Performance
- no network dependency
- no backend calls
- prompt content is bundled locally
- the app shell and navigation still mount immediately beneath the Spark overlay
- if loading takes longer than the Spark window, the overlay exits and hands off to normal loading

## Template Guidelines
- under 18 words per prompt
- optional, positive, tiny, and easy to remember
- timeless wording
- no medical advice, calorie goals, finance, politics, religion, or news
- no guilt, shame, or preachy tone

## Future Roadmap
- optional sound pack with silent-mode awareness
- broader vote analytics if backend preferences are introduced
- richer accessibility preferences including explicit high-contrast variants
- seasonal Spark packs and limited-time collaborations
