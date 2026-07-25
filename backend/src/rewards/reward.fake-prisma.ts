import { Prisma } from '@prisma/client';

/**
 * A small in-memory stand-in for the subset of PrismaClient that RewardService
 * touches. It faithfully models the behaviours the reward engine relies on:
 *  - a UNIQUE constraint on RewardLedgerEntry.idempotencyKey (throws P2002),
 *  - a UNIQUE constraint on RewardAccount.userId (upsert = insert-or-noop),
 *  - increment/decrement update operators,
 *  - $transaction with snapshot-based rollback on throw.
 *
 * This lets the engine's invariants be tested deterministically without a DB.
 * It is test-only and deliberately not exhaustive.
 */

interface UserRow {
  userId: string;
  totalAura: number;
  weeklyAura: number;
}
interface AccountRow {
  userId: string;
  auraBalance: number;
  rizzBalance: number;
  gemBalance: number;
  lifetimeAura: number;
  lifetimeRizz: number;
  lifetimeGems: number;
}
interface RuleRow {
  reasonCode: string;
  rewardType: string;
  baseAmount: number;
  enabled: boolean;
  dailyCap: number | null;
  perSourceCap: number | null;
  configJson: unknown;
  label: string;
  description: string;
}
interface LedgerRow {
  rewardLedgerEntryId: string;
  userId: string;
  rewardType: string;
  amount: number;
  balanceAfter: number;
  reasonCode: string;
  sourceType: string | null;
  sourceId: string | null;
  idempotencyKey: string;
  metadata: unknown;
  createdAt: Date;
}

interface Store {
  users: UserRow[];
  accounts: AccountRow[];
  rules: RuleRow[];
  ledger: LedgerRow[];
  seq: number;
}

function p2002(target: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on ${target}`,
    { code: 'P2002', clientVersion: 'test', meta: { target: [target] } },
  );
}

function applyNumericUpdate(current: number, value: unknown): number {
  if (value && typeof value === 'object') {
    const v = value as { increment?: number; decrement?: number };
    if (typeof v.increment === 'number') return current + v.increment;
    if (typeof v.decrement === 'number') return current - v.decrement;
  }
  return value as number;
}

export class FakePrisma {
  private store: Store;
  // Optional hook to force a create() to throw P2002 even when no row exists yet,
  // simulating a lost idempotency race with a concurrent transaction.
  public forceLedgerConflictOnce = false;

  constructor(seed: {
    users?: Partial<UserRow>[];
    accounts?: AccountRow[];
    rules: RuleRow[];
    ledger?: LedgerRow[];
  }) {
    this.store = {
      users: (seed.users ?? []).map((u) => ({
        userId: u.userId!,
        totalAura: u.totalAura ?? 0,
        weeklyAura: u.weeklyAura ?? 0,
      })),
      accounts: seed.accounts ?? [],
      rules: seed.rules,
      ledger: seed.ledger ?? [],
      seq: 1,
    };
  }

  private clone(): Store {
    return {
      users: this.store.users.map((r) => ({ ...r })),
      accounts: this.store.accounts.map((r) => ({ ...r })),
      rules: this.store.rules.map((r) => ({ ...r })),
      ledger: this.store.ledger.map((r) => ({ ...r })),
      seq: this.store.seq,
    };
  }

  // Public inspection helpers for assertions.
  get state() {
    return this.store;
  }
  private findAccount(userId: string) {
    return this.store.accounts.find((a) => a.userId === userId);
  }
  private findUser(userId: string) {
    return this.store.users.find((u) => u.userId === userId);
  }
  account(userId: string) {
    return this.findAccount(userId);
  }
  getUser(userId: string) {
    return this.findUser(userId);
  }
  ledgerFor(userId: string) {
    return this.store.ledger.filter((l) => l.userId === userId);
  }

  rewardRule = {
    findUnique: async ({ where }: any) =>
      this.store.rules.find((r) => r.reasonCode === where.reasonCode) ?? null,
    findMany: async () => this.store.rules.map((r) => ({ ...r })),
  };

  rewardLedgerEntry = {
    findUnique: async ({ where }: any) =>
      this.store.ledger.find((l) => l.idempotencyKey === where.idempotencyKey) ??
      null,
    findMany: async ({ where }: any = {}) =>
      this.store.ledger.filter((l) =>
        where?.userId ? l.userId === where.userId : true,
      ),
    aggregate: async ({ where }: any) => {
      const rows = this.store.ledger.filter((l) => {
        if (where.userId && l.userId !== where.userId) return false;
        if (where.reasonCode && l.reasonCode !== where.reasonCode) return false;
        if ('sourceType' in where && l.sourceType !== where.sourceType) return false;
        if ('sourceId' in where && l.sourceId !== where.sourceId) return false;
        if (where.createdAt?.gte && l.createdAt < where.createdAt.gte) return false;
        return true;
      });
      return { _sum: { amount: rows.reduce((s, r) => s + r.amount, 0) } };
    },
    create: async ({ data }: any) => {
      if (this.forceLedgerConflictOnce) {
        this.forceLedgerConflictOnce = false;
        throw p2002('idempotency_key');
      }
      if (this.store.ledger.some((l) => l.idempotencyKey === data.idempotencyKey)) {
        throw p2002('idempotency_key');
      }
      const row: LedgerRow = {
        rewardLedgerEntryId: `led_${this.store.seq++}`,
        userId: data.userId,
        rewardType: data.rewardType,
        amount: data.amount,
        balanceAfter: data.balanceAfter,
        reasonCode: data.reasonCode,
        sourceType: data.sourceType ?? null,
        sourceId: data.sourceId ?? null,
        idempotencyKey: data.idempotencyKey,
        metadata: data.metadata ?? null,
        createdAt: new Date(),
      };
      this.store.ledger.push(row);
      return { ...row };
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const l of this.store.ledger) {
        if (where.userId && l.userId === where.userId) {
          if (data.userId) l.userId = data.userId;
          count++;
        }
      }
      return { count };
    },
  };

  rewardAccount = {
    findUnique: async ({ where }: any) =>
      this.findAccount(where.userId) ? { ...this.findAccount(where.userId)! } : null,
    upsert: async ({ where, create }: any) => {
      const existing = this.findAccount(where.userId);
      if (existing) return { ...existing };
      const row: AccountRow = {
        userId: create.userId,
        auraBalance: create.auraBalance ?? 0,
        rizzBalance: create.rizzBalance ?? 0,
        gemBalance: create.gemBalance ?? 0,
        lifetimeAura: create.lifetimeAura ?? 0,
        lifetimeRizz: create.lifetimeRizz ?? 0,
        lifetimeGems: create.lifetimeGems ?? 0,
      };
      this.store.accounts.push(row);
      return { ...row };
    },
    update: async ({ where, data }: any) => {
      const row = this.findAccount(where.userId);
      if (!row) throw new Error(`account ${where.userId} not found`);
      for (const key of Object.keys(data)) {
        (row as any)[key] = applyNumericUpdate((row as any)[key], data[key]);
      }
      return { ...row };
    },
  };

  user = {
    findUnique: async ({ where }: any) =>
      this.findUser(where.userId) ? { ...this.findUser(where.userId)! } : null,
    update: async ({ where, data }: any) => {
      const row = this.findUser(where.userId);
      if (!row) throw new Error(`user ${where.userId} not found`);
      for (const key of Object.keys(data)) {
        (row as any)[key] = applyNumericUpdate((row as any)[key], data[key]);
      }
      return { ...row };
    },
    count: async ({ where }: any) =>
      this.store.users.filter((u) =>
        where?.weeklyAura?.gt != null ? u.weeklyAura > where.weeklyAura.gt : true,
      ).length,
  };

  async $transaction<T>(cb: (tx: FakePrisma) => Promise<T>): Promise<T> {
    const snapshot = this.clone();
    try {
      return await cb(this);
    } catch (err) {
      // Roll back on any throw, mirroring interactive-transaction semantics.
      this.store = snapshot;
      throw err;
    }
  }
}
