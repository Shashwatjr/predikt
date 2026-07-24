# My Prediktion User Audit

Test date: July 24, 2026
Environment: Production URL `https://myprediktion.com`
Observed redirect target: `https://predikt-alpha.vercel.app/`
Browser: Playwright Chromium (desktop `1440x1200`, mobile `390x844`)
Method: Clean-session UX audit on the live product with screenshot evidence

## 1. Executive verdict

Overall score: `4.8/10`
The product partially works in production, but I could not verify the full loop end-to-end from create to The Tea using only confirmed live behavior.
It is ready for another tightly moderated friend-group test only after a small polish-and-reliability batch.
It is not ready for broader public acquisition.
Biggest strength: the core concept is legible once logged in, and the dashboard/category system gives the product shape.
Biggest weakness: the social loop breaks before payoff because creation confidence, route search reliability, and post-create continuity are shaky.
Highest-impact next action: make one creation path reliably produce a room, land the creator on an unmistakable share screen, and prove that invite-to-prediction works cleanly for guests.

## 2. User journey scorecard

- Landing page: `5/10` - The page looks more productized than a blank beta, but the redirect to `predikt-alpha.vercel.app` and mixed `Predikt`/`Prediktion` naming immediately weaken trust.
- Login: `6/10` - The auth form is clean and readable, but one provided credential set failed with a live `401`, and success feedback is subtle.
- Create room: `4/10` - Category entry feels promising, but Travel creation stalled in place search and Custom creation did not give me a trustworthy post-submit handoff.
- Invite/share: `2/10` - I could not reach a confirmed invite surface from a completed room in this session.
- Guest join: `1/10` - Not verified because I could not obtain a working invite URL from a confirmed created room.
- Prediction: `1/10` - Not verified end-to-end in production.
- Live room: `1/10` - Not verified end-to-end in production.
- The Tea: `1/10` - Not verified end-to-end in production.
- Aura and badges: `4/10` - Aura is visible and positioned as a lightweight status loop, but it still reads as an unexplained number rather than earned meaning.
- Rematch: `1/10` - Not verified in production.
- Navigation: `6/10` - The main dashboard/navigation model is understandable, but the first-use coachmark blocks content awkwardly and the flow hierarchy still feels unfinished.
- Mobile experience: `4/10` - The layout technically renders on mobile, but the landing screenshot shows cramped density and a visually broken lower viewport.
- Trust and privacy: `5/10` - Ghost/Private/Public copy is reasonably explicit, but the live-domain mismatch undermines confidence.
- Delight: `5/10` - The product has more personality than a utilitarian form tool, but the experience is not yet consistently playful enough to earn sharing.
- Repeat-use potential: `4/10` - The repeat loop is conceptually there, but the product does not yet reliably carry users to the emotionally rewarding part.

## 3. What is working

### Product strengths

- The logged-in dashboard quickly surfaces the main jobs: start a prediction, join with code, and choose a category.
- The category architecture is clearer than expected for a beta: Sports, Travel ETA, Delivery ETA, and Custom Challenge create obvious use-case buckets.
- Privacy modes are presented early in creation instead of being buried near publish.

### UX strengths

- The login screen is visually clean, readable, and consistent with the dark visual system.
- The dashboard hero and category cards make the product easier to explain after login than on the anonymous landing page.
- The create-room flow uses progressive setup and plain-language category summaries.

### Technical strengths

- The authenticated dashboard loaded successfully with the second credential set.
- Custom Challenge setup appears to hit a live create endpoint successfully (`POST /events` returned `201` during testing).
- I did not observe catastrophic console crashes that blanked the app.

### Brand/voice strengths

- “Closest guess wins Aura” is a good concise mechanic line.
- The product voice is more social than generic productivity software once inside the app.
- “Ghost Mode” is memorable and more ownable than plain privacy labels alone.

### Privacy strengths

- Ghost / Private / Public descriptions are unusually explicit for a beta and reflect intentional product thinking.
- Guest access expectations are described in the Ghost Mode copy.

## 4. What is not working

### Critical bugs

- None confirmed at P0 from observed behavior.

### High-friction UX

- The public production URL redirects to a different `predikt-alpha` domain, which makes the app feel staged rather than trustworthy.
- Travel ETA place search remained in a `Searching places...` state and never surfaced a resolved next step during testing.
- After a successful Custom Challenge create request, I was not clearly landed in a room/share state, so the creator loop remained ambiguous.

### Confusing product decisions

- The anonymous landing page still reads partly like a lobby/discovery product rather than a crisp “create room / join room / reveal result” consumer loop.
- `Predikt` and `Prediktion` are both visible in user-facing surfaces, making the brand feel in transition.

### Visual polish issues

- The mobile landing screenshot ends with a large blank white band that looks broken rather than intentionally spacious.
- The first-use coachmark overlays important dashboard content in a way that reduces immediate clarity.

### Copy issues

- “Predict”, “Predikt”, and “Prediktion” compete instead of reinforcing each other.
- “Featured creators” and “Community hosts” panels dilute the core first action for new users who should probably be creating or joining.

### Mobile issues

- The landing page is dense and visually awkward on a small viewport.
- The bottom-of-page white area on mobile reads as a rendering/layout defect.

### Trust/privacy issues

- The domain mismatch from `myprediktion.com` to `predikt-alpha.vercel.app` weakens trust before the user does anything.
- One supplied test login (`pilot@predikt.ai`) returned a live `401 Invalid credentials`, which creates doubt about test-environment hygiene.

### Engagement and retention gaps

- I could not verify the product’s signature payoff loop, so the current experience still feels stronger as a concept than as a completed social ritual.
- Aura is visible, but not yet emotionally contextualized enough to pull a user into a second room.

## 5. Issue table

| ID | Severity | Screen | Finding | Reproduction | Expected | Actual | User impact | Screenshot | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MP-01 | P1 | Landing | Production URL redirects to `predikt-alpha.vercel.app` | Open `https://myprediktion.com` in a clean session | Stay on the canonical branded production domain | Redirects to a visibly different alpha/staging-flavored domain | Immediate trust drop; feels unfinished or risky to share | `docs/audit-assets/2026-07-24/01-landing-desktop.png` | Keep the user on the primary domain or mask the deployment domain fully |
| MP-02 | P1 | Login | Provided test account `pilot@predikt.ai` failed with live `401 Invalid credentials` | Open Sign In, submit the supplied credentials from the original brief | Working test credentials or an internally verified backup | Live auth rejection | Blocks testing, undermines confidence in account reliability | `docs/audit-assets/2026-07-24/03-signin-screen.png` | Maintain a verified audit account and rotate it only when the brief is updated |
| MP-03 | P1 | Create Room / Travel ETA | Place search hangs in `Searching places...` without clear recovery | Logged in, open `Travel ETA`, enter `MG Road` in From | Show suggestions, error state, or retry path | Persistent searching state with no visible results | Makes a core room type feel unreliable before creation is complete | `docs/audit-assets/2026-07-24/06-travel-from-suggestions.png` | Add loading timeout, no-results messaging, and visible retry/fallback entry |
| MP-04 | P1 | Create Room / Custom Challenge | Successful create request did not produce a clearly confirmed room/share state | Open `Custom Challenge`, fill fields, submit | Land on created room with obvious invite/share CTA | Server returned `201`, but the creator journey did not yield a trustworthy confirmed room in UI during this audit | Breaks confidence in the core create-share loop | `docs/audit-assets/2026-07-24/07-custom-challenge-step1.png` | After successful create, force a deterministic redirect to the room detail/share screen |
| MP-05 | P2 | Landing mobile | Lower viewport shows a large blank white region that reads as broken layout | Open landing page on a `390x844` viewport | Full-height intentional mobile layout | White band at bottom of screenshot | Lowers polish and trust on first visit | `docs/audit-assets/2026-07-24/02-landing-mobile.png` | Fix mobile page background/height handling and retest with small screens |
| MP-06 | P2 | Dashboard | First-use coachmark blocks core content and weakens next-step clarity | Log in with fresh session | Helpful onboarding that supports, not obscures | Coachmark overlays dashboard CTA area | Adds friction exactly when the user needs momentum | `docs/audit-assets/2026-07-24/04-post-login-home.png` | Reposition or simplify the first coachmark; keep CTA unobstructed |
| MP-07 | P2 | Brand surfaces | Mixed `Predikt` and `Prediktion` naming remains visible | Review landing and dashboard surfaces | Consistent public naming | Both naming systems appear live | Makes the brand feel transitional and less memorable | `docs/audit-assets/2026-07-24/01-landing-desktop.png` | Standardize naming across all user-facing surfaces before broader testing |
| MP-08 | P3 | Landing | Promotional side panels compete with the primary user task | Open landing or dashboard | New user should see a single obvious first action | “Featured creators” and “Community hosts” split attention | Reduces first-session focus | `docs/audit-assets/2026-07-24/01-landing-desktop.png` | De-emphasize secondary panels until the core create/join loop is proven |

## 6. The Tea assessment

The Tea score: `1/10`

- Reveal clarity: not verified
- Emotional payoff: not verified
- Commentary quality: not verified
- Screenshot/share value: not verified
- Badge value: not verified
- Aura value: only partially visible pre-result
- Reaction value: not verified
- Rematch value: not verified
- Signature-moment test: not yet proven in this production session

Observed fact: I could not complete a verified live production journey into The Tea during this audit because creation continuity broke before I could reach a room result state.
Interpretation: this is likely the main reason the product can feel “not right.” The promise is social payoff, but the product currently loses confidence before the payoff arrives.

## 7. First-time user narrative

I opened My Prediktion and my first reaction was that it looked more substantial than a rough MVP, but I was not fully sure whether it was a social prediction game, a lobby network, or a creator/discovery app. The redirect to a `predikt-alpha` domain immediately made it feel less finished than the visual design suggested. After login, the product became much easier to understand: start a prediction, pick a category, invite friends, compete for Aura. That was the strongest moment of clarity. But when I tried to actually create rooms, the confidence fell away. Travel ETA stalled on place search, and Custom Challenge did not deliver a clean “your room is live, share this now” moment. I left the session understanding the idea better than the ritual, which is a problem for something meant to become a story worth talking about.

## 8. Funnel analysis

- Landing -> Login
  Motivation: curiosity, strong visual system, clear Sign In CTA
  Drop-off risk: brand/domain mismatch and unclear create-vs-discovery framing
  Missing piece: sharper “what happens after I click”
  Next action obvious: mostly yes

- Login -> Create
  Motivation: dashboard CTA and category grid
  Drop-off risk: blocked-by-overlay onboarding and stats with no earned context
  Missing piece: stronger post-login guidance toward one best first room
  Next action obvious: yes

- Create -> Share
  Motivation: category-specific setup copy
  Drop-off risk: route search uncertainty, form confidence, unclear post-submit handoff
  Missing piece: deterministic success state with share-first momentum
  Next action obvious: no

- Share -> Join
  Motivation: conceptually strong, but not observed
  Drop-off risk: not enough evidence
  Missing piece: not enough evidence
  Next action obvious: not verified

- Join -> Predict
  Motivation: not verified
  Drop-off risk: not verified
  Missing piece: not verified
  Next action obvious: not verified

- Predict -> Live
  Motivation: not verified
  Drop-off risk: not verified
  Missing piece: not verified
  Next action obvious: not verified

- Live -> Resolve
  Motivation: not verified
  Drop-off risk: not verified
  Missing piece: not verified
  Next action obvious: not verified

- Resolve -> The Tea
  Motivation: this should be the product’s emotional engine
  Drop-off risk: creator confidence may already be gone by this point
  Missing piece: verified production proof that the reveal is worth the work
  Next action obvious: not verified

- The Tea -> Rematch
  Motivation: should be a social afterglow and future challenge hook
  Drop-off risk: if reveal is weak or never reached, rematch never matters
  Missing piece: verified production evidence
  Next action obvious: not verified

## 9. Founder diagnosis

The product does not mainly feel “not right” because it lacks features. It feels “not right” because functional completeness is ahead of emotional and social completeness.

- Functional completeness: partial. The app has real structure, categories, privacy choices, account flow, and live endpoints.
- Emotional completeness: weak. I could understand the product idea, but I could not consistently feel momentum building toward a satisfying reveal.
- Social completeness: weak. The crucial share-and-join handoff was not confidently reached.
- Repeat-use completeness: weak. Aura and category breadth are present, but the app has not yet proven a ritual that naturally earns another round.

Likely root cause: the product has been designed as if the loop is already trusted, but the current live experience still asks the user to believe in the payoff before the product has earned that belief. The founder feeling that something is off likely comes from this exact gap: the product is conceptually complete, but not yet ceremonially complete.

## 10. Prioritised recommendations

#### Ship now

- Make post-create routing deterministic: every successful room creation must land on a room detail/share state with one obvious CTA.
- Fix canonical-domain trust by removing visible `predikt-alpha` exposure from the public production journey.
- Repair or gracefully fail Travel ETA place search with explicit no-results, retry, and manual fallback behavior.
- Standardize `Predikt` vs `Prediktion` naming across all user-visible surfaces.
- Reduce first-session dashboard clutter by removing or demoting side promotions during onboarding.

#### Test in the next friend session

- Test a single “best first room” onboarding path and measure create-to-share completion rate.
- Test whether a dedicated post-create share card increases invite sends per creator.
- Test whether a shorter anonymous landing page with only `Create` and `Join` improves first-click clarity.
- Test whether an earned Aura explainer after first result increases second-room creation.
- Test whether removing secondary panels raises successful room creation among first-time users.

#### Defer

- Expanding creator/community promo modules on the landing/dashboard
- Additional categories beyond the current strongest four
- Deeper gamification systems before The Tea is proven
- Broader discovery/public feed ambitions
- Any acquisition push centered on “featured creators”

## 11. Friend-test script

- Setup: Recruit 6 to 10 users who know each other in real life. Give one person creator credentials and let the rest join only as invited participants.
- Tasks: Ask one user to create a room, share it naturally, let others join and predict, then observe whether anyone shares the result without prompting.
- What not to explain: Do not define Aura, The Tea, or Ghost Mode unless users ask directly.
- Questions afterwards: What did you think this app was for? What moment felt most fun? What felt like work? Would you start another room tonight?
- Behaviour to observe: Does anyone hesitate at creation? Does anyone ask whether this is betting? Does anyone struggle to know what to do after the room is created?
- Success signals: Someone shares a result screenshot, someone invites another friend unprompted, someone starts a second room, and people keep talking after the result lands.
- Failure signals: Creator cannot confidently share the room, guests need explanation to join, or nobody cares enough to run it back.

## 12. Final recommendation

Fix a small polish batch, then test.

The live product already has enough structure and personality to justify another friend-group test, but not enough reliability or payoff proof for broader acquisition. The right move is not a full redesign yet. It is a tight batch focused on one trustworthy room-creation path, one clean share handoff, one canonical brand/domain experience, and one clearly rewarding result flow. If those pieces click, you will learn much more from the next session than from adding more features now.
