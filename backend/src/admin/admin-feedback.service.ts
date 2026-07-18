import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthenticatedUser } from '../common/types/admin-authenticated-user';
import { safeAdminFeedbackItem } from './utils/safe-admin-projections';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class AdminFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: Record<string, string | undefined>) {
    const page = Number(query.page ?? 1);
    const pageSize = Math.min(Number(query.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.type) where.feedbackType = query.type;
    if (query.priority) where.priority = query.priority;

    const [total, items] = await Promise.all([
      this.prisma.userFeedback.count({ where }),
      this.prisma.userFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: { userId: true, name: true, prediktHandle: true },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: items.map((item) => safeAdminFeedbackItem(item as unknown as Record<string, unknown>)),
    };
  }

  async update(
    feedbackId: string,
    body: {
      status?: string;
      priority?: string;
      internalNotes?: string;
      assignedAdminId?: string;
    },
    adminUser: AdminAuthenticatedUser,
  ) {
    const before = await this.prisma.userFeedback.findUnique({ where: { feedbackId } });
    if (!before) throw new NotFoundException('Feedback not found');

    const after = await this.prisma.userFeedback.update({
      where: { feedbackId },
      data: {
        status: body.status,
        priority: body.priority,
        internalNotes: body.internalNotes,
        assignedAdminId: body.assignedAdminId ?? adminUser.adminUserId,
      },
      include: {
        user: {
          select: { userId: true, name: true, prediktHandle: true },
        },
      },
    });

    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'feedback.updated',
      targetType: 'feedback',
      targetId: feedbackId,
      beforeValue: { status: before.status, priority: before.priority },
      afterValue: { status: after.status, priority: after.priority },
      reason: body.internalNotes,
    });

    return safeAdminFeedbackItem(after as unknown as Record<string, unknown>);
  }
}
