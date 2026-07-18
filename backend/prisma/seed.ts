import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const LOCAL_DEFAULT_ADMIN_EMAIL = 'admin@predikt.local';
const LOCAL_DEFAULT_ADMIN_PASSWORD = 'Admin123!';

async function seedPlans() {
  const plans = [
    {
      planName: 'Free',
      planType: 'free',
      maxRoomsPerMonth: 5,
      maxParticipantsPerRoom: 25,
    },
    {
      planName: 'Creator Starter',
      planType: 'creator_starter',
      monthlyPriceInr: 499,
      yearlyPriceInr: 4990,
      maxRoomsPerMonth: 25,
      maxParticipantsPerRoom: 100,
    },
    {
      planName: 'Creator Pro',
      planType: 'creator_pro',
      monthlyPriceInr: 1499,
      yearlyPriceInr: 14990,
      maxRoomsPerMonth: 100,
      maxParticipantsPerRoom: 500,
      customBrandingAllowed: true,
      sponsoredRoomsAllowed: true,
      analyticsAllowed: true,
    },
    {
      planName: 'Creator Max',
      planType: 'creator_max',
      monthlyPriceInr: 3999,
      yearlyPriceInr: 39990,
      customBrandingAllowed: true,
      sponsoredRoomsAllowed: true,
      analyticsAllowed: true,
    },
    {
      planName: 'Brand Starter',
      planType: 'brand_starter',
      monthlyPriceInr: 9999,
      yearlyPriceInr: 99990,
      customBrandingAllowed: true,
      sponsoredRoomsAllowed: true,
      analyticsAllowed: true,
    },
    {
      planName: 'Brand Growth',
      planType: 'brand_growth',
      monthlyPriceInr: 24999,
      yearlyPriceInr: 249990,
      customBrandingAllowed: true,
      sponsoredRoomsAllowed: true,
      analyticsAllowed: true,
    },
    {
      planName: 'Enterprise/API',
      planType: 'enterprise',
      customBrandingAllowed: true,
      sponsoredRoomsAllowed: true,
      analyticsAllowed: true,
    },
  ] as const;

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { planId: `${plan.planType}` },
      update: plan,
      create: { planId: `${plan.planType}`, ...plan },
    });
  }
}

async function seedAdmin() {
  const adminEmail = resolveSeedAdminEmail();
  const adminPassword = resolveSeedAdminPassword();
  if (!adminEmail || !adminPassword) {
    return;
  }

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const roles = [
    { roleName: 'super_admin', description: 'Full platform access', permissions: { all: true } },
    {
      roleName: 'platform_ops',
      description: 'Operations access',
      permissions: {
        'admin.dashboard.read': true,
        'admin.analytics.read': true,
        'admin.rooms.read': true,
        'admin.rooms.review': true,
        'admin.users.read': true,
        'admin.users.review': true,
        'admin.system.health.read': true,
        'admin.system.flags.read': true,
        'admin.moderation.read': true,
      },
    },
    {
      roleName: 'campaign_manager',
      description: 'Campaign access',
      permissions: {},
    },
    {
      roleName: 'privacy_officer',
      description: 'Privacy access',
      permissions: {
        'admin.feedback.read': true,
        'admin.feedback.update': true,
        'admin.moderation.read': true,
        'admin.moderation.resolve': true,
        'admin.privacy.read': true,
        'admin.privacy.action': true,
        'admin.audit.read': true,
      },
    },
    {
      roleName: 'compliance_auditor',
      description: 'Compliance access',
      permissions: {
        'admin.audit.read': true,
        'admin.rooms.read': true,
        'admin.users.read': true,
        'admin.system.health.read': true,
        'admin.system.flags.read': true,
      },
    },
  ] as const;

  for (const role of roles) {
    await prisma.adminRole.upsert({
      where: { roleName: role.roleName },
      update: role,
      create: role,
    });
  }

  const superAdminRole = await prisma.adminRole.findUnique({
    where: { roleName: 'super_admin' },
  });

  if (!superAdminRole) return;

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { roleId: superAdminRole.roleId, passwordHash: adminHash },
    create: {
      name: 'PREDIKT Admin',
      email: adminEmail,
      passwordHash: adminHash,
      roleId: superAdminRole.roleId,
    },
  });

  console.log('admin seeded');
  console.log(`admin email: ${adminEmail}`);
  console.log(`environment: ${process.env.NODE_ENV ?? 'development'}`);
}

function resolveSeedAdminEmail() {
  const env = process.env.NODE_ENV ?? 'development';
  const explicitEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (explicitEmail) {
    return explicitEmail;
  }
  if (canUseLocalDefaultSeed(env)) {
    return LOCAL_DEFAULT_ADMIN_EMAIL;
  }
  if (isProductionLike(env)) {
    throw new Error('SEED_ADMIN_EMAIL is required outside explicit local development seeding');
  }
  return null;
}

function resolveSeedAdminPassword() {
  const env = process.env.NODE_ENV ?? 'development';
  const explicitPassword = process.env.SEED_ADMIN_PASSWORD;
  if (explicitPassword) {
    assertStrongSeedPassword(explicitPassword, env);
    return explicitPassword;
  }
  if (canUseLocalDefaultSeed(env)) {
    return LOCAL_DEFAULT_ADMIN_PASSWORD;
  }
  if (isProductionLike(env)) {
    throw new Error('SEED_ADMIN_PASSWORD is required outside explicit local development seeding');
  }
  return null;
}

function canUseLocalDefaultSeed(env: string) {
  return env === 'development' && process.env.ALLOW_LOCAL_DEFAULT_ADMIN_SEED === 'true';
}

function isProductionLike(env: string) {
  return env === 'production' || env === 'staging' || env === 'preview';
}

function assertStrongSeedPassword(password: string, env: string) {
  const strongEnough =
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  if (!strongEnough) {
    throw new Error(`SEED_ADMIN_PASSWORD must be strong for ${env} seeding`);
  }
  if (isProductionLike(env) && password === LOCAL_DEFAULT_ADMIN_PASSWORD) {
    throw new Error('Default local admin password is forbidden outside local development');
  }
}

async function main() {
  console.log('Seeding database...');

  const hash = await bcrypt.hash('Password123', 10);

  const [creator, viewer1, viewer2, viewer3] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'creator@predikt.test' },
      update: {
        name: 'Aarav Kapoor',
        prediktHandle: 'aarav.kapoor',
      },
      create: {
        name: 'Aarav Kapoor',
        email: 'creator@predikt.test',
        prediktHandle: 'aarav.kapoor',
        passwordHash: hash,
      },
    }),
    prisma.user.upsert({
      where: { email: 'viewer1@predikt.test' },
      update: {
        name: 'Anya Sen',
        prediktHandle: 'anya.sen',
      },
      create: {
        name: 'Anya Sen',
        email: 'viewer1@predikt.test',
        prediktHandle: 'anya.sen',
        passwordHash: hash,
      },
    }),
    prisma.user.upsert({
      where: { email: 'viewer2@predikt.test' },
      update: {
        name: 'Rohan Mehta',
        prediktHandle: 'rohan.mehta',
      },
      create: {
        name: 'Rohan Mehta',
        email: 'viewer2@predikt.test',
        prediktHandle: 'rohan.mehta',
        passwordHash: hash,
      },
    }),
    prisma.user.upsert({
      where: { email: 'viewer3@predikt.test' },
      update: {
        name: 'Priya Nair',
        prediktHandle: 'priya.nair',
      },
      create: {
        name: 'Priya Nair',
        email: 'viewer3@predikt.test',
        prediktHandle: 'priya.nair',
        passwordHash: hash,
      },
    }),
  ]);

  await prisma.creatorProfile.upsert({
    where: { userId: creator.userId },
    update: {
      displayName: 'Aarav Live',
      handle: 'aaravlive',
      instagramHandle: '@aaravlive',
      creatorCategory: 'travel',
      audienceSizeLabel: '10k-50k',
      subscriptionPlan: 'creator_starter',
    },
    create: {
      userId: creator.userId,
      displayName: 'Aarav Live',
      handle: 'aaravlive',
      instagramHandle: '@aaravlive',
      creatorCategory: 'travel',
      audienceSizeLabel: '10k-50k',
      subscriptionPlan: 'creator_starter',
    },
  });

  const sponsor = await prisma.sponsor.upsert({
    where: { sponsorId: 'sample-sponsor' },
    update: {
      sponsorName: 'Travel Partner',
      brandColor: '#0ea5e9',
    },
    create: {
      sponsorId: 'sample-sponsor',
      sponsorName: 'Travel Partner',
      brandColor: '#0ea5e9',
      websiteUrl: 'https://example.com',
      industry: 'travel',
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { campaignId: 'sample-campaign' },
    update: {},
    create: {
      campaignId: 'sample-campaign',
      sponsorId: sponsor.sponsorId,
      campaignName: 'Road Trip Challenge',
      campaignType: 'road_trip_challenge',
      creatorUserId: creator.userId,
      status: 'active',
      budgetLabel: 'Pilot',
    },
  });

  const closeTime = new Date(Date.now() + 30 * 60 * 1000);
  const room = await prisma.predictionRoom.upsert({
    where: { inviteCode: 'DEMO1' },
    update: {},
    create: {
      creatorUserId: creator.userId,
      roomTitle: 'Airport Dash',
      eventType: 'journey',
      predictionMode: 'milestone',
      roomCategory: 'travel',
      socialMode: 'instagram_live',
      creatorSocialPlatform: 'instagram',
      creatorSocialHandle: '@aaravlive',
      socialLiveUrl: 'https://instagram.com/live/demo',
      pinnedCommentText:
        'Join my PREDIKT room 🎯 Code: DEMO1. Predict my next milestone. Exact location is hidden for safety.',
      shareCardTitle: 'Airport Dash',
      shareCardSubtitle: 'Predict what’s next.',
      instagramStoryText: 'Predict my next milestone on PREDIKT. Code: DEMO1',
      facebookPostText: 'Join my live prediction room with code DEMO1',
      qrCodePayload: 'PREDIKT:DEMO1',
      resultShareText: 'Predict right. Build Aura. Earn Clout.',
      startingPointLabel: 'Koramangala',
      destinationLabel: 'Kempegowda Airport',
      predictionCloseTime: closeTime,
      inviteCode: 'DEMO1',
      status: 'predictions_open',
      visibility: 'invite_only',
      locationDisplayMode: 'approximate',
      safetyDelayMinutes: 10,
      movementAvatarType: 'flight',
      isSponsored: true,
      sponsorName: sponsor.sponsorName,
      sponsorBrandColor: sponsor.brandColor,
      sponsorTagline: 'Powered travel experiences',
      resultCardSponsorText: 'Powered by Travel Partner',
      milestones: {
        create: [
          {
            milestoneOrder: 1,
            milestoneName: 'Hebbal Flyover',
            locationLabel: 'Hebbal',
            predictionCloseTime: new Date(Date.now() + 20 * 60 * 1000),
            status: 'prediction_open',
            auraMultiplier: 1,
          },
          {
            milestoneOrder: 2,
            milestoneName: 'Airport Arrivals',
            locationLabel: 'Kempegowda Airport',
            predictionCloseTime: closeTime,
            milestoneType: 'final_destination',
            status: 'prediction_open',
            auraMultiplier: 1.25,
          },
        ],
      },
    },
    include: { milestones: true },
  });

  const [hebbal, airport] = room.milestones.sort((a, b) => a.milestoneOrder - b.milestoneOrder);

  await prisma.milestonePrediction.createMany({
    data: [
      {
        roomId: room.roomId,
        milestoneId: hebbal.milestoneId,
        userId: viewer1.userId,
        predictedReachedTime: new Date(Date.now() + 35 * 60 * 1000),
      },
      {
        roomId: room.roomId,
        milestoneId: airport.milestoneId,
        userId: viewer1.userId,
        predictedReachedTime: new Date(Date.now() + 60 * 60 * 1000),
      },
      {
        roomId: room.roomId,
        milestoneId: hebbal.milestoneId,
        userId: viewer2.userId,
        predictedReachedTime: new Date(Date.now() + 40 * 60 * 1000),
      },
      {
        roomId: room.roomId,
        milestoneId: airport.milestoneId,
        userId: viewer2.userId,
        predictedReachedTime: new Date(Date.now() + 65 * 60 * 1000),
      },
      {
        roomId: room.roomId,
        milestoneId: hebbal.milestoneId,
        userId: viewer3.userId,
        predictedReachedTime: new Date(Date.now() + 42 * 60 * 1000),
      },
      {
        roomId: room.roomId,
        milestoneId: airport.milestoneId,
        userId: viewer3.userId,
        predictedReachedTime: new Date(Date.now() + 58 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.follow.createMany({
    data: [
      { followerId: viewer1.userId, followingId: creator.userId },
      { followerId: viewer2.userId, followingId: creator.userId },
      { followerId: viewer1.userId, followingId: viewer2.userId },
      { followerId: viewer3.userId, followingId: viewer1.userId },
    ],
    skipDuplicates: true,
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        activityEventId: 'activity-room-created',
        userId: creator.userId,
        eventType: 'room_created',
        message: 'opened Airport Dash for live milestone predictions.',
      },
      {
        activityEventId: 'activity-prediction-viewer1',
        userId: viewer1.userId,
        eventType: 'prediction_submitted',
        message: 'submitted milestone predictions in Airport Dash.',
      },
      {
        activityEventId: 'activity-prediction-viewer2',
        userId: viewer2.userId,
        eventType: 'prediction_submitted',
        message: 'joined the race to call the airport ETA.',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.campaignMetric.upsert({
    where: { metricId: 'sample-metric' },
    update: {},
    create: {
      metricId: 'sample-metric',
      campaignId: campaign.campaignId,
      roomId: room.roomId,
      impressions: 1200,
      joins: 45,
      predictionsSubmitted: 6,
      uniqueParticipants: 3,
    },
  });

  await prisma.drop.createMany({
    data: [
      {
        title: 'Airport Coffee Drop',
        description: 'Unlock a creator coffee voucher.',
        dropType: 'voucher',
        cloutCost: 120,
        sponsorName: 'Travel Partner',
        terms: 'Terms apply',
      },
      {
        title: 'Mystery Hype Drop',
        description: 'A surprise perk for active predictors.',
        dropType: 'mystery_drop',
        cloutCost: 90,
      },
    ],
    skipDuplicates: true,
  });

  const aiSystems = [
    {
      aiSystemId: 'ai-eta-comparison',
      featureName: 'AI ETA Comparison',
      purpose: 'Compare room outcomes against an AI ETA baseline',
    },
    {
      aiSystemId: 'suspicious-prediction-behavior',
      featureName: 'Suspicious Prediction Behavior Detection',
      purpose: 'Detect anomalous prediction patterns',
    },
    {
      aiSystemId: 'campaign-recommendation-assistant',
      featureName: 'Campaign Recommendation Assistant',
      purpose: 'Recommend campaign formats for creators and sponsors',
    },
  ] as const;

  for (const aiSystem of aiSystems) {
    await prisma.aiSystemInventory.upsert({
      where: { aiSystemId: aiSystem.aiSystemId },
      update: aiSystem,
      create: aiSystem,
    });
  }

  await seedPlans();
  await seedAdmin();

  console.log('Seed complete.');
  console.log('Users:', [creator, viewer1, viewer2, viewer3].map((user) => user.email));
  console.log('Room invite code: DEMO1');
  console.log(
    'Admin seeded from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (local default only when ALLOW_LOCAL_DEFAULT_ADMIN_SEED=true in development).',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
