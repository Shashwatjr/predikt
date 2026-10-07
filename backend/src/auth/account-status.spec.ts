import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminService } from '../admin/admin.service';
import { AdminOperationsService } from '../admin/admin-operations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminAuthenticatedUser } from '../common/types/admin-authenticated-user';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

const adminActor: AdminAuthenticatedUser = {
  adminUserId: 'admin-1',
  email: 'admin@predikt.local',
  name: 'Admin',
  status: 'active',
  role: { roleName: 'super_admin' },
};

function authConfig() {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret-test-secret-test-secret';
      if (key === 'JWT_ACCESS_TTL_SECONDS') return 900;
      if (key === 'JWT_REFRESH_TTL_DAYS') return 30;
      return undefined;
    }),
  } as unknown as ConfigService;
}

function productUser(status: string) {
  return {
    userId: 'user-1',
    email: 'player@predikt.local',
    name: 'Player',
    status,
    isGuest: false,
    passwordHash: '',
    prediktHandle: 'player',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('product account status', () => {
  describe('login', () => {
    async function loginAs(status: string, password = 'Player123!') {
      const passwordHash = await bcrypt.hash(password, 4);
      const user = { ...productUser(status), passwordHash };
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(user) },
        userSession: { create: jest.fn().mockResolvedValue({}) },
      };
      const service = new AuthService(
        prisma as any,
        { signAsync: jest.fn().mockResolvedValue('signed-token') } as unknown as JwtService,
        authConfig(),
      );
      return { service, prisma };
    }

    it('issues tokens for an active user', async () => {
      const { service, prisma } = await loginAs('active');
      const result = await service.login({
        email: 'player@predikt.local',
        password: 'Player123!',
      });
      expect(result.accessToken).toBe('signed-token');
      expect(result.user).not.toHaveProperty('status');
      expect(prisma.userSession.create).toHaveBeenCalled();
    });

    it.each(['disabled', 'suspended'])(
      'rejects a %s user with the same credentials error and mints no session',
      async (status) => {
        const { service, prisma } = await loginAs(status);
        await expect(
          service.login({ email: 'player@predikt.local', password: 'Player123!' }),
        ).rejects.toThrow('Invalid credentials');
        expect(prisma.userSession.create).not.toHaveBeenCalled();
      },
    );

    it('uses the same error for a bad password', async () => {
      const { service } = await loginAs('active', 'Player123!');
      await expect(
        service.login({ email: 'player@predikt.local', password: 'wrong-password' }),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refresh', () => {
    async function refreshAs(status: string) {
      const refreshToken = 'refresh-plain';
      const refreshTokenHash = await bcrypt.hash(refreshToken, 4);
      const prisma = {
        userSession: {
          findUnique: jest.fn().mockResolvedValue({
            userSessionId: 'session-1',
            userId: 'user-1',
            refreshTokenHash,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            user: productUser(status),
          }),
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
        },
      };
      const service = new AuthService(
        prisma as any,
        {
          verifyAsync: jest.fn().mockResolvedValue({
            sub: 'user-1',
            sid: 'session-1',
            tokenType: 'refresh',
          }),
          signAsync: jest.fn().mockResolvedValue('signed-token'),
        } as unknown as JwtService,
        authConfig(),
      );
      return { service, prisma, refreshToken };
    }

    it('rotates a session for an active user', async () => {
      const { service, prisma, refreshToken } = await refreshAs('active');
      const result = await service.refresh({ refreshToken });
      expect(result.accessToken).toBe('signed-token');
      expect(prisma.userSession.update).toHaveBeenCalled();
      expect(prisma.userSession.create).toHaveBeenCalled();
    });

    it.each(['disabled', 'suspended'])(
      'refuses to mint a new session for a %s user',
      async (status) => {
        const { service, prisma, refreshToken } = await refreshAs(status);
        await expect(service.refresh({ refreshToken })).rejects.toThrow(
          'Invalid or expired refresh token',
        );
        expect(prisma.userSession.update).not.toHaveBeenCalled();
        expect(prisma.userSession.create).not.toHaveBeenCalled();
      },
    );
  });

  describe('JwtAuthGuard via JwtStrategy.validate', () => {
    const findUnique = jest.fn();
    const strategy = new JwtStrategy(
      { getOrThrow: () => 'test-secret-test-secret-test-secret' } as any,
      { user: { findUnique } } as any,
    );
    const guard = new JwtAuthGuard();
    const payload = {
      sub: 'user-1',
      email: 'player@predikt.local',
      tokenType: 'access' as const,
    };

    beforeEach(() => findUnique.mockReset());

    it('accepts an active user and does not attach status to the request user', async () => {
      findUnique.mockResolvedValue({
        userId: 'user-1',
        email: 'player@predikt.local',
        name: 'Player',
        status: 'active',
      });
      const user = await strategy.validate(payload);
      expect(user).toMatchObject({ userId: 'user-1', email: 'player@predikt.local' });
      expect(user).not.toHaveProperty('status');
      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ status: true }),
        }),
      );
    });

    it.each(['disabled', 'suspended'])(
      'rejects a previously valid access token when the user is %s',
      async (status) => {
        findUnique.mockResolvedValue({
          userId: 'user-1',
          email: 'player@predikt.local',
          status,
        });
        let caught: unknown;
        try {
          await strategy.validate(payload);
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(UnauthorizedException);
        expect((caught as UnauthorizedException).message).toBe('Unauthorized');
        expect(() =>
          guard.handleRequest(caught, false, undefined, {} as any),
        ).toThrow(UnauthorizedException);
      },
    );
  });

  describe('session revocation', () => {
    function operationsPrisma(nextStatus: string) {
      return {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            userId: 'user-1',
            name: 'Player',
            status: 'active',
            isGuest: false,
          }),
          update: jest.fn().mockResolvedValue({
            userId: 'user-1',
            name: 'Player',
            prediktHandle: 'player',
            isGuest: false,
            status: nextStatus,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        userSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
    }

    it('revokes open sessions when an admin disables a user', async () => {
      const prisma = operationsPrisma('disabled');
      const service = new AdminOperationsService(prisma as any, { log: jest.fn() } as any);
      await service.disableUser('user-1', 'abuse', adminActor);
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('leaves sessions in place when an admin re-enables a user', async () => {
      const prisma = operationsPrisma('active');
      const service = new AdminOperationsService(prisma as any, { log: jest.fn() } as any);
      await service.enableUser('user-1', undefined, adminActor);
      expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
    });

    it('revokes open sessions when an admin suspends a user', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ userId: 'user-1', status: 'active' }),
          update: jest.fn().mockResolvedValue({ userId: 'user-1', status: 'suspended' }),
        },
        userSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      };
      const service = new AdminService(
        prisma as any,
        { signAsync: jest.fn() } as unknown as JwtService,
        { log: jest.fn() } as any,
        authConfig(),
      );
      await service.suspendUser('user-1', { status: 'suspended', reason: 'review' }, adminActor);
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokes open sessions when patchUserStatus sets suspended', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ userId: 'user-1', status: 'active' }),
          update: jest.fn().mockResolvedValue({ userId: 'user-1', status: 'suspended' }),
        },
        userSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const service = new AdminService(
        prisma as any,
        { signAsync: jest.fn() } as unknown as JwtService,
        { log: jest.fn() } as any,
        authConfig(),
      );
      await service.patchUserStatus('user-1', { status: 'suspended' }, adminActor);
      expect(prisma.userSession.updateMany).toHaveBeenCalled();
    });
  });
});
