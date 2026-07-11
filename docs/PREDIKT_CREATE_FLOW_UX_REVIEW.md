# PREDIKT Create Flow UX Review

## Old create flow pain points

- Arrival Time exposed route templates, visibility, delay, prediction type, title, and lock time too early.
- Users had to understand room mechanics before seeing an ETA.
- The route flow felt like a long form instead of a maps-style action.
- Weather and template categories already worked, but advanced fields were too visible.

## New simplified flow

1. Pick category.
2. Pick mode.
3. Add only the category-specific details.
4. Preview smart defaults.
5. Create.

Advanced settings are hidden by default and can still be changed when needed.

## Category-specific setup review

- Arrival Time: start, destination, travel mode, route preview, create.
- Weather / Rain: location, time window, forecast chance, forecast provider, fixed rain options.
- Food ETA: provider/app ETA style quick fields, no external API calls.
- Who's Late: person/group label and target/template details with friendly consent copy.
- Gym / Habit: habit and target detail with positive accountability copy.

## Arrival Time route UX review

- Travel mode chips now match user language: Car, Bike, Walk, Cycle, Transit.
- Route preview shows ETA, distance, travel mode, provider, confidence/approximation, Oracle Bot benchmark, lock/safety copy, and Ghost Mode.
- Generated title and question are shown before creation.
- Custom title, custom question, lock time override, visibility, start delay, prediction type, and route templates moved into Advanced Options.
- Primary CTA is now "Create Arrival PREDIKT"; secondary is "Change details".

## Map provider behavior

- `MAPS_PROVIDER=auto` is the default.
- Auto selects Google when `GOOGLE_MAPS_API_KEY` exists.
- Auto selects Bing/Azure when their keys exist and Google is unavailable.
- OpenStreetMap remains the fallback.
- The provider layer returns a route preview with provider labels and approximation warnings.

## Travel mode support

- Frontend modes: `car`, `bike`, `walk`, `cycle`, `transit`.
- Google mapping: driving, bike estimate via driving fallback, walking, bicycling, transit.
- Bing/Azure mapping: available driving/walking/transit style modes; bike/cycle return approximation warnings.
- OSM fallback uses distance and mode speed and labels the result as approximate.

## Privacy review

- Participant/public room projections continue to expose route labels, mode, distance, and approximate duration, not raw coordinates.
- Live state exposes delayed/approximate progress only.
- Ghost Mode remains the default safety posture.
- Copy repeats: "Accuracy wins. Speed does not."
- No passenger data, exact public live location, or exact route replay was added.

## Remaining complexity

- The create screen is still a large file; new components reduced the Arrival surface but further extraction would help.
- Food, Who's Late, and Gym/Habit still use generic room creation under the hood.
- Provider route duration is approximate for non-Google and for unsupported travel modes.

## Fixes implemented

- Added maps provider abstraction and environment-driven provider preference.
- Added travel mode normalization and provider-specific fallback warnings.
- Expanded route preview payload with provider, mode label, ETA label, confidence, approximation, and warnings.
- Simplified Arrival Time quick setup and moved advanced controls behind a drawer.
- Added `TravelModeSelector` and `RoutePreviewCard`.
- Added backend tests for provider selection, travel-mode mapping, route preview, and route room creation storage.

## Remaining gaps

- Manual web QA still needs a browser pass after Expo starts.
- A future sprint should split `CreateRoomScreen` into category setup components.
- A future sprint should add real provider route APIs for Bing/Azure and full Google Directions where available.
