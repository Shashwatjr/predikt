export type CommentaryResponse = {
  commentaryId?: string;
  roomId: string;
  personality: string;
  headline: string;
  punchline: string;
  supportingLine: string;
  safetyMode: string;
  provider: string;
  generationVersion: number;
  generatedAt: string;
  canRegenerate?: boolean;
  remainingRegenerations?: number;
};

export type RoomBadge = {
  userBadgeId: string;
  userId: string;
  badgeKey: string;
  title: string;
  description: string;
  icon?: string | null;
  category?: string | null;
  awardedAt: string;
};

export type ResultPayload = {
  roomId: string;
  actualOutcome?: string | Date;
  actualOptionKey?: string | null;
  comebackPrompt?: string;
  rematchCta?: string;
  momentCard?: {
    titles?: string[];
    shareText?: string;
    badge?: string;
    subtitle?: string;
  };
  badges?: Array<{ userId: string; badgeKey: string; title: string }>;
  winner?: {
    userId: string;
    name?: string;
    totalRoomAura?: number;
    user?: { prediktHandle?: string | null; name?: string };
  };
  rankings?: any[];
  closureType?: string;
};
