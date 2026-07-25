import { Prisma, PrismaClient } from '@prisma/client';
import { PHASE1_REWARD_RULES } from './reward.constants';

/**
 * Idempotent upsert of the Phase 1 reward rule catalog. Safe to run repeatedly.
 * Updates amounts/caps/config/labels in place; never deletes rules (so a rule
 * disabled via config is not resurrected by an operator-edited row unless the
 * seed itself changes). Accepts an injected client so it can be reused from
 * prisma/seed.ts, a standalone script, or tests.
 */
export async function seedRewardRules(prisma: PrismaClient): Promise<void> {
  for (const rule of PHASE1_REWARD_RULES) {
    const data = {
      rewardType: rule.rewardType,
      baseAmount: rule.baseAmount,
      enabled: rule.enabled,
      dailyCap: rule.dailyCap,
      perSourceCap: rule.perSourceCap,
      configJson: rule.config as unknown as Prisma.InputJsonObject,
      label: rule.label,
      description: rule.description,
    };
    await prisma.rewardRule.upsert({
      where: { reasonCode: rule.reasonCode },
      create: { reasonCode: rule.reasonCode, ...data },
      update: data,
    });
  }
}
