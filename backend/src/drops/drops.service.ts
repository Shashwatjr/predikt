import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class DropsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDrops() {
    return this.prisma.drop.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async myDrops(user: User) {
    return this.prisma.userDrop.findMany({
      where: { userId: user.userId },
      include: { drop: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  async unlockDrop(dropId: string, user: User) {
    const drop = await this.prisma.drop.findUnique({ where: { dropId } });
    if (!drop || drop.status !== 'active') {
      throw new NotFoundException('Drop not found');
    }
    if (user.cloutBalance < drop.cloutCost) {
      throw new BadRequestException('Not enough Clout to unlock this Drop');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { userId: user.userId },
        data: { cloutBalance: { decrement: drop.cloutCost } },
      });
      await tx.cloutTransaction.create({
        data: {
          userId: user.userId,
          amount: -drop.cloutCost,
          transactionType: 'spend',
          reason: `Unlocked Drop: ${drop.title}`,
        },
      });
      return tx.userDrop.create({
        data: { userId: user.userId, dropId },
        include: { drop: true },
      });
    });
  }

  async redeemDrop(userDropId: string, user: User) {
    const userDrop = await this.prisma.userDrop.findFirst({
      where: { userDropId, userId: user.userId },
      include: { drop: true },
    });
    if (!userDrop) throw new NotFoundException('User Drop not found');
    if (userDrop.status !== 'unlocked') {
      throw new BadRequestException('Only unlocked Drops can be redeemed');
    }

    return this.prisma.userDrop.update({
      where: { userDropId },
      data: {
        status: 'redeemed',
        redeemedAt: new Date(),
        redemptionCode: userDrop.redemptionCode ?? `DROP-${userDropId.slice(0, 8).toUpperCase()}`,
      },
      include: { drop: true },
    });
  }
}
