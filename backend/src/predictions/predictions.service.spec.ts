import { BadRequestException, ConflictException } from '@nestjs/common';
import { PredictionsService } from './predictions.service';

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
