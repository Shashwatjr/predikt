import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportType, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { findBannedBettingTerms } from '../common/utils/content-policy';
import { POLICY_BLOCK_MESSAGE } from '../common/constants/policy.constants';
import { SAFE_PUBLIC_USER_SELECT, safePublicUser } from '../common/utils/safe-user-select';

const ALLOWED_REACTIONS = new Set(['🔥', '🎯', '👑', '😂', '😭', '🤝', '⚡', '🌧️', '🍕', '💪']);

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async report(user: User, body: any) {
    if (!body.reportType || !Object.values(ReportType).includes(body.reportType)) {
      throw new BadRequestException('Invalid report type');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: user.userId,
        targetUserId: body.targetUserId,
        roomId: body.roomId,
        reportType: body.reportType,
        reason: body.reason,
        metadata: body.metadata,
      },
    });
    await this.auditService.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'report.created',
      targetType: body.roomId ? 'room' : 'user',
      targetId: body.roomId ?? body.targetUserId,
      afterValue: { reportId: report.reportId, reportType: report.reportType },
    });
    return { reportId: report.reportId, status: report.status };
  }

  async block(currentUser: User, targetUserId: string, reason?: string) {
    if (currentUser.userId === targetUserId) {
      throw new BadRequestException('You cannot block yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { userId: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    const block = await this.prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: currentUser.userId,
          blockedId: targetUserId,
        },
      },
      update: { reason },
      create: {
        blockerId: currentUser.userId,
        blockedId: targetUserId,
        reason,
      },
    });
    await this.prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: currentUser.userId, followingId: targetUserId },
          { followerId: targetUserId, followingId: currentUser.userId },
        ],
      },
    });
    await this.auditService.log({
      actorType: 'user',
      actorId: currentUser.userId,
      action: 'user.blocked',
      targetType: 'user',
      targetId: targetUserId,
      reason,
    });
    return block;
  }

  async unblock(currentUser: User, targetUserId: string) {
    await this.prisma.userBlock.deleteMany({
      where: { blockerId: currentUser.userId, blockedId: targetUserId },
    });
    await this.auditService.log({
      actorType: 'user',
      actorId: currentUser.userId,
      action: 'user.unblocked',
      targetType: 'user',
      targetId: targetUserId,
    });
    return { success: true };
  }

  async blocked(currentUser: User) {
    const blocks = await this.prisma.userBlock.findMany({
      where: { blockerId: currentUser.userId },
      include: { blocked: { select: SAFE_PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return blocks.map((block) => ({
      createdAt: block.createdAt,
      reason: block.reason,
      user: safePublicUser(block.blocked),
    }));
  }

  async disputeRoom(currentUser: User, roomId: string, body: any) {
    const room = await this.prisma.predictionRoom.findUnique({ where: { roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (!body.reason) throw new BadRequestException('Dispute reason is required');

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.roomDispute.create({
        data: { roomId, userId: currentUser.userId, reason: body.reason },
      });
      await tx.predictionRoom.update({
        where: { roomId },
        data: { resultDisputed: true, rewardsSuppressed: true },
      });
      return created;
    });

    await this.auditService.log({
      actorType: 'user',
      actorId: currentUser.userId,
      action: 'room.dispute.created',
      targetType: 'room',
      targetId: roomId,
      afterValue: { disputeId: dispute.disputeId },
      reason: body.reason,
    });
    return dispute;
  }

  async reactToResult(currentUser: User, roomId: string, body: any) {
    const emoji = body.emoji;
    if (!ALLOWED_REACTIONS.has(emoji)) {
      throw new BadRequestException('Unsupported result reaction');
    }
    const room = await this.prisma.predictionRoom.findUnique({ where: { roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== 'completed') {
      throw new ForbiddenException('Reactions are available after results');
    }
    const membership = await this.prisma.roomMembership.findFirst({
      where: { roomId, userId: currentUser.userId, status: 'joined' },
    });
    if (room.creatorUserId !== currentUser.userId && !membership) {
      throw new ForbiddenException('Only room participants can react to results');
    }

    await this.prisma.resultReaction.deleteMany({
      where: { roomId, userId: currentUser.userId },
    });

    const reaction = await this.prisma.resultReaction.create({
      data: { roomId, userId: currentUser.userId, emoji },
    });
    await this.auditService.log({
      actorType: 'user',
      actorId: currentUser.userId,
      action: 'room.result_reaction.updated',
      targetType: 'room',
      targetId: roomId,
      afterValue: { emoji },
    });
    return reaction;
  }

  async assertTextAllowed(user: User, text?: string | null) {
    const blocked = findBannedBettingTerms(text);
    if (!blocked.length) return;
    await this.auditService.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'policy.keyword_blocked',
      targetType: 'moderation_text',
      afterValue: { blocked },
      reason: POLICY_BLOCK_MESSAGE,
    });
    throw new BadRequestException({
      message: POLICY_BLOCK_MESSAGE,
      blockedTerms: blocked,
    });
  }
}
