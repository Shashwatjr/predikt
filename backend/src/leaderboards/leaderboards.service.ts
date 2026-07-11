import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_PUBLIC_USER_SELECT, safePublicUser } from '../common/utils/safe-user-select';

@Injectable()
export class LeaderboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async roomLeaderboard(roomId: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
    });
    if (!room) throw new NotFoundException('Room not found');

    const results = await this.prisma.roomResult.findMany({
      where: { roomId },
      include: { user: { select: SAFE_PUBLIC_USER_SELECT } },
      orderBy: [{ overallRank: 'asc' }, { totalRoomAura: 'desc' }],
    });

    return results.map((result) => ({
      user: safePublicUser(result.user),
      userId: result.user.userId,
      name: result.user.prediktHandle ? `@${result.user.prediktHandle}` : result.user.name,
      prediktHandle: result.user.prediktHandle,
      overallRank: result.overallRank,
      totalRoomAura: result.totalRoomAura,
      totalRoomClout: result.totalRoomClout,
      milestonesWon: result.milestonesWon,
      auraEarned: result.totalRoomAura,
    }));
  }

  async weeklyLeaderboard() {
    const users = await this.prisma.user.findMany({
      where: { weeklyAura: { gt: 0 } },
      orderBy: { weeklyAura: 'desc' },
      take: 50,
      select: SAFE_PUBLIC_USER_SELECT,
    });
    return users.map((user, index) => ({
      rank: index + 1,
      ...safePublicUser(user),
      weeklyAura: user.weeklyAura,
      totalAura: user.totalAura,
    }));
  }
}
