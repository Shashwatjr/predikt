import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRoleGuard } from './admin-role.guard';
import { AdminFeatureEnabledGuard } from './admin-feature-enabled.guard';
import { safeAdminAuditItem } from './utils/safe-admin-projections';
import { featureFlags } from '../config/feature-flags';

const adminUser = { adminUserId: 'admin-1', role: { roleName: 'super_admin' } } as any;

function makeService(prisma: any, audit: any = { log: jest.fn() }) {
  return new AdminService(prisma, {} as any, audit, {} as any);
}

describe('reverseCredits — money safety', () => {
  it('rejects a reversal larger than the balance (never goes negative)', async () => {
    const prisma = {
      creditLedger: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          user: { findUnique: jest.fn().mockResolvedValue({ creditBalance: 10 }), update: jest.fn() },
          creditLedger: { create: jest.fn() },
        }),
      ),
    };
    const service = makeService(prisma);

    await expect(
      service.reverseCredits({ userId: 'u1', amount: 50 } as any, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('is idempotent: a repeated key returns the original ledger without decrementing', async () => {
    const existing = { creditLedgerId: 'led-1', delta: -5 };
    const prisma = {
      creditLedger: { findUnique: jest.fn().mockResolvedValue(existing) },
      $transaction: jest.fn(),
    };
    const service = makeService(prisma);

    const result = await service.reverseCredits(
      { userId: 'u1', amount: 5, idempotencyKey: 'abc' } as any,
      adminUser,
    );

    expect(result).toBe(existing);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditLedger.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'admin_reverse:abc' },
    });
  });

  it('decrements atomically and writes a ledger + audit entry on the happy path', async () => {
    const createdLedger = { creditLedgerId: 'led-2', delta: -30, balanceAfter: 70 };
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ creditBalance: 100 }),
        update: jest.fn().mockResolvedValue({ creditBalance: 70 }),
      },
      creditLedger: { create: jest.fn().mockResolvedValue(createdLedger) },
    };
    const prisma = {
      creditLedger: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    const audit = { log: jest.fn() };
    const service = makeService(prisma, audit);

    const result = await service.reverseCredits(
      { userId: 'u1', amount: 30, reason: 'refund', idempotencyKey: 'k2' } as any,
      adminUser,
    );

    expect(result).toBe(createdLedger);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { creditBalance: { decrement: 30 } } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'credits.reversed', targetId: 'u1' }),
    );
  });
});

describe('AdminRoleGuard — RBAC enforcement', () => {
  const makeCtx = (adminUserCtx: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ adminUser: adminUserCtx }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  const reflectorRequiring = (permission: string | undefined) =>
    ({ getAllAndOverride: jest.fn().mockReturnValue(permission) }) as any;

  it('allows super_admin (permissions.all) for any required permission', () => {
    const guard = new AdminRoleGuard(reflectorRequiring('admin.credits.reverse'));
    expect(
      guard.canActivate(makeCtx({ role: { roleName: 'super_admin', permissions: { all: true } } })),
    ).toBe(true);
  });

  it('denies a portal role that lacks the required permission', () => {
    const guard = new AdminRoleGuard(reflectorRequiring('admin.credits.reverse'));
    expect(() =>
      guard.canActivate(
        makeCtx({ role: { roleName: 'platform_ops', permissions: { 'admin.users.read': true } } }),
      ),
    ).toThrow(/Missing required admin permission/);
  });

  it('denies a non-portal role before checking any permission', () => {
    const guard = new AdminRoleGuard(reflectorRequiring(undefined));
    expect(() =>
      guard.canActivate(makeCtx({ role: { roleName: 'not_an_admin', permissions: {} } })),
    ).toThrow(/Admin access required/);
  });
});

describe('AdminFeatureEnabledGuard — kill switch', () => {
  const guard = new AdminFeatureEnabledGuard();
  const original = featureFlags.adminPortalEnabled;
  afterEach(() => {
    (featureFlags as any).adminPortalEnabled = original;
  });

  it('throws 404 (hides existence) when the portal flag is off', () => {
    (featureFlags as any).adminPortalEnabled = false;
    expect(() => guard.canActivate({} as any)).toThrow(NotFoundException);
  });

  it('allows the request when the portal flag is on', () => {
    (featureFlags as any).adminPortalEnabled = true;
    expect(guard.canActivate({} as any)).toBe(true);
  });
});

describe('safeAdminAuditItem — metadata sanitization', () => {
  it('strips credentials, guest keys, and coordinates (recursively) from audit metadata', () => {
    const item = safeAdminAuditItem({
      auditLogId: 'a1',
      action: 'credits.reversed',
      actorType: 'admin',
      createdAt: new Date('2026-07-13T00:00:00Z'),
      metadata: {
        guestKey: 'gk-secret',
        email: 'user@example.com',
        startingLat: 12.9716,
        accessToken: 'tok-123',
        keep: 'visible',
        nested: { destinationLng: 77.5946, password: 'p' },
      },
    });

    const serialized = JSON.stringify(item);
    for (const leaked of ['gk-secret', 'user@example.com', '12.9716', 'tok-123', '77.5946']) {
      expect(serialized).not.toContain(leaked);
    }
    expect(serialized).toContain('visible');
  });
});
