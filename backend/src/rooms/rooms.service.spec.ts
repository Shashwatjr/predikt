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

  it('allows authenticated users to join a private room through the invite flow', async () => {
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          roomTitle: 'Private Room',
          creatorUserId: 'creator-1',
          status: 'predictions_open',
          visibility: 'private',
          journeyStatus: 'scheduled',
        }),
      },
      roomMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          membershipId: 'm-private',
          role: 'participant',
          status: 'joined',
          joinedAt: new Date('2026-07-20T10:00:00.000Z'),
        }),
      },
      milestonePrediction: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
    const service = new RoomsService(prisma, auditService, notificationsService);

    const joined = await service.join('room-1', { userId: 'user-1', name: 'Viewer' } as any);

    expect(joined.status).toBe('joined');
    expect(joined.nextAction).toBe('prediction');
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

describe('RoomsService.deleteRoom', () => {
  const auditService = { log: jest.fn() } as any;
  const notificationsService = { create: jest.fn() } as any;

  beforeEach(() => jest.clearAllMocks());

  const CHILD_MODELS = [
    'resultReaction', 'roomDispute', 'report', 'userNotification', 'userRoomPreference',
    'roomMembership', 'roomCommentary', 'campaignMetric', 'roomDropRule', 'userDrop',
    'userBadge', 'userFlex', 'userReliabilityLedger', 'creditLedger', 'cloutTransaction',
    'auraTransaction', 'roomResult', 'liveLocationEvent', 'roomCheckpoint',
    'milestonePrediction', 'journeyRoute', 'roomMilestone', 'activityEvent',
  ];

  // `otherPredictions` = number of MilestonePredictions by non-creators, which
  // drives the solo-vs-multi-participant branch of the deletion rule.
  function deletePrisma(room: any, otherPredictions = 0) {
    const prisma: any = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue(room),
        delete: jest.fn().mockResolvedValue(room),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ auditId: 'audit-1' }) },
      // Support feedback is preserved (roomId nulled), not deleted.
      userFeedback: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    for (const model of CHILD_MODELS) {
      prisma[model] = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
    }
    // computeDeletable counts non-creator predictions to classify the room.
    prisma.milestonePrediction.count = jest.fn().mockResolvedValue(otherPredictions);
    prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
    return prisma;
  }

  const HOUR_MS = 60 * 60 * 1000;

  const completedRoom = {
    roomId: 'room-1',
    roomTitle: 'Old Match',
    creatorUserId: 'creator-1',
    status: 'completed',
    rematches: [],
  };

  it('lets the creator delete a completed room and writes the audit row inside the transaction, first', async () => {
    const prisma = deletePrisma({ ...completedRoom });
    const service = new RoomsService(prisma, auditService, notificationsService);

    const result = await service.deleteRoom('room-1', { userId: 'creator-1' } as any);

    expect(result).toEqual({ success: true, roomId: 'room-1' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'room.deleted', targetId: 'room-1' }),
      }),
    );
    expect(prisma.predictionRoom.delete).toHaveBeenCalledWith({ where: { roomId: 'room-1' } });
    // Audit must be written BEFORE the room row is deleted (same transaction).
    const auditOrder = prisma.auditLog.create.mock.invocationCallOrder[0];
    const deleteOrder = prisma.predictionRoom.delete.mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(deleteOrder);
  });

  it('rejects a non-creator with 403 and writes no audit', async () => {
    const prisma = deletePrisma({ ...completedRoom });
    const service = new RoomsService(prisma, auditService, notificationsService);

    await expect(
      service.deleteRoom('room-1', { userId: 'not-the-creator' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.predictionRoom.delete).not.toHaveBeenCalled();
  });

  // --- Solo (no non-creator predictions): deletable in every state ---
  it.each([
    'created',
    'predictions_open',
    'predictions_locked',
    'live',
    'completed',
    'cancelled',
  ])('lets the creator delete a solo room in %s state (immediate)', async (status) => {
    const prisma = deletePrisma({ ...completedRoom, status }, 0);
    const service = new RoomsService(prisma, auditService, notificationsService);

    const result = await service.deleteRoom('room-1', { userId: 'creator-1' } as any);
    expect(result).toEqual({ success: true, roomId: 'room-1' });
    expect(prisma.predictionRoom.delete).toHaveBeenCalledWith({ where: { roomId: 'room-1' } });
  });

  // --- Multi-participant + terminal ≥24h: allowed ---
  it('lets the creator delete a multi-participant room 24h+ after it completed', async () => {
    const prisma = deletePrisma(
      { ...completedRoom, status: 'completed', actualEndTime: new Date(Date.now() - 25 * HOUR_MS) },
      2,
    );
    const service = new RoomsService(prisma, auditService, notificationsService);

    const result = await service.deleteRoom('room-1', { userId: 'creator-1' } as any);
    expect(result).toEqual({ success: true, roomId: 'room-1' });
    expect(prisma.predictionRoom.delete).toHaveBeenCalledWith({ where: { roomId: 'room-1' } });
  });

  // --- Multi-participant + active: 409, steer to cancel ---
  it('rejects deleting a multi-participant active room with the cancel-instead 409', async () => {
    const prisma = deletePrisma({ ...completedRoom, status: 'live' }, 3);
    const service = new RoomsService(prisma, auditService, notificationsService);

    await expect(
      service.deleteRoom('room-1', { userId: 'creator-1' } as any),
    ).rejects.toThrow("can't delete it while friends have predictions in play");
    await expect(
      service.deleteRoom('room-1', { userId: 'creator-1' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.predictionRoom.delete).not.toHaveBeenCalled();
  });

  // --- Multi-participant + terminal <24h: 409 with availableAt ---
  it('rejects deleting a multi-participant terminal room inside the 24h window', async () => {
    const prisma = deletePrisma(
      { ...completedRoom, status: 'completed', actualEndTime: new Date(Date.now() - 2 * HOUR_MS) },
      2,
    );
    const service = new RoomsService(prisma, auditService, notificationsService);

    await expect(
      service.deleteRoom('room-1', { userId: 'creator-1' } as any),
    ).rejects.toThrow(/You can delete this room after .*Give friends time to see the result/s);
    expect(prisma.predictionRoom.delete).not.toHaveBeenCalled();
  });

  // --- Cascade: solo active-room delete leaves no orphan child rows ---
  it('purges telemetry and nulls feedback pointers when deleting a solo active room', async () => {
    const prisma = deletePrisma({ ...completedRoom, status: 'live' }, 0);
    const service = new RoomsService(prisma, auditService, notificationsService);

    await service.deleteRoom('room-1', { userId: 'creator-1' } as any);
    // Every room-child table is swept inside the transaction. creditLedger keys
    // the room on `sourceId` rather than `roomId`.
    for (const model of CHILD_MODELS) {
      const expectedWhere =
        model === 'creditLedger' ? { sourceId: 'room-1' } : { roomId: 'room-1' };
      expect(prisma[model].deleteMany).toHaveBeenCalledWith({ where: expectedWhere });
    }
    expect(prisma.activityEvent.deleteMany).toHaveBeenCalledWith({ where: { roomId: 'room-1' } });
    expect(prisma.userFeedback.updateMany).toHaveBeenCalledWith({
      where: { roomId: 'room-1' },
      data: { roomId: null },
    });
  });

  it('rejects deleting a room that has rematches/linked successors with 409', async () => {
    const prisma = deletePrisma({ ...completedRoom, rematches: [{ roomId: 'child-1' }] });
    const service = new RoomsService(prisma, auditService, notificationsService);

    await expect(
      service.deleteRoom('room-1', { userId: 'creator-1' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.predictionRoom.delete).not.toHaveBeenCalled();
  });

  it('deletes the room row so it is excluded from normal list/query views', async () => {
    const prisma = deletePrisma({ ...completedRoom, status: 'cancelled' });
    const service = new RoomsService(prisma, auditService, notificationsService);

    await service.deleteRoom('room-1', { userId: 'creator-1' } as any);
    expect(prisma.predictionRoom.delete).toHaveBeenCalledWith({ where: { roomId: 'room-1' } });
  });
});

describe('RoomsService privacy access matrix (findById)', () => {
  const auditService = { log: jest.fn() } as any;
  const notificationsService = { create: jest.fn() } as any;

  beforeEach(() => jest.clearAllMocks());

  function findByIdPrisma(roomOverrides: any) {
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          ...buildRoom(),
          creator: {},
          milestones: [],
          journeyRoute: null,
          locationEvents: [],
          roomMemberships: [],
          ...roomOverrides,
        }),
      },
      milestonePrediction: { count: jest.fn().mockResolvedValue(0) },
    } as any;
    return prisma;
  }

  // --- Private (invite-only, visible to invited) ---
  it('Private: blocks a non-invited authenticated viewer (403)', async () => {
    const prisma = findByIdPrisma({ visibility: 'private', roomMemberships: [] });
    const service = new RoomsService(prisma, auditService, notificationsService);
    await expect(service.findById('room-1', { userId: 'outsider' } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('Private: allows the creator', async () => {
    const prisma = findByIdPrisma({ visibility: 'private', creatorUserId: 'creator-1' });
    const service = new RoomsService(prisma, auditService, notificationsService);
    await expect(service.findById('room-1', { userId: 'creator-1' } as any)).resolves.toBeTruthy();
  });

  it('Private: allows an invited (joined) viewer', async () => {
    const prisma = findByIdPrisma({
      visibility: 'private',
      roomMemberships: [{ userId: 'invitee', status: 'joined' }],
    });
    const service = new RoomsService(prisma, auditService, notificationsService);
    await expect(service.findById('room-1', { userId: 'invitee' } as any)).resolves.toBeTruthy();
  });

  // --- Ghost (invite_only): reachable via link, not membership-gated at read ---
  it('Ghost (invite_only): does not 403 a viewer holding the room reference', async () => {
    const prisma = findByIdPrisma({ visibility: 'invite_only', roomMemberships: [] });
    const service = new RoomsService(prisma, auditService, notificationsService);
    await expect(service.findById('room-1', { userId: 'link-holder' } as any)).resolves.toBeTruthy();
  });

  it('Ghost (invite_only): returns only a safe preview before membership is established', async () => {
    const prisma = findByIdPrisma({ visibility: 'invite_only', roomMemberships: [] });
    const service = new RoomsService(prisma, auditService, notificationsService);

    const preview = await service.findById('room-1', { userId: 'link-holder' } as any);

    expect(preview.roomId).toBe('room-1');
    expect(preview.visibility).toBe('invite_only');
    expect('creator' in preview).toBe(false);
    expect('shareKit' in preview).toBe(false);
    expect('milestones' in preview).toBe(false);
  });

  // --- Public (discoverable): open to any authenticated viewer ---
  it('Public: allows any authenticated viewer', async () => {
    const prisma = findByIdPrisma({ visibility: 'public', roomMemberships: [] });
    const service = new RoomsService(prisma, auditService, notificationsService);
    await expect(service.findById('room-1', { userId: 'anyone' } as any)).resolves.toBeTruthy();
  });
});

describe('RoomsService deletable projection (findById)', () => {
  const auditService = { log: jest.fn() } as any;
  const notificationsService = { create: jest.fn() } as any;
  const HOUR_MS = 60 * 60 * 1000;

  beforeEach(() => jest.clearAllMocks());

  function deletablePrisma(roomOverrides: any, otherPredictions: number) {
    return {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          ...buildRoom(),
          creator: {},
          milestones: [],
          journeyRoute: null,
          locationEvents: [],
          roomMemberships: [],
          visibility: 'public',
          ...roomOverrides,
        }),
      },
      milestonePrediction: { count: jest.fn().mockResolvedValue(otherPredictions) },
    } as any;
  }

  it('non-creator viewer always gets a locked deletable object', async () => {
    const prisma = deletablePrisma({ visibility: 'public', status: 'completed' }, 3);
    const service = new RoomsService(prisma, auditService, notificationsService);
    const res: any = await service.findById('room-1', { userId: 'viewer-x' } as any);
    expect(res.viewerIsCreator).toBe(false);
    expect(res.deletable).toEqual({ canDelete: false, availableAt: null, reason: null });
  });

  it('solo active → canDelete true, no gate', async () => {
    const prisma = deletablePrisma({ status: 'live' }, 0);
    const service = new RoomsService(prisma, auditService, notificationsService);
    const res: any = await service.findById('room-1', { userId: 'creator-1' } as any);
    expect(res.deletable).toEqual({ canDelete: true, availableAt: null, reason: null });
  });

  it('solo terminal → canDelete true, no gate', async () => {
    const prisma = deletablePrisma(
      { status: 'completed', actualEndTime: new Date(Date.now() - HOUR_MS) },
      0,
    );
    const service = new RoomsService(prisma, auditService, notificationsService);
    const res: any = await service.findById('room-1', { userId: 'creator-1' } as any);
    expect(res.deletable.canDelete).toBe(true);
  });

  it('multi active → canDelete false with cancel-instead reason, no availableAt', async () => {
    const prisma = deletablePrisma({ status: 'live' }, 2);
    const service = new RoomsService(prisma, auditService, notificationsService);
    const res: any = await service.findById('room-1', { userId: 'creator-1' } as any);
    expect(res.deletable.canDelete).toBe(false);
    expect(res.deletable.availableAt).toBeNull();
    expect(res.deletable.reason).toMatch(/predictions in play/);
  });

  it('multi terminal-fresh (<24h) → canDelete false with future availableAt', async () => {
    const endedAt = new Date(Date.now() - 2 * HOUR_MS);
    const prisma = deletablePrisma({ status: 'completed', actualEndTime: endedAt }, 2);
    const service = new RoomsService(prisma, auditService, notificationsService);
    const res: any = await service.findById('room-1', { userId: 'creator-1' } as any);
    expect(res.deletable.canDelete).toBe(false);
    expect(new Date(res.deletable.availableAt).getTime()).toBeGreaterThan(Date.now());
    expect(res.deletable.reason).toMatch(/You can delete this room after/);
  });

  it('multi terminal-aged (≥24h) → canDelete true with past availableAt', async () => {
    const endedAt = new Date(Date.now() - 25 * HOUR_MS);
    const prisma = deletablePrisma({ status: 'completed', actualEndTime: endedAt }, 2);
    const service = new RoomsService(prisma, auditService, notificationsService);
    const res: any = await service.findById('room-1', { userId: 'creator-1' } as any);
    expect(res.deletable.canDelete).toBe(true);
    expect(new Date(res.deletable.availableAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('RoomsService invite preview access', () => {
  const auditService = { log: jest.fn() } as any;
  const notificationsService = { create: jest.fn() } as any;

  beforeEach(() => jest.clearAllMocks());

  function invitePreviewPrisma(roomOverrides: any) {
    return {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          ...buildRoom(),
          creator: { name: 'Creator', prediktHandle: 'creator' },
          milestones: [],
          journeyRoute: null,
          locationEvents: [],
          milestonePredictions: [{ userId: 'u1' }],
          roomMemberships: [{ userId: 'u1', status: 'joined' }],
          ...roomOverrides,
        }),
      },
    } as any;
  }

  it('Ghost: allows unauthenticated invite preview and returns minimal safe data', async () => {
    const prisma = invitePreviewPrisma({ visibility: 'invite_only' });
    const service = new RoomsService(prisma, auditService, notificationsService);

    const preview = await service.getInvitePreview('ABCDE', null);

    expect(preview.visibility).toBe('invite_only');
    expect(preview.title).toBeDefined();
    expect('creatorDisplayName' in preview).toBe(false);
    expect('creatorHandle' in preview).toBe(false);
    expect('benchmarks' in preview).toBe(false);
    expect('routeSummary' in preview).toBe(false);
    expect('safePreview' in preview).toBe(false);
  });

  it('Private: blocks unauthenticated invite preview', async () => {
    const prisma = invitePreviewPrisma({ visibility: 'private' });
    const service = new RoomsService(prisma, auditService, notificationsService);

    await expect(service.getInvitePreview('ABCDE', null)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('Private: allows authenticated invite preview for the join flow', async () => {
    const prisma = invitePreviewPrisma({ visibility: 'private' });
    const service = new RoomsService(prisma, auditService, notificationsService);

    const preview = await service.getInvitePreview('ABCDE', 'viewer-1');

    expect(preview.visibility).toBe('private');
    expect(preview.roomId).toBe('room-1');
  });

  it('code lookup never exposes more than invite preview data', async () => {
    const prisma = invitePreviewPrisma({ visibility: 'invite_only' });
    const service = new RoomsService(prisma, auditService, notificationsService);

    const byCode = await service.findByInviteCode('ABCDE', null);

    expect('creatorDisplayName' in byCode).toBe(false);
    expect('creatorHandle' in byCode).toBe(false);
    expect('benchmarks' in byCode).toBe(false);
    expect('routeSummary' in byCode).toBe(false);
    expect('safePreview' in byCode).toBe(false);
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
