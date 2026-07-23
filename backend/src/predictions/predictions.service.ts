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
import { featureFlags } from '../config/feature-flags';

// v2: highest checkpoint reached; predictions locked after 80% are Rizz-tier only,
// and none are accepted after 100%.
async function maxReachedCheckpoint(
  prisma: PrismaService,
  roomId: string,
): Promise<number> {
  const rows = await prisma.roomCheckpoint.findMany({
    where: { roomId },
    select: { checkpoint: true },
  });
  return rows.reduce((max, row) => Math.max(max, row.checkpoint), -1);
}

// Extract the whitelist of valid option keys from a room's stored `options` JSON.
// Options are persisted as a string[] of keys (e.g. ['yes','no'] or custom keys);
// tolerate {key}/{value} object shapes defensively. Returns null when the room has
// no structured options to validate against (nothing to enforce).
function roomOptionKeys(options: unknown): string[] | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  const keys = options
    .map((option) => {
      if (typeof option === 'string') return option;
      if (option && typeof option === 'object') {
        const record = option as Record<string, unknown>;
        const candidate = record.key ?? record.value ?? record.id;
        return typeof candidate === 'string' ? candidate : null;
      }
      return null;
    })
    .filter((key): key is string => typeof key === 'string' && key.length > 0);
  return keys.length ? keys : null;
}

// Reject a selectedOptionKey that isn't one of the room's defined options.
function assertOptionInRoom(selectedOptionKey: string, options: unknown) {
  const keys = roomOptionKeys(options);
  if (keys && !keys.includes(selectedOptionKey)) {
    throw new BadRequestException('selectedOptionKey is not a valid option for this room');
  }
}

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

    // v2 (checkpoint_leaderboard_v2): predictions placed after the 80% checkpoint are
    // accepted but Rizz-tier only (excluded from winner/Aura); none accepted after 100%.
    const v2 = featureFlags.checkpointLeaderboardV2;
    let auraEligible = true;
    let lockedCheckpoint: number | null = null;
    if (v2) {
      const maxCp = await maxReachedCheckpoint(this.prisma, roomId);
      if (maxCp >= 100) {
        throw new BadRequestException('Predictions are closed for this room');
      }
      if (maxCp >= 80) {
        auraEligible = false;
        lockedCheckpoint = 80;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const submittedAt = new Date();
      // Fairness rule: edits are intentionally short-lived so players can fix typos without
      // creating a long window to wait for outside signals before changing a guess.
      // v2 keeps the same 2-minute review window; editability past that is governed by the
      // 80%-checkpoint re-predict window (see getEditablePrediction).
      const reviewMs = 2 * 60 * 1000;
      const editDeadline = v2
        ? new Date(submittedAt.getTime() + reviewMs)
        : new Date(Math.min(submittedAt.getTime() + reviewMs, room.predictionCloseTime.getTime()));
      await tx.milestonePrediction.createMany({
        data: predictions.map((entry) => ({
          roomId,
          userId: user.userId,
          milestoneId: entry.milestoneId,
          predictedReachedTime: new Date(entry.predictedReachedTime),
          selectedOptionKey: dto.selectedOptionKey ?? null,
          submittedAt,
          editDeadline,
          auraEligible,
          lockedCheckpoint,
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
    const isGenericRoom = (room.category ?? room.templateKey) === 'open_prediction';
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
    // Legacy (v1): coarse all-or-nothing hide until the room-wide lock.
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

    // v2 (checkpoint_leaderboard_v2): per-viewer blur. A viewer sees peers' predicted
    // times only once their OWN prediction has locked (1-min review elapsed, or locked
    // at the room's end). Before that, peers show as "submitted" (existence only).
    const v2 = featureFlags.checkpointLeaderboardV2;
    const now = Date.now();
    const viewerLocked =
      v2 &&
      predictions.some(
        (p) =>
          p.userId === requestingUser.userId &&
          !p.revokedAt &&
          (p.lockedStatus || (p.editDeadline != null && now > p.editDeadline.getTime())),
      );

    return predictions.map((prediction) => {
      const isOwn = prediction.userId === requestingUser.userId;
      // v2: hide a peer's value until the viewer's own prediction locks; always show own.
      // v1: coarse hide until the room-wide lock.
      const hide = v2 ? !isOwn && !viewerLocked : hideValues;
      const hidePredictedTime = hide || prediction.revokedAt;
      const hideSelectedOption = !isGenericRoom && (hide || prediction.revokedAt);
      return {
      predictionId: prediction.predictionId,
      milestoneId: prediction.milestoneId,
      milestoneName: prediction.milestone.milestoneName,
      milestoneOrder: prediction.milestone.milestoneOrder,
      milestoneType: prediction.milestone.milestoneType,
      predictedReachedTime:
        // Fairness rule: before lock, peers should only know that a prediction exists.
        hidePredictedTime ? undefined : prediction.predictedReachedTime,
      selectedOptionKey:
        hideSelectedOption ? undefined : prediction.selectedOptionKey,
      submittedAt: prediction.submittedAt,
      editDeadline: prediction.editDeadline,
      revokedAt: prediction.revokedAt,
      auraEligible: prediction.auraEligible,
      lockedCheckpoint: prediction.lockedCheckpoint,
      status: prediction.revokedAt
        ? 'revoked'
        : hideSelectedOption
          ? 'submitted'
          : 'visible',
      isCurrentUser: prediction.userId === requestingUser.userId,
      differenceFromActualMinutes: prediction.differenceFromActualMinutes,
      differenceFromActualSeconds: prediction.differenceFromActualSeconds,
      rankForMilestone: prediction.rankForMilestone,
      totalAuraAwarded: prediction.totalAuraAwarded,
      cloutAwarded: prediction.cloutAwarded,
      user: safePublicUser(prediction.user),
      };
    });
  }

  async updatePrediction(predictionId: string, dto: any, user: User) {
    const prediction = await this.getEditablePrediction(predictionId, user);
    if (prediction.room.answerType === 'multiple_choice') {
      if (!dto.selectedOptionKey) {
        throw new BadRequestException('selectedOptionKey is required');
      }
      assertOptionInRoom(dto.selectedOptionKey, prediction.room.options);
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
    const isGenericRoom =
      (prediction.room.category ?? prediction.room.templateKey) === 'open_prediction';
    if (isGenericRoom) {
      const now = new Date();
      if (prediction.room.status !== 'predictions_open') {
        throw new ForbiddenException('Predictions are locked for this room');
      }
      if (now > prediction.room.predictionCloseTime) {
        throw new BadRequestException('Prediction edit window has closed');
      }
      return prediction;
    }
    // v2 (checkpoint_leaderboard_v2): re-predict is allowed through the 80% checkpoint
    // (the client surfaces it at 20/40/60/80); none after. A re-predict replaces the
    // prior guess. Governed by checkpoints, not the legacy predictionCloseTime/status.
    if (featureFlags.checkpointLeaderboardV2) {
      if (['completed', 'cancelled'].includes(prediction.room.status)) {
        throw new ForbiddenException('Predictions are locked for this room');
      }
      const maxCp = await maxReachedCheckpoint(this.prisma, prediction.roomId);
      if (maxCp >= 80) {
        throw new BadRequestException('Re-predict window has closed (80% checkpoint reached)');
      }
      return prediction;
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
