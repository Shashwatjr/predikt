# PREDIKT Experience Framework

## Product Principles

1. Every room creates anticipation.
PREDIKT rooms should open with a clear question, a visible lock moment, and a reason to care before the answer arrives.

2. Every result creates a story.
Results should explain what happened, who got closest, what the benchmark said, and why the moment was memorable.

3. Every story should be worth sharing.
Each completed room should produce a clean, screenshot-ready reveal with playful language, recognizable achievements, and safe context.

4. Every share should create curiosity.
Moment Cards, result copy, and invites should make outsiders want to ask, "What app is this?"

5. Every curiosity should lead to another room.
The product loop should naturally end in Rematch, Comeback, or a new category challenge.

6. Losing should feel playful, not humiliating.
Misses should create rematch energy, never shame, pile-ons, or identity-based targeting.

7. Winning should feel recognizable and brag-worthy.
Wins should unlock visible status through Aura, badges, and shareable copy without exaggerating risk or certainty.

8. AI commentary should decorate the result, not determine it.
Oracle Bot and personality commentary can add flavor, but server-side scoring, winner selection, badges, and fairness rules remain deterministic.

9. Safety, privacy, fairness, and auditability are always enforced server-side.
No client-side presentation layer can bypass moderation, privacy controls, room visibility, or result governance.

10. The product should feel simple even when governance is sophisticated underneath.
The experience can be playful and lightweight while enterprise-grade protections stay invisible unless needed.

## Tone Guide

- Playful, concise, screenshot-friendly
- Smart without sounding technical
- Friendly teasing, never personal attacks
- Memorable one-liners with category context
- Confident about the moment, not overconfident about certainty

## Allowed Humor

- Everyday chaos jokes about traffic, rain, delays, food routes, routines, and group habits
- Self-aware jokes about overconfidence, timing, instincts, and benchmark misses
- Office satire, route drama, and lightweight cultural familiarity when respectful
- Warm "you should have known" energy without insult

## Disallowed Humor

- Any joke about protected traits or sensitive attributes
- Humiliation, dogpiling, shaming, or pile-on language
- Sexual content or innuendo
- Mocking emergencies, accidents, safety incidents, illness, grief, or financial hardship
- Threats, harassment, profanity-heavy copy, or encouragement of dangerous behavior

## Enterprise Guardrails

- Winners, rewards, and badges must be determined by audited server logic
- Hidden predictions remain hidden until the correct lifecycle state
- Commentary payloads must exclude precise location, personal contact, private messages, and sensitive profile data
- AI generation must time out safely and fall back to deterministic templates
- All commentary generation and regeneration events must be auditable by room, personality, provider, and version

## User Opt-Out

- Users can disable commentary entirely
- Users can opt out of AI-style commentary while retaining deterministic copy
- Personalities are optional and should default to a safe setting
- Unsafe or disputed room states force neutral commentary regardless of user preference

## Moderation Model

- Server validates allowed personalities, safe room states, and participant access
- Deterministic filters reject unsafe copy before storage or display
- Disputed, cancelled, abandoned, emergency, or safety-sensitive rooms use neutral commentary
- Reports, blocks, disputes, and reaction controls stay available from the result surface

## AI Fallback Behavior

1. Templates/rules engine is the default path
2. Optional local or external model can be used only with minimal safe payloads
3. Generated copy must pass deterministic validation
4. Failed or unsafe output falls back to safe templates
5. Unsafe lifecycle states downgrade to neutral commentary automatically

## Category Personality Examples

### Arrival Time
- Oracle: "Oracle Bot predicted 9:31 AM. Actual arrival was 9:34 AM."
- Chaos: "Bangalore traffic saw the ETA and chose character development."
- Traffic Cop: "Signal discipline was optional, suspense was not."

### Weather / Rain
- Oracle: "Forecast benchmark called rain after 6 PM."
- Chaos: "The umbrella stayed loyal longer than the clouds did."
- Best Friend: "You really trusted your instincts and it paid off."

### Food ETA
- Oracle: "Benchmark ETA was 8:12 PM. Delivery landed at 8:09 PM."
- Chaos: "The biryani took the scenic route but still respected the plot."
- Gen Z: "Delivery arc was messy but iconic."

### Who's Late
- Oracle: "Closest guess won by 2 minutes."
- Chaos: "Tradition was maintained and punctuality remained aspirational."
- Corporate Manager: "We appreciate the timeline variance and the learnings."

### Gym / Habit
- Oracle: "The room closed on the recorded routine outcome."
- Best Friend: "Not perfect, still progress, still a story."
- Indian Mom: "I told you to start on time, but at least you showed up."
