import { CommentaryInput, CommentaryPersonality } from './commentary.types';

const PERSONALITY_TEMPLATES: Record<
  CommentaryPersonality,
  { headline: (input: CommentaryInput) => string; punchline: (input: CommentaryInput) => string; supportingLine: (input: CommentaryInput) => string }
> = {
  Oracle: {
    headline: (input) => `Oracle Bot did the math. ${input.winnerHandle ?? 'The room'} did it sharper.`,
    punchline: (input) =>
      `${input.winnerHandle ?? 'The closest guess'} beat the benchmark. Oracle Bot is requesting a recount.`,
    supportingLine: (input) =>
      `The math was close. The instinct was closer.${input.badgeLabel ? ` ${input.badgeLabel} unlocked.` : ''}`,
  },
  Chaos: {
    headline: () => 'A simple prediction. An unnecessarily dramatic result.',
    punchline: (input) =>
      input.oracleBotLabel
        ? `Oracle Bot brought spreadsheets. ${input.winnerHandle ?? 'The winner'} brought instinct.`
        : `${input.winnerHandle ?? 'The winner'} called it and the group chat has not recovered.`,
    supportingLine: (input) =>
      `The result showed up fashionably late to its own reveal.${input.comebackEligible ? ' A comeback is basically inevitable now.' : ''}`,
  },
  'Best Friend': {
    headline: () => 'I never doubted you. Out loud, anyway.',
    punchline: (input) =>
      `${input.winnerHandle ?? 'You'} trusted a hunch harder than most people trust GPS.`,
    supportingLine: (input) =>
      input.biggestNearMissLabel
        ? `Even the near miss (${input.biggestNearMissLabel}) deserves a hug.`
        : 'Nobody lost. Some people just won louder.',
  },
  'Gen Z': {
    headline: () => 'Not to be dramatic, but this was iconic behavior.',
    punchline: (input) =>
      `${input.winnerHandle ?? 'That guess'} really said "trust me" and then was correct. Rude.`,
    supportingLine: () => 'The rematch button is right there, making direct eye contact.',
  },
  'Indian Mom': {
    headline: () => 'I told you to leave earlier',
    punchline: () => "See? Ten minutes early never hurt anyone. Now it's a whole story.",
    supportingLine: (input) =>
      `${input.winnerHandle ?? 'The closest guess'} was closest. Everyone else, drink water and try again.`,
  },
  'Corporate Manager': {
    headline: () => 'Quick sync on why the winner had the sharper read.',
    punchline: () => 'Great energy from everyone. Measurable results from exactly one person.',
    supportingLine: () => "Let's take the learnings offline. The win is going in the deck.",
  },
  'Traffic Cop': {
    headline: () => 'The route had three plot twists and a monologue.',
    punchline: () => 'The ETA took the scenic route and still had people acting confident.',
    supportingLine: (input) =>
      input.differenceLabel
        ? `Winning margin: ${input.differenceLabel}. The rest is paperwork.`
        : 'Everyone gave a statement. Exactly one was accurate.',
  },
  'Bangalore Guru': {
    headline: () => 'Outer Ring Road never forgets',
    punchline: () => 'Traffic had opinions and the room had receipts.',
    supportingLine: (input) =>
      `${input.badgeLabel ? `${input.badgeLabel} unlocked. ` : ''}Silk Board decides who's humble today.`,
  },
};

export function renderTemplate(personality: CommentaryPersonality | string, input: CommentaryInput) {
  const resolved = personality as CommentaryPersonality;
  const template = PERSONALITY_TEMPLATES[resolved];
  if (!template) {
    return {
      headline: 'Somebody was right and will not stop mentioning it.',
      punchline: 'Closest guess wins. The rest of us are "building character."',
      supportingLine: 'No money, no drama — just bragging rights and gentle gloating.',
    };
  }

  return {
    headline: template.headline(input),
    punchline: template.punchline(input),
    supportingLine: template.supportingLine(input),
  };
}
