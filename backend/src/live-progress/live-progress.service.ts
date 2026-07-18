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
      ...(dto.rawLat != null && dto.rawLng != null && [50, 80].includes(Math.round(dto.progressPercentage))
        ? [
            this.prisma.roomCheckpoint.upsert({
              where: {
                roomId_checkpoint: {
                  roomId,
                  checkpoint: Math.round(dto.progressPercentage),
                },
              },
              update: {
                lat: dto.rawLat,
                lng: dto.rawLng,
                capturedAt: createdAt,
              },
              create: {
                roomId,
                checkpoint: Math.round(dto.progressPercentage),
                lat: dto.rawLat,
                lng: dto.rawLng,
                capturedAt: createdAt,
              },
            }),
          ]
        : []),
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
    const viewerVisibleTime = new Date(now.getTime() - room.safetyDelayMinutes * 60 * 1000);

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
    const visibleStartTime = room.visibleMovementStartTime ?? room.startTime;
    const viewerShouldStillWait = !!visibleStartTime && now < visibleStartTime;
    const timedProgress = this.buildTimedProgress(room, now);
    const milestoneBanner = this.buildMilestoneBanner(timedProgress.progressPercentage);
    const derivedEtaMinutes = timedProgress.etaMinutes;

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
      secondsUntilStart: visibleStartTime
        ? Math.max(0, Math.ceil((visibleStartTime.getTime() - now.getTime()) / 1000))
        : null,
      displayedProgressTimestamp: delayedEvent?.createdAt?.toISOString() ?? null,
      safetyDelayMinutes: room.safetyDelayMinutes,
      waitingForDelayedStart: viewerShouldStillWait,
      progressPercentage: viewerShouldStillWait ? 0 : (delayedEvent?.progressPercentage ?? timedProgress.progressPercentage),
      etaMinutes: viewerShouldStillWait ? null : (delayedEvent?.etaMinutes ?? derivedEtaMinutes),
      locationDisplayMode: room.locationDisplayMode,
      currentMilestone: delayedEvent?.currentMilestone ?? null,
      milestoneBanner,
      movementAvatarType: room.movementAvatarType,
      movementAvatarUrl: room.movementAvatarUrl ?? null,
      sponsor,
      lifecycleMessage: viewerShouldStillWait ? 'Waiting to start.' : this.buildLifecycleMessage(room.journeyStatus),
      safetyMessage: delayedEvent
        ? 'Movement is delayed for safety. Exact location hidden.'
        : 'Movement is delayed for safety. Exact location hidden.',
    };
  }

  private buildTimedProgress(room: { status: string; startTime: Date | null; expectedDurationSeconds: number | null }, now: Date) {
    const startTime = room.startTime;
    const expectedDurationMs = (room.expectedDurationSeconds ?? 0) * 1000;
    if (!startTime || expectedDurationMs <= 0) {
      return { progressPercentage: room.status === 'completed' ? 100 : 0, etaMinutes: null };
    }

    const elapsedMs = Math.max(0, now.getTime() - startTime.getTime());
    const progressPercentage = room.status === 'completed'
      ? 100
      : Math.min(100, (elapsedMs / expectedDurationMs) * 100);
    const remainingMs = Math.max(0, expectedDurationMs - elapsedMs);
    return {
      progressPercentage,
      etaMinutes: room.status === 'completed' ? 0 : Math.ceil(remainingMs / 60000),
    };
  }

  private buildMilestoneBanner(progressPercentage: number) {
    if (progressPercentage >= 100) {
      return { checkpoint: 100, message: 'Just arrived. The Tea is brewing.' };
    }
    if (progressPercentage >= 80) {
      return { checkpoint: 80, message: 'Final approach. Anyone want to change their answer? (Too late.)' };
    }
    if (progressPercentage >= 50) {
      return { checkpoint: 50, message: 'Halfway there. Guesses are looking cocky.' };
    }
    return null;
  }

  private buildLifecycleMessage(journeyStatus: string) {
    if (journeyStatus === 'overdue') return 'Journey is overdue. Confirm arrival or it may auto-close.';
    if (journeyStatus === 'inactive') return 'Waiting for traveller update.';
    if (journeyStatus === 'auto_closed') return 'Arrival was never confirmed — calling this one a draw. No losses counted.';
    if (journeyStatus === 'cancelled_by_host' || journeyStatus === 'plan_changed') {
      return 'Journey closed fairly after a plan change.';
    }
    if (journeyStatus === 'abandoned') return 'This journey never left the gate. Calling it a draw — nobody takes the loss.';
    if (journeyStatus === 'arrived_verified' || journeyStatus === 'completed') return 'Arrival confirmed.';
    return 'Approx. journey progress is shown with privacy-safe timing.';
  }
}
