import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('creates privacy-safe notifications and unread counts', async () => {
    const prisma = {
      userNotification: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ notificationId: 'n1', ...data })),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;
    const service = new NotificationsService(prisma);

    const created = await service.create({
      userId: 'user-1',
      roomId: 'room-1',
      type: 'journey_auto_closed',
      title: 'Journey auto-closed',
      body: 'Closed neutrally.',
      metadata: {
        email: 'hidden@example.com',
        rawLat: 12.9,
        safe: 'shown',
      },
      idempotencyKey: 'auto-close:room-1',
    });

    expect(created.metadata).toMatchObject({ safe: 'shown', idempotencyKey: 'auto-close:room-1' });
    expect(JSON.stringify(created.metadata)).not.toContain('hidden@example.com');
    expect(JSON.stringify(created.metadata)).not.toContain('rawLat');
    await expect(service.unreadCount({ userId: 'user-1' } as any)).resolves.toEqual({ count: 1 });
  });

  it('marks one or all notifications as read for the current user', async () => {
    const prisma = {
      userNotification: {
        findFirst: jest.fn().mockResolvedValue({ notificationId: 'n1', status: 'unread' }),
        update: jest.fn().mockResolvedValue({ notificationId: 'n1', status: 'read' }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    } as any;
    const service = new NotificationsService(prisma);

    await expect(service.markRead('n1', { userId: 'user-1' } as any)).resolves.toMatchObject({
      notificationId: 'n1',
      status: 'read',
    });
    await expect(service.markAllRead({ userId: 'user-1' } as any)).resolves.toMatchObject({
      success: true,
    });
  });
});
