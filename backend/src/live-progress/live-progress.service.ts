import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { CheckpointUpdateDto } from './dto/checkpoint-update.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createMapsProvider, distanceMetersBetween, fetchGoogleDurationInTraffic } from '../routes/maps-provider';
import { featureFlags } from '../config/feature-flags';

// Checkpoints that get a live provider ETA re-read (billed). 90/100 are verify-only
// and use the free derived ETA. Decision recorded in the plan.
const LIVE_REREAD_CHECKPOINTS = [20, 40, 60, 80];
// Progress marks that store a fresh Google duration_in_traffic on the room.
const MILESTONE_ETA_CHECKPOINTS = [20, 40, 60, 80, 90, 95, 100];
// Hard cap on billable Google Maps calls per journey. The natural cadence is
// 20/40/60/80 (4) plus the arrival re-read (1) = 5. This counter is the backstop:
// once this many billable snapshots exist for a room we stop calling the provider
// and fall back to the free time-based derived ETA, so a retried/replayed journey
// can never run up the Maps bill.
const MAX_BILLABLE_ETA_CALLS = 5;
// Snapshot source values that count as a paid provider re-read (anything that is
// not a free derived/fallback extrapolation).
const FREE_SNAPSHOT_SOURCES = new Set(['derived', 'fallback']);
const ETA_MOVE_NOTIFY_THRESHOLD_MS = 20 * 60 * 1000;
const PING_REREAD_MIN_INTERVAL_MS = 4 * 60 * 1000;
const ARRIVAL_GEOFENCE_METERS = 1000;

const num = (value: unknown): number | null =>
  value == null ? null : Number(value);

@Injectable()
export class LiveProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycleService: LifecycleService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * v2 (checkpoint_leaderboard_v2): records one discrete, time-based checkpoint
   * from the creator's one-shot timer. Does a live Google ETA re-read at
   * 20/40/60/80 and a free derived ETA at 90/100, stores both GPS + ETA on the
   * checkpoint, and raises a one-time notification if the arrival estimate has
   * moved more than 20 min vs the original start ETA.
   */
  async recordClientCheckpoint(roomId: string, dto: CheckpointUpdateDto, user: User) {
    if (!featureFlags.checkpointLeaderboardV2) {
      throw new BadRequestException('Checkpoint leaderboard v2 is not enabled');
    }

    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { journeyRoute: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorUserId !== user.userId) {
      throw new ForbiddenException('Only the creator can post checkpoints');
    }
    if (room.status !== 'live') {
      throw new BadRequestException('Room must be live to post checkpoints');
    }
    if (room.startTime && room.startTime.getTime() > Date.now()) {
      throw new BadRequestException('Journey timer has not started yet');
    }

    const { checkpointPct, lat, lng } = dto;
    const capturedAt = new Date();

    const destLat = num(room.destinationLat) ?? num(room.journeyRoute?.destinationLat);
    const destLng = num(room.destinationLng) ?? num(room.journeyRoute?.destinationLng);

    let etaSeconds: number | null = null;
    let remainingMeters: number | null = null;
    let source: string | null = null;

    // Live re-read only at the scoring-relevant checkpoints, when we know the
    // destination, and while under the per-journey billable-call cap. Any provider
    // failure (or the cap) falls back to the free time-based derived ETA — the
    // journey never crashes on a Maps error.
    const billableCallsSoFar = await this.prisma.roomMilestoneSnapshot.count({
      where: { roomId, source: { notIn: Array.from(FREE_SNAPSHOT_SOURCES) } },
    });
    if (
      LIVE_REREAD_CHECKPOINTS.includes(checkpointPct) &&
      destLat != null &&
      destLng != null &&
      billableCallsSoFar < MAX_BILLABLE_ETA_CALLS
    ) {
      try {
        const provider = createMapsProvider(this.configService);
        const preview = await provider.getRoutePreview(
          { placeId: '', label: 'current', latitude: lat, longitude: lng },
          { placeId: '', label: 'destination', latitude: destLat, longitude: destLng },
          room.journeyRoute?.travelMode,
        );
        etaSeconds = Math.round(preview.durationSeconds);
        remainingMeters = Math.round(preview.distanceMeters);
        source = provider.name;
      } catch {
        // fall through to derived
      }
    }

    if (etaSeconds == null) {
      const derived = this.buildTimedProgress(room, capturedAt);
      etaSeconds = derived.etaMinutes != null ? derived.etaMinutes * 60 : 0;
      // Straight-line remaining distance is a safe, free approximation for the
      // fallback snapshot (never exposed raw to viewers — meters only).
      remainingMeters =
        destLat != null && destLng != null
          ? distanceMetersBetween(
              { latitude: lat, longitude: lng },
              { latitude: destLat, longitude: destLng },
            )
          : null;
      source = billableCallsSoFar >= MAX_BILLABLE_ETA_CALLS ? 'fallback' : 'derived';
    }

    // Recompute the journey's expected duration from this fresh checkpoint:
    // elapsed-so-far + remaining ETA. Future milestones (which are derived from
    // expectedDurationSeconds) shift with it, which is what stops the progress bar
    // from hitting 100% while the traveller is still driving.
    const recomputedDurationSeconds =
      room.startTime && etaSeconds != null
        ? Math.max(
            60,
            Math.round((capturedAt.getTime() - room.startTime.getTime()) / 1000) + etaSeconds,
          )
        : null;

    await this.prisma.$transaction([
      this.prisma.roomCheckpoint.upsert({
        where: { roomId_checkpoint: { roomId, checkpoint: checkpointPct } },
        update: { lat, lng, capturedAt, etaSeconds, source },
        create: { roomId, checkpoint: checkpointPct, lat, lng, capturedAt, etaSeconds, source },
      }),
      this.prisma.roomMilestoneSnapshot.upsert({
        where: { roomId_checkpointPercent: { roomId, checkpointPercent: checkpointPct } },
        update: { capturedAt, etaSeconds, remainingMeters, source },
        create: { roomId, checkpointPercent: checkpointPct, capturedAt, etaSeconds, remainingMeters, source },
      }),
      this.prisma.predictionRoom.update({
        where: { roomId },
        data: {
          lastTravellerUpdateAt: capturedAt,
          journeyStatus: checkpointPct >= 95 ? 'overdue' : 'live',
          ...(recomputedDurationSeconds != null
            ? { expectedDurationSeconds: recomputedDurationSeconds }
            : {}),
        },
      }),
    ]);

    await this.maybeNotifyEtaMoved(room, checkpointPct, etaSeconds, capturedAt);

    if (remainingMeters != null && remainingMeters <= ARRIVAL_GEOFENCE_METERS) {
      const arrival = await this.lifecycleService.finalizeArrivalFromLocation(roomId, user, lat, lng);
      if (arrival.finalized) {
        return {
          checkpoint: checkpointPct,
          etaSeconds: 0,
          remainingMeters,
          source,
          recomputedDurationSeconds,
          capturedAt: capturedAt.toISOString(),
          arrived: true,
          result: arrival.result,
        };
      }
    }

    return {
      checkpoint: checkpointPct,
      etaSeconds,
      remainingMeters,
      source,
      recomputedDurationSeconds,
      capturedAt: capturedAt.toISOString(),
    };
  }

  // One-time (idempotent per checkpoint) alert when the projected arrival has
  // drifted more than 20 min from the original start ETA. Gated implicitly by v2
  // (only reachable from recordClientCheckpoint), independent of the notifications flag.
  private async maybeNotifyEtaMoved(
    room: { roomId: string; startTime: Date | null; expectedDurationSeconds: number | null },
    checkpointPct: number,
    etaSeconds: number,
    capturedAt: Date,
  ) {
    if (!room.startTime || !room.expectedDurationSeconds) return;
    const expectedArrivalMs = room.startTime.getTime() + room.expectedDurationSeconds * 1000;
    const projectedArrivalMs = capturedAt.getTime() + etaSeconds * 1000;
    const driftMs = Math.abs(projectedArrivalMs - expectedArrivalMs);
    if (driftMs <= ETA_MOVE_NOTIFY_THRESHOLD_MS) return;

    const driftMinutes = Math.round(driftMs / 60000);
    await this.notificationsService.notifyRoomMembers({
      roomId: room.roomId,
      type: 'eta_moved',
      title: 'Arrival estimate changed',
      body: `Heads up — the arrival estimate moved by about ${driftMinutes} min.`,
      severity: 'info',
      actionLabel: 'View live',
      actionTarget: `room:${room.roomId}:live`,
      metadata: { checkpoint: checkpointPct, driftMinutes },
      idempotencyKey: `eta_moved:${room.roomId}:${checkpointPct}`,
    });
  }

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

  async recordLivePing(roomId: string, dto: LocationPingDto, user: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: { journeyRoute: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorUserId !== user.userId) {
      throw new ForbiddenException('Only the creator can post location pings');
    }
    if (room.status !== 'live') {
      throw new BadRequestException('Room must be live to post updates');
    }
    if (room.startTime && room.startTime.getTime() > Date.now()) {
      return {
        waitingToStart: true,
        secondsUntilStart: Math.ceil((room.startTime.getTime() - Date.now()) / 1000),
      };
    }

    const { lat, lng } = dto;
    const capturedAt = new Date();
    const destLat = num(room.destinationLat) ?? num(room.journeyRoute?.destinationLat);
    const destLng = num(room.destinationLng) ?? num(room.journeyRoute?.destinationLng);
    const remainingMeters =
      destLat != null && destLng != null
        ? distanceMetersBetween(
            { latitude: lat, longitude: lng },
            { latitude: destLat, longitude: destLng },
          )
        : null;

    const startLat = num(room.startingLat) ?? num(room.journeyRoute?.startLat);
    const startLng = num(room.startingLng) ?? num(room.journeyRoute?.startLng);
    const totalMeters =
      startLat != null && startLng != null && destLat != null && destLng != null
        ? distanceMetersBetween(
            { latitude: startLat, longitude: startLng },
            { latitude: destLat, longitude: destLng },
          )
        : null;
    const withinArrivalGeofence =
      remainingMeters != null && remainingMeters <= ARRIVAL_GEOFENCE_METERS;
    const progressPercentage =
      remainingMeters != null && totalMeters != null && totalMeters > 0
        ? Math.min(99, Math.max(1, Math.round(((totalMeters - remainingMeters) / totalMeters) * 100)))
        : this.buildTimedProgress(room, capturedAt).progressPercentage;
    const existingEtas = readCheckpointEtas(room.checkpointEtas);
    const dueCheckpoints = pendingMilestoneCheckpoints(progressPercentage, existingEtas);
    // 100% is the arrival geofence, not the straight-line clamp (live progress stops at 99).
    if (withinArrivalGeofence && existingEtas['100'] == null && !dueCheckpoints.includes(100)) {
      dueCheckpoints.push(100);
    }
    let milestoneEta: { etaSeconds: number; durationInTrafficSeconds: number } | null = null;
    if (dueCheckpoints.length && destLat != null && destLng != null) {
      try {
        const traffic = await fetchGoogleDurationInTraffic(
          this.configService,
          { latitude: lat, longitude: lng },
          { latitude: destLat, longitude: destLng },
          room.journeyRoute?.travelMode,
        );
        if (traffic) {
          milestoneEta = {
            etaSeconds: traffic.durationInTrafficSeconds,
            durationInTrafficSeconds: traffic.durationInTrafficSeconds,
          };
          for (const checkpoint of dueCheckpoints) {
            existingEtas[String(checkpoint)] = {
              checkpoint,
              etaSeconds: traffic.durationInTrafficSeconds,
              etaMinutes: Math.max(0, Math.ceil(traffic.durationInTrafficSeconds / 60)),
              durationInTrafficSeconds: traffic.durationInTrafficSeconds,
              capturedAt: capturedAt.toISOString(),
              source: 'google',
            };
          }
        }
      } catch {
        milestoneEta = null;
      }
    }

    if (withinArrivalGeofence) {
      if (milestoneEta) {
        await this.persistMilestoneEtas(
          roomId,
          dueCheckpoints,
          lat,
          lng,
          capturedAt,
          existingEtas,
          milestoneEta.etaSeconds,
          remainingMeters,
        );
      }
      const arrival = await this.lifecycleService.finalizeArrivalFromLocation(roomId, user, lat, lng);
      if (arrival.finalized) {
        return {
          arrived: true,
          remainingMeters,
          etaMinutes: 0,
          progressPercentage: 100,
          checkpointEtas: this.publicCheckpointEtas(existingEtas),
          canConfirmArrival: true,
          result: arrival.result,
        };
      }
    }

    const lastBillable = await this.prisma.roomMilestoneSnapshot.findFirst({
      where: { roomId, source: { notIn: Array.from(FREE_SNAPSHOT_SOURCES) } },
      orderBy: { capturedAt: 'desc' },
    });
    const billableCallsSoFar = await this.prisma.roomMilestoneSnapshot.count({
      where: { roomId, source: { notIn: Array.from(FREE_SNAPSHOT_SOURCES) } },
    });
    const rereadDue =
      !lastBillable || capturedAt.getTime() - lastBillable.capturedAt.getTime() >= PING_REREAD_MIN_INTERVAL_MS;

    let etaSeconds: number | null = milestoneEta?.etaSeconds ?? null;
    let source = milestoneEta ? 'google' : 'derived';
    if (
      etaSeconds == null &&
      rereadDue &&
      destLat != null &&
      destLng != null &&
      billableCallsSoFar < MAX_BILLABLE_ETA_CALLS
    ) {
      try {
        const provider = createMapsProvider(this.configService);
        const preview = await provider.getRoutePreview(
          { placeId: '', label: 'current', latitude: lat, longitude: lng },
          { placeId: '', label: 'destination', latitude: destLat, longitude: destLng },
          room.journeyRoute?.travelMode,
        );
        etaSeconds = Math.round(preview.durationSeconds);
        source = provider.name;
      } catch {
        etaSeconds = null;
      }
    }

    if (etaSeconds == null) {
      if (lastBillable?.etaSeconds != null) {
        const elapsedSince = Math.max(0, capturedAt.getTime() - lastBillable.capturedAt.getTime()) / 1000;
        etaSeconds = Math.max(60, Math.round(lastBillable.etaSeconds - elapsedSince));
        source = 'derived';
      } else {
        const timed = this.buildTimedProgress(room, capturedAt);
        etaSeconds = timed.etaMinutes != null ? Math.max(60, timed.etaMinutes * 60) : 60;
      }
    }

    const recomputedDurationSeconds =
      room.startTime != null
        ? Math.max(60, Math.round((capturedAt.getTime() - room.startTime.getTime()) / 1000) + etaSeconds)
        : null;
    const etaMinutes = Math.max(1, Math.ceil(etaSeconds / 60));
    const capturedMilestoneEta = milestoneEta;
    const roundedRemainingMeters = remainingMeters == null ? null : Math.round(remainingMeters);

    await this.prisma.$transaction([
      this.prisma.liveLocationEvent.create({
        data: {
          roomId,
          creatorUserId: user.userId,
          progressPercentage,
          etaMinutes,
          locationDisplayMode: room.locationDisplayMode,
          createdAt: capturedAt,
        },
      }),
      this.prisma.predictionRoom.update({
        where: { roomId },
        data: {
          lastTravellerUpdateAt: capturedAt,
          journeyStatus: 'live',
          ...(recomputedDurationSeconds != null ? { expectedDurationSeconds: recomputedDurationSeconds } : {}),
          ...(capturedMilestoneEta
            ? { checkpointEtas: existingEtas as unknown as Prisma.InputJsonValue }
            : {}),
          autoCloseAt: new Date(capturedAt.getTime() + 45 * 60 * 1000),
        },
      }),
      ...(capturedMilestoneEta
        ? dueCheckpoints.flatMap((checkpoint) => [
            this.prisma.roomCheckpoint.upsert({
              where: { roomId_checkpoint: { roomId, checkpoint } },
              update: { lat, lng, capturedAt, etaSeconds: capturedMilestoneEta.etaSeconds, source: 'google' },
              create: {
                roomId,
                checkpoint,
                lat,
                lng,
                capturedAt,
                etaSeconds: capturedMilestoneEta.etaSeconds,
                source: 'google',
              },
            }),
            this.prisma.roomMilestoneSnapshot.upsert({
              where: { roomId_checkpointPercent: { roomId, checkpointPercent: checkpoint } },
              update: {
                capturedAt,
                etaSeconds: capturedMilestoneEta.etaSeconds,
                remainingMeters: roundedRemainingMeters,
                source: 'google',
              },
              create: {
                roomId,
                checkpointPercent: checkpoint,
                capturedAt,
                etaSeconds: capturedMilestoneEta.etaSeconds,
                remainingMeters: roundedRemainingMeters,
                source: 'google',
              },
            }),
          ])
        : []),
    ]);

    return {
      arrived: false,
      remainingMeters,
      etaMinutes,
      etaSeconds,
      progressPercentage,
      checkpointEtas: this.publicCheckpointEtas(existingEtas),
      source,
      canConfirmArrival: remainingMeters != null && remainingMeters <= ARRIVAL_GEOFENCE_METERS,
    };
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
    const latestSnapshot = await this.prisma.roomMilestoneSnapshot.findFirst({
      where: { roomId },
      orderBy: { capturedAt: 'desc' },
    });
    const snapshotEtaMinutes =
      latestSnapshot?.etaSeconds != null
        ? Math.max(
            room.status === 'live' ? 1 : 0,
            Math.ceil(
              (latestSnapshot.etaSeconds * 1000 - (now.getTime() - latestSnapshot.capturedAt.getTime())) / 60000,
            ),
          )
        : null;
    const derivedEtaMinutes =
      viewerShouldStillWait
        ? null
        : delayedEvent?.etaMinutes ?? snapshotEtaMinutes ?? timedProgress.etaMinutes;
    const liveEtaMinutes =
      room.status === 'live' && derivedEtaMinutes === 0 ? 1 : derivedEtaMinutes;

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
      etaMinutes: viewerShouldStillWait ? null : liveEtaMinutes,
      checkpointEtas: this.publicCheckpointEtas(room.checkpointEtas),
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
    // Only a confirmed arrival (status === 'completed') shows 100%. While the
    // journey is live we clamp to 99 so the bar can never read "Arrived" while the
    // traveller is still driving — even if elapsed time overshoots the (recomputed)
    // expected duration. Checkpoint ETA re-reads push expectedDurationSeconds out,
    // so in the normal case progress simply tracks the recomputed journey.
    const progressPercentage = room.status === 'completed'
      ? 100
      : Math.min(99, (elapsedMs / expectedDurationMs) * 100);
    const remainingMs = Math.max(0, expectedDurationMs - elapsedMs);
    return {
      progressPercentage,
      etaMinutes: room.status === 'completed' ? 0 : Math.ceil(remainingMs / 60000),
    };
  }

  private buildMilestoneBanner(progressPercentage: number) {
    if (progressPercentage >= 100) {
      return { checkpoint: 100, message: 'Arrived. The Tea is ready.' };
    }
    if (progressPercentage >= 90) {
      return { checkpoint: 90, message: 'Final stretch. Arrival is close now.' };
    }
    if (progressPercentage >= 80) {
      return { checkpoint: 80, message: 'Getting close. The reveal is warming up.' };
    }
    if (progressPercentage >= 60) {
      return { checkpoint: 60, message: 'Past halfway. The room can feel the finish line.' };
    }
    if (progressPercentage >= 40) {
      return { checkpoint: 40, message: 'Making progress. Predictions are officially sweating.' };
    }
    if (progressPercentage >= 20) {
      return { checkpoint: 20, message: 'Journey underway. Friends can follow the delayed ride.' };
    }
    return null;
  }

  private async persistMilestoneEtas(
    roomId: string,
    checkpoints: number[],
    lat: number,
    lng: number,
    capturedAt: Date,
    checkpointEtas: Record<string, CheckpointEtaEntry>,
    etaSeconds: number,
    remainingMeters: number | null,
  ) {
    await this.prisma.$transaction([
      this.prisma.predictionRoom.update({
        where: { roomId },
        data: { checkpointEtas: checkpointEtas as unknown as Prisma.InputJsonValue },
      }),
      ...checkpoints.flatMap((checkpoint) => [
        this.prisma.roomCheckpoint.upsert({
          where: { roomId_checkpoint: { roomId, checkpoint } },
          update: { lat, lng, capturedAt, etaSeconds, source: 'google' },
          create: { roomId, checkpoint, lat, lng, capturedAt, etaSeconds, source: 'google' },
        }),
        this.prisma.roomMilestoneSnapshot.upsert({
          where: { roomId_checkpointPercent: { roomId, checkpointPercent: checkpoint } },
          update: {
            capturedAt,
            etaSeconds,
            remainingMeters: remainingMeters == null ? null : Math.round(remainingMeters),
            source: 'google',
          },
          create: {
            roomId,
            checkpointPercent: checkpoint,
            capturedAt,
            etaSeconds,
            remainingMeters: remainingMeters == null ? null : Math.round(remainingMeters),
            source: 'google',
          },
        }),
      ]),
    ]);
  }

  private publicCheckpointEtas(value: unknown) {
    return readCheckpointEtas(value);
  }

  private buildLifecycleMessage(journeyStatus: string) {
    if (journeyStatus === 'overdue') return 'Still tracking — ETA updates from the latest Maps read.';
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

export interface CheckpointEtaEntry {
  checkpoint: number;
  etaSeconds: number;
  etaMinutes: number;
  durationInTrafficSeconds: number;
  capturedAt: string;
  source: string;
}

function readCheckpointEtas(value: unknown): Record<string, CheckpointEtaEntry> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, CheckpointEtaEntry> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const etaSeconds = Number(row.durationInTrafficSeconds ?? row.etaSeconds);
    if (!Number.isFinite(etaSeconds)) continue;
    const etaMinutes = Number(row.etaMinutes);
    const traffic = Number(row.durationInTrafficSeconds);
    out[key] = {
      checkpoint: Number(row.checkpoint ?? key),
      etaSeconds,
      etaMinutes: Number.isFinite(etaMinutes) ? etaMinutes : Math.ceil(etaSeconds / 60),
      durationInTrafficSeconds: Number.isFinite(traffic) ? traffic : etaSeconds,
      capturedAt: typeof row.capturedAt === 'string' ? row.capturedAt : new Date(0).toISOString(),
      source: typeof row.source === 'string' ? row.source : 'google',
    };
  }
  return out;
}

function pendingMilestoneCheckpoints(progress: number, existing: Record<string, unknown>): number[] {
  if (!Number.isFinite(progress)) return [];
  return MILESTONE_ETA_CHECKPOINTS.filter((checkpoint) => progress >= checkpoint && existing[String(checkpoint)] == null);
}
