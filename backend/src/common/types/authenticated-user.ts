export interface AuthenticatedUser {
  userId: string;
  name: string;
  email?: string | null;
  prediktHandle?: string | null;
  avatarKey?: string | null;
  selectedBackgroundKey?: string | null;
  totalAura: number;
  weeklyAura: number;
  rewardAccount?: {
    auraBalance: number;
    rizzBalance: number;
    gemBalance: number;
    lifetimeAura: number;
    lifetimeRizz: number;
    lifetimeGems: number;
  } | null;
  predictionAccuracyScore: number;
  roomsCreatedCount: number;
  predictionsMadeCount: number;
  winsCount: number;
  currentStreak: number;
  longestStreak: number;
  marketingOptIn: boolean;
  aiPersonalisationOptOut: boolean;
  locationConsentStatus?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
