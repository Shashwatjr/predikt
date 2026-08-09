import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import {
  assertHandleAvailable,
  buildHandleSuggestions,
  sanitizePrediktHandle,
  validatePrediktHandle,
} from '../common/utils/predikt-handle';
import { safeSelfUser } from '../common/utils/safe-user-select';
import { findBannedBettingTerms } from '../common/utils/content-policy';
import { POLICY_BLOCK_MESSAGE } from '../common/constants/policy.constants';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(user: User, body: any) {
    const blockedTerms = [
      ...findBannedBettingTerms(body.name),
      ...findBannedBettingTerms(body.profileText),
    ];
    if (blockedTerms.length) {
      throw new BadRequestException({
        message: POLICY_BLOCK_MESSAGE,
        blockedTerms,
      });
    }

    const prediktHandle = sanitizePrediktHandle(body.prediktHandle);
    validatePrediktHandle(prediktHandle);

    if (prediktHandle) {
      const existing = await this.prisma.user.findFirst({
        where: {
          prediktHandle,
          NOT: { userId: user.userId },
        },
      });
      assertHandleAvailable(!!existing);
    }

    const updated = await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        name: body.name ?? user.name,
        prediktHandle,
        avatarKey: body.avatarKey ?? user.avatarKey,
        selectedBackgroundKey:
          body.selectedBackgroundKey ?? user.selectedBackgroundKey,
        marketingOptIn:
          typeof body.marketingOptIn === 'boolean'
            ? body.marketingOptIn
            : user.marketingOptIn,
        aiPersonalisationOptOut:
          typeof body.aiPersonalisationOptOut === 'boolean'
            ? body.aiPersonalisationOptOut
            : user.aiPersonalisationOptOut,
        locationConsentStatus:
          body.locationConsentStatus ?? user.locationConsentStatus,
        profileImage:
          Object.prototype.hasOwnProperty.call(body, 'profileImage')
            ? body.profileImage
            : user.profileImage,
      },
    });

    return safeSelfUser(updated);
  }

  async handleAvailable(rawHandle: string) {
    const handle = sanitizePrediktHandle(rawHandle);
    validatePrediktHandle(handle);
    const existing = await this.prisma.user.findFirst({
      where: { prediktHandle: handle ?? undefined },
    });
    return {
      handle,
      available: !existing,
    };
  }

  async handleSuggestions(user: User) {
    const users = await this.prisma.user.findMany({
      where: { prediktHandle: { not: null } },
      select: { prediktHandle: true },
    });
    const existingHandles = new Set(
      users
        .map((entry) => entry.prediktHandle)
        .filter((handle): handle is string => !!handle),
    );

    return {
      suggestions: buildHandleSuggestions(user.name, existingHandles),
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.safeUser(user);
  }

  async follow(currentUser: User, targetUserId: string) {
    if (currentUser.userId === targetUserId) {
      return { success: false, message: 'You cannot follow yourself.' };
    }
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: currentUser.userId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUser.userId },
        ],
      },
    });
    if (block) {
      throw new ForbiddenException('Blocked users cannot follow each other.');
    }

    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: currentUser.userId,
          followingId: targetUserId,
        },
      },
      update: {},
      create: {
        followerId: currentUser.userId,
        followingId: targetUserId,
      },
    });

    return { success: true };
  }

  async unfollow(currentUser: User, targetUserId: string) {
    await this.prisma.follow.deleteMany({
      where: {
        followerId: currentUser.userId,
        followingId: targetUserId,
      },
    });
    return { success: true };
  }

  async following(currentUser: User) {
    return this.prisma.follow.findMany({
      where: { followerId: currentUser.userId },
      include: {
        following: {
          select: {
            userId: true,
            name: true,
            prediktHandle: true,
            weeklyAura: true,
            cloutBalance: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async followers(currentUser: User) {
    return this.prisma.follow.findMany({
      where: { followingId: currentUser.userId },
      include: {
        follower: {
          select: {
            userId: true,
            name: true,
            prediktHandle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reliabilitySummary(userId: string) {
    const entries = await this.prisma.userReliabilityLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return {
      reliabilityScore: entries.reduce((sum, entry) => sum + entry.pointsDelta, 0),
      reliabilityEvents: entries.length,
      recentReliability: entries.slice(0, 5).map((entry) => ({
        eventType: entry.eventType,
        pointsDelta: entry.pointsDelta,
        reason: entry.reason,
        createdAt: entry.createdAt,
      })),
    };
  }

  safeUser(user: any) {
    return safeSelfUser(user);
  }
}
