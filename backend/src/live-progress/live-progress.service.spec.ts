import { LiveProgressService } from './live-progress.service';
import { featureFlags } from '../config/feature-flags';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';

function mockLiveStatePrisma(room: Record<string, unknown>, snapshots: unknown[] = []) {
  return {
    predictionRoom: { findUnique: jest.fn().mockResolvedValue(room) },
    liveLocationEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    roomMilestoneSnapshot: {
      findMany: jest.fn().mockResolvedValue(snapshots),
      findFirst: jest.fn().mockResolvedValue(snapshots[snapshots.length - 1] ?? null),
    },
  } as any;
}

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
      roomMilestoneSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
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

    const prisma = mockLiveStatePrisma(room);
    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn() } as any,
      { get: jest.fn() } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    const result = await service.getLiveState('room-2');

    expect(result.progressPercentage).toBeLessThan(100);
    expect(result.progressPercentage).toBe(99);
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

    const prisma = mockLiveStatePrisma(room);
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

  it('exposes participant-safe checkpoint ETAs without coordinates', async () => {
    const capturedAt = new Date('2026-10-29T04:00:00.000Z');
    const prisma = mockLiveStatePrisma(
      {
        roomId: 'room-etas',
        status: 'live',
        safetyDelayMinutes: 0,
        locationDisplayMode: 'approximate',
        movementAvatarType: 'car',
        isSponsored: false,
      },
      [
        {
          checkpointPercent: 40,
          etaSeconds: 1500,
          remainingMeters: 4200,
          source: 'google',
          capturedAt,
        },
      ],
    );
    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn() } as any,
      { get: jest.fn() } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );

    const result = await service.getLiveState('room-etas');
    expect(result.checkpointEtas['40']).toEqual({
      checkpoint: 40,
      etaSeconds: 1500,
      etaMinutes: 25,
      remainingMeters: 4200,
      source: 'google',
      capturedAt: capturedAt.toISOString(),
    });
    expect(JSON.stringify(result)).not.toMatch(/"lat"|"lng"|rawLat|rawLng|latitude|longitude/);
  });

  function delayedRoom(overrides: Record<string, unknown> = {}) {
    return {
      roomId: 'room-delay',
      creatorUserId: 'creator-1',
      status: 'live',
      safetyDelayMinutes: 10,
      locationDisplayMode: 'approximate',
      movementAvatarType: 'car',
      movementAvatarUrl: null,
      isSponsored: false,
      ...overrides,
    };
  }

  function etaSnapshot(capturedAt: Date, overrides: Record<string, unknown> = {}) {
    return {
      checkpointPercent: 40,
      etaSeconds: 1500,
      remainingMeters: 4200,
      source: 'google',
      capturedAt,
      ...overrides,
    };
  }

  it('shows a fresh checkpoint only to the creator during the safety delay', async () => {
    const fresh = new Date();
    const prisma = mockLiveStatePrisma(delayedRoom(), [etaSnapshot(fresh)]);
    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn() } as any,
      { get: jest.fn() } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );

    const creator = await service.getLiveState('room-delay', { userId: 'creator-1' });
    const guest = await service.getLiveState('room-delay', { userId: 'guest-1' });
    const anonymous = await service.getLiveState('room-delay', null);

    expect(creator.checkpointEtas['40']).toMatchObject({
      checkpoint: 40,
      etaSeconds: 1500,
      etaMinutes: 25,
      remainingMeters: 4200,
      source: 'google',
      capturedAt: fresh.toISOString(),
    });
    expect(creator.etaMinutes).toBe(25);
    expect(guest.checkpointEtas).toEqual({});
    expect(guest.etaMinutes).toBeNull();
    expect(anonymous.checkpointEtas).toEqual({});
    expect(anonymous.etaMinutes).toBeNull();
    for (const result of [creator, guest, anonymous]) {
      expect(result).not.toHaveProperty('creatorUserId');
      expect(JSON.stringify(result)).not.toContain('creator-1');
      expect(JSON.stringify(result)).not.toMatch(/"lat"|"lng"|rawLat|rawLng|latitude|longitude/);
    }
    expect(prisma.roomMilestoneSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roomId: 'room-delay' },
      }),
    );
    expect(prisma.roomMilestoneSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          roomId: 'room-delay',
          capturedAt: { lt: expect.any(Date) },
        },
      }),
    );
  });

  it('shows guests a checkpoint only after it is older than the safety delay', async () => {
    const visible = new Date(Date.now() - 11 * 60 * 1000);
    const stillFresh = new Date();
    const prisma = mockLiveStatePrisma(delayedRoom(), [
      etaSnapshot(visible, { checkpointPercent: 20, etaSeconds: 2400, remainingMeters: 8000 }),
      etaSnapshot(stillFresh, { checkpointPercent: 40 }),
    ]);
    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn() } as any,
      { get: jest.fn() } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );

    const guest = await service.getLiveState('room-delay', { userId: 'guest-1' });
    expect(guest.checkpointEtas['20']).toMatchObject({
      checkpoint: 20,
      etaSeconds: 2400,
      remainingMeters: 8000,
      source: 'google',
      capturedAt: visible.toISOString(),
    });
    expect(guest.checkpointEtas['40']).toBeUndefined();
    expect(JSON.stringify(guest)).not.toMatch(/"lat"|"lng"|rawLat|rawLng|latitude|longitude/);
    expect(guest).not.toHaveProperty('creatorUserId');
  });
});

describe('LiveProgressService milestone ETA worker', () => {
  const originalFetch = global.fetch;
  const start = { lat: 12.9716, lng: 77.5946 };
  // ~27.8 km north so 90%/95% remain outside the 1 km arrival geofence.
  const dest = { lat: 13.2216, lng: 77.5946 };
  const METERS_PER_DEG_LAT = (6371000 * Math.PI) / 180;
  const pointAtRemainingMeters = (remainingMeters: number) => ({
    lat: dest.lat - remainingMeters / METERS_PER_DEG_LAT,
    lng: dest.lng,
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function pingPrisma(existingSnapshots: any[] = []) {
    const roomCheckpoint = { upsert: jest.fn().mockResolvedValue({}) };
    const roomMilestoneSnapshot = {
      findMany: jest.fn().mockResolvedValue(existingSnapshots),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(
        existingSnapshots.filter((s) => s.source && !['derived', 'fallback', 'arrived'].includes(s.source))
          .length,
      ),
      findFirst: jest.fn().mockResolvedValue(null),
    };
    const liveLocationEvent = { create: jest.fn().mockResolvedValue({}) };
    const predictionRoom = {
      findUnique: jest.fn().mockResolvedValue({
        roomId: 'room-ping',
        creatorUserId: 'u1',
        status: 'live',
        startTime: new Date(Date.now() - 10 * 60 * 1000),
        expectedDurationSeconds: 60 * 60,
        locationDisplayMode: 'approximate',
        startingLat: start.lat,
        startingLng: start.lng,
        destinationLat: dest.lat,
        destinationLng: dest.lng,
        journeyRoute: { travelMode: 'car', startLat: start.lat, startLng: start.lng },
      }),
      update: jest.fn().mockResolvedValue({}),
    };
    return {
      prisma: {
        predictionRoom,
        liveLocationEvent,
        roomCheckpoint,
        roomMilestoneSnapshot,
        $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
      } as any,
      roomCheckpoint,
      roomMilestoneSnapshot,
    };
  }

  function googleTrafficResponse(trafficSeconds: number, durationSeconds = trafficSeconds) {
    return {
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'OK',
        routes: [
          {
            legs: [
              {
                distance: { value: 5000 },
                duration: { value: durationSeconds },
                duration_in_traffic: { value: trafficSeconds },
              },
            ],
          },
        ],
      }),
    };
  }

  it('stores only the current Google reading and marks skipped earlier checkpoints as derived', async () => {
    const fetchMock = jest.fn().mockResolvedValue(googleTrafficResponse(1200, 900));
    global.fetch = fetchMock as any;
    const { prisma, roomCheckpoint, roomMilestoneSnapshot } = pingPrisma([]);
    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn(), finalizeArrivalFromLocation: jest.fn() } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );

    // ~50% of the start→dest straight line.
    const mid = { lat: start.lat + (dest.lat - start.lat) * 0.5, lng: start.lng };
    await service.recordLivePing('room-ping', mid, { userId: 'u1' } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('departure_time=now');

    const checkpointCreates = roomCheckpoint.upsert.mock.calls.map((c: any) => c[0].create);
    const snapshotCreates = roomMilestoneSnapshot.upsert.mock.calls.map((c: any) => c[0].create);
    expect(checkpointCreates.map((c: any) => c.checkpoint).sort((a: number, b: number) => a - b)).toEqual([
      20, 40,
    ]);
    expect(snapshotCreates.find((c: any) => c.checkpointPercent === 40)).toMatchObject({
      etaSeconds: 1200,
      source: 'google',
    });
    expect(snapshotCreates.find((c: any) => c.checkpointPercent === 20)).toMatchObject({
      source: 'derived',
    });
    expect(snapshotCreates.find((c: any) => c.checkpointPercent === 20).etaSeconds).not.toBe(1200);
  });

  it('consumes the checkpoint attempt when the provider fails and does not retry it', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    global.fetch = fetchMock as any;
    const { prisma, roomMilestoneSnapshot } = pingPrisma([]);
    const stored: Array<Record<string, unknown>> = [];
    roomMilestoneSnapshot.findMany.mockImplementation(async () => stored.map((row) => ({ ...row })));
    roomMilestoneSnapshot.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      if (stored.some((row) => row.checkpointPercent === data.checkpointPercent)) {
        const error = new Error('Unique constraint failed') as Error & { code: string };
        error.code = 'P2002';
        throw error;
      }
      stored.push({ ...data });
      return data;
    });
    roomMilestoneSnapshot.upsert.mockImplementation(
      async ({
        where,
        create,
        update,
      }: {
        where: { roomId_checkpointPercent?: { checkpointPercent: number } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const pct = where.roomId_checkpointPercent?.checkpointPercent ?? create.checkpointPercent;
        const index = stored.findIndex((row) => row.checkpointPercent === pct);
        if (index >= 0) stored[index] = { ...stored[index], ...update, checkpointPercent: pct };
        else stored.push({ ...create });
        return {};
      },
    );
    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn(), finalizeArrivalFromLocation: jest.fn() } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    const mid = { lat: start.lat + (dest.lat - start.lat) * 0.45, lng: start.lng };

    await service.recordLivePing('room-ping', mid, { userId: 'u1' } as any);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const failed = stored.find((row) => row.checkpointPercent === 40);
    expect(failed).toMatchObject({ source: 'provider-failed' });
    expect(typeof failed?.etaSeconds).toBe('number');
    expect(stored.find((row) => row.checkpointPercent === 20)).toMatchObject({ source: 'derived' });

    await service.recordLivePing('room-ping', mid, { userId: 'u1' } as any);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stored.filter((row) => row.source === 'google')).toHaveLength(0);
  });

  it('counts provider failures toward the five-call cap and still stores 100 as zero', async () => {
    const fetchMock = jest.fn().mockResolvedValue(googleTrafficResponse(800));
    global.fetch = fetchMock as any;
    const existing = [20, 40, 60, 80, 95].map((checkpointPercent) => ({
      checkpointPercent,
      source: 'provider-failed',
      etaSeconds: 900,
      capturedAt: new Date(Date.now() - 60_000),
    }));
    const { prisma, roomMilestoneSnapshot } = pingPrisma(existing);
    const service = new LiveProgressService(
      prisma,
      {
        evaluateRoomLifecycle: jest.fn(),
        finalizeArrivalFromLocation: jest.fn().mockResolvedValue({ finalized: true, result: {} }),
      } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );

    await service.recordLivePing('room-ping', { lat: dest.lat, lng: dest.lng }, { userId: 'u1' } as any);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(roomMilestoneSnapshot.create).not.toHaveBeenCalled();
    const creates = roomMilestoneSnapshot.upsert.mock.calls.map((c: any) => c[0].create);
    expect(creates.find((c: any) => c.checkpointPercent === 100)).toMatchObject({
      etaSeconds: 0,
      source: 'arrived',
    });
    expect(creates.every((c: any) => c.source !== 'google')).toBe(true);
  });

  it('respects the five-call billable cap', async () => {
    const fetchMock = jest.fn().mockResolvedValue(googleTrafficResponse(800));
    global.fetch = fetchMock as any;
    const existing = [20, 40, 60, 80, 95].map((checkpointPercent) => ({
      checkpointPercent,
      source: 'google',
      etaSeconds: 900,
      capturedAt: new Date(Date.now() - 60_000),
    }));
    const { prisma, roomMilestoneSnapshot } = pingPrisma(existing);
    const service = new LiveProgressService(
      prisma,
      {
        evaluateRoomLifecycle: jest.fn(),
        finalizeArrivalFromLocation: jest.fn().mockResolvedValue({ finalized: true, result: {} }),
      } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );

    await service.recordLivePing('room-ping', { lat: dest.lat, lng: dest.lng }, { userId: 'u1' } as any);

    expect(fetchMock).not.toHaveBeenCalled();
    const creates = roomMilestoneSnapshot.upsert.mock.calls.map((c: any) => c[0].create);
    expect(creates.some((c: any) => c.checkpointPercent === 100 && c.etaSeconds === 0)).toBe(true);
    expect(creates.every((c: any) => c.source !== 'google')).toBe(true);
  });

  it('uses derived ETA at 90, provider at 95, and zero at 100 without a paid call', async () => {
    const fetchMock = jest.fn().mockResolvedValue(googleTrafficResponse(300));
    global.fetch = fetchMock as any;

    // First: cross 90 only (no prior snapshots). No paid call. Remain > 1 km.
    const first = pingPrisma([]);
    const atNinety = pointAtRemainingMeters(2500);
    const service90 = new LiveProgressService(
      first.prisma,
      {
        evaluateRoomLifecycle: jest.fn(),
        finalizeArrivalFromLocation: jest.fn().mockResolvedValue({ finalized: false }),
      } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    await service90.recordLivePing('room-ping', atNinety, { userId: 'u1' } as any);
    const at90 = first.roomMilestoneSnapshot.upsert.mock.calls.map((c: any) => c[0].create);
    const current90 = at90.filter((c: any) => c.checkpointPercent === 90);
    expect(current90).toHaveLength(1);
    expect(current90[0].source).toBe('derived');
    expect(fetchMock).not.toHaveBeenCalled();

    // Second: already have through 90; cross 95 with a paid call. Remain > 1 km.
    const existingThrough90 = [20, 40, 60, 80, 90].map((checkpointPercent) => ({
      checkpointPercent,
      source: checkpointPercent === 90 ? 'derived' : 'google',
      etaSeconds: 400,
      capturedAt: new Date(),
    }));
    const second = pingPrisma(existingThrough90);
    const atNinetyFive = pointAtRemainingMeters(1200);
    const service95 = new LiveProgressService(
      second.prisma,
      {
        evaluateRoomLifecycle: jest.fn(),
        finalizeArrivalFromLocation: jest.fn().mockResolvedValue({ finalized: false }),
      } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    await service95.recordLivePing('room-ping', atNinetyFive, { userId: 'u1' } as any);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const at95 = second.roomMilestoneSnapshot.upsert.mock.calls.map((c: any) => c[0].create);
    expect(at95.find((c: any) => c.checkpointPercent === 95)).toMatchObject({
      source: 'google',
      etaSeconds: 300,
    });

    // Third: arrival geofence stores 100 with zero ETA and no paid call.
    fetchMock.mockClear();
    const existingThrough95 = [
      ...existingThrough90,
      { checkpointPercent: 95, source: 'google', etaSeconds: 300, capturedAt: new Date() },
    ];
    const third = pingPrisma(existingThrough95);
    const service100 = new LiveProgressService(
      third.prisma,
      {
        evaluateRoomLifecycle: jest.fn(),
        finalizeArrivalFromLocation: jest.fn().mockResolvedValue({ finalized: true, result: { ok: true } }),
      } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    const arrived = await service100.recordLivePing(
      'room-ping',
      { lat: dest.lat, lng: dest.lng },
      { userId: 'u1' } as any,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(arrived.etaSeconds).toBe(0);
    const at100 = third.roomMilestoneSnapshot.upsert.mock.calls.map((c: any) => c[0].create);
    expect(at100.find((c: any) => c.checkpointPercent === 100)).toMatchObject({
      etaSeconds: 0,
      source: 'arrived',
    });
  });

  function uniqueConflict() {
    const error = new Error('Unique constraint failed') as Error & { code: string };
    error.code = 'P2002';
    return error;
  }

  async function raceProviderClaims(
    create: jest.Mock,
    run: () => Promise<unknown>,
  ) {
    let claims = 0;
    let releaseFirst: () => void = () => undefined;
    const firstWaiting = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    create.mockImplementation(async ({ data }: { data: { source?: string } }) => {
      if (data.source !== 'provider-attempt') return data;
      claims += 1;
      if (claims === 1) {
        await firstWaiting;
        return data;
      }
      releaseFirst();
      throw uniqueConflict();
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('second claim did not arrive')), 1000);
    });
    try {
      await Promise.race([run(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    return claims;
  }

  it('uses one provider attempt when a checkpoint post and a live ping cross the same milestone together', async () => {
    const fetchMock = jest.fn().mockResolvedValue(googleTrafficResponse(1200, 900));
    global.fetch = fetchMock as any;
    const { prisma, roomMilestoneSnapshot } = pingPrisma([]);
    const flags = featureFlags as { checkpointLeaderboardV2: boolean };
    const previous = flags.checkpointLeaderboardV2;
    flags.checkpointLeaderboardV2 = true;
    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn(), finalizeArrivalFromLocation: jest.fn().mockResolvedValue({ finalized: false }) } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    const mid = { lat: start.lat + (dest.lat - start.lat) * 0.5, lng: start.lng };
    try {
      const claims = await raceProviderClaims(roomMilestoneSnapshot.create, () =>
        Promise.all([
          service.recordClientCheckpoint(
            'room-ping',
            { checkpointPct: 40, lat: mid.lat, lng: mid.lng },
            { userId: 'u1' } as any,
          ),
          service.recordLivePing('room-ping', mid, { userId: 'u1' } as any),
        ]),
      );
      expect(claims).toBe(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const googleWrites = roomMilestoneSnapshot.upsert.mock.calls
        .map((call: any) => call[0].create)
        .filter((row: any) => row.checkpointPercent === 40 && row.source === 'google');
      expect(googleWrites).toHaveLength(1);
    } finally {
      flags.checkpointLeaderboardV2 = previous;
    }
  });

  it('uses one provider attempt when two live pings cross the same milestone together', async () => {
    const fetchMock = jest.fn().mockResolvedValue(googleTrafficResponse(1000));
    global.fetch = fetchMock as any;
    const { prisma, roomMilestoneSnapshot } = pingPrisma([]);
    const service = new LiveProgressService(
      prisma,
      { evaluateRoomLifecycle: jest.fn(), finalizeArrivalFromLocation: jest.fn().mockResolvedValue({ finalized: false }) } as any,
      { get: jest.fn((key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined)) } as any,
      { notifyRoomMembers: jest.fn() } as any,
    );
    const mid = { lat: start.lat + (dest.lat - start.lat) * 0.5, lng: start.lng };
    const claims = await raceProviderClaims(roomMilestoneSnapshot.create, () =>
      Promise.all([
        service.recordLivePing('room-ping', mid, { userId: 'u1' } as any),
        service.recordLivePing('room-ping', mid, { userId: 'u1' } as any),
      ]),
    );
    expect(claims).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const googleWrites = roomMilestoneSnapshot.upsert.mock.calls
      .map((call: any) => call[0].create)
      .filter((row: any) => row.source === 'google');
    expect(googleWrites).toHaveLength(1);
  });
});

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();

  it('keeps anonymous and rejected credentials on the public live-state path', () => {
    expect(guard.handleRequest(null, false)).toBeNull();
    expect(guard.handleRequest(new Error('expired'), false)).toBeNull();
    expect(guard.handleRequest(null, { userId: 'guest-1' })).toEqual({ userId: 'guest-1' });
  });
});
