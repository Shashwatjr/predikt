import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthenticatedUser } from '../common/types/admin-authenticated-user';
import { safeAdminReportItem } from './utils/safe-admin-projections';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class AdminModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: Record<string, string | undefined>) {
    const page = Number(query.page ?? 1);
    const pageSize = Math.min(Number(query.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const where: Prisma.ReportWhereInput = {};
    if (query.status) where.status = query.status as Prisma.ReportWhereInput['status'];
    if (query.type) where.reportType = query.type as Prisma.ReportWhereInput['reportType'];
    if (query.priority) where.priority = query.priority;

    const [total, items] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          targetUser: { select: { userId: true, prediktHandle: true } },
          room: { select: { roomId: true, roomTitle: true } },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: items.map((item) => safeAdminReportItem(item as unknown as Record<string, unknown>)),
    };
  }

  async updateReport(
    reportId: string,
    body: { status?: string; priority?: string; resolution?: string },
    adminUser: AdminAuthenticatedUser,
  ) {
    const before = await this.prisma.report.findUnique({ where: { reportId } });
    if (!before) throw new NotFoundException('Report not found');

    const after = await this.prisma.report.update({
      where: { reportId },
      data: {
        status: body.status as Prisma.ReportUpdateInput['status'],
        priority: body.priority,
        assignedAdminId: adminUser.adminUserId,
        reason: body.resolution ?? before.reason,
      },
      include: {
        targetUser: { select: { userId: true, prediktHandle: true } },
        room: { select: { roomId: true, roomTitle: true } },
      },
    });

    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'report.updated',
      targetType: 'report',
      targetId: reportId,
      beforeValue: { status: before.status, priority: before.priority },
      afterValue: { status: after.status, priority: after.priority },
      reason: body.resolution,
    });

    return safeAdminReportItem(after as unknown as Record<string, unknown>);
  }

  async forceSafeCommentaryFallback(
    roomId: string,
    reason: string | undefined,
    adminUser: AdminAuthenticatedUser,
  ) {
    const commentary = await this.prisma.roomCommentary.findFirst({
      where: { roomId, isCurrent: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!commentary) throw new NotFoundException('No commentary found for room');

    const after = await this.prisma.roomCommentary.update({
      where: { commentaryId: commentary.commentaryId },
      data: {
        moderationStatus: 'fallback',
        moderationReason: reason ?? 'Admin forced safe commentary fallback',
        provider: 'templates',
        safetyMode: 'deterministic',
      },
    });

    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'commentary.fallback_forced',
      targetType: 'room',
      targetId: roomId,
      afterValue: { commentaryId: after.commentaryId, moderationStatus: after.moderationStatus },
      reason,
    });

    return { roomId, commentaryId: after.commentaryId, moderationStatus: after.moderationStatus };
  }
}
