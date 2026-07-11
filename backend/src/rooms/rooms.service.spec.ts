import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

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
