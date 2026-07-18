import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RoomsService, usesExclusiveLocationResource } from './rooms.service';

describe('RoomsService memberships', () => {
  const auditService = { log: jest.fn() } as any;
  const notificationsService = { create: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a creator membership when a room is created', async () => {
    const room = buildRoom();
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          ...room,
          creator: {},
          milestones: [],
          journeyRoute: null,
        }),
      },
      roomMembership: { upsert: jest.fn() },
      user: { update: jest.fn().mockResolvedValue({ creditBalance: 15 }) },
      creditLedger: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    await service.create(
      {
        roomTitle: room.roomTitle,
        eventType: room.eventType,
        startingPointLabel: room.startingPointLabel,
        destinationLabel: room.destinationLabel,
        predictionCloseTime: room.predictionCloseTime.toISOString(),
      } as any,
      { userId: 'creator-1' },
    );

    expect(prisma.roomMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'creator-1',
          role: 'creator',
          status: 'joined',
        }),
      }),
    );
  });

  it('blocks a second active location-tracked room by the same creator', async () => {
    const room = buildRoom();
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue(null),
        // An active room already exists in this creator's category.
        findFirst: jest.fn().mockResolvedValue({ roomId: 'room-existing', roomTitle: 'Morning Commute' }),
        create: jest.fn(),
      },
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    await expect(
      service.create(
        {
          roomTitle: room.roomTitle,
          eventType: room.eventType,
          startingPointLabel: room.startingPointLabel,
          destinationLabel: room.destinationLabel,
          predictionCloseTime: room.predictionCloseTime.toISOString(),
        } as any,
        { userId: 'creator-1' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.predictionRoom.create).not.toHaveBeenCalled();
    expect(prisma.predictionRoom.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          creatorUserId: 'creator-1',
          status: { notIn: ['completed', 'cancelled'] },
        }),
      }),
    );
  });

  it('classifies only physically-tracked categories as exclusive-location', () => {
    for (const c of ['journey', 'milestone_journey', 'travel', 'fitness']) {
      expect(usesExclusiveLocationResource(c)).toBe(true);
    }
    for (const c of ['delivery', 'weather_rain', 'custom', 'brand_room', 'ai_vs_human']) {
      expect(usesExclusiveLocationResource(c)).toBe(false);
    }
  });

  it('allows parallel non-GPS rooms and skips the exclusivity query', async () => {
    const room = buildRoom();
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ ...room, creator: {}, milestones: [], journeyRoute: null }),
      },
      roomMembership: { upsert: jest.fn() },
      user: { update: jest.fn().mockResolvedValue({ creditBalance: 15 }) },
      creditLedger: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    await service.create(
      {
        roomTitle: room.roomTitle,
        eventType: room.eventType,
        roomCategory: 'delivery',
        predictionCloseTime: room.predictionCloseTime.toISOString(),
      } as any,
      { userId: 'creator-1' },
    );

    // Non-GPS rooms never hit the one-active-journey guard.
    expect(prisma.predictionRoom.findFirst).not.toHaveBeenCalled();
    expect(prisma.predictionRoom.create).toHaveBeenCalled();
  });

  it('joins idempotently and returns next action without submitting a prediction', async () => {
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          roomTitle: 'Airport Run',
          creatorUserId: 'creator-1',
          status: 'predictions_open',
          visibility: 'invite_only',
          journeyStatus: 'scheduled',
        }),
      },
      roomMembership: {
        findUnique: jest.fn().mockResolvedValue({
          membershipId: 'm1',
          roomId: 'room-1',
          userId: 'user-1',
          role: 'participant',
          status: 'joined',
          joinedAt: new Date('2026-07-10T00:00:00.000Z'),
        }),
        upsert: jest.fn().mockImplementation(({ update }) =>
          Promise.resolve({
            membershipId: 'm1',
            role: update.role,
            status: update.status,
            joinedAt: update.joinedAt,
          }),
        ),
      },
      milestonePrediction: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    const joined = await service.join('room-1', { userId: 'user-1', name: 'User One' } as any);

    expect(joined).toMatchObject({
      roomId: 'room-1',
      membershipId: 'm1',
      role: 'participant',
      status: 'joined',
      nextAction: 'prediction',
    });
    expect(prisma.roomMembership.upsert).toHaveBeenCalledTimes(1);
  });

  it('prevents blocked users from joining', async () => {
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          roomTitle: 'Airport Run',
          creatorUserId: 'creator-1',
          status: 'predictions_open',
          visibility: 'invite_only',
          journeyStatus: 'scheduled',
        }),
      },
      roomMembership: {
        findUnique: jest.fn().mockResolvedValue({ status: 'blocked' }),
      },
      milestonePrediction: {
        count: jest.fn(),
      },
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    await expect(service.join('room-1', { userId: 'user-1' } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('prevents creators from leaving active rooms', async () => {
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          creatorUserId: 'creator-1',
          status: 'live',
        }),
      },
      roomMembership: {
        findUnique: jest.fn().mockResolvedValue({
          membershipId: 'm1',
          role: 'creator',
          status: 'joined',
        }),
      },
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    await expect(service.leave('room-1', { userId: 'creator-1' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires membership for private room details', async () => {
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          ...buildRoom(),
          visibility: 'private',
          creator: {},
          milestones: [],
          journeyRoute: null,
          roomMemberships: [],
        }),
      },
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    await expect(service.findById('room-1', { userId: 'user-1' } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('routes late joiners to prediction while live, with no upper time gate', async () => {
    // Started 45 min ago — far beyond any old 10-min window — but the projected
    // arrival is still >3 min out, so late prediction stays open.
    const startedAt = new Date(Date.now() - 45 * 60 * 1000);
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          roomTitle: 'Airport Run',
          creatorUserId: 'creator-1',
          status: 'live',
          visibility: 'invite_only',
          journeyStatus: 'started',
          journeyStartedAt: startedAt,
          startTime: startedAt,
          plannedStartTime: startedAt,
          answerType: 'exact_time',
          roomCategory: 'journey',
          expectedDurationSeconds: 60 * 60,
        }),
      },
      roomMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          membershipId: 'm2',
          role: 'participant',
          status: 'joined',
          joinedAt: new Date('2026-07-16T10:00:00.000Z'),
        }),
      },
      milestonePrediction: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    const joined = await service.join('room-1', { userId: 'user-2', name: 'Late Joiner' } as any);

    expect(joined.nextAction).toBe('prediction');
    expect(joined.canLateJoinPredict).toBe(true);
    expect(joined.hasSubmittedPrediction).toBe(false);
  });

  it('sends late joiners to live once the room is inside the last 3 minutes of arrival', async () => {
    // Started 28 min ago on a 30-min planned trip → projected arrival ~2 min out,
    // which is inside the 3-min buffer, so late prediction is closed.
    const startedAt = new Date(Date.now() - 28 * 60 * 1000);
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          roomTitle: 'Airport Run',
          creatorUserId: 'creator-1',
          status: 'live',
          visibility: 'invite_only',
          journeyStatus: 'started',
          journeyStartedAt: startedAt,
          startTime: startedAt,
          plannedStartTime: startedAt,
          answerType: 'exact_time',
          roomCategory: 'journey',
          expectedDurationSeconds: 30 * 60,
        }),
      },
      roomMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          membershipId: 'm3',
          role: 'participant',
          status: 'joined',
          joinedAt: new Date('2026-07-16T10:00:00.000Z'),
        }),
      },
      milestonePrediction: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    const joined = await service.join('room-1', { userId: 'user-3', name: 'Too Late' } as any);

    expect(joined.nextAction).toBe('live');
    expect(joined.canLateJoinPredict).toBe(false);
  });
});

function buildRoom() {
  return {
    roomId: 'room-1',
    creatorUserId: 'creator-1',
    roomTitle: 'Airport Run',
    eventType: 'journey',
    roomType: 'journey',
    answerType: 'exact_time',
    roomCategory: 'journey',
    startingPointLabel: 'Home',
    destinationLabel: 'Airport',
    predictionCloseTime: new Date(Date.now() + 60 * 60 * 1000),
    status: 'predictions_open',
    visibility: 'invite_only',
    locationDisplayMode: 'delayed',
    safetyDelayMinutes: 10,
    predictionVisibilityMode: 'hidden_until_lock',
    createdAt: new Date(),
  };
}
