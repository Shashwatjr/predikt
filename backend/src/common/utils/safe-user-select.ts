export const SAFE_PUBLIC_USER_SELECT = {
  userId: true,
  name: true,
  prediktHandle: true,
  profileImage: true,
  avatarKey: true,
  totalAura: true,
  weeklyAura: true,
  cloutBalance: true,
  creditBalance: true,
  winsCount: true,
  userFlexes: {
    include: {
      flex: true,
    },
  },
  creatorProfile: {
    select: {
      displayName: true,
      handle: true,
      creatorCategory: true,
      verificationStatus: true,
    },
  },
} as const;

export const SAFE_SELF_USER_SELECT = {
  userId: true,
  name: true,
  email: true,
  isGuest: true,
  prediktHandle: true,
  profileImage: true,
  avatarKey: true,
  selectedBackgroundKey: true,
  totalAura: true,
  weeklyAura: true,
  cloutBalance: true,
  creditBalance: true,
  lifetimeCloutEarned: true,
  predictionAccuracyScore: true,
  roomsCreatedCount: true,
  predictionsMadeCount: true,
  winsCount: true,
  currentStreak: true,
  longestStreak: true,
  termsAcceptedAt: true,
  privacyAcceptedAt: true,
  marketingOptIn: true,
  aiPersonalisationOptOut: true,
  commentaryEnabled: true,
  aiCommentaryOptOut: true,
  preferredCommentaryPersonality: true,
  commentaryToneLevel: true,
  locationConsentStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function publicDisplayName(user: any) {
  if (!user) return null;
  if (user.prediktHandle) return `@${user.prediktHandle}`;
  return user.creatorProfile?.displayName ?? user.name ?? 'PREDIKT user';
}

export function safePublicUser(user: any): any {
  if (!user) return null;
  return {
    // Privacy boundary: public and participant payloads keep identity lightweight and
    // intentionally exclude private contact data such as email and phone.
    userId: user.userId,
    name: publicDisplayName(user),
    prediktHandle: user.prediktHandle ?? null,
    avatarKey: user.avatarKey ?? user.profileImage ?? null,
    totalAura: user.totalAura ?? 0,
    weeklyAura: user.weeklyAura ?? 0,
    cloutBalance: user.cloutBalance ?? 0,
    creditBalance: user.creditBalance ?? 0,
    winsCount: user.winsCount ?? 0,
    badges: (user.userFlexes ?? []).map((entry: any) => entry.flex?.flexName).filter(Boolean),
    creator: user.creatorProfile
      ? {
          displayName: user.creatorProfile.displayName ?? publicDisplayName(user),
          handle: user.creatorProfile.handle ?? user.prediktHandle ?? null,
          category: user.creatorProfile.creatorCategory ?? null,
          verificationStatus: user.creatorProfile.verificationStatus ?? null,
        }
      : null,
  };
}

export function safeSelfUser(user: any): any {
  if (!user) return null;
  return {
    userId: user.userId,
    name: user.name,
    email: user.email ?? null,
    isGuest: user.isGuest ?? false,
    prediktHandle: user.prediktHandle ?? null,
    avatarKey: user.avatarKey ?? user.profileImage ?? null,
    selectedBackgroundKey: user.selectedBackgroundKey ?? null,
    totalAura: user.totalAura ?? 0,
    weeklyAura: user.weeklyAura ?? 0,
    cloutBalance: user.cloutBalance ?? 0,
    creditBalance: user.creditBalance ?? 0,
    lifetimeCloutEarned: user.lifetimeCloutEarned ?? 0,
    predictionAccuracyScore: user.predictionAccuracyScore ?? 0,
    roomsCreatedCount: user.roomsCreatedCount ?? 0,
    predictionsMadeCount: user.predictionsMadeCount ?? 0,
    winsCount: user.winsCount ?? 0,
    currentStreak: user.currentStreak ?? 0,
    longestStreak: user.longestStreak ?? 0,
    termsAcceptedAt: user.termsAcceptedAt ?? null,
    privacyAcceptedAt: user.privacyAcceptedAt ?? null,
    marketingOptIn: user.marketingOptIn ?? false,
    aiPersonalisationOptOut: user.aiPersonalisationOptOut ?? false,
    commentaryEnabled: user.commentaryEnabled ?? true,
    aiCommentaryOptOut: user.aiCommentaryOptOut ?? false,
    preferredCommentaryPersonality: user.preferredCommentaryPersonality ?? null,
    commentaryToneLevel: user.commentaryToneLevel ?? 'playful',
    locationConsentStatus: user.locationConsentStatus ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
