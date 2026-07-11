import { CommentaryInput, CommentaryPersonality } from './commentary.types';

const PERSONALITY_TEMPLATES: Record<
  CommentaryPersonality,
  { headline: (input: CommentaryInput) => string; punchline: (input: CommentaryInput) => string; supportingLine: (input: CommentaryInput) => string }
> = {
  Oracle: {
    headline: (input) => `Oracle Bot predicted ${input.oracleBotLabel ?? input.baselineLabel ?? 'the benchmark'}`,
    punchline: (input) => `${input.winnerHandle ?? 'Closest guess'} beat the benchmark with a ${input.differenceLabel ?? 'close'} finish.`,
    supportingLine: (input) => `Actual result: ${input.actualOutcomeLabel ?? 'recorded'}. ${input.badgeLabel ? `${input.badgeLabel} unlocked.` : ''}`.trim(),
  },
  Chaos: {
    headline: () => 'The room kept the drama alive',
    punchline: (input) =>
      input.oracleBotLabel
        ? `Oracle Bot brought spreadsheets. ${input.winnerHandle ?? 'The winner'} brought instinct.`
        : `${input.winnerHandle ?? 'The winner'} turned a normal moment into group-chat material.`,
    supportingLine: (input) => `${input.actualOutcomeLabel ?? 'The result'} arrived with extra spice. ${input.comebackEligible ? 'Comeback energy is officially live.' : ''}`.trim(),
  },
  'Best Friend': {
    headline: () => 'That was a very solid call',
    punchline: (input) => `${input.winnerHandle ?? 'You'} really trusted the read and it worked.`,
    supportingLine: (input) => `${input.biggestNearMissLabel ? `Even the near miss was close: ${input.biggestNearMissLabel}.` : 'The room stayed playful and fair.'}`,
  },
  'Gen Z': {
    headline: () => 'Low-key iconic',
    punchline: (input) => `${input.winnerHandle ?? 'That guess'} was kind of a flex, not gonna lie.`,
    supportingLine: () => 'Rematch energy is still extremely available.',
  },
  'Indian Mom': {
    headline: () => 'I told you to leave earlier',
    punchline: () => 'See? Timing matters, but at least this became a good story.',
    supportingLine: (input) => `${input.winnerHandle ?? 'Closest guess'} got it closest and nobody had to fight about it.`,
  },
  'Corporate Manager': {
    headline: () => 'Let’s circle back to the result',
    punchline: () => 'Strong execution from the winner, mixed learnings for the rest of the room.',
    supportingLine: (input) => `The closest guess still won the day${input.oracleBotLabel ? `, ahead of the ${input.oracleBotLabel} benchmark` : ''}.`,
  },
  'Traffic Cop': {
    headline: () => 'The route stayed unreasonably dramatic',
    punchline: () => 'The ETA took the scenic route and still had people acting confident.',
    supportingLine: (input) => `${input.differenceLabel ? `Winning margin: ${input.differenceLabel}.` : 'Everyone walked away with a story.'}`,
  },
  'Bangalore Guru': {
    headline: () => 'Outer Ring Road never forgets',
    punchline: () => 'Traffic had opinions and the room had receipts.',
    supportingLine: (input) => `${input.badgeLabel ? `${input.badgeLabel} energy detected.` : 'That was the kind of result that gets shared.'}`,
  },
};

export function renderTemplate(personality: CommentaryPersonality | string, input: CommentaryInput) {
  const resolved = personality as CommentaryPersonality;
  const template = PERSONALITY_TEMPLATES[resolved];
  if (!template) {
    return {
      headline: 'The room had a story',
      punchline: 'The closest guess still earned the moment.',
      supportingLine: 'The result stayed fair and playful.',
    };
  }

  return {
    headline: template.headline(input),
    punchline: template.punchline(input),
    supportingLine: template.supportingLine(input),
  };
}
