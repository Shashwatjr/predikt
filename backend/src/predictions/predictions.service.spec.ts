import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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

describe('PredictionsService.updatePrediction (open_prediction editing)', () => {
  const OWNER = { userId: 'owner-1' } as any;
  const OTHER = { userId: 'intruder-9' } as any;

  function editPrisma(overrides: {
    predictionUserId?: string;
    roomStatus?: string;
    predictionCloseTime?: Date;
    options?: unknown;
    revokedAt?: Date | null;
  }) {
    const prediction = {
      predictionId: 'pred-1',
      roomId: 'room-1',
      userId: overrides.predictionUserId ?? 'owner-1',
      selectedOptionKey: 'yes',
      revokedAt: overrides.revokedAt ?? null,
      editDeadline: null,
      room: {
        roomId: 'room-1',
        category: 'open_prediction',
        templateKey: 'open_prediction',
        answerType: 'multiple_choice',
        status: overrides.roomStatus ?? 'predictions_open',
        predictionCloseTime: overrides.predictionCloseTime ?? FUTURE,
        options: overrides.options ?? ['yes', 'no'],
      },
    };
    const update = jest.fn().mockResolvedValue({ ...prediction, selectedOptionKey: 'no' });
    const create = jest.fn();
    return {
      prisma: {
        milestonePrediction: {
          findUnique: jest.fn().mockResolvedValue(prediction),
          update,
          create,
        },
      } as any,
      update,
      create,
    };
  }

  it('lets the owner update their choice in place (no duplicate row created)', async () => {
    const { prisma, update, create } = editPrisma({});
    const service = new PredictionsService(prisma);
    const result = await service.updatePrediction('pred-1', { selectedOptionKey: 'no' }, OWNER);
    expect(update).toHaveBeenCalledWith({
      where: { predictionId: 'pred-1' },
      data: { selectedOptionKey: 'no', revokedAt: null },
    });
    expect(create).not.toHaveBeenCalled();
    expect(result.selectedOptionKey).toBe('no');
  });

  it('rejects a non-owner with 403', async () => {
    const { prisma, update } = editPrisma({ predictionUserId: 'someone-else' });
    const service = new PredictionsService(prisma);
    await expect(
      service.updatePrediction('pred-1', { selectedOptionKey: 'no' }, OTHER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects editing once predictions are locked (status no longer open)', async () => {
    const { prisma } = editPrisma({ roomStatus: 'predictions_locked' });
    const service = new PredictionsService(prisma);
    await expect(
      service.updatePrediction('pred-1', { selectedOptionKey: 'no' }, OWNER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects editing once the prediction close time has passed', async () => {
    const { prisma } = editPrisma({ predictionCloseTime: PAST });
    const service = new PredictionsService(prisma);
    await expect(
      service.updatePrediction('pred-1', { selectedOptionKey: 'no' }, OWNER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an option key that is not one of the room options', async () => {
    const { prisma, update } = editPrisma({ options: ['yes', 'no'] });
    const service = new PredictionsService(prisma);
    await expect(
      service.updatePrediction('pred-1', { selectedOptionKey: 'maybe' }, OWNER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('Open-prediction result copy helpers', () => {
  const makeService = () =>
    new (require('../lifecycle/lifecycle.service').LifecycleService)(
      {} as any,
      { log: jest.fn() } as any,
      { notifyRoomMembers: jest.fn() } as any,
      { awardRoomBadges: jest.fn() } as any,
    );

  it('uses Custom Challenge result copy for custom_challenge subtype', () => {
    const service = makeService() as any;
    expect(
      service.buildResultReadyBody({
        category: 'open_prediction',
        scoringRule: { subtype: 'custom_challenge' },
      }),
    ).toBe('Result revealed. Correct picks earn Aura.');
    expect(service.buildMomentCardCopy('open_prediction', 'custom_challenge')).toEqual({
      titles: ['Prediction Pro', 'Result revealed', 'Aura unlocked'],
      shareText: 'Prediction Pro unlocked. Correct picks earn Aura.',
    });
  });

  it('uses Sports result copy for sports subtype', () => {
    const service = makeService() as any;
    expect(
      service.buildResultReadyBody({
        category: 'open_prediction',
        scoringRule: { subtype: 'sports' },
      }),
    ).toBe('Final result revealed. Correct picks earn Aura.');
    expect(service.buildMomentCardCopy('open_prediction', 'sports')).toEqual({
      titles: ['Match Oracle', 'Final result revealed', 'Aura unlocked'],
      shareText: 'Match Oracle unlocked. Correct picks earn Aura.',
    });
  });
});
