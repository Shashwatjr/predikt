import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthenticatedUser } from '../common/types/admin-authenticated-user';
import {
  safeAdminRoomDetail,
  safeAdminRoomListItem,
  safeAdminUserDetail,
  safeAdminUserListItem,
} from './utils/safe-admin-projections';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listRooms(query: Record<string, string | undefined>) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where = this.buildRoomFilters(query);

    const [total, rooms] = await Promise.all([
      this.prisma.predictionRoom.count({ where }),
      this.prisma.predictionRoom.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          creator: {
            select: {
              userId: true,
              name: true,
              prediktHandle: true,
              isGuest: true,
            },
          },
          _count: {
            select: {
              roomMemberships: true,
              milestonePredictions: true,
              reports: true,
            },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: rooms.map((room) =>
        safeAdminRoomListItem(room as unknown as Record<string, unknown>, {
          participantCount: room._count.roomMemberships,
          predictionCount: room._count.milestonePredictions,
          reportCount: room._count.reports,
        }),
      ),
    };
  }

  async roomDetail(roomId: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: {
        creator: {
          select: { userId: true, name: true, prediktHandle: true, isGuest: true },
        },
        rematches: {
          select: { roomId: true, inviteCode: true, status: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const [participantCount, predictionCount, reports, auditEvents] = await Promise.all([
      this.prisma.roomMembership.count({ where: { roomId } }),
      this.prisma.milestonePrediction.count({ where: { roomId } }),
      this.prisma.report.findMany({
        where: { roomId },
        select: {
          reportId: true,
          reportType: true,
          status: true,
          priority: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.auditLog.findMany({
        where: { targetId: roomId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return safeAdminRoomDetail(room as unknown as Record<string, unknown>, {
      participantCount,
      predictionCount,
      reports,
      auditEvents: auditEvents.map((log) => ({
        action: log.action,
        actorType: log.actorType,
        timestamp: log.createdAt,
        result: log.afterValue ? 'success' : 'recorded',
      })),
      rematchChain: room.rematches,
    });
  }

  async markRoomForReview(
    roomId: string,
    reason: string | undefined,
    adminUser: AdminAuthenticatedUser,
  ) {
    const room = await this.prisma.predictionRoom.findUnique({ where: { roomId } });
    if (!room) throw new NotFoundException('Room not found');

    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'room.marked_for_review',
      targetType: 'room',
      targetId: roomId,
      beforeValue: { status: room.status },
      afterValue: { reviewFlagged: true },
      reason,
    });

    return { roomId, markedForReview: true };
  }

  async listUsers(query: Record<string, string | undefined>) {
    const page = this.page(query.page);
    const pageSize = this.pageSize(query.pageSize);
    const where = this.buildUserFilters(query);

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          userId: true,
          name: true,
          prediktHandle: true,
          isGuest: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          roomsCreatedCount: true,
          predictionsMadeCount: true,
          totalAura: true,
        },
      }),
    ]);

    const reportCounts = await this.reportCountsForUsers(users.map((user) => user.userId));

    return {
      page,
      pageSize,
      total,
      items: users.map((user) => ({
        ...safeAdminUserListItem(user as unknown as Record<string, unknown>),
        reportCount: reportCounts.get(user.userId) ?? 0,
      })),
    };
  }

  async userDetail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');

    const [
      roomCount,
      predictionCount,
      reportsSubmitted,
      reportsReceived,
      badgesCount,
      activeRooms,
      blocks,
    ] = await Promise.all([
      this.prisma.predictionRoom.count({ where: { creatorUserId: userId } }),
      this.prisma.milestonePrediction.count({ where: { userId } }),
      this.prisma.report.count({ where: { reporterId: userId } }),
      this.prisma.report.count({ where: { targetUserId: userId } }),
      this.prisma.userBadge.count({ where: { userId } }),
      this.prisma.predictionRoom.count({
        where: {
          creatorUserId: userId,
          status: { in: ['created', 'predictions_open', 'predictions_locked', 'live'] },
        },
      }),
      this.prisma.userBlock.count({ where: { blockedId: userId } }),
    ]);

    return safeAdminUserDetail(user as unknown as Record<string, unknown>, {
      roomCount,
      predictionCount,
      reportsSubmitted,
      reportsReceived,
      badgesCount,
      activeRooms,
      isBlocked: blocks > 0,
    });
  }

  async disableUser(userId: string, reason: string | undefined, adminUser: AdminAuthenticatedUser) {
    return this.setUserStatus(userId, 'disabled', 'user.disabled', reason, adminUser);
  }

  async enableUser(userId: string, reason: string | undefined, adminUser: AdminAuthenticatedUser) {
    return this.setUserStatus(userId, 'active', 'user.enabled', reason, adminUser);
  }

  async markUserForReview(
    userId: string,
    reason: string | undefined,
    adminUser: AdminAuthenticatedUser,
  ) {
    return this.setUserStatus(userId, 'review', 'user.marked_for_review', reason, adminUser);
  }

  private async setUserStatus(
    userId: string,
    status: string,
    action: string,
    reason: string | undefined,
    adminUser: AdminAuthenticatedUser,
  ) {
    const before = await this.prisma.user.findUnique({ where: { userId } });
    if (!before) throw new NotFoundException('User not found');

    const after = await this.prisma.user.update({
      where: { userId },
      data: { status },
      select: {
        userId: true,
        name: true,
        prediktHandle: true,
        isGuest: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action,
      targetType: 'user',
      targetId: userId,
      beforeValue: { status: before.status },
      afterValue: { status: after.status },
      reason,
    });

    return safeAdminUserListItem(after as unknown as Record<string, unknown>);
  }

  private buildRoomFilters(query: Record<string, string | undefined>): Prisma.PredictionRoomWhereInput {
    const where: Prisma.PredictionRoomWhereInput = {};
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status as Prisma.PredictionRoomWhereInput['status'];
    if (query.unresolved === 'true') {
      where.status = { in: ['live', 'predictions_locked', 'predictions_open'] };
      where.resultDeadline = { lt: new Date() };
    }
    if (query.abandoned === 'true') where.abandonedAt = { not: null };
    if (query.autoClosed === 'true') where.autoClosedAt = { not: null };
    if (query.rematch === 'true') where.rematchOfRoomId = { not: null };
    if (query.reported === 'true') where.reports = { some: {} };
    if (query.guestCreated === 'true') {
      where.creator = { isGuest: true };
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }
    return where;
  }

  private buildUserFilters(query: Record<string, string | undefined>): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (query.accountType === 'guest') where.isGuest = true;
    if (query.accountType === 'registered') where.isGuest = false;
    if (query.status) where.status = query.status;
    if (query.reported === 'true') where.reportsReceived = { some: {} };
    return where;
  }

  private async reportCountsForUsers(userIds: string[]) {
    const counts = await this.prisma.report.groupBy({
      by: ['targetUserId'],
      where: { targetUserId: { in: userIds } },
      _count: { reportId: true },
    });
    return new Map(
      counts
        .filter((row) => row.targetUserId)
        .map((row) => [row.targetUserId as string, row._count.reportId]),
    );
  }

  private page(value?: string) {
    const page = Number(value ?? 1);
    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException('Invalid page');
    }
    return Math.floor(page);
  }

  private pageSize(value?: string) {
    const size = Number(value ?? DEFAULT_PAGE_SIZE);
    if (!Number.isFinite(size) || size < 1 || size > MAX_PAGE_SIZE) {
      throw new BadRequestException(`pageSize must be between 1 and ${MAX_PAGE_SIZE}`);
    }
    return Math.floor(size);
  }
}
