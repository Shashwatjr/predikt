import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, RewardType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADMIN_REASON_BY_TYPE,
  RewardReason,
  RewardReasonCode,
  RewardRuleConfig,
} from './reward.constants';

type Tx = Prisma.TransactionClient;

export interface GrantInput {
  userId: string;
  rewardType: RewardType;
  reasonCode: RewardReasonCode;
  /** Required for dynamic rules (Aura scoring, admin adjust); otherwise rule.baseAmount. */
  amount?: number;
  sourceType?: string;
  sourceId?: string;
  /** Deterministic replay guard — see docs/reward-system-phase1-contract.md §3. */
  idempotencyKey: string;
  /** The user who triggered the grant, for self-action rejection. */
  actorUserId?: string;
  metadata?: Prisma.InputJsonValue;
  /** Participate in an outer interactive transaction instead of opening one. */
  tx?: Tx;
}

export type GrantSkipReason =
  | 'rule_missing'
  | 'rule_disabled'
  | 'self_action'
  | 'requires_other_user'
  | 'zero_amount'
  | 'duplicate'
  | 'per_source_cap'
  | 'daily_cap'
  | 'not_allowlisted';

export interface GrantResult {
  applied: boolean;
  skippedReason?: GrantSkipReason;
  amount: number;
  balanceAfter: number;
  ledgerEntryId?: string;
  rewardType: RewardType;
}

const BALANCE_FIELD: Record<RewardType, 'auraBalance' | 'rizzBalance' | 'gemBalance'> = {
  AURA: 'auraBalance',
  RIZZ: 'rizzBalance',
  GEMS: 'gemBalance',
};
const LIFETIME_FIELD: Record<RewardType, 'lifetimeAura' | 'lifetimeRizz' | 'lifetimeGems'> = {
  AURA: 'lifetimeAura',
  RIZZ: 'lifetimeRizz',
  GEMS: 'lifetimeGems',
};

function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class RewardService {
  private readonly logger = new Logger(RewardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The single entry point for every reward balance change. Transactional,
   * idempotent, cap-aware, and self-action-aware. Never throws on business
   * skips (returns applied:false); throws only on hard invariants
   * (negative balance) or infrastructure errors.
   */
  async grant(input: GrantInput): Promise<GrantResult> {
    if (input.tx) {
      return this.grantInTx(input.tx, input);
    }
    try {
      return await this.prisma.$transaction((tx) => this.grantInTx(tx, input));
    } catch (err) {
      // Lost an idempotency race: a concurrent grant inserted the same key first.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.rewardLedgerEntry.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        return {
          applied: false,
          skippedReason: 'duplicate',
          amount: 0,
          balanceAfter: existing?.balanceAfter ?? 0,
          ledgerEntryId: existing?.rewardLedgerEntryId,
          rewardType: input.rewardType,
        };
      }
      throw err;
    }
  }

  private async grantInTx(tx: Tx, input: GrantInput): Promise<GrantResult> {
    const skip = (skippedReason: GrantSkipReason): GrantResult => ({
      applied: false,
      skippedReason,
      amount: 0,
      balanceAfter: 0,
      rewardType: input.rewardType,
    });

    const rule = await tx.rewardRule.findUnique({
      where: { reasonCode: input.reasonCode },
    });
    if (!rule) return skip('rule_missing');
    if (!rule.enabled) return skip('rule_disabled');

    const config = (rule.configJson ?? {}) as RewardRuleConfig;

    if (config.rejectSelf && input.actorUserId && input.actorUserId === input.userId) {
      return skip('self_action');
    }

    const amount = input.amount ?? rule.baseAmount;
    if (amount === 0) return skip('zero_amount');

    // Idempotency: fast path (also backstopped by the unique constraint under races).
    const existing = await tx.rewardLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return {
        applied: false,
        skippedReason: 'duplicate',
        amount: existing.amount,
        balanceAfter: existing.balanceAfter,
        ledgerEntryId: existing.rewardLedgerEntryId,
        rewardType: input.rewardType,
      };
    }

    // Caps apply only to positive earning.
    if (amount > 0) {
      if (rule.perSourceCap != null) {
        const agg = await tx.rewardLedgerEntry.aggregate({
          _sum: { amount: true },
          where: {
            userId: input.userId,
            reasonCode: input.reasonCode,
            sourceType: input.sourceType ?? null,
            sourceId: input.sourceId ?? null,
          },
        });
        if ((agg._sum.amount ?? 0) + amount > rule.perSourceCap) {
          return skip('per_source_cap');
        }
      }
      if (rule.dailyCap != null) {
        const agg = await tx.rewardLedgerEntry.aggregate({
          _sum: { amount: true },
          where: {
            userId: input.userId,
            reasonCode: input.reasonCode,
            createdAt: { gte: startOfUtcDay() },
          },
        });
        if ((agg._sum.amount ?? 0) + amount > rule.dailyCap) {
          return skip('daily_cap');
        }
      }
    }

    const account = await this.ensureAccountTx(tx, input.userId);
    const balField = BALANCE_FIELD[input.rewardType];
    const lifeField = LIFETIME_FIELD[input.rewardType];
    const newBalance = account[balField] + amount;

    // Hard invariant: balances never go negative.
    if (newBalance < 0) {
      throw new BadRequestException(
        `Reward grant would drive ${input.rewardType} balance negative (` +
          `${account[balField]} + ${amount}).`,
      );
    }

    const data: Prisma.RewardAccountUpdateInput = { [balField]: newBalance };
    if (amount > 0) {
      data[lifeField] = account[lifeField] + amount;
    }
    await tx.rewardAccount.update({ where: { userId: input.userId }, data });

    // AURA mirror: User.totalAura stays canonical for existing leaderboards.
    if (input.rewardType === 'AURA') {
      await tx.user.update({
        where: { userId: input.userId },
        data: {
          totalAura: { increment: amount },
          ...(amount > 0 ? { weeklyAura: { increment: amount } } : {}),
        },
      });
    }

    const entry = await tx.rewardLedgerEntry.create({
      data: {
        userId: input.userId,
        rewardType: input.rewardType,
        amount,
        balanceAfter: newBalance,
        reasonCode: input.reasonCode,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      },
    });

    return {
      applied: true,
      amount,
      balanceAfter: newBalance,
      ledgerEntryId: entry.rewardLedgerEntryId,
      rewardType: input.rewardType,
    };
  }

  /** Lazily create a RewardAccount, mirroring the user's existing Aura. */
  private async ensureAccountTx(tx: Tx, userId: string) {
    const existing = await tx.rewardAccount.findUnique({ where: { userId } });
    if (existing) return existing;
    const user = await tx.user.findUnique({
      where: { userId },
      select: { totalAura: true },
    });
    const aura = user?.totalAura ?? 0;
    // upsert compiles to INSERT ... ON CONFLICT — safe against concurrent creation.
    return tx.rewardAccount.upsert({
      where: { userId },
      create: { userId, auraBalance: aura, lifetimeAura: aura },
      update: {},
    });
  }

  async ensureAccount(userId: string) {
    return this.prisma.$transaction((tx) => this.ensureAccountTx(tx, userId));
  }

  /** Admin adjustment endpoint helper. Amount may be negative (never below 0). */
  async adminAdjust(params: {
    userId: string;
    rewardType: RewardType;
    amount: number;
    reason: string;
    idempotencyKey: string;
    adminId: string;
  }): Promise<GrantResult> {
    return this.grant({
      userId: params.userId,
      rewardType: params.rewardType,
      reasonCode: ADMIN_REASON_BY_TYPE[params.rewardType],
      amount: params.amount,
      sourceType: 'admin',
      sourceId: params.adminId,
      idempotencyKey: `admin_adjust:${params.idempotencyKey}`,
      metadata: { reason: params.reason },
    });
  }

  /**
   * Merge one user's reward balances and ledger history into another. The current
   * guest→real conversion (auth.upgradeGuest) mutates a single User row, so
   * balances carry over automatically and this is NOT needed there. It exists for
   * a genuine two-row merge (e.g. a guest device signing into an existing account)
   * and reconciles balances, mirrors Aura into the target User, and re-parents the
   * ledger. Idempotency keys are per-user, so re-parenting never collides.
   */
  async mergeAccounts(sourceUserId: string, targetUserId: string): Promise<void> {
    if (sourceUserId === targetUserId) return;
    await this.prisma.$transaction(async (tx) => {
      const source = await tx.rewardAccount.findUnique({
        where: { userId: sourceUserId },
      });
      if (!source) return;
      const target = await this.ensureAccountTx(tx, targetUserId);

      await tx.rewardAccount.update({
        where: { userId: targetUserId },
        data: {
          auraBalance: target.auraBalance + source.auraBalance,
          rizzBalance: target.rizzBalance + source.rizzBalance,
          gemBalance: target.gemBalance + source.gemBalance,
          lifetimeAura: target.lifetimeAura + source.lifetimeAura,
          lifetimeRizz: target.lifetimeRizz + source.lifetimeRizz,
          lifetimeGems: target.lifetimeGems + source.lifetimeGems,
        },
      });

      // Keep the Aura mirror consistent on the target User row.
      if (source.auraBalance !== 0) {
        await tx.user.update({
          where: { userId: targetUserId },
          data: {
            totalAura: { increment: source.auraBalance },
            weeklyAura: { increment: source.auraBalance },
          },
        });
      }

      await tx.rewardLedgerEntry.updateMany({
        where: { userId: sourceUserId },
        data: { userId: targetUserId },
      });

      await tx.rewardAccount.update({
        where: { userId: sourceUserId },
        data: { auraBalance: 0, rizzBalance: 0, gemBalance: 0 },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Read APIs
  // ---------------------------------------------------------------------------

  async getMe(userId: string) {
    const account = await this.ensureAccount(userId);
    const [user, recent, rules] = await Promise.all([
      this.prisma.user.findUnique({
        where: { userId },
        select: {
          totalAura: true,
          weeklyAura: true,
          winsCount: true,
          predictionsMadeCount: true,
        },
      }),
      this.prisma.rewardLedgerEntry.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { rewardLedgerEntryId: 'desc' }],
        take: 10,
      }),
      this.loadRuleLabelMap(),
    ]);

    const weeklyAura = user?.weeklyAura ?? 0;
    const rank =
      weeklyAura > 0
        ? (await this.prisma.user.count({ where: { weeklyAura: { gt: weeklyAura } } })) + 1
        : null;

    return {
      aura: {
        balance: user?.totalAura ?? account.auraBalance,
        weekly: weeklyAura,
        lifetime: account.lifetimeAura,
        rank,
      },
      tier: null as null, // No formal Aura tier exists in Phase 1 (reserved).
      rizz: { balance: account.rizzBalance, lifetime: account.lifetimeRizz },
      gems: { balance: account.gemBalance, lifetime: account.lifetimeGems },
      recentEntries: recent.map((e) => this.toPublicEntry(e, rules)),
      nextMilestone: this.deriveNextMilestone({
        predictionsMade: user?.predictionsMadeCount ?? 0,
        wins: user?.winsCount ?? 0,
        gemLifetime: account.lifetimeGems,
      }),
    };
  }

  async history(
    userId: string,
    opts: { type?: RewardType; limit?: number; cursor?: string },
  ) {
    const take = Math.min(Math.max(opts.limit ?? 25, 1), 100);
    const rules = await this.loadRuleLabelMap();
    const rows = await this.prisma.rewardLedgerEntry.findMany({
      where: { userId, ...(opts.type ? { rewardType: opts.type } : {}) },
      orderBy: [{ createdAt: 'desc' }, { rewardLedgerEntryId: 'desc' }],
      take: take + 1,
      ...(opts.cursor
        ? { cursor: { rewardLedgerEntryId: opts.cursor }, skip: 1 }
        : {}),
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      entries: page.map((e) => this.toPublicEntry(e, rules)),
      nextCursor: hasMore ? page[page.length - 1].rewardLedgerEntryId : null,
    };
  }

  /** Safe public rule summaries — no caps, thresholds, or admin rules exposed. */
  async publicRules() {
    const rules = await this.prisma.rewardRule.findMany({
      where: { enabled: true },
      orderBy: [{ rewardType: 'asc' }, { baseAmount: 'desc' }],
    });
    return {
      rules: rules
        .filter((r) => {
          const config = (r.configJson ?? {}) as RewardRuleConfig;
          return config.publicVisible !== false;
        })
        .map((r) => {
          const config = (r.configJson ?? {}) as RewardRuleConfig;
          return {
            reasonCode: r.reasonCode,
            rewardType: r.rewardType,
            reward: config.dynamic ? null : r.baseAmount,
            label: r.label,
            description: r.description,
          };
        }),
    };
  }

  private async loadRuleLabelMap(): Promise<Map<string, string>> {
    const rules = await this.prisma.rewardRule.findMany({
      select: { reasonCode: true, label: true },
    });
    return new Map(rules.map((r) => [r.reasonCode, r.label]));
  }

  private toPublicEntry(
    e: {
      rewardLedgerEntryId: string;
      rewardType: RewardType;
      amount: number;
      balanceAfter: number;
      reasonCode: string;
      sourceType: string | null;
      createdAt: Date;
    },
    labels: Map<string, string>,
  ) {
    return {
      id: e.rewardLedgerEntryId,
      rewardType: e.rewardType,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      reasonCode: e.reasonCode,
      label: labels.get(e.reasonCode) ?? e.reasonCode,
      sourceType: e.sourceType,
      createdAt: e.createdAt,
    };
  }

  private deriveNextMilestone(stats: {
    predictionsMade: number;
    wins: number;
    gemLifetime: number;
  }): { reasonCode: string; label: string; reward: number; rewardType: RewardType } | null {
    if (stats.predictionsMade === 0) {
      return {
        reasonCode: RewardReason.GEM_FIRST_PREDICTION,
        label: 'Make your first prediction',
        reward: 20,
        rewardType: 'GEMS',
      };
    }
    if (stats.wins === 0) {
      return {
        reasonCode: RewardReason.GEM_FIRST_WIN,
        label: 'Win your first room',
        reward: 50,
        rewardType: 'GEMS',
      };
    }
    return null;
  }
}
