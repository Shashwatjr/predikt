import { LiveProgressService } from './live-progress.service';

describe('LiveProgressService', () => {
  it('returns safety-delayed viewer state', async () => {
    const room = {
      roomId: 'room-1',
      status: 'live',
      safetyDelayMinutes: 10,
      locationDisplayMode: 'approximate',
      movementAvatarType: 'car',
      movementAvatarUrl: null,
      isSponsored: true,
      sponsorName: 'Travel Partner',
      sponsorLogoUrl: null,
      sponsorBrandColor: '#0ea5e9',
      sponsorTagline: 'Powered travel experiences',
    };

    const oldEventTime = new Date(Date.now() - 12 * 60 * 1000);

    const prisma = {
      predictionRoom: { findUnique: jest.fn().mockResolvedValue(room) },
      liveLocationEvent: {
        findFirst: jest.fn().mockResolvedValue({
          progressPercentage: 42,
          etaMinutes: 18,
          createdAt: oldEventTime,
          currentMilestone: {
            milestoneId: 'm1',
            milestoneName: 'Hebbal',
            milestoneOrder: 1,
            status: 'reached',
          },
        }),
      },
      roomMilestoneSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn() } as any,
      { get: jest.fn() } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    const result = await service.getLiveState('room-1');

    expect(result.progressPercentage).toBe(42);
    expect(result.safetyDelayMinutes).toBe(10);
    expect(result.safetyMessage).toBe('Movement is delayed for safety. Exact location hidden.');
    expect(result.currentMilestone?.milestoneName).toBe('Hebbal');
    expect(result.sponsor?.name).toBe('Travel Partner');
    expect(prisma.liveLocationEvent.findFirst).toHaveBeenCalled();
  });

  it('never reports 100% while a live journey is still underway (100%-while-driving fix)', async () => {
    // Started 2h ago with a 1h expected duration: raw elapsed/expected = 200%.
    const room = {
      roomId: 'room-2',
      status: 'live',
      safetyDelayMinutes: 0,
      locationDisplayMode: 'approximate',
      movementAvatarType: 'car',
      movementAvatarUrl: null,
      isSponsored: false,
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expectedDurationSeconds: 60 * 60,
      visibleMovementStartTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    };

    const prisma = {
      predictionRoom: { findUnique: jest.fn().mockResolvedValue(room) },
      // No delayed location event -> viewer progress comes from the timed path.
      liveLocationEvent: { findFirst: jest.fn().mockResolvedValue(null) },
      roomMilestoneSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn() } as any,
      { get: jest.fn() } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    const result = await service.getLiveState('room-2');

    expect(result.progressPercentage).toBeLessThan(100);
    expect(result.progressPercentage).toBe(99);
    // The "Arrived" banner must not fire while still live.
    expect(result.milestoneBanner?.message).not.toBe('Arrived. The Tea is ready.');
  });

  it('reports 100% only once arrival is confirmed (status completed)', async () => {
    const room = {
      roomId: 'room-3',
      status: 'completed',
      safetyDelayMinutes: 0,
      locationDisplayMode: 'approximate',
      movementAvatarType: 'car',
      movementAvatarUrl: null,
      isSponsored: false,
      startTime: new Date(Date.now() - 30 * 60 * 1000),
      expectedDurationSeconds: 60 * 60,
      visibleMovementStartTime: new Date(Date.now() - 30 * 60 * 1000),
    };

    const prisma = {
      predictionRoom: { findUnique: jest.fn().mockResolvedValue(room) },
      liveLocationEvent: { findFirst: jest.fn().mockResolvedValue(null) },
      roomMilestoneSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn() } as any,
      { get: jest.fn() } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    const result = await service.getLiveState('room-3');

    expect(result.progressPercentage).toBe(100);
    expect(result.milestoneBanner?.message).toBe('Arrived. The Tea is ready.');
  });

  it('exposes stored checkpoint ETAs on live-state', async () => {
    const room = {
      roomId: 'room-etas',
      status: 'live',
      safetyDelayMinutes: 0,
      locationDisplayMode: 'approximate',
      movementAvatarType: 'car',
      checkpointEtas: {
        '40': {
          checkpoint: 40,
          etaSeconds: 1500,
          etaMinutes: 25,
          durationInTrafficSeconds: 1500,
          capturedAt: '2026-10-29T04:00:00.000Z',
          source: 'google',
        },
      },
    };
    const prisma = {
      predictionRoom: { findUnique: jest.fn().mockResolvedValue(room) },
      liveLocationEvent: { findFirst: jest.fn().mockResolvedValue(null) },
      roomMilestoneSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn() } as any,
      { get: jest.fn() } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );

    const result = await service.getLiveState('room-etas');
    expect(result.checkpointEtas['40']).toMatchObject({
      etaSeconds: 1500,
      etaMinutes: 25,
      durationInTrafficSeconds: 1500,
      source: 'google',
    });
  });

  it('records Google duration_in_traffic at crossed checkpoints instead of a 60-minute default', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'OK',
        routes: [
          {
            legs: [
              {
                duration: { value: 900 },
                duration_in_traffic: { value: 1200 },
              },
            ],
          },
        ],
      }),
    });
    global.fetch = fetchMock as any;

    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-ping',
          creatorUserId: 'u1',
          status: 'live',
          startTime: new Date(Date.now() - 10 * 60 * 1000),
          expectedDurationSeconds: 60 * 60,
          locationDisplayMode: 'approximate',
          startingLat: 12.9716,
          startingLng: 77.5946,
          destinationLat: 13.0,
          destinationLng: 77.5946,
          checkpointEtas: null,
          journeyRoute: { travelMode: 'car' },
        }),
        update,
      },
      liveLocationEvent: { create: jest.fn().mockResolvedValue({}) },
      roomCheckpoint: { upsert: jest.fn().mockResolvedValue({}) },
      roomMilestoneSnapshot: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    } as any;

    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn(), finalizeArrivalFromLocation: jest.fn() } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );

    try {
      const result = await service.recordLivePing(
        'room-ping',
        { lat: 12.9858, lng: 77.5946 },
        { userId: 'u1' } as any,
      );

      expect(fetchMock).toHaveBeenCalled();
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain('departure_time=now');
      expect(result.progressPercentage).toBeGreaterThanOrEqual(40);
      expect(result.progressPercentage).toBeLessThan(60);

      const stored = update.mock.calls[0][0].data.checkpointEtas;
      expect(stored['20'].etaSeconds).toBe(1200);
      expect(stored['20'].durationInTrafficSeconds).toBe(1200);
      expect(stored['40'].etaMinutes).toBe(20);
      expect(stored['60']).toBeUndefined();
      expect(stored['20'].etaSeconds).not.toBe(60 * 60);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
