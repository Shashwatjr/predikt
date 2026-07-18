import { LeaderboardsService } from './leaderboards.service';

const viewer = { userId: 'me' } as any;

// A ~northbound trip: start (0,0) -> destination (0, 0.1). At the 50% checkpoint
// the traveller sits at (0, 0.05), reached 20 min after an 18:00 start. Observed
// speed therefore projects arrival ~20 more minutes out => ~18:40.
function buildRoom(overrides: any = {}) {
  return {
    roomId: 'room-1',
    status: 'live',
    visibility: 'public',
    creatorUserId: 'host',
    destinationLat: 0,
    destinationLng: 0.1,
    startTime: new Date('2026-07-16T18:00:00.000Z'),
    expectedDurationSeconds: 2400,
    journeyRoute: { startLat: 0, startLng: 0, destinationLat: 0, destinationLng: 0.1 },
    milestones: [{ milestoneId: 'final-1' }],
    checkpoints: [
      { checkpoint: 0, lat: 0, lng: 0, capturedAt: new Date('2026-07-16T18:00:00.000Z') },
      { checkpoint: 50, lat: 0, lng: 0.05, capturedAt: new Date('2026-07-16T18:20:00.000Z') },
    ],
    ...overrides,
  };
}

function predictionsFor(times: Array<{ userId: string; time: string; submittedAt: string }>) {
  return times.map((t, i) => ({
    predictionId: `p${i}`,
    userId: t.userId,
    milestoneId: 'final-1',
    predictedReachedTime: new Date(t.time),
    submittedAt: new Date(t.submittedAt),
    revokedAt: null,
    user: { userId: t.userId, name: t.userId, prediktHandle: null },
  }));
}

function makeService(room: any, predictions: any[]) {
  const prisma = {
    predictionRoom: { findUnique: jest.fn().mockResolvedValue(room) },
    roomMembership: { findUnique: jest.fn().mockResolvedValue({ status: 'joined' }) },
    milestonePrediction: { findMany: jest.fn().mockResolvedValue(predictions) },
  } as any;
  return new LeaderboardsService(prisma);
}

describe('LeaderboardsService.checkpointLeaderboard', () => {
  it('ranks predictions by closeness to the GPS-projected arrival', async () => {
    const predictions = predictionsFor([
      { userId: 'far', time: '2026-07-16T19:10:00.000Z', submittedAt: '2026-07-16T17:00:00.000Z' },
      { userId: 'closest', time: '2026-07-16T18:41:00.000Z', submittedAt: '2026-07-16T17:00:00.000Z' },
      { userId: 'mid', time: '2026-07-16T18:30:00.000Z', submittedAt: '2026-07-16T17:00:00.000Z' },
    ]);
    const service = makeService(buildRoom(), predictions);

    const board = await service.checkpointLeaderboard('room-1', 50, viewer);

    expect(board.available).toBe(true);
    if (!board.available) return;
    expect(board.basis).toBe('gps');
    // Projected arrival ~18:40 => 'closest' (18:41) first, 'mid' (18:30) second, 'far' last.
    expect(board.standings.map((s) => s.userId)).toEqual(['closest', 'mid', 'far']);
    expect(board.standings[0].rank).toBe(1);
  });

  it('breaks ties by earliest submission', async () => {
    // Two guesses equidistant from ~18:40 (18:35 and 18:45). Earlier submitter wins.
    const predictions = predictionsFor([
      { userId: 'late-submit', time: '2026-07-16T18:45:00.000Z', submittedAt: '2026-07-16T17:30:00.000Z' },
      { userId: 'early-submit', time: '2026-07-16T18:35:00.000Z', submittedAt: '2026-07-16T17:00:00.000Z' },
    ]);
    const service = makeService(buildRoom(), predictions);

    const board = await service.checkpointLeaderboard('room-1', 50, viewer);
    if (!board.available) throw new Error('expected available board');
    expect(board.standings[0].diffSeconds).toBe(board.standings[1].diffSeconds);
    expect(board.standings[0].userId).toBe('early-submit');
  });

  it('hides standings while predictions are still open', async () => {
    const service = makeService(buildRoom({ status: 'predictions_open' }), []);
    const board = await service.checkpointLeaderboard('room-1', 50, viewer);
    expect(board.available).toBe(false);
    if (board.available) return;
    expect(board.reason).toBe('predictions_open');
  });

  it('reports not_reached when the checkpoint has no capture yet', async () => {
    const service = makeService(buildRoom({ checkpoints: [] }), []);
    const board = await service.checkpointLeaderboard('room-1', 80, viewer);
    expect(board.available).toBe(false);
    if (board.available) return;
    expect(board.reason).toBe('not_reached');
  });

  it('falls back to pace extrapolation without GPS references', async () => {
    // No start checkpoint and no route coords => pace_fallback from elapsed fraction.
    const room = buildRoom({
      journeyRoute: null,
      destinationLat: null,
      destinationLng: null,
      checkpoints: [
        { checkpoint: 50, lat: 0, lng: 0.05, capturedAt: new Date('2026-07-16T18:20:00.000Z') },
      ],
    });
    const predictions = predictionsFor([
      { userId: 'a', time: '2026-07-16T18:40:00.000Z', submittedAt: '2026-07-16T17:00:00.000Z' },
    ]);
    const service = makeService(room, predictions);

    const board = await service.checkpointLeaderboard('room-1', 50, viewer);
    if (!board.available) throw new Error('expected available board');
    expect(board.basis).toBe('pace_fallback');
    // 20 min elapsed at 50% => projected total 40 min => arrival 18:40.
    expect(board.projectedArrivalAt).toBe('2026-07-16T18:40:00.000Z');
  });
});
