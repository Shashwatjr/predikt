import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  it('authenticates an admin and writes an audit log', async () => {
    const passwordHash = await bcrypt.hash('Admin123!', 1);
    const prisma = {
      adminUser: {
        findUnique: jest.fn().mockResolvedValue({
          adminUserId: 'admin-1',
          name: 'Admin',
          email: 'admin@predikt.local',
          passwordHash,
          role: { roleName: 'super_admin' },
        }),
        update: jest.fn(),
      },
    } as any;

    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('admin-token'),
    } as unknown as JwtService;

    const auditService = {
      log: jest.fn(),
    } as any;

    const configService = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          key === 'ADMIN_JWT_SECRET' ? 'test-admin-secret-1234567890' : 3600,
        ),
    } as unknown as ConfigService;

    const service = new AdminService(prisma, jwtService, auditService, configService);
    const result = await service.login(
      { email: 'admin@predikt.local', password: 'Admin123!' },
      {},
    );

    expect(result.accessToken).toBe('admin-token');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.login.success' }),
    );
  });
});
