import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('sanitizes handle availability checks', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;
    const service = new UsersService(prisma);

    const result = await service.handleAvailable('@My.Handle');

    expect(result).toEqual({ handle: 'my.handle', available: true });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { prediktHandle: 'my.handle' },
    });
  });

  it('rejects invalid handles', async () => {
    const service = new UsersService({ user: {} } as any);
    await expect(service.handleAvailable('ab')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.handleAvailable('bad handle')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updates profile with sanitized handle', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          userId: 'u1',
          name: 'Aarav',
          prediktHandle: 'new.handle',
          profileImage: null,
        }),
      },
    } as any;
    const service = new UsersService(prisma);

    const result = await service.updateProfile(
      { userId: 'u1', name: 'Aarav', profileImage: null } as any,
      { name: 'Aarav Kapoor', prediktHandle: '@New.Handle', profileImage: null },
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prediktHandle: 'new.handle',
        }),
      }),
    );
    expect(result.prediktHandle).toBe('new.handle');
  });

  it('rejects duplicate handles', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ userId: 'u2' }),
      },
    } as any;
    const service = new UsersService(prisma);

    await expect(
      service.updateProfile({ userId: 'u1', name: 'Aarav' } as any, {
        prediktHandle: 'taken.handle',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('generates dynamic suggestions from user name', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { prediktHandle: 'someone' },
          { prediktHandle: 'else' },
        ]),
      },
    } as any;

    const service = new UsersService(prisma);
    const result = await service.handleSuggestions({
      name: 'Aarav Kapoor',
    } as any);

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.every((entry: any) => typeof entry.handle === 'string')).toBe(true);
  });
});
