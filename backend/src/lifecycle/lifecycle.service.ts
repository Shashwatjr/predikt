import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EndRoomDto } from './dto/end-room.dto';
import { ReachMilestoneDto } from './dto/reach-milestone.dto';
import { StartRoomDto } from './dto/start-room.dto';
import { User } from '@prisma/client';
import { safePublicUser, SAFE_PUBLIC_USER_SELECT } from '../common/utils/safe-user-select';
import { findBannedBettingTerms } from '../common/utils/content-policy';
import { distanceMeters } from '../common/utils/geo';
import { usesExclusiveLocationResource } from '../rooms/rooms.service';
import { deriveRoomSubtype } from '../rooms/rooms.service';
import { POLICY_BLOCK_MESSAGE } from '../common/constants/policy.constants';
import { AuditService } from '../audit/audit.service';
import { CancelJourneyDto } from './dto/cancel-journey.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { BadgeService } from '../badges/badge.service';
import { featureFlags } from '../config/feature-flags';
import { computeOracleGuess } from '../common/utils/oracle-guess';

const TERMINAL_STATUSES = ['completed', 'cancelled'] as const;
const DEFAULT_START_DELAY_MINUTES = 3;
const AURA_BY_RANK: Record<number, number> = { 1: 100, 2: 70, 3: 40 };
const CLOUT_BY_RANK: Record<number, number> = { 1: 30, 2: 20, 3: 10 };
const CONFIDENCE_MULTIPLIER: Record<string, number> = {
  low: 0.75,
  medium: 1,
  high: 1.15,
  verified: 1.25,
};
const MULTIPLE_CHOICE_WIN_AURA = 100;
const MULTIPLE_CHOICE_PARTICIPATION_AURA = 5;
const MULTIPLE_CHOICE_WIN_CLOUT = 30;
const MULTIPLE_CHOICE_PARTICIPATION_CLOUT = 5;
const DEFAULT_EXPECTED_DURATION_SECONDS = 60 * 60;
const INACTIVITY_THRESHOLD_SECONDS = 20 * 60;
const START_VISIBILITY_DELAY_MS = 2 * 60 * 1000;
const START_VERIFY_DISTANCE_METERS = 2000;
const ARRIVAL_CONFIRM_DISTANCE_METERS = 2000;
const CHECKPOINT_MILESTONES = [50, 80] as const;
const RELIABILITY_POINTS: Record<string, number> = {
  journey_completed_verified: 2,
  cancelled_before_lock: 0,
  cancelled_after_lock: -2,
  auto_closed_no_confirmation: -4,
  no_show_abandoned: -6,
  repeated_abandonment_penalty: -10,
  dispute_accepted_restore: 4,
};

type OpenPredictionResultCopy = {
  badgeTitle: string;
  scoringCopy: string;
  resultState: string;
  shareText: string;
};

@Injectable()
export class LifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly badgeService: BadgeService,
  ) {}

  async lockPredictions(roomId: string, user: User) {
    const room = await this.getCreatorRoom(roomId, user);
    this.guardTerminal(room.status);

    if (room.status !== 'predictions_open') {
      throw new BadRequestException('Room must be in predictions_open status to lock');
    }

    await this.prisma.$transaction([
      this.prisma.milestonePrediction.updateMany({
        where: { roomId },
        data: { lockedStatus: true },
      }),
      this.prisma.roomMilestone.updateMany({
        where: { roomId, status: { in: ['prediction_open', 'pending'] } },
        data: { status: 'prediction_locked' },
      }),
      this.prisma.predictionRoom.update({
        where: { roomId },
        data: { status: 'predictions_locked' },
      }),
    ]);

    await this.notificationsService.notifyRoomMembers({
      roomId,
      type: 'predictions_locked',
      title: 'Predictions locked',
      body: 'Predictions are locked. Hidden guesses will be revealed when results are ready.',
      severity: 'info',
      actionLabel: 'View live',
      actionTarget: `room:${roomId}:live`,
      metadata: { roomStatus: 'predictions_locked' },
      idempotencyKey: `predictions_locked:${roomId}`,
    });

    return this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { milestones: { orderBy: { milestoneOrder: 'asc' } } },
    });
  }

  async start(roomId: string, user: User, dto: StartRoomDto = {}) {
    const room = await this.getCreatorRoom(roomId, user);
    this.guardTerminal(room.status);

    if (!['predictions_open', 'predictions_locked', 'created'].includes(room.status)) {
      throw new BadRequestException('Room must be ready for live start');
    }

    if (room.status === 'predictions_open') {
      if (featureFlags.checkpointLeaderboardV2) {
        // v2 (checkpoint_leaderboard_v2): journey start does NOT lock everyone.
        // Lock only the creator's own guess; other members keep predicting via the
        // late-join window (open until 10 min before the projected arrival).
        await this.prisma.milestonePrediction.updateMany({
          where: { roomId, userId: user.userId },
          data: { lockedStatus: true },
        });
      } else {
        await this.lockPredictions(roomId, user);
      }
    }

    // Non-GPS rooms have no live location to protect or coordinate, so they may
    // start immediately (no default delay) and become visible at once.
    const isLocationTracked = usesExclusiveLocationResource(room.roomCategory);
    if (featureFlags.checkpointLeaderboardV2 && isLocationTracked) {
      if (dto.location?.lat == null || dto.location?.lng == null) {
        throw new BadRequestException('Creator GPS is required to start this journey');
      }
      const startVerification = this.buildStartVerification(room, dto.location.lat, dto.location.lng);
      if (startVerification.shouldBlock) {
        throw new BadRequestException(
          `Start verification failed. Move closer to ${room.startingPointLabel} before starting the journey.`,
        );
      }
    }
    const startDelayMinutes =
      dto.startDelayMinutes ?? (isLocationTracked ? DEFAULT_START_DELAY_MINUTES : 0);
    const scheduledStartTime = new Date(Date.now() + startDelayMinutes * 60 * 1000);
    const expectedDurationSeconds =
      room.expectedDurationSeconds ??
      room.journeyRoute?.estimatedDurationSeconds ??
      DEFAULT_EXPECTED_DURATION_SECONDS;
    const gracePeriodSeconds = this.resolveGracePeriodSeconds(expectedDurationSeconds, room.gracePeriodSeconds);
    const autoCloseAt = new Date(
      scheduledStartTime.getTime() + (expectedDurationSeconds + gracePeriodSeconds) * 1000,
    );

    const visibleMovementStartTime = isLocationTracked
      ? new Date(scheduledStartTime.getTime() + START_VISIBILITY_DELAY_MS)
      : scheduledStartTime;

    const updated = await this.prisma.predictionRoom.update({
      where: { roomId },
      data: {
        status: 'live',
        journeyStatus: 'started',
        plannedStartTime: scheduledStartTime,
        startTime: scheduledStartTime,
        visibleMovementStartTime,
        journeyStartedAt: scheduledStartTime,
        journeyScheduledStartAt: room.journeyScheduledStartAt ?? scheduledStartTime,
        expectedDurationSeconds,
        gracePeriodSeconds,
        autoCloseAt,
        noStartCutoffAt:
          room.noStartCutoffAt ??
          new Date(
            scheduledStartTime.getTime() + Math.min(30 * 60 * 1000, Math.max(15 * 60 * 1000, Math.round(gracePeriodSeconds / 2) * 1000)),
          ),
      },
      include: { journeyRoute: true },
    });

    if (dto.location?.lat != null && dto.location?.lng != null && !featureFlags.checkpointLeaderboardV2) {
      await this.recordCheckpoint(roomId, user.userId, 0, dto.location.lat, dto.location.lng, scheduledStartTime);
    }

    await this.auditService.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'journey_started',
      targetType: 'room',
      targetId: roomId,
      afterValue: {
        autoCloseAt: updated.autoCloseAt,
        expectedDurationSeconds,
        startVerified:
          featureFlags.checkpointLeaderboardV2 && dto.location?.lat != null && dto.location?.lng != null,
      },
    });

    await this.notificationsService.notifyRoomMembers({
      roomId,
      type: 'journey_started',
      title: 'Journey started',
      body: 'The room is live. Follow progress from the live screen.',
      severity: 'info',
      actionLabel: 'View live',
      actionTarget: `room:${roomId}:live`,
      metadata: { journeyStatus: updated.journeyStatus, deliverAfter: visibleMovementStartTime.toISOString() },
      idempotencyKey: `journey_started:${roomId}`,
    });

    return updated;
  }

  async reachMilestone(
    roomId: string,
    milestoneId: string,
    dto: ReachMilestoneDto,
    user: User,
  ) {
    const room = await this.getCreatorRoom(roomId, user);
    if (room.status !== 'live') {
      throw new BadRequestException('Room must be live to mark a milestone reached');
    }

    const milestone = await this.prisma.roomMilestone.findFirst({
      where: { roomId, milestoneId },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.status === 'reached') {
      throw new BadRequestException('Milestone already reached');
    }

    const actualReachedTime = dto.actualReachedTime
      ? new Date(dto.actualReachedTime)
      : new Date();

    await this.prisma.roomMilestone.update({
      where: { milestoneId },
      data: { actualReachedTime, status: 'reached' },
    });

    const leaderboard = await this.scoreMilestone(roomId, milestoneId, actualReachedTime);
    return {
      roomId,
      milestoneId,
      actualReachedTime,
      leaderboard,
    };
  }

  async end(roomId: string, dto: EndRoomDto, user: User) {
    const room = await this.getCreatorRoom(roomId, user);
    this.guardTerminal(room.status);
    const blocked = findBannedBettingTerms(dto.resultText);
    if (blocked.length) {
      throw new BadRequestException({
        message: POLICY_BLOCK_MESSAGE,
        blockedTerms: blocked.map((term) => ({ field: 'resultText', term })),
      });
    }

    if (!['live', 'predictions_locked', 'predictions_open'].includes(room.status)) {
      throw new BadRequestException('Room must be in progress to end');
    }

    if (room.answerType === 'multiple_choice') {
      return this.endMultipleChoiceRoom(roomId, dto, user);
    }

    if (room.status !== 'live') {
      await this.start(roomId, user);
    }

    const actualEndTime = dto.actualEndTime ? new Date(dto.actualEndTime) : new Date();

    const finalMilestone = await this.prisma.roomMilestone.findFirst({
      where: { roomId, milestoneType: 'final_destination' },
      orderBy: { milestoneOrder: 'desc' },
    });

    if (finalMilestone && finalMilestone.status !== 'reached') {
      await this.reachMilestone(
        roomId,
        finalMilestone.milestoneId,
        { actualReachedTime: actualEndTime.toISOString() },
        user,
      );
    }

    await this.prisma.predictionRoom.update({
      where: { roomId },
      data: {
        status: 'completed',
        journeyStatus: 'completed',
        arrivalConfirmedAt: actualEndTime,
        actualEndTime,
        outcomeSource: dto.outcomeSource ?? 'host_declared',
        confidenceLevel: dto.confidenceLevel ?? 'medium',
      },
    });

    return this.finalizeRoom(roomId, user.userId);
  }

  private async endMultipleChoiceRoom(roomId: string, dto: EndRoomDto, user: User) {
    if (!dto.actualOptionKey) {
      throw new BadRequestException('actualOptionKey is required for multiple-choice rooms');
    }

    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      select: { options: true },
    });
    const allowedOptions = Array.isArray(room?.options) ? (room.options as string[]) : [];
    if (allowedOptions.length > 0 && !allowedOptions.includes(dto.actualOptionKey)) {
      throw new BadRequestException('actualOptionKey must match one of the room options');
    }

    const finalMilestone = await this.prisma.roomMilestone.findFirst({
      where: { roomId, milestoneType: 'final_destination' },
      orderBy: { milestoneOrder: 'desc' },
    });
    if (!finalMilestone) throw new NotFoundException('Final milestone not found');

    if (finalMilestone.status !== 'reached') {
      await this.prisma.roomMilestone.update({
        where: { milestoneId: finalMilestone.milestoneId },
        data: {
          actualOptionKey: dto.actualOptionKey,
          actualReachedTime: dto.actualEndTime ? new Date(dto.actualEndTime) : new Date(),
          status: 'reached',
        },
      });
    }

    await this.scoreMultipleChoiceMilestone(
      roomId,
      finalMilestone.milestoneId,
      dto.actualOptionKey,
    );

    const actualEndTime = dto.actualEndTime ? new Date(dto.actualEndTime) : new Date();
    await this.prisma.predictionRoom.update({
      where: { roomId },
      data: {
        status: 'completed',
        journeyStatus: 'completed',
        actualEndTime,
        outcomeSource: dto.outcomeSource ?? 'host_declared',
        confidenceLevel: dto.confidenceLevel ?? 'medium',
      },
    });

    await this.auditService.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'result_declared',
      targetType: 'room',
      targetId: roomId,
      afterValue: {
        answerType: 'multiple_choice',
        actualOptionKey: dto.actualOptionKey,
        outcomeSource: dto.outcomeSource ?? 'host_declared',
      },
    });

    return this.finalizeRoom(roomId, user.userId);
  }

  async confirmArrival(roomId: string, user: User) {
    const room = await this.getCreatorRoom(roomId, user);
    this.guardTerminal(room.status);
    return this.confirmArrivalWithContext(room, user, {});
  }

  async previewArrivalConfirmation(roomId: string, user: User, dto: EndRoomDto) {
    const room = await this.getCreatorRoom(roomId, user);
    this.guardTerminal(room.status);

    const actualEndTime = new Date();
    if (dto.location?.lat != null && dto.location?.lng != null) {
      await this.recordCheckpoint(roomId, user.userId, 100, dto.location.lat, dto.location.lng, actualEndTime);
    }

    const verification = this.buildArrivalVerification(room, dto.location?.lat, dto.location?.lng);
    if (verification.shouldPrompt && !dto.confirmAnyway) {
      return {
        requiresConfirmation: true,
        prompt: `Looks like you're not quite at ${room.destinationLabel} yet — mark as arrived anyway?`,
        distanceMeters: verification.distanceMeters,
      };
    }

    return this.confirmArrivalWithContext(room, user, dto);
  }

  private async confirmArrivalWithContext(room: any, user: User, dto: EndRoomDto) {
    const actualEndTime = new Date();
    if (dto.location?.lat != null && dto.location?.lng != null) {
      await this.recordCheckpoint(room.roomId, user.userId, 100, dto.location.lat, dto.location.lng, actualEndTime);
    }

    if (featureFlags.checkpointLeaderboardV2) {
      const verification = this.buildArrivalVerification(room, dto.location?.lat, dto.location?.lng);
      if (verification.shouldPrompt && !dto.confirmAnyway) {
        return {
          requiresConfirmation: true,
          prompt: `Looks like you're not quite at ${room.destinationLabel} yet — mark as arrived anyway?`,
          distanceMeters: verification.distanceMeters,
        };
      }
    }

    await this.prisma.predictionRoom.update({
      where: { roomId: room.roomId },
      data: {
        journeyStatus: 'arrived_verified',
        arrivalConfirmedAt: actualEndTime,
        actualEndTime,
        outcomeSource: 'arrival_confirmed',
        confidenceLevel: 'verified',
      },
    });

    await this.adjustReliability(user.userId, room.roomId, 'journey_completed_verified', 'Journey completed with arrival confirmation');
    await this.auditService.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'journey_arrival_confirmed',
      targetType: 'room',
      targetId: room.roomId,
    });

    await this.notificationsService.notifyRoomMembers({
      roomId: room.roomId,
      type: 'arrival_confirmed',
      title: 'Arrival confirmed',
      body: 'Arrival was verified. Results are being prepared.',
      severity: 'success',
      actionLabel: 'View room',
      actionTarget: `room:${room.roomId}:live`,
      metadata: { journeyStatus: 'arrived_verified' },
      idempotencyKey: `arrival_confirmed:${room.roomId}`,
    });

    return this.end(
      room.roomId,
      {
        actualEndTime: actualEndTime.toISOString(),
        outcomeSource: 'arrival_confirmed',
        confidenceLevel: 'verified',
        location: dto.location,
        confirmAnyway: dto.confirmAnyway,
      },
      user,
    );
  }

  private async recordCheckpoint(
    roomId: string,
    creatorUserId: string,
    checkpoint: number,
    lat: number,
    lng: number,
    capturedAt: Date,
  ) {
    await this.prisma.roomCheckpoint.upsert({
      where: { roomId_checkpoint: { roomId, checkpoint } },
      update: { lat, lng, capturedAt },
      create: { roomId, checkpoint, lat, lng, capturedAt },
    });

    await this.prisma.liveLocationEvent.create({
      data: {
        roomId,
        creatorUserId,
        rawLat: checkpoint === 100 ? lat : undefined,
        rawLng: checkpoint === 100 ? lng : undefined,
        progressPercentage: checkpoint,
        locationDisplayMode: 'progress',
        createdAt: capturedAt,
      },
    });
  }

  private buildStartVerification(room: any, lat?: number, lng?: number) {
    const expectedLat = room.startingLat ?? room.journeyRoute?.startLat ?? null;
    const expectedLng = room.startingLng ?? room.journeyRoute?.startLng ?? null;
    if (lat == null || lng == null || expectedLat == null || expectedLng == null) {
      return { shouldBlock: false, distanceMeters: null };
    }

    const distance = distanceMeters(lat, lng, expectedLat, expectedLng);
    return {
      shouldBlock: distance > START_VERIFY_DISTANCE_METERS,
      distanceMeters: distance,
    };
  }

  private buildArrivalVerification(room: any, lat?: number, lng?: number) {
    if (
      lat == null ||
      lng == null ||
      room.destinationLat == null ||
      room.destinationLng == null
    ) {
      return { shouldPrompt: false, distanceMeters: null };
    }

    const distance = distanceMeters(lat, lng, room.destinationLat, room.destinationLng);
    return {
      shouldPrompt: distance > ARRIVAL_CONFIRM_DISTANCE_METERS,
      distanceMeters: distance,
    };
  }

  async cancelJourney(roomId: string, user: User, dto: CancelJourneyDto) {
    const room = await this.getCreatorRoom(roomId, user);
    this.guardTerminal(room.status);
    const now = new Date();
    const afterLock = now > room.predictionCloseTime || room.status !== 'predictions_open';
    const journeyStatus = dto.reasonCode === 'plan_changed' ? 'plan_changed' : 'cancelled_by_host';

    await this.prisma.$transaction(async (tx) => {
      await tx.roomMilestone.updateMany({
        where: { roomId, status: { not: 'reached' } },
        data: { status: 'cancelled' },
      });
      await tx.predictionRoom.update({
        where: { roomId },
        data: {
          status: 'cancelled',
          journeyStatus,
          cancelledAt: now,
          closureReasonCode: dto.reasonCode,
          closureNote: dto.note ?? null,
        },
      });
    });

    if (afterLock && dto.reasonCode !== 'emergency') {
      await this.adjustReliability(user.userId, roomId, 'cancelled_after_lock', 'Journey cancelled after lock');
    } else {
      await this.adjustReliability(user.userId, roomId, 'cancelled_before_lock', 'Journey cancelled before lock');
    }

    await this.compensateParticipants(roomId, afterLock ? 'Journey closed fairly after lock.' : 'Journey closed fairly before lock.');
    await this.auditService.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'journey_cancelled',
      targetType: 'room',
      targetId: roomId,
      reason: dto.reasonCode,
      afterValue: { afterLock },
    });

    await this.notificationsService.notifyRoomMembers({
      roomId,
      type: 'journey_cancelled',
      title: 'Plan changed',
      body: 'This Prediktion was closed fairly after a plan change. Your prediction was not counted as a loss.',
      severity: 'warning',
      actionLabel: 'View result',
      actionTarget: `room:${roomId}:result`,
      metadata: { reasonCode: dto.reasonCode, afterLock },
      idempotencyKey: `journey_cancelled:${roomId}`,
    });

    return this.buildNeutralClosureResponse(roomId);
  }

  async cancel(roomId: string, user: User) {
    return this.cancelJourney(roomId, user, { reasonCode: 'other' });
  }

  async evaluateRoomLifecycle(
    roomId: string,
    actor: { actorType: 'admin' | 'system'; actorId: string | null },
  ) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { journeyRoute: true, milestonePredictions: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (['completed', 'cancelled'].includes(room.status) && !['auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'].includes(room.journeyStatus)) {
      return room;
    }

    const now = new Date();
    const noStartCutoffAt = room.noStartCutoffAt;
    const autoCloseAt = room.autoCloseAt;
    const inactivityCutoff = new Date(now.getTime() - INACTIVITY_THRESHOLD_SECONDS * 1000);

    if (
      ['scheduled', 'open', 'locked'].includes(room.journeyStatus) &&
      noStartCutoffAt &&
      now > noStartCutoffAt &&
      !room.journeyStartedAt
    ) {
      await this.applyNeutralClosure(room, 'abandoned', 'no_show_abandoned', 'No-Show: journey never started', actor);
      return this.prisma.predictionRoom.findUnique({ where: { roomId } });
    }

    if (
      ['started', 'live', 'inactive', 'overdue'].includes(room.journeyStatus) &&
      room.lastTravellerUpdateAt &&
      room.lastTravellerUpdateAt < inactivityCutoff &&
      room.journeyStatus === 'live'
    ) {
      await this.prisma.predictionRoom.update({
        where: { roomId },
        data: { journeyStatus: 'inactive' },
      });
    }

    if (
      ['started', 'live', 'inactive', 'overdue'].includes(room.journeyStatus) &&
      autoCloseAt &&
      now > autoCloseAt &&
      !room.arrivalConfirmedAt
    ) {
      await this.applyNeutralClosure(room, 'auto_closed', 'auto_closed_no_confirmation', 'Journey auto-closed: no verified arrival', actor);
      return this.prisma.predictionRoom.findUnique({ where: { roomId } });
    }

    if (
      ['started', 'live', 'inactive'].includes(room.journeyStatus) &&
      autoCloseAt &&
      now.getTime() > autoCloseAt.getTime() - 10 * 60 * 1000 &&
      now <= autoCloseAt
    ) {
      await this.prisma.predictionRoom.update({
        where: { roomId },
        data: { journeyStatus: 'overdue' },
      });
      await this.notificationsService.notifyRoomMembers({
        roomId,
        type: 'journey_overdue',
        title: 'Journey overdue',
        body: 'Arrival has not been verified yet. The room may close neutrally if there is no update.',
        severity: 'warning',
        actionLabel: 'View live',
        actionTarget: `room:${roomId}:live`,
        metadata: { journeyStatus: 'overdue' },
        idempotencyKey: `journey_overdue:${roomId}`,
      });
      await this.notificationsService.create({
        userId: room.creatorUserId,
        roomId,
        type: 'journey_auto_closing_soon',
        title: 'Auto-close check',
        body: 'Confirm arrival soon if the journey is complete.',
        severity: 'action_required',
        actionLabel: 'Confirm arrival',
        actionTarget: `room:${roomId}:live`,
        metadata: { journeyStatus: 'overdue' },
        idempotencyKey: `journey_auto_closing_soon:${roomId}`,
      });
    }

    return this.prisma.predictionRoom.findUnique({ where: { roomId } });
  }

  private async scoreMilestone(
    roomId: string,
    milestoneId: string,
    actualReachedTime: Date,
  ) {
    const milestone = await this.prisma.roomMilestone.findUnique({
      where: { milestoneId },
      include: { room: { include: { checkpoints: true } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const allPredictions = await this.prisma.milestonePrediction.findMany({
      where: { roomId, milestoneId, revokedAt: null },
      include: { user: true },
      orderBy: { submittedAt: 'asc' },
    });

    // v2 (checkpoint_leaderboard_v2): only Aura-eligible guesses that are NOT the
    // creator's own compete for rank/winner/Aura. Rizz-tier (locked after 80%) and the
    // creator's own guess are still recorded + shown, but earn nothing and can't win.
    const v2 = featureFlags.checkpointLeaderboardV2;
    const creatorId = milestone.room.creatorUserId;
    const isEligible = (p: (typeof allPredictions)[number]) =>
      p.auraEligible !== false && p.userId !== creatorId;
    const predictions = v2 ? allPredictions.filter(isEligible) : allPredictions;
    const ineligiblePredictions = v2 ? allPredictions.filter((p) => !isEligible(p)) : [];

    // v2: Oracle competes on the final destination as a non-human, non-creator, winner-
    // eligible entry. Its guess is READ from frozen checkpoints (computeOracleGuess never
    // calls the maps provider) — scored here against actual, never the live ETA.
    const oracleGuess =
      v2 && milestone.milestoneType === 'final_destination'
        ? computeOracleGuess(milestone.room, milestone.room.checkpoints)
        : null;
    const ORACLE_ID = '__oracle__';

    // When Oracle is present, humans who beat it earn the existing beat-AI bonus/flex.
    const aiBenchmarkTime = oracleGuess?.arrivalTime ?? milestone.room.aiPredictedTime;
    const aiDifferenceMinutes = aiBenchmarkTime
      ? Math.abs((aiBenchmarkTime.getTime() - actualReachedTime.getTime()) / 60000)
      : null;

    const withDiff = (predictedReachedTime: Date, submittedAt: Date, isOracle: boolean, prediction?: (typeof predictions)[number]) => ({
      isOracle,
      prediction,
      submittedAt,
      predictedReachedTime,
      differenceFromActualSeconds: Math.abs(
        Math.round((predictedReachedTime.getTime() - actualReachedTime.getTime()) / 1000),
      ),
    });

    const ranked = [
      ...predictions.map((p) => withDiff(p.predictedReachedTime, p.submittedAt, false, p)),
      // Oracle's tie-break submittedAt is its freeze moment (during the journey), so on an
      // exact tie a human (who committed before start) ranks ahead of the bot.
      ...(oracleGuess ? [withDiff(oracleGuess.arrivalTime, actualReachedTime, true)] : []),
    ].sort((a, b) => {
      if (a.differenceFromActualSeconds !== b.differenceFromActualSeconds) {
        return a.differenceFromActualSeconds - b.differenceFromActualSeconds;
      }
      // Tie-breaker: earlier submissions win when two predictions are equally close.
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    });

    const leaderboard = [];

    for (const [index, entry] of ranked.entries()) {
      const rank = index + 1;
      const differenceFromActualMinutes = entry.differenceFromActualSeconds / 60;

      // Oracle branch: persist its scored outcome for surfacing; award nothing, write no user rows.
      if (entry.isOracle) {
        await this.prisma.predictionRoom.update({
          where: { roomId },
          data: {
            oracleResult: {
              arrivalTime: entry.predictedReachedTime.toISOString(),
              diffSeconds: entry.differenceFromActualSeconds,
              diffMinutes: differenceFromActualMinutes,
              rank,
              beatenByHuman: rank > 1,
              frozenAtCheckpoint: oracleGuess!.frozenAtCheckpoint,
            },
          },
        });
        leaderboard.push({
          isOracle: true,
          userId: ORACLE_ID,
          name: 'Oracle',
          predictedReachedTime: entry.predictedReachedTime,
          differenceFromActualMinutes,
          differenceFromActualSeconds: entry.differenceFromActualSeconds,
          rankForMilestone: rank,
          totalAuraAwarded: 0,
          cloutAwarded: 0,
        });
        continue;
      }

      const prediction = entry.prediction!;
      const tier = this.scoreTier(entry.differenceFromActualSeconds);
      const baseAura =
        entry.differenceFromActualSeconds > 5 * 60
          ? 5
          : AURA_BY_RANK[rank] ?? 10;
      const dotBonusAura = tier.bonusAura;
      const beatAiBonus =
        aiDifferenceMinutes !== null && differenceFromActualMinutes < aiDifferenceMinutes
          ? 25
          : 0;
      const confidenceMultiplier = CONFIDENCE_MULTIPLIER[milestone.room.confidenceLevel ?? 'medium'] ?? 1;
      const totalAuraAwarded = Math.round(
        (baseAura + dotBonusAura + beatAiBonus) *
          Number(milestone.auraMultiplier) *
          confidenceMultiplier,
      );
      const cloutAwarded = (CLOUT_BY_RANK[rank] ?? 5) + (tier.name === 'exact_second' ? 10 : 0);

      await this.prisma.$transaction(async (tx) => {
        // Result integrity: write score evidence before balances so post-room audit trails
        // can explain how each user's Aura and Clout were derived.
        await tx.milestonePrediction.update({
          where: { predictionId: prediction.predictionId },
          data: {
            differenceFromActualMinutes,
            differenceFromActualSeconds: entry.differenceFromActualSeconds,
            rankForMilestone: rank,
            baseAura,
            rankBonusAura: dotBonusAura + beatAiBonus,
            totalAuraAwarded,
            cloutAwarded,
            lockedStatus: true,
          },
        });

        await tx.auraTransaction.create({
          data: {
            userId: prediction.userId,
            roomId,
            milestoneId,
            amount: totalAuraAwarded,
            reason: `Aura from milestone ${milestone.milestoneName}`,
          },
        });

        await tx.cloutTransaction.create({
          data: {
            userId: prediction.userId,
            roomId,
            milestoneId,
            amount: cloutAwarded,
            transactionType: 'earn',
            reason: `Clout from milestone ${milestone.milestoneName}`,
          },
        });

        const existingResult = await tx.roomResult.findUnique({
          where: { roomId_userId: { roomId, userId: prediction.userId } },
        });

        if (existingResult) {
          await tx.roomResult.update({
            where: { roomId_userId: { roomId, userId: prediction.userId } },
            data: {
              totalRoomAura: { increment: totalAuraAwarded },
              totalRoomClout: { increment: cloutAwarded },
              milestonesWon: rank === 1 ? { increment: 1 } : undefined,
            },
          });
        } else {
          await tx.roomResult.create({
            data: {
              roomId,
              userId: prediction.userId,
              totalRoomAura: totalAuraAwarded,
              totalRoomClout: cloutAwarded,
              milestonesWon: rank === 1 ? 1 : 0,
            },
          });
        }

        await tx.user.update({
          where: { userId: prediction.userId },
          data: {
            totalAura: { increment: totalAuraAwarded },
            weeklyAura: { increment: totalAuraAwarded },
            cloutBalance: { increment: cloutAwarded },
            lifetimeCloutEarned: { increment: cloutAwarded },
          },
        });

        if (tier.flexType) {
          await this.ensureFlex(tx, prediction.userId, tier.flexType, roomId, milestoneId);
        }
        if (rank === 1) {
          await this.ensureDropAwards(tx, roomId, prediction.userId, 'milestone_winner');
        }
        if (beatAiBonus > 0) {
          await this.ensureFlex(tx, prediction.userId, 'beat_ai', roomId, milestoneId);
          await this.ensureDropAwards(tx, roomId, prediction.userId, 'beat_ai');
        }
      });

      leaderboard.push({
        predictionId: prediction.predictionId,
        userId: prediction.userId,
        user: safePublicUser(prediction.user),
        name: prediction.user.prediktHandle ? `@${prediction.user.prediktHandle}` : prediction.user.name,
        predictedReachedTime: prediction.predictedReachedTime,
        differenceFromActualMinutes,
        differenceFromActualSeconds: entry.differenceFromActualSeconds,
        scoreTier: tier.name,
        dotBonus: tier.flexType,
        rankForMilestone: rank,
        totalAuraAwarded,
        cloutAwarded,
      });
    }

    // v2: persist accuracy for Rizz-tier + creator guesses so results can show and tag
    // them, but award no Aura/Clout and leave them out of the ranked leaderboard.
    for (const prediction of ineligiblePredictions) {
      const diffSeconds = Math.abs(
        Math.round((prediction.predictedReachedTime.getTime() - actualReachedTime.getTime()) / 1000),
      );
      await this.prisma.milestonePrediction.update({
        where: { predictionId: prediction.predictionId },
        data: {
          differenceFromActualSeconds: diffSeconds,
          differenceFromActualMinutes: diffSeconds / 60,
          rankForMilestone: null,
          totalAuraAwarded: 0,
          cloutAwarded: 0,
          lockedStatus: true,
        },
      });
    }

    return leaderboard;
  }

  private async scoreMultipleChoiceMilestone(
    roomId: string,
    milestoneId: string,
    actualOptionKey: string,
  ) {
    const predictions = await this.prisma.milestonePrediction.findMany({
      where: { roomId, milestoneId, revokedAt: null },
      include: { user: true },
      orderBy: { submittedAt: 'asc' },
    });

    const leaderboard = [];
    for (const prediction of predictions) {
      const isWinner = prediction.selectedOptionKey === actualOptionKey;
      const rank = isWinner ? 1 : 2;
      const totalAuraAwarded = isWinner
        ? MULTIPLE_CHOICE_WIN_AURA
        : MULTIPLE_CHOICE_PARTICIPATION_AURA;
      const cloutAwarded = isWinner
        ? MULTIPLE_CHOICE_WIN_CLOUT
        : MULTIPLE_CHOICE_PARTICIPATION_CLOUT;

      await this.prisma.$transaction(async (tx) => {
        await tx.milestonePrediction.update({
          where: { predictionId: prediction.predictionId },
          data: {
            differenceFromActualMinutes: isWinner ? 0 : null,
            differenceFromActualSeconds: isWinner ? 0 : null,
            rankForMilestone: rank,
            baseAura: totalAuraAwarded,
            rankBonusAura: 0,
            totalAuraAwarded,
            cloutAwarded,
            lockedStatus: true,
          },
        });

        await tx.auraTransaction.create({
          data: {
            userId: prediction.userId,
            roomId,
            milestoneId,
            amount: totalAuraAwarded,
            reason: isWinner
              ? 'Aura from matching the declared outcome'
              : 'Aura for participating in the room',
          },
        });

        await tx.cloutTransaction.create({
          data: {
            userId: prediction.userId,
            roomId,
            milestoneId,
            amount: cloutAwarded,
            transactionType: 'earn',
            reason: isWinner
              ? 'Clout from matching the declared outcome'
              : 'Clout for room participation',
          },
        });

        await tx.roomResult.upsert({
          where: { roomId_userId: { roomId, userId: prediction.userId } },
          create: {
            roomId,
            userId: prediction.userId,
            totalRoomAura: totalAuraAwarded,
            totalRoomClout: cloutAwarded,
            milestonesWon: isWinner ? 1 : 0,
            overallRank: rank,
          },
          update: {
            totalRoomAura: { increment: totalAuraAwarded },
            totalRoomClout: { increment: cloutAwarded },
            milestonesWon: isWinner ? { increment: 1 } : undefined,
            overallRank: rank,
          },
        });

        await tx.user.update({
          where: { userId: prediction.userId },
          data: {
            totalAura: { increment: totalAuraAwarded },
            weeklyAura: { increment: totalAuraAwarded },
            cloutBalance: { increment: cloutAwarded },
            lifetimeCloutEarned: { increment: cloutAwarded },
            winsCount: isWinner ? { increment: 1 } : undefined,
          },
        });

        if (isWinner) {
          await this.ensureDropAwards(tx, roomId, prediction.userId, 'milestone_winner');
        }
      });

      leaderboard.push({
        predictionId: prediction.predictionId,
        userId: prediction.userId,
        user: safePublicUser(prediction.user),
        name: prediction.user.prediktHandle ? `@${prediction.user.prediktHandle}` : prediction.user.name,
        selectedOptionKey: prediction.selectedOptionKey,
        actualOptionKey,
        rankForMilestone: rank,
        totalAuraAwarded,
        cloutAwarded,
      });
    }

    return leaderboard;
  }

  private async finalizeRoom(roomId: string, creatorUserId: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { milestones: { orderBy: { milestoneOrder: 'asc' } } },
    });
    const results = await this.prisma.roomResult.findMany({
      where: { roomId },
      include: { user: true },
      orderBy: [{ totalRoomAura: 'desc' }, { milestonesWon: 'desc' }],
    });

    let previousAura: number | null = null;
    let previousRank = 0;
    for (const [index, result] of results.entries()) {
      const rank =
        previousAura !== null && result.totalRoomAura === previousAura
          ? previousRank
          : index + 1;
      previousAura = result.totalRoomAura;
      previousRank = rank;
      await this.prisma.roomResult.update({
        where: { roomResultId: result.roomResultId },
        data: { overallRank: rank },
      });

      await this.prisma.cloutTransaction.create({
        data: {
          userId: result.userId,
          roomId,
          amount: 10,
          transactionType: 'earn',
          reason: 'Stayed active until room results',
        },
      });

      await this.prisma.user.update({
        where: { userId: result.userId },
        data: {
          cloutBalance: { increment: 10 },
          lifetimeCloutEarned: { increment: 10 },
        },
      });
    }

    const winner = results[0];
    if (winner && room?.answerType !== 'multiple_choice') {
      await this.prisma.$transaction(async (tx) => {
        await tx.cloutTransaction.create({
          data: {
            userId: winner.userId,
            roomId,
            amount: 150,
            transactionType: 'earn',
            reason: 'Overall room winner bonus',
          },
        });
        await tx.user.update({
          where: { userId: winner.userId },
          data: {
            cloutBalance: { increment: 150 },
            lifetimeCloutEarned: { increment: 150 },
            winsCount: { increment: 1 },
          },
        });
        await this.ensureFlex(tx, winner.userId, 'room_champion', roomId);
        await this.ensureDropAwards(tx, roomId, winner.userId, 'overall_winner');
      });
    }

    await this.awardMilestoneMasterFlex(roomId);
    await this.awardResultDeclaredCredits(roomId, creatorUserId);
    await this.notificationsService.notifyRoomMembers({
      roomId,
      type: 'result_ready',
      title: 'Result ready',
      body: this.buildResultReadyBody(room ?? null),
      severity: 'success',
      actionLabel: 'View result',
      actionTarget: `room:${roomId}:result`,
      metadata: { resultsCount: results.length },
      idempotencyKey: `result_ready:${roomId}`,
    });

    const finalMilestone = room?.milestones.find((milestone) => milestone.milestoneType === 'final_destination');
    const category = room?.category ?? room?.templateKey ?? room?.roomCategory ?? 'arrival_time';
    const subtype = deriveRoomSubtype(room ?? {});
    const momentCard = this.buildMomentCardCopy(category, subtype);
    const isNeutralClosure = ['auto_closed', 'abandoned', 'plan_changed', 'cancelled'].includes(room?.journeyStatus ?? '');

    let awardedBadges: Array<{ userId: string; badgeKey: string; title: string }> = [];
    if (winner && !isNeutralClosure) {
      const winnerPrediction = await this.prisma.milestonePrediction.findFirst({
        where: {
          roomId,
          userId: winner.userId,
          milestoneId: finalMilestone?.milestoneId,
        },
      });
      awardedBadges = await this.badgeService.awardRoomBadges({
        roomId,
        category,
        winnerUserId: winner.userId,
        userBeatBot: this.didWinnerBeatBot(winnerPrediction, finalMilestone, room?.oracleBotPrediction, room?.answerType),
        dotBonusAwarded: (winnerPrediction?.rankBonusAura ?? 0) > 0 || winnerPrediction?.differenceFromActualSeconds === 0,
        diffSeconds: winnerPrediction?.differenceFromActualSeconds ?? null,
        participantCount: await this.prisma.roomMembership.count({ where: { roomId, status: 'joined' } }),
        isNeutralClosure,
      });
    }

    const primaryBadge = awardedBadges[0]?.title ?? momentCard.titles[0];
    const genericPredictionEntries =
      room?.answerType === 'multiple_choice'
        ? await this.prisma.milestonePrediction.findMany({
            where: {
              roomId,
              milestoneId: finalMilestone?.milestoneId,
              revokedAt: null,
            },
            include: { user: { select: SAFE_PUBLIC_USER_SELECT } },
            orderBy: { submittedAt: 'asc' },
          })
        : [];
    const roomOptions =
      Array.isArray(room?.options) && room.options.length
        ? room.options.map((option) => String(option))
        : Array.isArray((room?.scoringRule as Record<string, unknown> | null)?.options)
          ? ((room?.scoringRule as Record<string, unknown>).options as unknown[]).map((option) =>
              String(option),
            )
          : Array.isArray(
                ((room?.scoringRule as Record<string, unknown> | null)?.creationMeta as
                  | Record<string, unknown>
                  | undefined)?.options,
              )
            ? ((((room?.scoringRule as Record<string, unknown> | null)?.creationMeta as
                | Record<string, unknown>
                | undefined)?.options as unknown[]) ?? []).map((option) => String(option))
            : [];
    const predictionSummary =
      room?.answerType === 'multiple_choice'
        ? roomOptions.map((option) => ({
            key: option,
            label: option.replace(/_/g, ' '),
            count: genericPredictionEntries.filter(
              (prediction) => prediction.selectedOptionKey === option,
            ).length,
          }))
        : [];

    return {
      roomId,
      actualOutcome: finalMilestone?.actualOptionKey ?? room?.actualEndTime,
      actualOptionKey: finalMilestone?.actualOptionKey ?? null,
      outcomeSource: room?.outcomeSource ?? null,
      confidenceLevel: room?.confidenceLevel ?? null,
      comebackPrompt: 'Want to beat your last miss?',
      rematchCta: 'Rematch with same group',
      momentCardCta: 'Create Moment Card',
      momentCard: {
        ...momentCard,
        badge: primaryBadge,
      },
      badges: awardedBadges,
      reactions: ['🔥', '🎯', '👑', '😂', '😭', '🤝', '⚡'],
      predictionSummary,
      predictionEntries:
        room?.answerType === 'multiple_choice'
          ? genericPredictionEntries.map((prediction) => ({
              predictionId: prediction.predictionId,
              selectedOptionKey: prediction.selectedOptionKey,
              status: 'visible',
              isCurrentUser: false,
              user: safePublicUser(prediction.user),
            }))
          : [],
      winner: winner
        ? {
            userId: winner.userId,
            user: safePublicUser(winner.user),
            name: winner.user.prediktHandle ? `@${winner.user.prediktHandle}` : winner.user.name,
            totalRoomAura: winner.totalRoomAura,
            totalRoomClout: winner.totalRoomClout,
            overallRank: 1,
          }
        : null,
      rankings: await this.prisma.roomResult.findMany({
        where: { roomId },
        include: { user: { select: SAFE_PUBLIC_USER_SELECT } },
        orderBy: { overallRank: 'asc' },
      }),
    };
  }

  private scoreTier(diffSeconds: number) {
    if (diffSeconds === 0) {
      return { name: 'exact_second', bonusAura: 50, flexType: 'dot_master' };
    }
    if (diffSeconds <= 10) {
      return { name: 'within_10_sec', bonusAura: 35, flexType: 'near_perfect' };
    }
    if (diffSeconds <= 30) {
      return { name: 'within_30_sec', bonusAura: 25, flexType: 'sharp_shot' };
    }
    if (diffSeconds <= 60) {
      return { name: 'within_1_min', bonusAura: 15, flexType: 'dot_hunter' };
    }
    if (diffSeconds <= 120) {
      return { name: 'within_2_min', bonusAura: 10, flexType: null };
    }
    if (diffSeconds <= 300) {
      return { name: 'within_5_min', bonusAura: 5, flexType: null };
    }
    return { name: 'outside_5_min', bonusAura: 0, flexType: null };
  }

  private buildMomentCardCopy(
    category: string,
    subtype: 'custom_challenge' | 'sports' | null = null,
  ) {
    if (category === 'open_prediction') {
      const generic = this.buildOpenPredictionResultCopy(subtype ?? 'custom_challenge');
      return {
        titles: [generic.badgeTitle, generic.resultState, 'Aura unlocked'],
        shareText: generic.shareText,
      };
    }
    switch (category) {
      case 'weather_rain':
        return {
          titles: ['Rain Oracle', 'Forecast Beater', 'Monsoon Streak'],
          shareText: 'I beat the forecast on My Prediktion. Rain Oracle unlocked.',
        };
      case 'food_eta':
        return {
          titles: ['ETA Master', 'Beat the ETA', 'Delivery Oracle'],
          shareText: 'I called the delivery ETA closest on My Prediktion.',
        };
      case 'whos_late':
        return {
          titles: ['Time Oracle', 'Comeback Crew', 'Group Chaos'],
          shareText: 'Time Oracle unlocked on My Prediktion.',
        };
      case 'gym_habit':
        return {
          titles: ['Pattern Breaker', 'Consistency Streak', 'Comeback Solo'],
          shareText: 'Consistency Streak unlocked on My Prediktion.',
        };
      default:
        return {
          titles: ['Route Oracle', 'ETA Sniper', 'Dot Bonus'],
          shareText: 'Route Oracle unlocked. Closest guess wins Aura.',
        };
    }
  }

  private buildResultReadyBody(
    room: { category?: string | null; templateKey?: string | null; scoringRule?: unknown } | null,
  ) {
    if ((room?.category ?? room?.templateKey) !== 'open_prediction') {
      return 'Results are ready. See who made the Closest Guess and earned Aura.';
    }
    const copy = this.buildOpenPredictionResultCopy(
      deriveRoomSubtype(room ?? {}) ?? 'custom_challenge',
    );
    return `${copy.resultState}. ${copy.scoringCopy}.`;
  }

  private buildOpenPredictionResultCopy(subtype: 'custom_challenge' | 'sports'): OpenPredictionResultCopy {
    if (subtype === 'sports') {
      return {
        badgeTitle: 'Match Oracle',
        scoringCopy: 'Correct picks earn Aura',
        resultState: 'Final result revealed',
        shareText: 'Match Oracle unlocked. Correct picks earn Aura.',
      };
    }
    return {
      badgeTitle: 'Prediction Pro',
      scoringCopy: 'Correct picks earn Aura',
      resultState: 'Result revealed',
      shareText: 'Prediction Pro unlocked. Correct picks earn Aura.',
    };
  }

  private async awardResultDeclaredCredits(roomId: string, creatorUserId: string) {
    const idempotencyKey = `result_declared:${roomId}:${creatorUserId}`;
    const existing = await this.prisma.creditLedger.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return;
    // Credit integrity: idempotency protects creators from duplicate rewards if result
    // declaration is retried after a partial failure or client timeout.
    const updatedUser = await this.prisma.user.update({
      where: { userId: creatorUserId },
      data: { creditBalance: { increment: 15 } },
    });
    await this.prisma.creditLedger.create({
      data: {
        userId: creatorUserId,
        eventType: 'result_declared',
        delta: 15,
        balanceAfter: updatedUser.creditBalance,
        sourceId: roomId,
        sourceType: 'room',
        idempotencyKey,
        metadata: { label: 'Result declared credit bonus' },
      },
    });
  }

  private async awardMilestoneMasterFlex(roomId: string) {
    const top = await this.prisma.roomResult.findMany({
      where: { roomId },
      orderBy: { milestonesWon: 'desc' },
      take: 1,
    });
    if (!top[0] || top[0].milestonesWon <= 0) return;

    await this.prisma.$transaction(async (tx) => {
      await this.ensureFlex(tx, top[0].userId, 'milestone_master', roomId);
    });
  }

  private async ensureDropAwards(tx: any, roomId: string, userId: string, ruleType: string) {
    const rules = await tx.roomDropRule.findMany({
      where: { roomId, ruleType },
      include: { drop: true },
    });

    for (const rule of rules) {
      const existingWinners = await tx.userDrop.count({
        where: { dropId: rule.dropId, roomId },
      });
      if (existingWinners >= rule.maxWinners) continue;

      const alreadyUnlocked = await tx.userDrop.findFirst({
        where: { userId, dropId: rule.dropId, roomId },
      });
      if (alreadyUnlocked) continue;

      await tx.userDrop.create({
        data: {
          userId,
          dropId: rule.dropId,
          roomId,
        },
      });
    }
  }

  private didWinnerBeatBot(
    winnerPrediction: { differenceFromActualSeconds?: number | null } | null | undefined,
    milestone: { actualReachedTime?: Date | null } | null | undefined,
    oracleBotPrediction: unknown,
    answerType?: string | null,
  ) {
    if (!winnerPrediction || !milestone?.actualReachedTime || !oracleBotPrediction || typeof oracleBotPrediction !== 'object') {
      return false;
    }
    const oracleMinutes = (oracleBotPrediction as Record<string, unknown>).predictedDurationMinutes;
    if (typeof oracleMinutes === 'number' && answerType !== 'multiple_choice' && answerType !== 'yes_no') {
      return (winnerPrediction.differenceFromActualSeconds ?? 999) < oracleMinutes * 60;
    }
    return (winnerPrediction.differenceFromActualSeconds ?? 999) <= 120;
  }

  private async ensureFlex(
    tx: any,
    userId: string,
    flexType: string,
    roomId?: string,
    milestoneId?: string,
  ) {
    const flex = await tx.flex.upsert({
      where: { flexName: flexType },
      update: {},
      create: {
        flexName: flexType,
        flexType,
        description: `Earned for ${flexType.replace(/_/g, ' ')}`,
      },
    });

    const exists = await tx.userFlex.findFirst({
      where: { userId, flexId: flex.flexId, roomId: roomId ?? null, milestoneId: milestoneId ?? null },
    });
    if (!exists) {
      await tx.userFlex.create({
        data: { userId, flexId: flex.flexId, roomId, milestoneId },
      });
    }
  }

  private async getCreatorRoom(roomId: string, user: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { journeyRoute: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorUserId !== user.userId) {
      throw new ForbiddenException('Only the creator can modify this room');
    }
    return room;
  }

  private resolveGracePeriodSeconds(expectedDurationSeconds: number, existingGracePeriodSeconds?: number | null) {
    // Grace must absorb real-world traffic variance, which routinely exceeds a
    // quarter of the trip. Floor at 60 min, and give long trips a full duration's
    // worth of slack. Never drop below the 60-min floor, even for a value pre-baked
    // at room creation.
    const minimumGraceSeconds = Math.max(60 * 60, expectedDurationSeconds);
    if (existingGracePeriodSeconds) return Math.max(existingGracePeriodSeconds, minimumGraceSeconds);
    return minimumGraceSeconds;
  }

  private async applyNeutralClosure(
    room: any,
    journeyStatus: 'abandoned' | 'auto_closed',
    reliabilityEventType: 'no_show_abandoned' | 'auto_closed_no_confirmation',
    message: string,
    actor: { actorType: 'admin' | 'system'; actorId: string | null },
  ) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.roomMilestone.updateMany({
        where: { roomId: room.roomId, status: { not: 'reached' } },
        data: { status: 'cancelled' },
      });
      await tx.predictionRoom.update({
        where: { roomId: room.roomId },
        data: {
          status: 'completed',
          journeyStatus,
          autoClosedAt: journeyStatus === 'auto_closed' ? now : room.autoClosedAt,
          abandonedAt: journeyStatus === 'abandoned' ? now : room.abandonedAt,
          closureReasonCode: journeyStatus,
          actualEndTime: now,
        },
      });
    });

    await this.adjustReliability(room.creatorUserId, room.roomId, reliabilityEventType, message);
    await this.compensateParticipants(room.roomId, message);
    await this.auditService.log({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: journeyStatus === 'auto_closed' ? 'journey_auto_closed' : 'journey_abandoned',
      targetType: 'room',
      targetId: room.roomId,
      afterValue: { journeyStatus },
    });

    await this.notificationsService.notifyRoomMembers({
      roomId: room.roomId,
      type: journeyStatus === 'auto_closed' ? 'journey_auto_closed' : 'journey_abandoned',
      title: journeyStatus === 'auto_closed' ? 'Journey auto-closed' : 'Called it a draw',
      body:
        journeyStatus === 'auto_closed'
          ? 'Nobody ever confirmed arrival, so we called this one a draw. Your guess stays off the record — no loss counted.'
          : 'The journey never actually got moving, so this one is a clean draw. Nobody wins, nobody loses.',
      severity: 'warning',
      actionLabel: 'View result',
      actionTarget: `room:${room.roomId}:result`,
      metadata: { journeyStatus },
      idempotencyKey: `${journeyStatus}:${room.roomId}`,
    });
  }

  private async adjustReliability(userId: string, roomId: string, eventType: keyof typeof RELIABILITY_POINTS, reason: string) {
    const pointsDelta = RELIABILITY_POINTS[eventType] ?? 0;
    await this.prisma.userReliabilityLedger.create({
      data: {
        userId,
        roomId,
        eventType,
        pointsDelta,
        reason,
      },
    });

    if (eventType === 'no_show_abandoned' || eventType === 'auto_closed_no_confirmation') {
      const recentAbandonments = await this.prisma.userReliabilityLedger.count({
        where: {
          userId,
          eventType: { in: ['no_show_abandoned', 'auto_closed_no_confirmation'] },
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      });
      if (recentAbandonments >= 3) {
        await this.prisma.userReliabilityLedger.create({
          data: {
            userId,
            roomId,
            eventType: 'repeated_abandonment_penalty',
            pointsDelta: RELIABILITY_POINTS.repeated_abandonment_penalty,
            reason: 'Repeated unexplained journey abandonment',
          },
        });
      }
    }

    await this.auditService.log({
      actorType: 'system',
      actorId: null,
      action: 'reliability_adjusted',
      targetType: 'user',
      targetId: userId,
      afterValue: { roomId, eventType, pointsDelta },
    });

    await this.notificationsService.create({
      userId,
      roomId,
      type: 'reliability_updated',
      title: 'Reliability updated',
      body: pointsDelta < 0
        ? 'Your Reliability changed after this journey. Review the room for context.'
        : 'Your Reliability improved after this journey.',
      severity: pointsDelta < 0 ? 'warning' : 'success',
      actionLabel: 'View room',
      actionTarget: `room:${roomId}:result`,
      metadata: { eventType, pointsDelta },
      idempotencyKey: `reliability_updated:${roomId}:${userId}:${eventType}`,
    });
  }

  private async compensateParticipants(roomId: string, reason: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { milestonePredictions: true },
    });
    if (!room) return;
    if (!room.createdAt || new Date().getTime() - room.createdAt.getTime() < 5 * 60 * 1000) return;

    const participantIds = Array.from(
      new Set((room.milestonePredictions ?? []).filter((prediction) => !prediction.revokedAt).map((prediction) => prediction.userId)),
    ).filter((userId) => userId !== room.creatorUserId);

    for (const userId of participantIds) {
      const idempotencyKey = `journey_closure_compensation:${roomId}:${userId}`;
      const existing = await this.prisma.creditLedger.findUnique({ where: { idempotencyKey } });
      if (existing) continue;
      const todayCount = await this.prisma.creditLedger.count({
        where: {
          userId,
          eventType: 'journey_closure_compensation',
          createdAt: { gte: new Date(new Date().toISOString().slice(0, 10)) },
        },
      });
      if (todayCount >= 3) continue;

      const updatedUser = await this.prisma.user.update({
        where: { userId },
        data: {
          creditBalance: { increment: 2 },
          totalAura: { increment: 5 },
          weeklyAura: { increment: 5 },
        },
      });
      await this.prisma.creditLedger.create({
        data: {
          userId,
          eventType: 'journey_closure_compensation',
          delta: 2,
          balanceAfter: updatedUser.creditBalance,
          sourceId: roomId,
          sourceType: 'room',
          idempotencyKey,
          metadata: { label: 'Journey closure participation recognition', reason },
        },
      });
      await this.prisma.auraTransaction.create({
        data: {
          userId,
          roomId,
          amount: 5,
          reason: 'Participation recognition after fair journey closure',
        },
      });
      await this.auditService.log({
        actorType: 'system',
        actorId: null,
        action: 'participant_compensated',
        targetType: 'user',
        targetId: userId,
        afterValue: { roomId, reason },
      });
      await this.notificationsService.create({
        userId,
        roomId,
        type: 'participation_recognition',
        title: 'Participation recognized',
        body: 'Thanks for joining. This closure was neutral, and your participation was recognized.',
        severity: 'success',
        actionLabel: 'View result',
        actionTarget: `room:${roomId}:result`,
        metadata: { reason },
        idempotencyKey: `participation_recognition:${roomId}:${userId}`,
      });
    }
  }

  private async buildNeutralClosureResponse(roomId: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { creator: { select: SAFE_PUBLIC_USER_SELECT } },
    });
    return {
      roomId,
      closureType: room?.journeyStatus ?? 'closed',
      closureReasonCode: room?.closureReasonCode ?? null,
      closureMessage: this.closureMessage(room?.journeyStatus, room?.closureReasonCode),
      predictionsCountedAsLosses: false,
      participantRecognitionIssued: true,
      hostReliabilityUpdated: true,
      creator: room?.creator ? safePublicUser(room.creator) : null,
      rankings: [],
      winner: null,
    };
  }

  private closureMessage(journeyStatus?: string | null, reasonCode?: string | null) {
    if (journeyStatus === 'plan_changed') return 'Journey closed: plan changed';
    if (journeyStatus === 'cancelled_by_host') return 'Journey closed fairly';
    if (journeyStatus === 'auto_closed') return 'Journey auto-closed: no verified arrival';
    if (journeyStatus === 'abandoned') return 'Plans changed — nobody counted as a loss';
    return reasonCode ? `Journey closed: ${reasonCode.replace(/_/g, ' ')}` : 'Journey closed';
  }

  private guardTerminal(status: string) {
    if (TERMINAL_STATUSES.includes(status as (typeof TERMINAL_STATUSES)[number])) {
      throw new BadRequestException(`Room is already ${status}`);
    }
  }
}
