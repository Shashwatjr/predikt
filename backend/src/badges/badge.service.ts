import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BADGE_CATALOG, BadgeKey, CATEGORY_WINNER_BADGE } from './badge.types';

type AwardContext = {
  roomId: string;
  category: string;
  winnerUserId?: string | null;
  userBeatBot?: boolean;
  dotBonusAwarded?: boolean;
  diffSeconds?: number | null;
  isNeutralClosure?: boolean;
  participantCount?: number;
};

@Injectable()
export class BadgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async awardRoomBadges(context: AwardContext) {
    if (context.isNeutralClosure || !context.winnerUserId) {
      return [];
    }

    const awarded: Array<{ userId: string; badgeKey: BadgeKey; title: string }> = [];
    const categoryBadge = CATEGORY_WINNER_BADGE[context.category] ?? 'group_oracle';

    const winnerBadges: BadgeKey[] = [categoryBadge, 'group_oracle'];
    if (context.userBeatBot) {
      winnerBadges.push('bot_beater', 'human_edge');
    }
    if (context.dotBonusAwarded) {
      winnerBadges.push('dot_bonus');
    }
    if (typeof context.diffSeconds === 'number' && context.diffSeconds <= 60) {
      if (context.category === 'arrival_time') {
        winnerBadges.push('eta_sniper');
      }
      if (context.category === 'food_eta') {
        winnerBadges.push('beat_the_eta');
      }
      if (context.category === 'weather_rain') {
        winnerBadges.push('forecast_beater');
      }
    }
    if ((context.participantCount ?? 0) >= 3 && context.category === 'whos_late') {
      winnerBadges.push('group_chaos');
    }

    for (const badgeKey of [...new Set(winnerBadges)]) {
      const badge = await this.ensureBadge({
        userId: context.winnerUserId,
        badgeKey,
        roomId: context.roomId,
        category: context.category,
      });
      if (badge) {
        awarded.push({ userId: context.winnerUserId, badgeKey, title: badge.title });
      }
    }

    return awarded;
  }

  async ensureBadge(input: {
    userId: string;
    badgeKey: BadgeKey | string;
    roomId?: string | null;
    category?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const definition = BADGE_CATALOG[input.badgeKey as BadgeKey];
    if (!definition) {
      return null;
    }

    const roomId = input.roomId ?? null;
    const existing = await this.prisma.userBadge.findFirst({
      where: {
        userId: input.userId,
        badgeKey: definition.badgeKey,
        roomId,
      },
    });
    if (existing) {
      return existing;
    }

    const created = await this.prisma.userBadge.create({
      data: {
        userId: input.userId,
        badgeKey: definition.badgeKey,
        roomId,
        category: input.category ?? null,
        title: definition.title,
        description: definition.description,
        icon: definition.icon,
        metadata: input.metadata as any,
      },
    });

    await this.auditService.log({
      actorType: 'system',
      action: 'badge.awarded',
      targetType: 'user',
      targetId: input.userId,
      afterValue: {
        badgeKey: definition.badgeKey,
        roomId,
        category: input.category ?? null,
      },
    });

    return created;
  }

  async getRoomBadges(roomId: string) {
    const badges = await this.prisma.userBadge.findMany({
      where: { roomId },
      orderBy: { awardedAt: 'asc' },
      select: {
        userBadgeId: true,
        userId: true,
        badgeKey: true,
        title: true,
        description: true,
        icon: true,
        category: true,
        awardedAt: true,
      },
    });

    return badges.map((badge) => ({
      ...badge,
      awardedAt: badge.awardedAt.toISOString(),
    }));
  }

  async getUserBadges(userId: string, limit = 50) {
    const badges = await this.prisma.userBadge.findMany({
      where: { userId },
      orderBy: { awardedAt: 'desc' },
      take: limit,
      select: {
        userBadgeId: true,
        badgeKey: true,
        roomId: true,
        title: true,
        description: true,
        icon: true,
        category: true,
        awardedAt: true,
      },
    });

    return badges.map((badge) => ({
      ...badge,
      awardedAt: badge.awardedAt.toISOString(),
    }));
  }
}
