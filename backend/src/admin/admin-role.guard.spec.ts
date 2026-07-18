import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRoleGuard } from './admin-role.guard';

describe('AdminRoleGuard', () => {
  function contextFor(roleName: string, permissions: Record<string, unknown> = {}) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          adminUser: {
            role: {
              roleName,
              permissions,
            },
          },
        }),
      }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    } as any;
  }

  it('allows super admins to bypass explicit permission checks', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('admin.users.disable'),
    } as unknown as Reflector;
    const guard = new AdminRoleGuard(reflector);

    expect(
      guard.canActivate(contextFor('super_admin', { all: true })),
    ).toBe(true);
  });

  it('rejects portal-eligible roles without the required permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('admin.credits.reverse'),
    } as unknown as Reflector;
    const guard = new AdminRoleGuard(reflector);

    expect(() => guard.canActivate(contextFor('campaign_manager', {}))).toThrow(
      ForbiddenException,
    );
  });

  it('allows roles that hold the required permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('admin.privacy.action'),
    } as unknown as Reflector;
    const guard = new AdminRoleGuard(reflector);

    expect(
      guard.canActivate(
        contextFor('privacy_officer', { 'admin.privacy.action': true }),
      ),
    ).toBe(true);
  });
});
