import { DAILY_SPARK_TEMPLATES, SPARK_VOTE_CHOICES, SparkTemplate } from '../data/dailySparkTemplates';

export type SparkRotationResult =
  | { mode: 'template'; template: SparkTemplate }
  | { mode: 'vote'; template: SparkTemplate; choices: typeof SPARK_VOTE_CHOICES };

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function hashSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getSparkForDate(date = new Date()): SparkRotationResult {
  const key = dayKey(date);
  const seed = hashSeed(key);
  const template = DAILY_SPARK_TEMPLATES[seed % DAILY_SPARK_TEMPLATES.length];
  const voteDay = seed % 10 === 0;

  if (voteDay) {
    return {
      mode: 'vote',
      template,
      choices: SPARK_VOTE_CHOICES,
    };
  }

  return {
    mode: 'template',
    template,
  };
}

export function getSparkDateKey(date = new Date()) {
  return dayKey(date);
}
