import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { safePublicUser, SAFE_PUBLIC_USER_SELECT } from '../common/utils/safe-user-select';
import { RoomsService } from '../rooms/rooms.service';
import { isLatePredictionWindowOpen } from '../common/utils/late-prediction';

@Injectable()
export class PredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService?: AuditService,
    private readonly roomsService?: RoomsService,
  ) {}

  async submit(roomId: string, dto: CreatePredictionDto, user: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { milestones: { where: { milestoneType: 'final_destination' } } },
    });
    if (!room) throw new NotFoundException('Room not found');

    if (room.answerType === 'multiple_choice') {
      if (!dto.selectedOptionKey) {
        throw new BadRequestException('selectedOptionKey is required');
      }

      const finalMilestone = room.milestones[0];
      if (!finalMilestone) {
        throw new NotFoundException('Final destination milestone not found');
      }

      return this.submitMilestonePredictions(
        roomId,
        {
          selectedOptionKey: dto.selectedOptionKey,
          predictions: [
            {
              milestoneId: finalMilestone.milestoneId,
              predictedReachedTime: room.predictionCloseTime.toISOString(),
            },
          ],
        },
        user,
      );
    }

    const fallback = dto.predictedArrivalTime
      ? {
          predictions: await this.buildCompatibilityPayload(
            roomId,
            dto.predictedArrivalTime,
          ),
        }
      : dto;

    return this.submitMilestonePredictions(roomId, fallback, user);
  }

  async submitMilestonePredictions(
    roomId: string,
    dto: CreatePredictionDto,
    user: User,
  ) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: {
        milestones: { orderBy: { milestoneOrder: 'asc' } },
        // Newest progress sample feeds the live pace-projected arrival cutoff.
        locationEvents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { progressPercentage: true, createdAt: true },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    await this.roomsService?.ensureJoinedMembership(roomId, user);

    const lateJoinWindowOpen = isLatePredictionWindowOpen(room);

    if (room.status !== 'predictions_open' && !lateJoinWindowOpen) {
      throw new BadRequestException('Predictions are not open for this room');
    }

    const predictions = dto.predictions ?? [];
    if (!predictions.length) {
      throw new BadRequestException('At least one milestone prediction is required');
    }

    const milestoneMap = new Map(room.milestones.map((m) => [m.milestoneId, m]));

    for (const entry of predictions) {
      const milestone = milestoneMap.get(entry.milestoneId);
      if (!milestone) {
        throw new BadRequestException(`Milestone ${entry.milestoneId} does not belong to this room`);
      }
      const closeTime = milestone.predictionCloseTime ?? room.predictionCloseTime;
      if (!lateJoinWindowOpen && new Date() > closeTime) {
        throw new BadRequestException(`Prediction window has closed for ${milestone.milestoneName}`);
      }
    }

    const existing = await this.prisma.milestonePrediction.findMany({
      where: {
        userId: user.userId,
        milestoneId: { in: predictions.map((entry) => entry.milestoneId) },
      },
    });
    if (existing.length) {
      throw new ConflictException('You have already submitted one or more milestone predictions');
    }

    await this.prisma.$transaction(async (tx) => {
      const submittedAt = new Date();
      // Fairness rule: edits are intentionally short-lived so players can fix typos without
      // creating a long window to wait for outside signals before changing a guess.
      const editDeadline = new Date(
        Math.min(
          submittedAt.getTime() + 2 * 60 * 1000,
          room.predictionCloseTime.getTime(),
        ),
      );
      await tx.milestonePrediction.createMany({
        data: predictions.map((entry) => ({
          roomId,
          userId: user.userId,
          milestoneId: entry.milestoneId,
          predictedReachedTime: new Date(entry.predictedReachedTime),
          selectedOptionKey: dto.selectedOptionKey ?? null,
          submittedAt,
          editDeadline,
        })),
      });

      const requiredMilestoneIds = room.milestones
        .filter((milestone) => milestone.status !== 'cancelled')
        .map((milestone) => milestone.milestoneId);

      const userCount = await tx.milestonePrediction.count({
        where: {
          roomId,
          userId: user.userId,
          milestoneId: { in: requiredMilestoneIds },
        },
      });

      const allSubmitted = userCount === requiredMilestoneIds.length;
      if (allSubmitted) {
        await tx.cloutTransaction.create({
          data: {
            userId: user.userId,
            roomId,
            amount: 20,
            transactionType: 'earn',
            reason: 'Submitted predictions for all milestones',
          },
        });

        await tx.user.update({
          where: { userId: user.userId },
          data: {
            predictionsMadeCount: { increment: requiredMilestoneIds.length },
            cloutBalance: { increment: 20 },
            lifetimeCloutEarned: { increment: 20 },
            currentStreak: { increment: 1 },
            longestStreak: { increment: 1 },
          },
        });
      } else {
        await tx.user.update({
          where: { userId: user.userId },
          data: {
            predictionsMadeCount: { increment: predictions.length },
          },
        });
      }

      const firstPredictionCredit = await tx.creditLedger.findUnique({
        where: { idempotencyKey: `first_prediction:${user.userId}` },
      });
      if (!firstPredictionCredit) {
        // Credit integrity: every balance mutation is mirrored in the ledger so reversals
        // and audits can reason about user-visible balances deterministically.
        const updatedUser = await tx.user.update({
          where: { userId: user.userId },
          data: { creditBalance: { increment: 10 } },
        });
        await tx.creditLedger.create({
          data: {
            userId: user.userId,
            eventType: 'first_prediction',
            delta: 10,
            balanceAfter: updatedUser.creditBalance,
            sourceId: roomId,
            sourceType: 'room',
            idempotencyKey: `first_prediction:${user.userId}`,
            metadata: { label: 'First prediction credit bonus' },
          },
        });
      }
    });

    await this.auditService?.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'prediction.submitted',
      targetType: 'room',
      targetId: roomId,
      afterValue: { count: predictions.length },
    });
    await this.auditService?.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'prediction_submitted',
      targetType: 'room',
      targetId: roomId,
      afterValue: {
        count: predictions.length,
        category: room.category,
        mode: room.mode,
        answerType: room.answerType,
      },
    });

    return this.listMilestonePredictions(roomId, user);
  }

  async list(roomId: string, user: User) {
    const items = await this.listMilestonePredictions(roomId, user);
    return items.filter((item) => item.milestoneType === 'final_destination');
  }

  async listMilestonePredictions(roomId: string, requestingUser: User) {
    const room = await this.assertRoom(roomId);
    if (room.visibility === 'private') {
      const membership = await this.prisma.roomMembership.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: requestingUser.userId,
          },
        },
      });
      if (room.creatorUserId !== requestingUser.userId && membership?.status !== 'joined') {
        throw new ForbiddenException('Join this room to view predictions.');
      }
    }
    const hideValues =
      room.predictionVisibilityMode === 'hidden_until_lock' &&
      room.status === 'predictions_open';

    const predictions = await this.prisma.milestonePrediction.findMany({
      where: { roomId },
      include: {
        user: { select: SAFE_PUBLIC_USER_SELECT },
        milestone: {
          select: {
            milestoneId: true,
            milestoneName: true,
            milestoneOrder: true,
            milestoneType: true,
          },
        },
      },
      orderBy: [{ milestone: { milestoneOrder: 'asc' } }, { submittedAt: 'asc' }],
    });

    return predictions.map((prediction) => ({
      predictionId: prediction.predictionId,
      milestoneId: prediction.milestoneId,
      milestoneName: prediction.milestone.milestoneName,
      milestoneOrder: prediction.milestone.milestoneOrder,
      milestoneType: prediction.milestone.milestoneType,
      predictedReachedTime:
        // Fairness rule: before lock, peers should only know that a prediction exists.
        hideValues || prediction.revokedAt ? undefined : prediction.predictedReachedTime,
      selectedOptionKey:
        hideValues || prediction.revokedAt ? undefined : prediction.selectedOptionKey,
      submittedAt: prediction.submittedAt,
      editDeadline: prediction.editDeadline,
      revokedAt: prediction.revokedAt,
      status: prediction.revokedAt
        ? 'revoked'
        : hideValues
          ? 'submitted'
          : 'visible',
      isCurrentUser: prediction.userId === requestingUser.userId,
      differenceFromActualMinutes: prediction.differenceFromActualMinutes,
      differenceFromActualSeconds: prediction.differenceFromActualSeconds,
      rankForMilestone: prediction.rankForMilestone,
      totalAuraAwarded: prediction.totalAuraAwarded,
      cloutAwarded: prediction.cloutAwarded,
      user: safePublicUser(prediction.user),
    }));
  }

  async updatePrediction(predictionId: string, dto: any, user: User) {
    const prediction = await this.getEditablePrediction(predictionId, user);
    if (prediction.room.answerType === 'multiple_choice') {
      if (!dto.selectedOptionKey) {
        throw new BadRequestException('selectedOptionKey is required');
      }
      const updated = await this.prisma.milestonePrediction.update({
        where: { predictionId },
        data: {
          selectedOptionKey: dto.selectedOptionKey,
          revokedAt: null,
        },
      });
      await this.auditService?.log({
        actorType: 'user',
        actorId: user.userId,
        action: 'prediction.edited',
        targetType: 'prediction',
        targetId: predictionId,
        afterValue: { roomId: prediction.roomId, selectedOptionKey: dto.selectedOptionKey },
      });
      return updated;
    }
    const predictedReachedTime = dto.predictedReachedTime ?? dto.predictedArrivalTime;
    if (!predictedReachedTime) {
      throw new BadRequestException('predictedReachedTime or predictedArrivalTime is required');
    }
    const updated = await this.prisma.milestonePrediction.update({
      where: { predictionId },
      data: {
        predictedReachedTime: new Date(predictedReachedTime),
        revokedAt: null,
      },
    });
    await this.auditService?.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'prediction.edited',
      targetType: 'prediction',
      targetId: predictionId,
      afterValue: { roomId: prediction.roomId },
    });
    return updated;
  }

  async revokePrediction(predictionId: string, user: User) {
    const prediction = await this.getEditablePrediction(predictionId, user);
    const revoked = await this.prisma.milestonePrediction.update({
      where: { predictionId },
      data: { revokedAt: new Date() },
    });
    await this.auditService?.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'prediction.revoked',
      targetType: 'prediction',
      targetId: predictionId,
      afterValue: { roomId: prediction.roomId },
    });
    return revoked;
  }

  private async assertRoom(roomId: string) {
    const room = await this.prisma.predictionRoom.findUnique({ where: { roomId } });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  private async getEditablePrediction(predictionId: string, user: User) {
    const prediction = await this.prisma.milestonePrediction.findUnique({
      where: { predictionId },
      include: { room: true },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    if (prediction.userId !== user.userId) {
      throw new ForbiddenException('You can only edit your own prediction');
    }
    if (prediction.revokedAt) {
      throw new BadRequestException('Prediction has been revoked');
    }
    const now = new Date();
    const deadline = prediction.editDeadline ?? prediction.room.predictionCloseTime;
    if (now > deadline || now > prediction.room.predictionCloseTime) {
      throw new BadRequestException('Prediction edit window has closed');
    }
    if (prediction.room.status !== 'predictions_open') {
      throw new ForbiddenException('Predictions are locked for this room');
    }
    return prediction;
  }

  private async buildCompatibilityPayload(roomId: string, predictedArrivalTime: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { milestones: { where: { milestoneType: 'final_destination' } } },
    });
    if (!room || room.milestones.length === 0) {
      throw new NotFoundException('Final destination milestone not found');
    }

    return room.milestones.map((milestone) => ({
      milestoneId: milestone.milestoneId,
      predictedReachedTime: predictedArrivalTime,
    }));
  }

}
