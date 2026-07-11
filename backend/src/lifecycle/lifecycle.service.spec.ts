import { LifecycleService } from './lifecycle.service';

describe('LifecycleService journey fairness', () => {
  const auditService = { log: jest.fn() } as any;
  const notificationsService = {
    create: jest.fn(),
    notifyRoomMembers: jest.fn(),
  } as any;
  const badgeService = {
    awardRoomBadges: jest.fn().mockResolvedValue([]),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes autoCloseAt when a journey starts', async () => {
    const update = jest.fn().mockResolvedValue({
      roomId: 'room-1',
      autoCloseAt: new Date('2026-07-10T12:00:00.000Z'),
    });
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          creatorUserId: 'u1',
          status: 'predictions_locked',
          expectedDurationSeconds: 3600,
          gracePeriodSeconds: 900,
          journeyScheduledStartAt: null,
          noStartCutoffAt: null,
          journeyRoute: { estimatedDurationSeconds: 3600 },
        }),
        update,
      },
    } as any;

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService);
    await service.start('room-1', { userId: 'u1' } as any, { startDelayMinutes: 3 });

    expect(update).toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.expectedDurationSeconds).toBe(3600);
    expect(update.mock.calls[0][0].data.gracePeriodSeconds).toBe(900);
    expect(update.mock.calls[0][0].data.autoCloseAt).toBeInstanceOf(Date);
  });

  it('marks a never-started room as abandoned after the cutoff', async () => {
    const updateMany = jest.fn();
    const update = jest.fn();
    const prisma = {
      predictionRoom: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            roomId: 'room-2',
            creatorUserId: 'host-1',
            status: 'predictions_open',
            journeyStatus: 'scheduled',
            noStartCutoffAt: new Date(Date.now() - 60_000),
            autoCloseAt: null,
            journeyStartedAt: null,
            autoClosedAt: null,
            abandonedAt: null,
            createdAt: new Date(Date.now() - 10 * 60_000),
            milestonePredictions: [],
          })
          .mockResolvedValueOnce({ roomId: 'room-2', journeyStatus: 'abandoned' }),
        update,
      },
      roomMilestone: { updateMany },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
      userReliabilityLedger: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      creditLedger: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      user: { update: jest.fn() },
      auraTransaction: { create: jest.fn() },
    } as any;

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService);
    await service.evaluateRoomLifecycle('room-2', { actorType: 'system', actorId: null });

    expect(updateMany).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roomId: 'room-2' },
        data: expect.objectContaining({ journeyStatus: 'abandoned' }),
      }),
    );
    expect(notificationsService.notifyRoomMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'journey_abandoned',
        title: 'No-Show closed',
      }),
    );
  });

  it('auto-closes overdue live rooms without arrival confirmation', async () => {
    const update = jest.fn();
    const prisma = {
      predictionRoom: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            roomId: 'room-3',
            creatorUserId: 'host-2',
            status: 'live',
            journeyStatus: 'live',
            noStartCutoffAt: null,
            autoCloseAt: new Date(Date.now() - 60_000),
            journeyStartedAt: new Date(Date.now() - 3600_000),
            arrivalConfirmedAt: null,
            autoClosedAt: null,
            abandonedAt: null,
            createdAt: new Date(Date.now() - 2 * 3600_000),
            milestonePredictions: [],
          })
          .mockResolvedValueOnce({ roomId: 'room-3', journeyStatus: 'auto_closed' }),
        update,
      },
      roomMilestone: { updateMany: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
      userReliabilityLedger: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      creditLedger: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      user: { update: jest.fn() },
      auraTransaction: { create: jest.fn() },
    } as any;

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService);
    await service.evaluateRoomLifecycle('room-3', { actorType: 'system', actorId: null });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roomId: 'room-3' },
        data: expect.objectContaining({ journeyStatus: 'auto_closed' }),
      }),
    );
    expect(notificationsService.notifyRoomMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'journey_auto_closed',
        title: 'Journey auto-closed',
      }),
    );
  });

  it('applies a mild reliability adjustment when cancelled after lock', async () => {
    const predictionRoom = {
      findUnique: jest.fn().mockResolvedValue({
        roomId: 'room-4',
        creatorUserId: 'host-3',
        status: 'predictions_locked',
        predictionCloseTime: new Date(Date.now() - 60_000),
        createdAt: new Date(Date.now() - 30 * 60_000),
        journeyRoute: null,
      }),
      update: jest.fn(),
    };
    const prisma = {
      predictionRoom,
      roomMilestone: { updateMany: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
      userReliabilityLedger: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      creditLedger: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      user: { update: jest.fn() },
      auraTransaction: { create: jest.fn() },
    } as any;

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService);
    await service.cancelJourney('room-4', { userId: 'host-3' } as any, { reasonCode: 'other' });

    expect(prisma.userReliabilityLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'cancelled_after_lock',
          pointsDelta: -2,
        }),
      }),
    );
    expect(notificationsService.notifyRoomMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'journey_cancelled',
        title: 'Plan changed',
      }),
    );
  });
});
