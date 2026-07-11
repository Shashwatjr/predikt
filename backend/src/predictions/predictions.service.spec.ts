import { ConflictException } from '@nestjs/common';
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
});
