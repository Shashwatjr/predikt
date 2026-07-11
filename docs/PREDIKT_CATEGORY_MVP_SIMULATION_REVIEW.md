# PREDIKT Category MVP Simulation Review

## Categories simulated

- Arrival Time: existing route-first room flow remains the primary journey setup.
- Weather / Rain: `weather_rain` room with a stored forecast snapshot, three multiple-choice options, and an Oracle Bot benchmark.
- Food ETA: safe manual template using provider label and app ETA fields. No delivery APIs, scraping, or credentials.
- Who's Late: friendly group-arrival template only. Copy avoids humiliation and reminds creators to use consent for private people.
- Gym / Habit: positive accountability template for personal streak and workout predictions.

## Mode behavior

- Play with Friends maps to `friends` and keeps invite/share behavior.
- Beat the Bot maps to `beat_bot` and stores Oracle Bot benchmark metadata where relevant.
- Challenge Yourself maps to `challenge_self` and can create solo-style generic rooms.

## Category creation UX observations

- Create starts with "What do you want to PREDIKT?" and category tiles.
- Mode selection follows immediately with clear explanations.
- Arrival Time continues into the existing route preview and journey setup.
- Weather / Rain collects location, time window, forecast chance, forecast window, and forecast provider.
- Placeholder templates are intentionally manual and avoid third-party integrations.

## Prediction and result behavior

- Weather uses `multiple_choice` with `no_rain`, `rain_before_6`, and `rain_after_6`.
- Forecast snapshots are stored at room creation so later forecast changes do not alter the benchmark.
- Predictions remain hidden until lock through the existing `hidden_until_lock` behavior.
- Multiple-choice result declaration supports host-declared outcomes and matches winners by selected option.
- Oracle Bot is stored and shown as a benchmark, not a source of truth.

## Safety and privacy review

- UI copy avoids real-money and wagering language.
- Public route previews continue to avoid exact GPS disclosure.
- Moment Card copy is category-aware and does not include exact address, route, live map, email, phone, or private person details.
- Weather MVP avoids severe-weather alerts, radar, flood guidance, and emergency advice.
- Food ETA MVP does not call Swiggy, Zomato, or any external delivery API.

## Copy issues found

- Some existing journey surfaces still use route-oriented labels for generic rooms. The new Weather result declaration flow avoids live route controls, but broader non-route live-state polish remains.
- Existing landing demo copy still contains older demo phrasing and should be refreshed in the next pass.

## Fixes implemented

- Added generic category metadata to rooms.
- Added multiple-choice room outcome support.
- Added deterministic Weather Oracle Bot benchmark fallback.
- Added category-aware share and Moment Card copy.
- Added lightweight funnel event tracking through existing persistence.
- Added engagement demo category rooms.

## Remaining gaps

- Food ETA, Who's Late, and Gym/Habit are frontend-safe templates with generic room support, not full category-specific scoring.
- Beat the Bot comparison is stored as benchmark metadata; it does not decide winners.
- Manual web QA still needs to be run after starting Expo web.
- Homepage and landing marketing copy need a dedicated no-restricted-words sweep before launch.
