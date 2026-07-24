# My Prediktion UX Diagnosis

## 1. UX verdict

UX score: `4.8/10` before fixes.
The product is understandable only after login, not in the first anonymous viewport.
It has playful ingredients, but the first-use path spends too much energy on structure before payoff.
Sharing does not feel natural enough because post-create confidence is weak.
Guest participation is conceptually good, but the handoff needs stronger creator momentum.
The Tea has the right ingredients, but the screen hierarchy was underselling the winner.
A new user might create one room out of curiosity, but was not being cleanly pulled into another.
Strongest moment: category-driven room creation once the product idea clicks.
Weakest moment: the creator handoff after room creation.
Root cause: functional completeness is ahead of emotional and social completeness.

## 2. Emotion timeline

| Stage       | Emotion            | Energy /10 | Thinking required /5 | What caused it |
| ----------- | ------------------ | ---------: | -------------------: | -------------- |
| Landing     | Curious, hesitant  |          5 |                    4 | Strong visuals, but unclear first action and mixed branding |
| Login       | Willing            |          6 |                    2 | Clean auth UI, low friction |
| Dashboard   | Interested, split  |          5 |                    4 | Too many competing ideas, onboarding overlay blocked momentum |
| Create      | Hopeful, cautious  |          6 |                    4 | Good categories, but travel search recovery was weak |
| Share       | Uncertain          |          3 |                    4 | Success state was not forceful enough about what to do next |
| Guest Join  | Promising          |          6 |                    2 | Guest value is good when the invite is obvious |
| Live        | Anticipatory       |          6 |                    3 | Loop is conceptually clear once inside |
| The Tea     | Amused, underfed   |          5 |                    2 | Commentary worked, but winner hierarchy needed more emphasis |
| Run It Back | Fuzzy              |          4 |                    3 | CTA meaning was too immediate and not future-facing enough |

## 3. Delight moments

- The category system makes the product feel real instead of gimmicky.
- Aura is a compact mechanic line once attached to a specific result.
- The Tea commentary has screenshot potential when paired with a clear winner.
- Top three signature-moment potential:
- Creator sees a room go live and copies the invite in one tap.
- Guest lands straight into a playful room and predicts without signup.
- The Tea reveals the winner first, then lands the punchline.

## 4. Dead moments

- Landing:
The user wanted to know what this is and what to do first.
Momentum dropped because the page looked like a network before it proved the create-or-join loop.
Risk: medium abandonment from confusion and trust drag.

- Travel search:
The user wanted quick place suggestions.
Momentum dropped because search could feel indefinite without recovery.
Risk: high abandonment on a flagship room type.

- Post-create:
The user wanted certainty and a share action.
Momentum dropped because success did not push hard enough into inviting friends.
Risk: high abandonment before the social loop starts.

## 5. Almost-quit moments

> I almost closed the app because the landing page still made me work to understand whether this was a social game or a lobby network.

> I almost closed the create flow because travel search did not feel trustworthy when suggestions stalled.

> I almost gave up on the creator loop because the room-success state did not feel urgent enough about sharing next.

## 6. Social energy

- I wanted to involve another person most at room creation and result reveal.
- Sharing felt possible, but not yet naturally dominant.
- The guest can feel like a participant if the creator reaches a confident share state.
- The live stage can create anticipation, but the handoff has to get there first.
- The result creates more conversation once the winner is visually prioritized.
- I would not reliably share The Tea unprompted before the hierarchy fix.

## 7. Memory test

- Most likely remembered:
- The app turns everyday moments into a game with friends.
- Aura is the score signal tied to being closest.
- The Tea is the branded result reveal.

- Strong memory potential:
- My Prediktion: yes, after the brand sweep.
- Commentary personality: medium.
- Aura: medium-high.
- The Tea: high.
- Ghost Mode: medium.
- Run It Back: medium after clarification.

## 8. Root-cause diagnosis

Main problem classification:
- first-use clarity
- weak share transition
- visual hierarchy
- technical reliability

Completeness diagnosis:
- Functional completeness: partial
- Emotional completeness: weak
- Social completeness: weak-to-partial
- Repeat-use completeness: partial

## 9. Fix candidates

| ID | UX problem | Evidence | User impact | Proposed fix | Confidence | Effort |
| -- | ---------- | -------- | ----------- | ------------ | ---------- | ------ |
| UX-01 | Landing leads with style before clarity | First anonymous viewport needed explanation | Users hesitate or bounce early | Rewrite hero around create/share/predict/reveal and not-betting reassurance | High | S |
| UX-02 | Dashboard has no single first move | Hero, stats, onboarding and other modules compete | New users lose momentum after login | Make create the clear next step and suppress blocking onboarding | High | S |
| UX-03 | Post-create share handoff is too soft | Creator can still wonder what happens next | Social loop breaks before invite send | Add status, copy-feedback, and explicit next-step guidance | High | S |
| UX-04 | Travel search recovery is weak | Search can feel indefinite | Core room type feels unreliable | Add timeout, retry, and clearer no-results copy | High | S |
| UX-05 | The Tea hierarchy undersells the winner | Commentary appeared before the win moment | Result loses emotional payoff | Lead with winner, then commentary, then rematch guidance | High | S |
| UX-06 | Run It Back sounds immediate | Meaning of rematch is fuzzy | Repeat loop is unclear | Rephrase as scheduling the next round | High | XS |
