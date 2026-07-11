import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

type NotificationSeverity = 'info' | 'success' | 'warning' | 'action_required';

interface CreateNotificationInput {
  userId: string;
  roomId?: string | null;
  type: string;
  title: string;
  body: string;
  severity?: NotificationSeverity;
  actionLabel?: string | null;
  actionTarget?: string | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string;
}

interface NotifyRoomMembersInput {
  roomId: string;
  type: string;
  title: string;
  body: string;
  severity?: NotificationSeverity;
  actionLabel?: string | null;
  actionTarget?: string | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string;
  includeCreator?: boolean;
}

const SENSITIVE_KEY_PARTS = [
  'email',
  'phone',
  'password',
  'passwordhash',
  'rawlat',
  'rawlng',
  'lat',
  'lng',
  'gps',
  'coordinate',
  'routehistory',
  'predictedreachedtime',
  'predictedarrivaltime',
];

function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (safe, [key, entry]) => {
        const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))) {
          return safe;
        }
        safe[key] = sanitizeMetadata(entry);
        return safe;
      },
      {},
    );
  }
  return value;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: User) {
    return this.prisma.userNotification.findMany({
      where: { userId: user.userId, status: { not: 'archived' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(user: User) {
    const count = await this.prisma.userNotification.count({
      where: { userId: user.userId, status: 'unread' },
    });
    return { count };
  }

  async markRead(notificationId: string, user: User) {
    const notification = await this.prisma.userNotification.findFirst({
      where: { notificationId, userId: user.userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.status === 'read') return notification;
    return this.prisma.userNotification.update({
      where: { notificationId },
      data: { status: 'read', readAt: new Date() },
    });
  }

  async markAllRead(user: User) {
    const now = new Date();
    await this.prisma.userNotification.updateMany({
      where: { userId: user.userId, status: 'unread' },
      data: { status: 'read', readAt: now },
    });
    return { success: true, readAt: now };
  }

  async create(input: CreateNotificationInput) {
    const metadata = {
      ...(sanitizeMetadata(input.metadata ?? {}) as Record<string, unknown>),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    };

    if (input.idempotencyKey) {
      const existing = await this.prisma.userNotification.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          roomId: input.roomId ?? undefined,
          metadata: {
            path: ['idempotencyKey'],
            equals: input.idempotencyKey,
          } as never,
        },
      });
      if (existing) return existing;
    }

    return this.prisma.userNotification.create({
      data: {
        userId: input.userId,
        roomId: input.roomId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        status: 'unread',
        severity: input.severity ?? 'info',
        actionLabel: input.actionLabel ?? null,
        actionTarget: input.actionTarget ?? null,
        metadata,
      },
    });
  }

  async notifyRoomMembers(input: NotifyRoomMembersInput) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId: input.roomId },
      select: { creatorUserId: true },
    });
    if (!room) return [];

    const memberships = await this.prisma.roomMembership.findMany({
      where: { roomId: input.roomId, status: 'joined' },
      select: { userId: true },
    });
    const userIds = new Set(memberships.map((membership) => membership.userId));
    if (input.includeCreator !== false) {
      userIds.add(room.creatorUserId);
    }

    return Promise.all(
      Array.from(userIds).map((userId) =>
        this.create({
          userId,
          roomId: input.roomId,
          type: input.type,
          title: input.title,
          body: input.body,
          severity: input.severity,
          actionLabel: input.actionLabel,
          actionTarget: input.actionTarget,
          metadata: input.metadata,
          idempotencyKey: input.idempotencyKey
            ? `${input.idempotencyKey}:${userId}`
            : undefined,
        }),
      ),
    );
  }
}
