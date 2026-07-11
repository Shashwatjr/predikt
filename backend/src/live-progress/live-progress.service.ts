import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { User } from '@prisma/client';
import { LifecycleService } from '../lifecycle/lifecycle.service';

@Injectable()
export class LiveProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycleService: LifecycleService,
  ) {}

  async postUpdate(roomId: string, dto: LocationUpdateDto, user: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorUserId !== user.userId) {
      throw new ForbiddenException('Only the creator can post location updates');
    }
    if (room.status !== 'live') {
      throw new BadRequestException('Room must be live to post updates');
    }
    if (room.startTime && room.startTime.getTime() > Date.now()) {
      throw new BadRequestException('Journey timer has not started yet');
    }

    const createdAt = new Date();
    const [event] = await this.prisma.$transaction([
      this.prisma.liveLocationEvent.create({
        data: {
          roomId,
          creatorUserId: user.userId,
          rawLat: dto.rawLat,
          rawLng: dto.rawLng,
          progressPercentage: dto.progressPercentage,
          etaMinutes: dto.etaMinutes,
          currentMilestoneId: dto.currentMilestoneId,
          locationDisplayMode: room.locationDisplayMode,
          createdAt,
        },
        select: {
          locationEventId: true,
          progressPercentage: true,
          etaMinutes: true,
          locationDisplayMode: true,
          createdAt: true,
        },
      }),
      this.prisma.predictionRoom.update({
        where: { roomId },
        data: {
          lastTravellerUpdateAt: createdAt,
          journeyStatus: dto.progressPercentage >= 95 ? 'overdue' : 'live',
        },
      }),
    ]);

    return event;
  }

  async getLiveState(roomId: string) {
    await this.lifecycleService.evaluateRoomLifecycle(roomId, { actorType: 'system', actorId: null });
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
    });
    if (!room) throw new NotFoundException('Room not found');

    const now = new Date();
    const viewerVisibleTime = new Date(
      now.getTime() - room.safetyDelayMinutes * 60 * 1000,
    );

    const delayedEvent = await this.prisma.liveLocationEvent.findFirst({
      where: { roomId, createdAt: { lte: viewerVisibleTime } },
      include: {
        currentMilestone: {
          select: {
            milestoneId: true,
            milestoneName: true,
            milestoneOrder: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sponsor = room.isSponsored
      ? {
          name: room.sponsorName,
          logoUrl: room.sponsorLogoUrl,
          brandColor: room.sponsorBrandColor,
          tagline: room.sponsorTagline,
        }
      : null;
    const scoringRule = room.scoringRule as { startDelayMinutes?: number } | null;

    // Privacy boundary: viewer-facing live state uses safety-delayed progress and must never expose raw or exact GPS coordinates.
    return {
      roomId: room.roomId,
      status: room.status,
      journeyStatus: room.journeyStatus,
      journeyScheduledStartAt: room.journeyScheduledStartAt?.toISOString() ?? null,
      journeyStartedAt: room.journeyStartedAt?.toISOString() ?? null,
      lastTravellerUpdateAt: room.lastTravellerUpdateAt?.toISOString() ?? null,
      expectedDurationSeconds: room.expectedDurationSeconds ?? null,
      gracePeriodSeconds: room.gracePeriodSeconds ?? null,
      autoCloseAt: room.autoCloseAt?.toISOString() ?? null,
      noStartCutoffAt: room.noStartCutoffAt?.toISOString() ?? null,
      arrivalConfirmedAt: room.arrivalConfirmedAt?.toISOString() ?? null,
      cancelledAt: room.cancelledAt?.toISOString() ?? null,
      autoClosedAt: room.autoClosedAt?.toISOString() ?? null,
      abandonedAt: room.abandonedAt?.toISOString() ?? null,
      closureReasonCode: room.closureReasonCode ?? null,
      currentTime: now.toISOString(),
      plannedStartTime: room.plannedStartTime?.toISOString() ?? null,
      startTime: room.startTime?.toISOString() ?? null,
      visibleMovementStartTime: room.visibleMovementStartTime?.toISOString() ?? null,
      defaultStartDelayMinutes: scoringRule?.startDelayMinutes ?? 3,
      secondsUntilStart: room.startTime
        ? Math.max(0, Math.ceil((room.startTime.getTime() - now.getTime()) / 1000))
        : null,
      displayedProgressTimestamp: delayedEvent?.createdAt?.toISOString() ?? null,
      safetyDelayMinutes: room.safetyDelayMinutes,
      progressPercentage: delayedEvent?.progressPercentage ?? 0,
      etaMinutes: delayedEvent?.etaMinutes ?? null,
      locationDisplayMode: room.locationDisplayMode,
      currentMilestone: delayedEvent?.currentMilestone ?? null,
      movementAvatarType: room.movementAvatarType,
      movementAvatarUrl: room.movementAvatarUrl ?? null,
      sponsor,
      lifecycleMessage: this.buildLifecycleMessage(room.journeyStatus),
      safetyMessage: delayedEvent
        ? 'Movement is delayed for safety. Exact location hidden.'
        : 'Movement is delayed for safety. Exact location hidden.',
    };
  }

  private buildLifecycleMessage(journeyStatus: string) {
    if (journeyStatus === 'overdue') return 'Journey is overdue. Confirm arrival or it may auto-close.';
    if (journeyStatus === 'inactive') return 'Waiting for traveller update.';
    if (journeyStatus === 'auto_closed') return 'No verified arrival. Predictions were closed neutrally.';
    if (journeyStatus === 'cancelled_by_host' || journeyStatus === 'plan_changed') {
      return 'Journey closed fairly after a plan change.';
    }
    if (journeyStatus === 'abandoned') return 'Journey was marked as a No-Show and closed neutrally.';
    if (journeyStatus === 'arrived_verified' || journeyStatus === 'completed') return 'Arrival confirmed.';
    return 'Approx. journey progress is shown with privacy-safe timing.';
  }
}
