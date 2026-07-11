import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AuditPayload = {
  actorType: 'admin' | 'user' | 'system';
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorType: payload.actorType,
          actorId: payload.actorId ?? null,
          actorRole: payload.actorRole ?? null,
          action: payload.action,
          targetType: payload.targetType ?? null,
          targetId: payload.targetId ?? null,
          beforeValue: payload.beforeValue as never,
          afterValue: payload.afterValue as never,
          reason: payload.reason ?? null,
          ipAddress: payload.ipAddress ?? null,
          userAgent: payload.userAgent ?? null,
          correlationId: payload.correlationId ?? null,
        },
      });
    } catch (error) {
      this.logger.error('Audit log write failed', error as Error);
    }
  }
}
