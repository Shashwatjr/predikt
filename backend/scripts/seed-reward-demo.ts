/**
 * Local-only screenshot fixture for the Phase 1 rewards UI. Gives test@predikt.ai
 * a known password, non-zero Aura/RIZZ/Gems balances, a handful of ledger entries
 * (for the Profile "recent activity" list), and a completed-room result so the
 * Result screen renders a non-zero "You earned" chip. Idempotent.
 *
 *   DATABASE_URL=<local> npx ts-node scripts/seed-reward-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const EMAIL = 'test@predikt.ai';

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, isGuest: false, totalAura: 420, weeklyAura: 180 },
    create: {
      email: EMAIL,
      name: 'Predikt Demo',
      prediktHandle: 'predikt.demo',
      passwordHash,
      isGuest: false,
      totalAura: 420,
      weeklyAura: 180,
    },
  });
  const userId = user.userId;

  await prisma.rewardAccount.upsert({
    where: { userId },
    update: {
      auraBalance: 420,
      lifetimeAura: 420,
      rizzBalance: 65,
      lifetimeRizz: 65,
      gemBalance: 90,
      lifetimeGems: 140,
    },
    create: {
      userId,
      auraBalance: 420,
      lifetimeAura: 420,
      rizzBalance: 65,
      lifetimeRizz: 65,
      gemBalance: 90,
      lifetimeGems: 140,
    },
  });

  const entries = [
    { rewardType: 'GEMS', amount: 50, balanceAfter: 90, reasonCode: 'GEM_FIRST_WIN', sourceType: 'room' },
    { rewardType: 'RIZZ', amount: 2, balanceAfter: 65, reasonCode: 'RIZZ_REACTION_RECEIVED', sourceType: 'reaction' },
    { rewardType: 'AURA', amount: 100, balanceAfter: 420, reasonCode: 'AURA_MILESTONE_SCORE', sourceType: 'milestone' },
    { rewardType: 'RIZZ', amount: 5, balanceAfter: 63, reasonCode: 'RIZZ_UNIQUE_JOIN', sourceType: 'membership' },
    { rewardType: 'GEMS', amount: 15, balanceAfter: 40, reasonCode: 'GEM_MILESTONE_BADGE', sourceType: 'badge' },
    { rewardType: 'GEMS', amount: 20, balanceAfter: 20, reasonCode: 'GEM_FIRST_PREDICTION', sourceType: 'prediction' },
  ] as const;

  for (const [i, e] of entries.entries()) {
    const idempotencyKey = `demo_seed:${userId}:${e.reasonCode}:${i}`;
    await prisma.rewardLedgerEntry.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        userId,
        rewardType: e.rewardType,
        amount: e.amount,
        balanceAfter: e.balanceAfter,
        reasonCode: e.reasonCode,
        sourceType: e.sourceType,
        idempotencyKey,
        createdAt: new Date(Date.now() - i * 3_600_000),
      },
    });
  }

  // A completed room where this user earned Aura, for the Result screenshot.
  const room = await prisma.predictionRoom.findFirst({
    where: { creatorUserId: userId, status: 'completed' },
    select: { roomId: true, roomTitle: true },
  });
  if (room) {
    await prisma.roomResult.upsert({
      where: { roomId_userId: { roomId: room.roomId, userId } },
      update: { totalRoomAura: 120, milestonesWon: 1, overallRank: 1 },
      create: {
        roomId: room.roomId,
        userId,
        totalRoomAura: 120,
        totalRoomClout: 40,
        milestonesWon: 1,
        overallRank: 1,
      },
    });
    console.log(`Result fixture on room "${room.roomTitle}" (${room.roomId})`);
  } else {
    console.log('No completed room found for this user; Result fixture skipped.');
  }

  console.log(`Seeded rewards demo for ${EMAIL} (userId ${userId}). Login: Password123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
