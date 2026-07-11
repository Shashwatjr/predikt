import { BadRequestException } from '@nestjs/common';
import { DropsService } from './drops.service';

describe('DropsService', () => {
  it('rejects unlock when Clout is insufficient', async () => {
    const prisma = {
      drop: {
        findUnique: jest.fn().mockResolvedValue({
          dropId: 'drop-1',
          status: 'active',
          cloutCost: 50,
          title: 'Coffee Drop',
        }),
      },
    } as any;

    const service = new DropsService(prisma);

    await expect(
      service.unlockDrop('drop-1', { userId: 'u1', cloutBalance: 10 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unlocks drop when Clout is sufficient', async () => {
    const transaction = jest.fn().mockImplementation(async (callback) =>
      callback({
        user: { update: jest.fn() },
        cloutTransaction: { create: jest.fn() },
        userDrop: {
          create: jest.fn().mockResolvedValue({
            userDropId: 'ud-1',
            drop: { title: 'Coffee Drop' },
          }),
        },
      }),
    );

    const prisma = {
      drop: {
        findUnique: jest.fn().mockResolvedValue({
          dropId: 'drop-1',
          status: 'active',
          cloutCost: 50,
          title: 'Coffee Drop',
        }),
      },
      $transaction: transaction,
    } as any;

    const service = new DropsService(prisma);
    const result = await service.unlockDrop('drop-1', {
      userId: 'u1',
      cloutBalance: 80,
    } as any);

    expect(result.userDropId).toBe('ud-1');
    expect(transaction).toHaveBeenCalled();
  });
});
