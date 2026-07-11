export type CommentaryPersonality =
  | 'Oracle'
  | 'Chaos'
  | 'Best Friend'
  | 'Gen Z'
  | 'Indian Mom'
  | 'Corporate Manager'
  | 'Traffic Cop'
  | 'Bangalore Guru';

export type CommentaryProvider = 'templates' | 'local' | 'openai' | 'auto';

export type CommentaryInput = {
  roomId: string;
  category: string;
  personality: CommentaryPersonality | string;
  resultType: string;
  roomTitle?: string | null;
  winnerHandle?: string | null;
  winnerPredictionLabel?: string | null;
  actualOutcomeLabel?: string | null;
  differenceLabel?: string | null;
  biggestNearMissLabel?: string | null;
  baselineLabel?: string | null;
  oracleBotLabel?: string | null;
  badgeLabel?: string | null;
  userBeatBot?: boolean | null;
  comebackEligible?: boolean | null;
  participantCount?: number | null;
  commentaryEnabled?: boolean | null;
  aiCommentaryOptOut?: boolean | null;
  safeMode?: boolean | null;
};

export type CommentaryResponse = {
  commentaryId?: string;
  roomId: string;
  personality: CommentaryPersonality | string;
  headline: string;
  punchline: string;
  supportingLine: string;
  safetyMode: 'deterministic' | 'neutral' | 'fallback';
  provider: CommentaryProvider;
  generatedAt: string;
  generationVersion: number;
  canRegenerate?: boolean;
  remainingRegenerations?: number;
};
