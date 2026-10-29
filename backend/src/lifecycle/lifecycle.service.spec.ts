import { UnprocessableEntityException } from '@nestjs/common';
import { LifecycleService } from './lifecycle.service';
import { featureFlags } from '../config/feature-flags';
import { distanceMeters } from '../common/utils/geo';

describe('LifecycleService journey fairness', () => {
  const auditService = { log: jest.fn() } as any;
  const notificationsService = {
    create: jest.fn(),
    notifyRoomMembers: jest.fn(),
  } as any;
  const badgeService = {
    awardRoomBadges: jest.fn().mockResolvedValue([]),
  } as any;

  const START = { lat: 12.9716, lng: 77.5946 };
  // Match backend geo.ts earth radius so the fixture distances stay exact.
  const METERS_PER_DEG_LAT = (6371000 * Math.PI) / 180;
  const NEAR_999 = { lat: START.lat + 999 / METERS_PER_DEG_LAT, lng: START.lng };
  const FAR_1001 = { lat: START.lat + 1001 / METERS_PER_DEG_LAT, lng: START.lng };

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

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService, { grant: jest.fn().mockResolvedValue({ applied: true }) } as any);
    await service.start('room-1', { userId: 'u1' } as any, { startDelayMinutes: 3 });

    expect(update).toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.expectedDurationSeconds).toBe(3600);
    // Grace is floored at max(60 min, expectedDuration) to absorb traffic variance,
    // so a pre-baked 900s value is raised to the 3600s floor.
    expect(update.mock.calls[0][0].data.gracePeriodSeconds).toBe(3600);
    expect(update.mock.calls[0][0].data.autoCloseAt).toBeInstanceOf(Date);
  });

  it('makes a zero-delay journey visible immediately', async () => {
    const update = jest.fn().mockResolvedValue({
      roomId: 'room-now',
      autoCloseAt: new Date('2026-07-10T12:00:00.000Z'),
    });
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-now',
          creatorUserId: 'u1',
          status: 'predictions_locked',
          roomCategory: 'travel',
          startingLat: START.lat,
          startingLng: START.lng,
          expectedDurationSeconds: 1800,
          gracePeriodSeconds: 900,
          journeyScheduledStartAt: null,
          noStartCutoffAt: null,
          journeyRoute: { estimatedDurationSeconds: 1800, startLat: START.lat, startLng: START.lng },
        }),
        update,
      },
      roomCheckpoint: { upsert: jest.fn().mockResolvedValue({}) },
      liveLocationEvent: { create: jest.fn().mockResolvedValue({}) },
    } as any;

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService, { grant: jest.fn().mockResolvedValue({ applied: true }) } as any);
    await service.start('room-now', { userId: 'u1' } as any, {
      startDelayMinutes: 0,
      location: NEAR_999,
    });

    expect(update).toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.startTime).toEqual(update.mock.calls[0][0].data.visibleMovementStartTime);
  });

  describe('start proximity contract', () => {
    function trackedRoom(overrides: Record<string, unknown> = {}) {
      return {
        roomId: 'room-prox',
        creatorUserId: 'u1',
        status: 'predictions_locked',
        roomCategory: 'travel',
        startingLat: START.lat,
        startingLng: START.lng,
        expectedDurationSeconds: 1800,
        gracePeriodSeconds: 3600,
        journeyRoute: { startLat: START.lat, startLng: START.lng, estimatedDurationSeconds: 1800 },
        ...overrides,
      };
    }

    it('allows a start at 999 m and rejects 1001 m with TOO_FAR_FROM_START', async () => {
      expect(distanceMeters(START.lat, START.lng, NEAR_999.lat, NEAR_999.lng)).toBeLessThanOrEqual(1000);
      expect(distanceMeters(START.lat, START.lng, FAR_1001.lat, FAR_1001.lng)).toBeGreaterThan(1000);

      const update = jest.fn().mockResolvedValue({ roomId: 'room-prox', autoCloseAt: new Date() });
      const prisma = {
        predictionRoom: {
          findUnique: jest.fn().mockResolvedValue(trackedRoom()),
          update,
        },
        roomCheckpoint: { upsert: jest.fn().mockResolvedValue({}) },
        liveLocationEvent: { create: jest.fn().mockResolvedValue({}) },
      } as any;
      const service = new LifecycleService(prisma, auditService, notificationsService, badgeService, { grant: jest.fn() } as any);

      await service.start('room-prox', { userId: 'u1' } as any, {
        startDelayMinutes: 3,
        location: NEAR_999,
      });
      expect(update).toHaveBeenCalled();

      update.mockClear();
      try {
        await service.start('room-prox', { userId: 'u1' } as any, {
          startDelayMinutes: 3,
          location: FAR_1001,
        });
        throw new Error('expected rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(UnprocessableEntityException);
        expect((error as UnprocessableEntityException).getStatus()).toBe(422);
        expect((error as UnprocessableEntityException).getResponse()).toEqual({
          error: 'TOO_FAR_FROM_START',
          message: 'You appear to be more than 1 km from your declared start point.',
          distanceMeters: expect.any(Number),
        });
        expect(
          ((error as UnprocessableEntityException).getResponse() as { distanceMeters: number })
            .distanceMeters,
        ).toBeGreaterThan(1000);
      }
      expect(update).not.toHaveBeenCalled();
    });

    it('rejects missing creator GPS and missing origin with distinct stable errors', async () => {
      const update = jest.fn();
      const prismaMissingGps = {
        predictionRoom: {
          findUnique: jest.fn().mockResolvedValue(trackedRoom()),
          update,
        },
      } as any;
      const service = new LifecycleService(
        prismaMissingGps,
        auditService,
        notificationsService,
        badgeService,
        { grant: jest.fn() } as any,
      );

      await expect(service.start('room-prox', { userId: 'u1' } as any, { startDelayMinutes: 3 })).rejects.toMatchObject({
        response: {
          error: 'CREATOR_GPS_REQUIRED',
          message: 'Creator GPS is required to start this journey.',
        },
      });

      const prismaMissingOrigin = {
        predictionRoom: {
          findUnique: jest.fn().mockResolvedValue(
            trackedRoom({ startingLat: null, startingLng: null, journeyRoute: null }),
          ),
          update,
        },
      } as any;
      const serviceMissingOrigin = new LifecycleService(
        prismaMissingOrigin,
        auditService,
        notificationsService,
        badgeService,
        { grant: jest.fn() } as any,
      );
      await expect(
        serviceMissingOrigin.start('room-prox', { userId: 'u1' } as any, {
          startDelayMinutes: 3,
          location: NEAR_999,
        }),
      ).rejects.toMatchObject({
        response: {
          error: 'START_ORIGIN_UNAVAILABLE',
          message: 'This journey has no declared start point to verify against.',
        },
      });
      expect(update).not.toHaveBeenCalled();
    });

    it('still enforces proximity when checkpointLeaderboardV2 is off', async () => {
      const original = featureFlags.checkpointLeaderboardV2;
      (featureFlags as { checkpointLeaderboardV2: boolean }).checkpointLeaderboardV2 = false;
      try {
        const update = jest.fn();
        const prisma = {
          predictionRoom: {
            findUnique: jest.fn().mockResolvedValue(trackedRoom()),
            update,
          },
        } as any;
        const service = new LifecycleService(prisma, auditService, notificationsService, badgeService, { grant: jest.fn() } as any);
        await expect(
          service.start('room-prox', { userId: 'u1' } as any, {
            startDelayMinutes: 3,
            location: FAR_1001,
          }),
        ).rejects.toBeInstanceOf(UnprocessableEntityException);
        expect(update).not.toHaveBeenCalled();
      } finally {
        (featureFlags as { checkpointLeaderboardV2: boolean }).checkpointLeaderboardV2 = original;
      }
    });

    it('skips proximity for non location-tracked rooms', async () => {
      const update = jest.fn().mockResolvedValue({ roomId: 'room-prox', autoCloseAt: new Date() });
      const prisma = {
        predictionRoom: {
          findUnique: jest.fn().mockResolvedValue(trackedRoom({ roomCategory: 'custom' })),
          update,
        },
      } as any;
      const service = new LifecycleService(prisma, auditService, notificationsService, badgeService, { grant: jest.fn() } as any);
      await service.start('room-prox', { userId: 'u1' } as any, { startDelayMinutes: 3 });
      expect(update).toHaveBeenCalled();
    });
  });

  it('marks a never-started room as abandoned after the cutoff', async () => {
    const updateMany = jest.fn();
    const update = jest.fn();
    const rewardService = {
      grant: jest.fn().mockResolvedValue({ applied: true }),
    } as any;
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
      rewardAccount: {
        findUnique: jest.fn().mockResolvedValue({ rizzBalance: 12 }),
      },
      creditLedger: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      user: { update: jest.fn() },
      auraTransaction: { create: jest.fn() },
    } as any;

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService, rewardService);
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
        title: 'Called it a draw',
      }),
    );
    expect(rewardService.grant).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'host-1',
        rewardType: 'RIZZ',
        reasonCode: 'RIZZ_ADMIN_ADJUSTMENT',
        amount: -5,
        idempotencyKey: 'rizz_no_show:room-2:host-1',
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

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService, { grant: jest.fn().mockResolvedValue({ applied: true }) } as any);
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

  it('does not auto-close a live room that is still sending location pings', async () => {
    const update = jest.fn();
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-3b',
          creatorUserId: 'host-2',
          status: 'live',
          journeyStatus: 'live',
          noStartCutoffAt: null,
          autoCloseAt: new Date(Date.now() - 60_000),
          journeyStartedAt: new Date(Date.now() - 3600_000),
          arrivalConfirmedAt: null,
          lastTravellerUpdateAt: new Date(),
          autoClosedAt: null,
          abandonedAt: null,
          createdAt: new Date(Date.now() - 2 * 3600_000),
          milestonePredictions: [],
        }),
        update,
      },
    } as any;

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService, { grant: jest.fn().mockResolvedValue({ applied: true }) } as any);
    await service.evaluateRoomLifecycle('room-3b', { actorType: 'system', actorId: null });

    expect(update).not.toHaveBeenCalled();
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

    const service = new LifecycleService(prisma, auditService, notificationsService, badgeService, { grant: jest.fn().mockResolvedValue({ applied: true }) } as any);
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
