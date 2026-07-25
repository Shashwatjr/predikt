import { BadRequestException } from '@nestjs/common';
import { RewardService } from './reward.service';
import { FakePrisma } from './reward.fake-prisma';
import { RewardReason } from './reward.constants';

/**
 * Engine-invariant tests for RewardService using an in-memory Prisma fake.
 * Covers the Phase 1 test matrix: idempotent grants, concurrent-update race,
 * duplicate reactions / repeat joins, self-actions, daily caps, negative-balance
 * rejection + rollback, Aura preservation/mirroring, and account merge.
 */

const RULES = [
  {
    reasonCode: RewardReason.RIZZ_UNIQUE_JOIN,
    rewardType: 'RIZZ',
    baseAmount: 5,
    enabled: true,
    dailyCap: 12,
    perSourceCap: null,
    configJson: { rejectSelf: true },
    label: 'New participant',
    description: '',
  },
  {
    reasonCode: RewardReason.RIZZ_REACTION_RECEIVED,
    rewardType: 'RIZZ',
    baseAmount: 2,
    enabled: true,
    dailyCap: 50,
    perSourceCap: null,
    configJson: { rejectSelf: true },
    label: 'Reaction received',
    description: '',
  },
  {
    reasonCode: RewardReason.AURA_MILESTONE_SCORE,
    rewardType: 'AURA',
    baseAmount: 0,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    configJson: { dynamic: true, publicVisible: false },
    label: 'Prediction score',
    description: '',
  },
  {
    reasonCode: RewardReason.GEM_ADMIN_ADJUSTMENT,
    rewardType: 'GEMS',
    baseAmount: 0,
    enabled: true,
    dailyCap: null,
    perSourceCap: null,
    configJson: { dynamic: true, publicVisible: false },
    label: 'Admin adjustment',
    description: '',
  },
  {
    reasonCode: RewardReason.GEM_REFERRAL_COMPLETED,
    rewardType: 'GEMS',
    baseAmount: 100,
    enabled: false,
    dailyCap: null,
    perSourceCap: null,
    configJson: {},
    label: 'Referral',
    description: '',
  },
] as any[];

function makeService(seed: {
  users?: any[];
  accounts?: any[];
  ledger?: any[];
}) {
  const fake = new FakePrisma({ rules: RULES, ...seed });
  const service = new RewardService(fake as any);
  return { fake, service };
}

describe('RewardService.grant', () => {
  it('applies a first grant: writes ledger, updates balance and lifetime', async () => {
    const { fake, service } = makeService({ users: [{ userId: 'creator' }] });

    const res = await service.grant({
      userId: 'creator',
      rewardType: 'RIZZ',
      reasonCode: RewardReason.RIZZ_UNIQUE_JOIN,
      sourceType: 'membership',
      sourceId: 'room1',
      idempotencyKey: 'rizz_join:room1:joiner',
      actorUserId: 'joiner',
    });

    expect(res.applied).toBe(true);
    expect(res.amount).toBe(5);
    expect(res.balanceAfter).toBe(5);
    expect(fake.account('creator')).toMatchObject({ rizzBalance: 5, lifetimeRizz: 5 });
    expect(fake.ledgerFor('creator')).toHaveLength(1);
  });

  it('is idempotent: the same idempotency key never double-grants', async () => {
    const { fake, service } = makeService({ users: [{ userId: 'creator' }] });
    const input = {
      userId: 'creator' as const,
      rewardType: 'RIZZ' as const,
      reasonCode: RewardReason.RIZZ_UNIQUE_JOIN,
      idempotencyKey: 'rizz_join:room1:joiner',
      actorUserId: 'joiner',
    };

    const first = await service.grant(input);
    const second = await service.grant(input);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.skippedReason).toBe('duplicate');
    expect(fake.account('creator')!.rizzBalance).toBe(5);
    expect(fake.ledgerFor('creator')).toHaveLength(1);
  });

  it('repeat joins / duplicate reactions from the same actor grant once', async () => {
    const { fake, service } = makeService({ users: [{ userId: 'creator' }] });
    // Same reactor changing emoji => same idempotency key => single grant.
    for (const emoji of ['fire', 'clap', 'fire']) {
      await service.grant({
        userId: 'creator',
        rewardType: 'RIZZ',
        reasonCode: RewardReason.RIZZ_REACTION_RECEIVED,
        idempotencyKey: 'rizz_react:room1:reactor',
        actorUserId: 'reactor',
        metadata: { emoji },
      });
    }
    expect(fake.account('creator')!.rizzBalance).toBe(2);
    expect(fake.ledgerFor('creator')).toHaveLength(1);
  });

  it('survives a lost idempotency race: create P2002 is treated as duplicate', async () => {
    const { fake, service } = makeService({ users: [{ userId: 'creator' }] });
    // First grant lands normally.
    await service.grant({
      userId: 'creator',
      rewardType: 'RIZZ',
      reasonCode: RewardReason.RIZZ_UNIQUE_JOIN,
      idempotencyKey: 'rizz_join:room1:joiner',
      actorUserId: 'joiner',
    });
    // Simulate a concurrent grant that passed its own existence check, then hit the
    // unique constraint on insert. Force the next create() to throw P2002.
    fake.forceLedgerConflictOnce = true;
    const raced = await service.grant({
      userId: 'creator',
      rewardType: 'RIZZ',
      reasonCode: RewardReason.RIZZ_UNIQUE_JOIN,
      idempotencyKey: 'rizz_join:room1:joiner',
      actorUserId: 'joiner',
    });
    expect(raced.applied).toBe(false);
    expect(raced.skippedReason).toBe('duplicate');
    expect(fake.account('creator')!.rizzBalance).toBe(5);
  });

  it('rejects self-actions (creator reacting to / joining their own room)', async () => {
    const { fake, service } = makeService({ users: [{ userId: 'creator' }] });
    const res = await service.grant({
      userId: 'creator',
      rewardType: 'RIZZ',
      reasonCode: RewardReason.RIZZ_REACTION_RECEIVED,
      idempotencyKey: 'rizz_react:room1:creator',
      actorUserId: 'creator',
    });
    expect(res.applied).toBe(false);
    expect(res.skippedReason).toBe('self_action');
    expect(fake.account('creator')).toBeUndefined();
  });

  it('enforces the daily cap and then skips further grants', async () => {
    const { fake, service } = makeService({ users: [{ userId: 'creator' }] });
    // dailyCap 12, baseAmount 5 => grants at 5, 10, then 15 > 12 is skipped.
    const applied: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await service.grant({
        userId: 'creator',
        rewardType: 'RIZZ',
        reasonCode: RewardReason.RIZZ_UNIQUE_JOIN,
        idempotencyKey: `rizz_join:room1:joiner${i}`,
        actorUserId: `joiner${i}`,
      });
      applied.push(r.applied);
    }
    expect(applied).toEqual([true, true, false]);
    expect(fake.account('creator')!.rizzBalance).toBe(10);
  });

  it('skips disabled rules (e.g. referrals in Phase 1)', async () => {
    const { service } = makeService({ users: [{ userId: 'u1' }] });
    const res = await service.grant({
      userId: 'u1',
      rewardType: 'GEMS',
      reasonCode: RewardReason.GEM_REFERRAL_COMPLETED,
      idempotencyKey: 'gem_referral:r1',
    });
    expect(res.applied).toBe(false);
    expect(res.skippedReason).toBe('rule_disabled');
  });

  it('rejects a grant that would drive a balance negative and rolls back', async () => {
    const { fake, service } = makeService({
      users: [{ userId: 'u1' }],
      accounts: [
        {
          userId: 'u1',
          auraBalance: 0,
          rizzBalance: 0,
          gemBalance: 10,
          lifetimeAura: 0,
          lifetimeRizz: 0,
          lifetimeGems: 10,
        },
      ],
    });
    await expect(
      service.grant({
        userId: 'u1',
        rewardType: 'GEMS',
        reasonCode: RewardReason.GEM_ADMIN_ADJUSTMENT,
        amount: -25,
        idempotencyKey: 'admin:neg1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Rolled back: balance untouched, no ledger row written.
    expect(fake.account('u1')!.gemBalance).toBe(10);
    expect(fake.ledgerFor('u1')).toHaveLength(0);
  });

  it('allows a negative admin adjustment down to zero', async () => {
    const { fake, service } = makeService({
      users: [{ userId: 'u1' }],
      accounts: [
        {
          userId: 'u1',
          auraBalance: 0,
          rizzBalance: 0,
          gemBalance: 10,
          lifetimeAura: 0,
          lifetimeRizz: 0,
          lifetimeGems: 10,
        },
      ],
    });
    const res = await service.grant({
      userId: 'u1',
      rewardType: 'GEMS',
      reasonCode: RewardReason.GEM_ADMIN_ADJUSTMENT,
      amount: -10,
      idempotencyKey: 'admin:zero',
    });
    expect(res.applied).toBe(true);
    expect(res.balanceAfter).toBe(0);
    // Negative amount must not inflate lifetime totals.
    expect(fake.account('u1')!.lifetimeGems).toBe(10);
  });

  it('mirrors AURA into User.totalAura/weeklyAura and preserves existing Aura', async () => {
    const { fake, service } = makeService({
      users: [{ userId: 'u1', totalAura: 100, weeklyAura: 40 }],
    });
    const res = await service.grant({
      userId: 'u1',
      rewardType: 'AURA',
      reasonCode: RewardReason.AURA_MILESTONE_SCORE,
      amount: 30,
      idempotencyKey: 'aura_ms:m1:u1',
    });
    expect(res.applied).toBe(true);
    // Existing 100 preserved; new account seeds from it, then +30.
    expect(fake.getUser('u1')).toMatchObject({ totalAura: 130, weeklyAura: 70 });
    expect(fake.account('u1')).toMatchObject({ auraBalance: 130, lifetimeAura: 130 });
    expect(res.balanceAfter).toBe(130);
  });
});

describe('RewardService.ensureAccount', () => {
  it('seeds a new account from existing totalAura (mirror)', async () => {
    const { fake, service } = makeService({ users: [{ userId: 'u1', totalAura: 250 }] });
    const acct = await service.ensureAccount('u1');
    expect(acct.auraBalance).toBe(250);
    expect(acct.lifetimeAura).toBe(250);
    expect(acct.rizzBalance).toBe(0);
    expect(acct.gemBalance).toBe(0);
    expect(fake.account('u1')).toBeDefined();
  });
});

describe('RewardService.mergeAccounts', () => {
  it('sums balances, mirrors Aura, and re-parents ledger history', async () => {
    const { fake, service } = makeService({
      users: [
        { userId: 'guest', totalAura: 20, weeklyAura: 20 },
        { userId: 'real', totalAura: 100, weeklyAura: 50 },
      ],
      accounts: [
        {
          userId: 'guest',
          auraBalance: 20,
          rizzBalance: 8,
          gemBalance: 20,
          lifetimeAura: 20,
          lifetimeRizz: 8,
          lifetimeGems: 20,
        },
        {
          userId: 'real',
          auraBalance: 100,
          rizzBalance: 3,
          gemBalance: 5,
          lifetimeAura: 100,
          lifetimeRizz: 3,
          lifetimeGems: 5,
        },
      ],
      ledger: [
        {
          rewardLedgerEntryId: 'l1',
          userId: 'guest',
          rewardType: 'GEMS',
          amount: 20,
          balanceAfter: 20,
          reasonCode: RewardReason.GEM_ADMIN_ADJUSTMENT,
          sourceType: 'admin',
          sourceId: 'a',
          idempotencyKey: 'k1',
          metadata: null,
          createdAt: new Date(),
        },
      ],
    });

    await service.mergeAccounts('guest', 'real');

    expect(fake.account('real')).toMatchObject({
      auraBalance: 120,
      rizzBalance: 11,
      gemBalance: 25,
      lifetimeGems: 25,
    });
    // Aura mirrored onto the target user row.
    expect(fake.getUser('real')).toMatchObject({ totalAura: 120, weeklyAura: 70 });
    // Source drained; ledger re-parented.
    expect(fake.account('guest')).toMatchObject({ rizzBalance: 0, gemBalance: 0 });
    expect(fake.ledgerFor('real')).toHaveLength(1);
    expect(fake.ledgerFor('guest')).toHaveLength(0);
  });

  it('is a no-op when source and target are the same row (guest upgrade path)', async () => {
    const { fake, service } = makeService({
      users: [{ userId: 'u1', totalAura: 10 }],
      accounts: [
        {
          userId: 'u1',
          auraBalance: 10,
          rizzBalance: 5,
          gemBalance: 5,
          lifetimeAura: 10,
          lifetimeRizz: 5,
          lifetimeGems: 5,
        },
      ],
    });
    await service.mergeAccounts('u1', 'u1');
    expect(fake.account('u1')).toMatchObject({ rizzBalance: 5, gemBalance: 5 });
  });
});
