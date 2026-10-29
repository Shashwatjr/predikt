import { PrismaClient } from '@prisma/client';
import { LiveProgressService } from './live-progress.service';
import { featureFlags } from '../config/feature-flags';

// This suite must only write to the explicitly provisioned disposable local DB.
describe('checkpoint authority (disposable PostgreSQL)', () => {
  const prisma = new PrismaClient();
  let roomId: string;
  let userId: string;
  const originalFetch = global.fetch;
  const flags = featureFlags as { checkpointLeaderboardV2: boolean };
  const originalFlag = flags.checkpointLeaderboardV2;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.includes('wave1_test')) {
      throw new Error('Requires disposable local wave1_test database');
    }
    flags.checkpointLeaderboardV2 = true;
    const user = await prisma.user.create({ data: { name: 'Concurrency fixture' } });
    userId = user.userId;
    const room = await prisma.predictionRoom.create({ data: {
      creatorUserId: userId, roomTitle: 'Concurrency fixture', eventType: 'journey',
      startingPointLabel: 'Station', destinationLabel: 'Cafe',
      startingLat: 12.9716, startingLng: 77.5946, destinationLat: 13.2216, destinationLng: 77.5946,
      status: 'live', startTime: new Date(Date.now() - 600_000), expectedDurationSeconds: 3600,
      predictionCloseTime: new Date(Date.now() - 60_000), safetyDelayMinutes: 10,
      inviteCode: `race-${Date.now()}`,
    } });
    roomId = room.roomId;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    flags.checkpointLeaderboardV2 = originalFlag;
    if (roomId) {
      await prisma.liveLocationEvent.deleteMany({ where: { roomId } });
      await prisma.roomCheckpoint.deleteMany({ where: { roomId } });
      await prisma.roomMilestoneSnapshot.deleteMany({ where: { roomId } });
      await prisma.predictionRoom.delete({ where: { roomId } });
    }
    if (userId) await prisma.user.delete({ where: { userId } });
    await prisma.$disconnect();
  });

  it('persists one canonical reading across posts and pings, hides claims, then delays guest ETAs', async () => {
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const provider = jest.fn(async () => {
      entered();
      await gate;
      return { ok: true, json: async () => ({ status: 'OK', routes: [{ legs: [{
        distance: { value: 5000 }, duration: { value: 900 }, duration_in_traffic: { value: 1200 },
      }] }] }) };
    });
    global.fetch = provider as any;
    const service = new LiveProgressService(prisma as any,
      { evaluateRoomLifecycle: jest.fn(), finalizeArrivalFromLocation: jest.fn().mockResolvedValue({ finalized: false }) } as any,
      { get: (key: string) => key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined } as any,
      { notifyRoomMembers: jest.fn() } as any);
    const point = { lat: 13.0966, lng: 77.5946 };
    const user = { userId } as any;
    const post = () => service.recordClientCheckpoint(roomId, { checkpointPct: 40, ...point }, user);
    const first = post();
    try {
      await started;
      await Promise.all([post(), service.recordLivePing(roomId, point, user), post()]);
      const inFlight = await service.getLiveState(roomId, { userId });
      expect(inFlight.checkpointEtas['40']).toBeUndefined();
      expect(JSON.stringify(inFlight)).not.toContain('provider-attempt');
    } finally { release(); }
    await first;
    expect(provider).toHaveBeenCalledTimes(1);
    const rows = await prisma.roomMilestoneSnapshot.findMany({ where: { roomId, checkpointPercent: 40 } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: 'google', etaSeconds: 1200 });
    const checkpoint = await prisma.roomCheckpoint.findUniqueOrThrow({ where: { roomId_checkpoint: { roomId, checkpoint: 40 } } });
    expect(checkpoint.etaSeconds).toBe(rows[0].etaSeconds);
    expect(checkpoint.capturedAt).toEqual(rows[0].capturedAt);
    const creator = await service.getLiveState(roomId, { userId });
    const guest = await service.getLiveState(roomId, { userId: 'guest' });
    expect(creator.checkpointEtas['40'].etaSeconds).toBe(1200);
    expect(guest.checkpointEtas).toEqual({});
    await prisma.roomMilestoneSnapshot.update({ where: { roomId_checkpointPercent: { roomId, checkpointPercent: 40 } }, data: { capturedAt: new Date(Date.now() - 660_000) } });
    const delayed = await service.getLiveState(roomId, { userId: 'guest' });
    expect(delayed.checkpointEtas['40'].etaSeconds).toBe(1200);
    expect(JSON.stringify(delayed)).not.toMatch(/provider-attempt|creatorUserId|test-key|rawLat|rawLng|latitude|longitude/);
  });
});
