export type SparkCategory =
  | 'mind'
  | 'body'
  | 'hydration'
  | 'posture'
  | 'vocabulary'
  | 'kindness'
  | 'productivity'
  | 'creativity'
  | 'gratitude'
  | 'fun_facts'
  | 'breathing'
  | 'tiny_habits';

export type SparkTemplate = {
  key: string;
  category: SparkCategory;
  icon: string;
  prompt: string;
  followUp: string;
};

export type SparkVoteChoice = {
  key: string;
  icon: string;
  label: string;
};

export const SPARK_VOTE_CHOICES: SparkVoteChoice[] = [
  { key: 'hydration', icon: '💧', label: 'Hydration' },
  { key: 'word', icon: '📖', label: 'Word' },
  { key: 'brain', icon: '🧠', label: 'Brain' },
  { key: 'move', icon: '🚶', label: 'Move' },
  { key: 'kindness', icon: '😊', label: 'Kindness' },
];

export const DAILY_SPARK_TEMPLATES: SparkTemplate[] = [
  { key: 'mind-01', category: 'mind', icon: '🧠', prompt: 'Name one thing going right.', followUp: 'Momentum likes attention.' },
  { key: 'mind-02', category: 'mind', icon: '🧠', prompt: 'Pause before the next tab.', followUp: 'Let your brain land first.' },
  { key: 'mind-03', category: 'mind', icon: '🧠', prompt: 'Pick one clear intention.', followUp: 'Vague plans hate daylight.' },
  { key: 'mind-04', category: 'mind', icon: '🧠', prompt: 'Notice one helpful thought.', followUp: 'Keep that one around.' },
  { key: 'mind-05', category: 'mind', icon: '🧠', prompt: 'Give one worry a smaller job.', followUp: 'It does not need a promotion.' },
  { key: 'mind-06', category: 'mind', icon: '🧠', prompt: 'Choose calm over dramatic.', followUp: 'Your future self approves.' },
  { key: 'mind-07', category: 'mind', icon: '🧠', prompt: 'Think in one next step.', followUp: 'That is usually enough.' },
  { key: 'mind-08', category: 'mind', icon: '🧠', prompt: 'Let one thought pass through.', followUp: 'Not every guest stays.' },
  { key: 'body-01', category: 'body', icon: '🧍', prompt: 'Unclench your jaw.', followUp: 'We are not fighting the inbox.' },
  { key: 'body-02', category: 'body', icon: '🧍', prompt: 'Roll your shoulders once.', followUp: 'Your posture deserves better PR.' },
  { key: 'body-03', category: 'body', icon: '🧍', prompt: 'Stand up for ten seconds.', followUp: 'Tiny resets count.' },
  { key: 'body-04', category: 'body', icon: '🧍', prompt: 'Stretch your neck gently.', followUp: 'Screens are persistent. Be smarter.' },
  { key: 'body-05', category: 'body', icon: '🧍', prompt: 'Relax your hands.', followUp: 'You are allowed to soften.' },
  { key: 'body-06', category: 'body', icon: '🧍', prompt: 'Shift your weight and breathe.', followUp: 'A small reboot works wonders.' },
  { key: 'body-07', category: 'body', icon: '🧍', prompt: 'Take one full-body stretch.', followUp: 'Elegant and free.' },
  { key: 'body-08', category: 'body', icon: '🧍', prompt: 'Drop your shoulders slightly.', followUp: 'Tension was being theatrical.' },
  { key: 'hydration-01', category: 'hydration', icon: '💧', prompt: 'Refill your water soon.', followUp: 'Your battery is not the only one.' },
  { key: 'hydration-02', category: 'hydration', icon: '💧', prompt: 'Take three sips now.', followUp: 'Look at you, thriving quietly.' },
  { key: 'hydration-03', category: 'hydration', icon: '💧', prompt: 'Water first, chaos second.', followUp: 'Strong sequencing.' },
  { key: 'hydration-04', category: 'hydration', icon: '💧', prompt: 'Check your water bottle.', followUp: 'It misses your attention.' },
  { key: 'hydration-05', category: 'hydration', icon: '💧', prompt: 'One glass before the scroll.', followUp: 'A respectable trade.' },
  { key: 'hydration-06', category: 'hydration', icon: '💧', prompt: 'Sip like you mean it.', followUp: 'Low drama. High value.' },
  { key: 'hydration-07', category: 'hydration', icon: '💧', prompt: 'Hydration check.', followUp: 'Future You sends polite pressure.' },
  { key: 'hydration-08', category: 'hydration', icon: '💧', prompt: 'Water is still underrated.', followUp: 'A classic for a reason.' },
  { key: 'posture-01', category: 'posture', icon: '🪑', prompt: 'Sit a little taller.', followUp: 'Confidence loves geometry.' },
  { key: 'posture-02', category: 'posture', icon: '🪑', prompt: 'Straighten your back gently.', followUp: 'No need to announce it.' },
  { key: 'posture-03', category: 'posture', icon: '🪑', prompt: 'Lift your chest slightly.', followUp: 'That looks more like it.' },
  { key: 'posture-04', category: 'posture', icon: '🪑', prompt: 'Feet flat for a moment.', followUp: 'Stability is having a day.' },
  { key: 'posture-05', category: 'posture', icon: '🪑', prompt: 'Adjust your seat.', followUp: 'You deserve better alignment.' },
  { key: 'posture-06', category: 'posture', icon: '🪑', prompt: 'Reset your posture once.', followUp: 'Small correction. Big energy.' },
  { key: 'posture-07', category: 'posture', icon: '🪑', prompt: 'Shoulders back, just enough.', followUp: 'Heroic without the speech.' },
  { key: 'posture-08', category: 'posture', icon: '🪑', prompt: 'Untwist from the screen.', followUp: 'Your spine noticed.' },
  { key: 'vocabulary-01', category: 'vocabulary', icon: '📖', prompt: "Today's word: momentum.", followUp: 'Use it once today.' },
  { key: 'vocabulary-02', category: 'vocabulary', icon: '📖', prompt: "Today's word: precise.", followUp: 'Let it improve one sentence.' },
  { key: 'vocabulary-03', category: 'vocabulary', icon: '📖', prompt: "Today's word: steady.", followUp: 'A strong little word.' },
  { key: 'vocabulary-04', category: 'vocabulary', icon: '📖', prompt: "Today's word: curious.", followUp: 'Keep it nearby.' },
  { key: 'vocabulary-05', category: 'vocabulary', icon: '📖', prompt: "Today's word: vivid.", followUp: 'Borrow it if needed.' },
  { key: 'vocabulary-06', category: 'vocabulary', icon: '📖', prompt: "Today's word: patient.", followUp: 'Underrated in many meetings.' },
  { key: 'vocabulary-07', category: 'vocabulary', icon: '📖', prompt: 'Learn one new word.', followUp: 'Your future captions improve instantly.' },
  { key: 'vocabulary-08', category: 'vocabulary', icon: '📖', prompt: 'Swap one vague word.', followUp: 'Precision looks expensive.' },
  { key: 'kindness-01', category: 'kindness', icon: '😊', prompt: 'Message someone you miss.', followUp: 'Very efficient kindness.' },
  { key: 'kindness-02', category: 'kindness', icon: '😊', prompt: 'Send one sincere thank-you.', followUp: 'Short texts can still matter.' },
  { key: 'kindness-03', category: 'kindness', icon: '😊', prompt: 'Compliment something specific.', followUp: 'Details make it real.' },
  { key: 'kindness-04', category: 'kindness', icon: '😊', prompt: 'Check in on one person.', followUp: 'Low effort. High human value.' },
  { key: 'kindness-05', category: 'kindness', icon: '😊', prompt: 'Smile at someone today.', followUp: 'No big campaign required.' },
  { key: 'kindness-06', category: 'kindness', icon: '😊', prompt: 'Reply with a little warmth.', followUp: 'The internet can handle it.' },
  { key: 'kindness-07', category: 'kindness', icon: '😊', prompt: 'Give one person credit.', followUp: 'Generous and strategic.' },
  { key: 'kindness-08', category: 'kindness', icon: '😊', prompt: 'Send the encouraging text.', followUp: 'You know the one.' },
  { key: 'productivity-01', category: 'productivity', icon: '⚡', prompt: 'Clear one tiny task first.', followUp: 'Momentum enjoys a warm-up.' },
  { key: 'productivity-02', category: 'productivity', icon: '⚡', prompt: 'Rename one messy file.', followUp: 'Civilization advances.' },
  { key: 'productivity-03', category: 'productivity', icon: '⚡', prompt: 'Close one useless tab.', followUp: 'Bravery takes many forms.' },
  { key: 'productivity-04', category: 'productivity', icon: '⚡', prompt: 'Write the first sentence.', followUp: 'The rest negotiates later.' },
  { key: 'productivity-05', category: 'productivity', icon: '⚡', prompt: 'Pick one top priority.', followUp: 'Everything else can line up.' },
  { key: 'productivity-06', category: 'productivity', icon: '⚡', prompt: 'Set a ten-minute timer.', followUp: 'Tiny structure, solid results.' },
  { key: 'productivity-07', category: 'productivity', icon: '⚡', prompt: 'Delete one old reminder.', followUp: 'Your list deserved honesty.' },
  { key: 'productivity-08', category: 'productivity', icon: '⚡', prompt: 'Finish one almost-done thing.', followUp: 'Closure looks good on you.' },
  { key: 'creativity-01', category: 'creativity', icon: '🎨', prompt: 'Capture one random idea.', followUp: 'Messy notes still count.' },
  { key: 'creativity-02', category: 'creativity', icon: '🎨', prompt: 'Photograph something textured.', followUp: 'Your eye has range.' },
  { key: 'creativity-03', category: 'creativity', icon: '🎨', prompt: 'Change one small detail.', followUp: 'Sometimes that is the whole trick.' },
  { key: 'creativity-04', category: 'creativity', icon: '🎨', prompt: 'Try a new phrase today.', followUp: 'Language likes experimentation.' },
  { key: 'creativity-05', category: 'creativity', icon: '🎨', prompt: 'Sketch an idea in words.', followUp: 'Perfection can wait outside.' },
  { key: 'creativity-06', category: 'creativity', icon: '🎨', prompt: 'Make one boring thing prettier.', followUp: 'Taste is a habit.' },
  { key: 'creativity-07', category: 'creativity', icon: '🎨', prompt: 'Save one idea for later.', followUp: 'Good instincts deserve storage.' },
  { key: 'creativity-08', category: 'creativity', icon: '🎨', prompt: 'Notice one color combination.', followUp: 'Design brain: awake.' },
  { key: 'gratitude-01', category: 'gratitude', icon: '🌱', prompt: 'Name one thing you appreciate.', followUp: 'Quiet abundance still counts.' },
  { key: 'gratitude-02', category: 'gratitude', icon: '🌱', prompt: 'Thank your past self once.', followUp: 'They tried, honestly.' },
  { key: 'gratitude-03', category: 'gratitude', icon: '🌱', prompt: 'Notice one small convenience.', followUp: 'Modern life got one right.' },
  { key: 'gratitude-04', category: 'gratitude', icon: '🌱', prompt: 'Pick one good part of today.', followUp: 'No grand speech required.' },
  { key: 'gratitude-05', category: 'gratitude', icon: '🌱', prompt: 'Appreciate one ordinary thing.', followUp: 'Consistency is quietly luxurious.' },
  { key: 'gratitude-06', category: 'gratitude', icon: '🌱', prompt: 'Find one useful win.', followUp: 'Tiny gratitude still lands.' },
  { key: 'gratitude-07', category: 'gratitude', icon: '🌱', prompt: 'Notice what is working.', followUp: 'A bold move, frankly.' },
  { key: 'gratitude-08', category: 'gratitude', icon: '🌱', prompt: 'Pause for one good thing.', followUp: 'That counts as progress too.' },
  { key: 'fun-01', category: 'fun_facts', icon: '✨', prompt: 'Octopuses have three hearts.', followUp: 'Overachievers, truly.' },
  { key: 'fun-02', category: 'fun_facts', icon: '✨', prompt: 'Bananas are berries.', followUp: 'Language remains chaotic.' },
  { key: 'fun-03', category: 'fun_facts', icon: '✨', prompt: 'Honey never really spoils.', followUp: 'A stunning flex from bees.' },
  { key: 'fun-04', category: 'fun_facts', icon: '✨', prompt: 'Sharks existed before trees.', followUp: 'Take a moment with that.' },
  { key: 'fun-05', category: 'fun_facts', icon: '✨', prompt: 'Your nose warms incoming air.', followUp: 'Quiet engineering.' },
  { key: 'fun-06', category: 'fun_facts', icon: '✨', prompt: 'Some turtles breathe through more than noses.', followUp: 'Nature keeps freelancing.' },
  { key: 'fun-07', category: 'fun_facts', icon: '✨', prompt: 'A day on Venus outlasts its year.', followUp: 'Scheduling nightmare.' },
  { key: 'fun-08', category: 'fun_facts', icon: '✨', prompt: 'Sea otters hold hands while sleeping.', followUp: 'Adorable and practical.' },
  { key: 'breathing-01', category: 'breathing', icon: '🍃', prompt: 'Take three slow breaths.', followUp: 'No applause needed.' },
  { key: 'breathing-02', category: 'breathing', icon: '🍃', prompt: 'Exhale longer than you inhale.', followUp: 'Subtle, solid reset.' },
  { key: 'breathing-03', category: 'breathing', icon: '🍃', prompt: 'Pause for ten calm breaths.', followUp: 'Drama just lost screen time.' },
  { key: 'breathing-04', category: 'breathing', icon: '🍃', prompt: 'Breathe into your shoulders.', followUp: 'Yes, they noticed.' },
  { key: 'breathing-05', category: 'breathing', icon: '🍃', prompt: 'One deep breath before replying.', followUp: 'That message deserves the upgrade.' },
  { key: 'breathing-06', category: 'breathing', icon: '🍃', prompt: 'Reset with one long exhale.', followUp: 'Very efficient recovery.' },
  { key: 'breathing-07', category: 'breathing', icon: '🍃', prompt: 'Breathe like you remembered yourself.', followUp: 'Excellent timing.' },
  { key: 'breathing-08', category: 'breathing', icon: '🍃', prompt: 'Try a slower inhale.', followUp: 'There it is.' },
  { key: 'habit-01', category: 'tiny_habits', icon: '🌟', prompt: 'Make your bed a little.', followUp: 'Perfection is not invited.' },
  { key: 'habit-02', category: 'tiny_habits', icon: '🌟', prompt: 'Put one thing away.', followUp: 'A quiet victory.' },
  { key: 'habit-03', category: 'tiny_habits', icon: '🌟', prompt: 'Wipe one small surface.', followUp: 'Look at this refined chaos.' },
  { key: 'habit-04', category: 'tiny_habits', icon: '🌟', prompt: 'Prepare tomorrow slightly.', followUp: 'Tiny foresight, huge charisma.' },
  { key: 'habit-05', category: 'tiny_habits', icon: '🌟', prompt: 'Charge one neglected device.', followUp: 'A practical love language.' },
  { key: 'habit-06', category: 'tiny_habits', icon: '🌟', prompt: 'Open the window briefly.', followUp: 'New air, new reputation.' },
  { key: 'habit-07', category: 'tiny_habits', icon: '🌟', prompt: 'Take the stairs once.', followUp: 'Small wins absolutely count.' },
  { key: 'habit-08', category: 'tiny_habits', icon: '🌟', prompt: 'Stretch while the coffee cools.', followUp: 'Excellent use of waiting.' },
  { key: 'mind-09', category: 'mind', icon: '🧠', prompt: 'Trade rushing for rhythm.', followUp: 'The day can survive it.' },
  { key: 'hydration-09', category: 'hydration', icon: '💧', prompt: 'Put water within reach.', followUp: 'Convenience is a strategy.' },
  { key: 'kindness-09', category: 'kindness', icon: '😊', prompt: 'Say the nice thing out loud.', followUp: 'Audacity, but wholesome.' },
  { key: 'productivity-09', category: 'productivity', icon: '⚡', prompt: 'Start before you feel ready.', followUp: 'A classic professional move.' },
];
