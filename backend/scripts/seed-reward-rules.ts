/**
 * Seeds/updates the Phase 1 reward rule catalog (Aura / RIZZ / Gems).
 * Idempotent — safe to run against any environment.
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node scripts/seed-reward-rules.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedRewardRules } from '../src/rewards/seed-reward-rules';

const prisma = new PrismaClient();

async function main() {
  await seedRewardRules(prisma);
  const count = await prisma.rewardRule.count();
  console.log(`Reward rules seeded. Total rules in table: ${count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
