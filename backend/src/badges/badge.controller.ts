import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { BadgeService } from './badge.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

@Controller()
export class BadgeController {
  constructor(
    private readonly badgeService: BadgeService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('rooms/:roomId/badges')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getRoomBadges(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    await this.assertParticipant(roomId, user.userId);
    return this.badgeService.getRoomBadges(roomId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/me/badges')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getMyBadges(@CurrentUser() user: User) {
    return this.badgeService.getUserBadges(user.userId);
  }

  private async assertParticipant(roomId: string, userId: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      select: { creatorUserId: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    const membership = await this.prisma.roomMembership.findFirst({
      where: { roomId, userId, status: 'joined' },
    });
    if (room.creatorUserId !== userId && !membership) {
      throw new ForbiddenException('Only room participants can view badges');
    }
  }
}
