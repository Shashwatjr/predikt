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
});
