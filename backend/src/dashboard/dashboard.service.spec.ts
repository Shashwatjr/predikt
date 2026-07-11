import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService active predictions', () => {
  const prisma = {
    predictionRoom: {
      findMany: jest.fn(),
    },
    userRoomPreference: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (items: any[]) => Promise.all(items)),
  } as any;
  const lifecycleService = {
    evaluateRoomLifecycle: jest.fn().mockResolvedValue(null),
  } as any;

  const service = new DashboardService(prisma, lifecycleService);
  const user = { userId: 'user-1' } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns privacy-safe active prediction cards with approximate progress', async () => {
    const rooms = [
      {
        roomId: 'room-1',
        inviteCode: 'ABCDE',
        roomTitle: 'Office Arrival',
        eventType: 'When will everyone arrive?',
        roomType: 'single_target',
        answerType: 'exact_time',
        visibility: 'invite_only',
        creatorUserId: 'creator-2',
        status: 'live',
        lockTime: null,
        predictionCloseTime: new Date('2026-07-09T10:00:00.000Z'),
        resultDeadline: null,
        selectedBackground: 'aurora',
        selectedRoomTheme: 'night-drive',
        confidenceLevel: null,
        startingPointLabel: 'Home',
        destinationLabel: 'Office',
        createdAt: new Date('2026-07-09T09:00:00.000Z'),
        updatedAt: new Date('2026-07-09T09:30:00.000Z'),
        creator: { userId: 'creator-2' },
        journeyRoute: {
          startLabel: 'Home',
          destinationLabel: 'Office',
          travelMode: 'driving',
          estimatedDurationSeconds: 3600,
        },
        milestonePredictions: [
          {
            userId: 'user-1',
            predictedReachedTime: new Date('2026-07-09T10:20:00.000Z'),
            revokedAt: null,
          },
        ],
        locationEvents: [
          {
            progressPercentage: 63,
            etaMinutes: 18,
            createdAt: new Date('2026-07-09T09:42:00.000Z'),
          },
        ],
        roomPreferences: [{ userId: 'user-1', roomId: 'room-1', pinned: true, displayOrder: 4 }],
        roomMemberships: [
          { userId: 'creator-2', role: 'creator', status: 'joined' },
          { userId: 'user-1', role: 'participant', status: 'joined' },
        ],
      },
    ];
    prisma.predictionRoom.findMany.mockResolvedValueOnce(rooms).mockResolvedValueOnce(rooms);

    const [card] = await service.activePredictions(user);

    expect(card).toMatchObject({
      roomId: 'room-1',
      inviteCode: 'ABCDE',
      title: 'Office Arrival',
      roomMode: 'single_target',
      pinned: true,
      displayOrder: 4,
      hasSubmittedPrediction: true,
      quickAction: { label: 'View Live', targetScreen: 'LiveRoom' },
      routeSummary: {
        startLabel: 'Home',
        destinationLabel: 'Office',
        travelMode: 'driving',
      },
    });
    expect(card.liveProgress.progressPercentApprox).toBe(65);
    expect(card.liveProgress.etaVsMyPredictionLabel).toContain('ETA is about');
    expect(JSON.stringify(card)).not.toContain('passwordHash');
    expect(JSON.stringify(card)).not.toContain('email');
    expect(JSON.stringify(card)).not.toContain('rawLat');
  });

  it('clamps approximate progress and marks completed rooms as result ready', async () => {
    const rooms = [
      {
        roomId: 'room-2',
        inviteCode: 'FGHIJ',
        roomTitle: 'Late Train',
        eventType: 'Will the train make it?',
        roomType: 'single_target',
        answerType: 'yes_no',
        visibility: 'invite_only',
        creatorUserId: 'user-1',
        status: 'completed',
        lockTime: null,
        predictionCloseTime: new Date('2026-07-09T08:00:00.000Z'),
        resultDeadline: null,
        selectedBackground: null,
        selectedRoomTheme: null,
        confidenceLevel: 'approximate',
        startingPointLabel: 'Station',
        destinationLabel: 'Campus',
        createdAt: new Date('2026-07-09T07:00:00.000Z'),
        updatedAt: new Date('2026-07-09T08:45:00.000Z'),
        creator: { userId: 'user-1' },
        journeyRoute: null,
        milestonePredictions: [],
        locationEvents: [{ progressPercentage: 140, etaMinutes: 0, createdAt: new Date('2026-07-09T08:30:00.000Z') }],
        roomPreferences: [],
        roomMemberships: [{ userId: 'user-1', role: 'creator', status: 'joined' }],
      },
    ];
    prisma.predictionRoom.findMany.mockResolvedValueOnce(rooms).mockResolvedValueOnce(rooms);

    const [card] = await service.activePredictions(user);

    expect(card.status).toBe('result_ready');
    expect(card.liveProgress.progressPercentApprox).toBe(100);
    expect(card.quickAction).toEqual({ label: 'View Results', targetScreen: 'Result' });
  });

  it('shows joined rooms before the user submits a prediction', async () => {
    const rooms = [
      {
        roomId: 'room-joined',
        inviteCode: 'JOIN1',
        roomTitle: 'Airport Run',
        eventType: 'When will it finish?',
        roomType: 'journey',
        answerType: 'exact_time',
        visibility: 'invite_only',
        creatorUserId: 'creator-3',
        status: 'predictions_open',
        lockTime: null,
        predictionCloseTime: new Date(Date.now() + 60 * 60 * 1000),
        resultDeadline: null,
        selectedBackground: null,
        selectedRoomTheme: null,
        confidenceLevel: null,
        startingPointLabel: 'Home',
        destinationLabel: 'Airport',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { userId: 'creator-3' },
        journeyRoute: null,
        milestonePredictions: [],
        locationEvents: [],
        roomPreferences: [],
        roomMemberships: [
          { userId: 'creator-3', role: 'creator', status: 'joined' },
          { userId: 'user-1', role: 'participant', status: 'joined' },
        ],
      },
    ];
    prisma.predictionRoom.findMany.mockResolvedValueOnce(rooms).mockResolvedValueOnce(rooms);

    const [card] = await service.activePredictions(user);

    expect(card.hasSubmittedPrediction).toBe(false);
    expect(card.userRole).toBe('participant');
    expect(card.quickAction).toEqual({ label: 'Predict Now', targetScreen: 'Prediction' });
  });

  it('persists room ordering for joined rooms', async () => {
    prisma.predictionRoom.findMany.mockResolvedValueOnce([{ roomId: 'room-1' }, { roomId: 'room-2' }]);
    prisma.userRoomPreference.upsert.mockImplementation(({ create, update }: any) =>
      Promise.resolve({ ...create, ...update }),
    );

    const result = await service.updateActivePredictionsOrder(user, {
      items: [
        { roomId: 'room-1', displayOrder: 0, pinned: true },
        { roomId: 'room-2', displayOrder: 1, pinned: false },
      ],
    });

    expect(result.success).toBe(true);
    expect(prisma.userRoomPreference.upsert).toHaveBeenCalledTimes(2);
  });

  it('rejects reordering rooms the user is not part of', async () => {
    prisma.predictionRoom.findMany.mockResolvedValueOnce([{ roomId: 'room-1' }]);

    await expect(
      service.updateActivePredictionsOrder(user, {
        items: [
          { roomId: 'room-1', displayOrder: 0, pinned: false },
          { roomId: 'room-2', displayOrder: 1, pinned: false },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
