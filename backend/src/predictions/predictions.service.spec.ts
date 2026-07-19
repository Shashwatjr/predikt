import { BadRequestException, ConflictException } from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { featureFlags } from '../config/feature-flags';

const PAST = new Date(Date.now() - 60 * 1000);
const FUTURE = new Date(Date.now() + 60 * 1000);
const ARRIVAL = new Date(Date.now() + 30 * 60 * 1000);

function blurPrisma(ownEditDeadline: Date) {
  return {
    predictionRoom: {
      findUnique: jest.fn().mockResolvedValue({
        roomId: 'room-1',
        visibility: 'public',
        predictionVisibilityMode: 'hidden_until_lock',
        status: 'live',
      }),
    },
    milestonePrediction: {
      findMany: jest.fn().mockResolvedValue([
        {
          predictionId: 'p-own',
          milestoneId: 'm1',
          userId: 'u1',
          predictedReachedTime: ARRIVAL,
          submittedAt: PAST,
          editDeadline: ownEditDeadline,
          revokedAt: null,
          lockedStatus: false,
          auraEligible: true,
          lockedCheckpoint: null,
          milestone: { milestoneId: 'm1', milestoneName: 'Home', milestoneOrder: 1, milestoneType: 'final_destination' },
          user: { userId: 'u1', name: 'Me', prediktHandle: 'me' },
        },
        {
          predictionId: 'p-peer',
          milestoneId: 'm1',
          userId: 'u2',
          predictedReachedTime: ARRIVAL,
          submittedAt: PAST,
          editDeadline: PAST,
          revokedAt: null,
          lockedStatus: true,
          auraEligible: true,
          lockedCheckpoint: null,
          milestone: { milestoneId: 'm1', milestoneName: 'Home', milestoneOrder: 1, milestoneType: 'final_destination' },
          user: { userId: 'u2', name: 'Peer', prediktHandle: 'peer' },
        },
      ]),
    },
  } as any;
}

describe('PredictionsService v2 per-viewer blur', () => {
  let original: boolean;
  beforeEach(() => {
    original = featureFlags.checkpointLeaderboardV2;
    (featureFlags as { checkpointLeaderboardV2: boolean }).checkpointLeaderboardV2 = true;
  });
  afterEach(() => {
    (featureFlags as { checkpointLeaderboardV2: boolean }).checkpointLeaderboardV2 = original;
  });

  it("hides a peer's time until the viewer's own prediction locks", async () => {
    // Viewer u1 still in the 1-min review (editDeadline in the future) => peer blurred.
    const service = new PredictionsService(blurPrisma(FUTURE));
    const list = await service.listMilestonePredictions('room-1', { userId: 'u1' } as any);
    const peer = list.find((p) => p.predictionId === 'p-peer')!;
    const own = list.find((p) => p.predictionId === 'p-own')!;
    expect(peer.status).toBe('submitted');
    expect(peer.predictedReachedTime).toBeUndefined();
    expect(own.predictedReachedTime).toBeDefined(); // own always visible to self
  });

  it("reveals a peer's time once the viewer's own prediction has locked", async () => {
    // Viewer u1's review has elapsed (editDeadline in the past) => peer revealed.
    const service = new PredictionsService(blurPrisma(PAST));
    const list = await service.listMilestonePredictions('room-1', { userId: 'u1' } as any);
    const peer = list.find((p) => p.predictionId === 'p-peer')!;
    expect(peer.status).toBe('visible');
    expect(peer.predictedReachedTime).toBeDefined();
  });
});

describe('PredictionsService', () => {
  it('enforces one prediction per user per milestone', async () => {
    const closeTime = new Date(Date.now() + 60 * 1000);
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          status: 'predictions_open',
          predictionCloseTime: closeTime,
          milestones: [
            {
              milestoneId: 'm1',
              milestoneName: 'Hebbal',
              predictionCloseTime: closeTime,
              status: 'prediction_open',
            },
          ],
        }),
      },
      milestonePrediction: {
        findMany: jest.fn().mockResolvedValue([{ predictionId: 'existing' }]),
      },
    } as any;

    const service = new PredictionsService(prisma);

    await expect(
      service.submitMilestonePredictions(
        'room-1',
        {
          predictions: [
            {
              milestoneId: 'm1',
              predictedReachedTime: new Date().toISOString(),
            },
          ],
        },
        { userId: 'u1' } as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects late-join predictions inside the final 3 minutes before benchmark arrival', async () => {
    const closeTime = new Date(Date.now() - 60 * 1000);
    const scheduledStartAt = new Date(Date.now() - 25 * 60 * 1000);
    const prisma = {
      predictionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          roomId: 'room-1',
          status: 'live',
          predictionCloseTime: closeTime,
          journeyStartedAt: new Date(Date.now() - 5 * 60 * 1000),
          journeyScheduledStartAt: scheduledStartAt,
          answerType: 'exact_time',
          roomCategory: 'journey',
          baselineValue: 27 * 60,
          milestones: [
            {
              milestoneId: 'm1',
              milestoneName: 'Hebbal',
              predictionCloseTime: closeTime,
              status: 'prediction_locked',
            },
          ],
        }),
      },
      milestonePrediction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const roomsService = {
      ensureJoinedMembership: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new PredictionsService(prisma, undefined, roomsService);

    await expect(
      service.submitMilestonePredictions(
        'room-1',
        {
          predictions: [
            {
              milestoneId: 'm1',
              predictedReachedTime: new Date().toISOString(),
            },
          ],
        },
        { userId: 'u1' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
