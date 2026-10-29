import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { CheckpointUpdateDto } from './dto/checkpoint-update.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { User } from '@prisma/client';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { NotificationsService } from '../notifications/notifications.service';
import { distanceMetersBetween, fetchGoogleDurationInTraffic } from '../routes/maps-provider';
import { featureFlags } from '../config/feature-flags';

// Paid Google refreshes. 90 is derived-only; 100 stores zero remaining without a paid call.
const PROVIDER_ETA_CHECKPOINTS = [20, 40, 60, 80, 95] as const;
const MILESTONE_ETA_CHECKPOINTS = [20, 40, 60, 80, 90, 95, 100] as const;
// Hard cap on billable Google Maps calls per journey (20/40/60/80/95).
const MAX_BILLABLE_ETA_CALLS = 5;
// Snapshot source values that are free / reconstructed — not paid provider reads.
const FREE_SNAPSHOT_SOURCES = new Set(['derived', 'fallback', 'arrived']);
// Inserted before the network call. Unique (room, checkpoint) is the claim.
const PROVIDER_ATTEMPT_SOURCE = 'provider-attempt';
// A failed attempt is stored so the checkpoint cannot be retried. The ETA is derived.
const PROVIDER_FAILED_SOURCE = 'provider-failed';
const ETA_MOVE_NOTIFY_THRESHOLD_MS = 20 * 60 * 1000;
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
   * v2 (checkpoint_leaderboard_v2): records one discrete checkpoint from the
   * creator timer. Paid Google traffic ETAs at 20/40/60/80/95; derived at 90;
   * zero remaining at 100 without a paid call.
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
    const seededRemaining =
      destLat != null && destLng != null
        ? distanceMetersBetween(
            { latitude: lat, longitude: lng },
            { latitude: destLat, longitude: destLng },
          )
        : null;
    const existingSnapshot = await this.prisma.roomMilestoneSnapshot.findUnique({
      where: { roomId_checkpointPercent: { roomId, checkpointPercent: checkpointPct } },
    });
    const billableCallsSoFar = await this.prisma.roomMilestoneSnapshot.count({
      where: { roomId, source: { notIn: Array.from(FREE_SNAPSHOT_SOURCES) } },
    });
    const captured = await this.captureMilestoneReading({
      roomId,
      checkpoint: checkpointPct,
      lat,
      lng,
      capturedAt,
      room,
      destLat,
      destLng,
      remainingMeters: seededRemaining,
      billableCallsSoFar,
      existing: existingSnapshot,
    });
    const etaSeconds = captured.etaSeconds;
    const remainingMeters = captured.remainingMeters;
    const source = captured.source;

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

    const writes = [];
    if (captured.persistCurrent) {
      writes.push(
        ...this.milestoneWriteOps({
          roomId,
          checkpoint: checkpointPct,
          lat,
          lng,
          capturedAt,
          etaSeconds,
          remainingMeters,
          source,
        }),
      );
    }
    writes.push(
      this.prisma.predictionRoom.update({
        where: { roomId },
        data: {
          lastTravellerUpdateAt: capturedAt,
          journeyStatus: checkpointPct >= 95 ? 'overdue' : 'live',
          ...(captured.persistCurrent && recomputedDurationSeconds != null
            ? { expectedDurationSeconds: recomputedDurationSeconds }
            : {}),
        },
      }),
    );
    await this.prisma.$transaction(writes);

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
    const withinArrivalGeofence =
      remainingMeters != null && remainingMeters <= ARRIVAL_GEOFENCE_METERS;

    const startLat = num(room.startingLat) ?? num(room.journeyRoute?.startLat);
    const startLng = num(room.startingLng) ?? num(room.journeyRoute?.startLng);
    const totalMeters =
      startLat != null && startLng != null && destLat != null && destLng != null
        ? distanceMetersBetween(
            { latitude: startLat, longitude: startLng },
            { latitude: destLat, longitude: destLng },
          )
        : null;
    const progressPercentage = withinArrivalGeofence
      ? 100
      : remainingMeters != null && totalMeters != null && totalMeters > 0
        ? Math.min(99, Math.max(1, Math.round(((totalMeters - remainingMeters) / totalMeters) * 100)))
        : this.buildTimedProgress(room, capturedAt).progressPercentage;

    const existingSnapshots = await this.prisma.roomMilestoneSnapshot.findMany({
      where: { roomId },
      select: { checkpointPercent: true, source: true, etaSeconds: true, capturedAt: true },
    });
    const existingByCheckpoint = new Map(
      existingSnapshots.map((row) => [row.checkpointPercent, row]),
    );
    const billableCallsSoFar = existingSnapshots.filter(
      (row) => row.source != null && !FREE_SNAPSHOT_SOURCES.has(row.source),
    ).length;
    const dueCheckpoints = MILESTONE_ETA_CHECKPOINTS.filter(
      (checkpoint) => progressPercentage >= checkpoint && !existingByCheckpoint.has(checkpoint),
    );
    // An in-flight or completed higher checkpoint owns this crossing. A ping
    // must not turn a skipped earlier checkpoint into a second provider attempt.
    const reachedCheckpoint = [...MILESTONE_ETA_CHECKPOINTS].reverse().find(
      (checkpoint) => progressPercentage >= checkpoint,
    );
    const currentCheckpoint = reachedCheckpoint != null &&
      !existingByCheckpoint.has(reachedCheckpoint) ? reachedCheckpoint : null;
    const earlierMissed =
      currentCheckpoint == null
        ? []
        : dueCheckpoints.filter((checkpoint) => checkpoint < currentCheckpoint);

    let liveEtaSeconds: number | null = null;
    let liveSource = 'derived';
    let ownedMilestone = currentCheckpoint == null;
    const roundedRemaining =
      remainingMeters == null ? null : Math.round(remainingMeters);

    if (currentCheckpoint != null) {
      const recorded = await this.recordCrossedMilestones({
        roomId,
        room,
        lat,
        lng,
        capturedAt,
        currentCheckpoint,
        earlierMissed,
        destLat,
        destLng,
        remainingMeters: roundedRemaining,
        billableCallsSoFar,
      });
      liveEtaSeconds = recorded.etaSeconds;
      liveSource = recorded.source;
      ownedMilestone = recorded.owned;
    }

    if (withinArrivalGeofence) {
      const arrival = await this.lifecycleService.finalizeArrivalFromLocation(roomId, user, lat, lng);
      if (arrival.finalized) {
        return {
          arrived: true,
          remainingMeters,
          etaMinutes: 0,
          etaSeconds: 0,
          progressPercentage: 100,
          source: 'arrived',
          canConfirmArrival: true,
          result: arrival.result,
        };
      }
    }

    const lastBillable = [...existingSnapshots]
      .filter((row) => row.source != null && !FREE_SNAPSHOT_SOURCES.has(row.source) && row.etaSeconds != null)
      .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];

    if (liveEtaSeconds == null) {
      if (lastBillable?.etaSeconds != null) {
        const elapsedSince =
          Math.max(0, capturedAt.getTime() - lastBillable.capturedAt.getTime()) / 1000;
        liveEtaSeconds = Math.max(60, Math.round(lastBillable.etaSeconds - elapsedSince));
        liveSource = 'derived';
      } else {
        const timed = this.buildTimedProgress(room, capturedAt);
        liveEtaSeconds = timed.etaMinutes != null ? Math.max(60, timed.etaMinutes * 60) : 60;
        liveSource = 'derived';
      }
    }

    const recomputedDurationSeconds =
      room.startTime != null
        ? Math.max(
            60,
            Math.round((capturedAt.getTime() - room.startTime.getTime()) / 1000) + liveEtaSeconds,
          )
        : null;
    const etaMinutes = Math.max(1, Math.ceil(liveEtaSeconds / 60));
    const displayProgress = withinArrivalGeofence
      ? 99
      : progressPercentage;

    await this.prisma.$transaction([
      this.prisma.liveLocationEvent.create({
        data: {
          roomId,
          creatorUserId: user.userId,
          progressPercentage: displayProgress,
          etaMinutes,
          locationDisplayMode: room.locationDisplayMode,
          createdAt: capturedAt,
        },
      }),
      this.prisma.predictionRoom.update({
        where: { roomId },
        data: {
          lastTravellerUpdateAt: capturedAt,
          journeyStatus: displayProgress >= 95 ? 'overdue' : 'live',
          ...(ownedMilestone && recomputedDurationSeconds != null
            ? { expectedDurationSeconds: recomputedDurationSeconds }
            : {}),
          autoCloseAt: new Date(capturedAt.getTime() + 45 * 60 * 1000),
        },
      }),
    ]);

    return {
      arrived: false,
      remainingMeters,
      etaMinutes,
      etaSeconds: liveEtaSeconds,
      progressPercentage: displayProgress,
      source: liveSource,
      canConfirmArrival: withinArrivalGeofence,
    };
  }

  async getLiveState(roomId: string, viewer?: { userId?: string | null } | null) {
    await this.lifecycleService.evaluateRoomLifecycle(roomId, { actorType: 'system', actorId: null });
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
    });
    if (!room) throw new NotFoundException('Room not found');

    const now = new Date();
    const isCreator = !!viewer?.userId && viewer.userId === room.creatorUserId;
    const safetyDelayMs = Math.max(0, (room.safetyDelayMinutes ?? 0) * 60 * 1000);
    const guestCutoff = new Date(now.getTime() - safetyDelayMs);
    // Creators see their own movement immediately. Guests and anonymous polls stay delayed.
    const eventCutoff = isCreator ? now : guestCutoff;
    const viewerVisibleTime = eventCutoff;

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
    const visibleStartTime = isCreator ? room.startTime : room.visibleMovementStartTime ?? room.startTime;
    const viewerShouldStillWait = !!visibleStartTime && now < visibleStartTime;
    const timedProgress = this.buildTimedProgress(room, now);
    const delayedViewer = !isCreator && safetyDelayMs > 0;
    const snapshots = await this.prisma.roomMilestoneSnapshot.findMany({
      where: {
        roomId,
        // Guests only receive snapshots strictly older than the configured safety delay.
        ...(isCreator || safetyDelayMs === 0 ? {} : { capturedAt: { lt: guestCutoff } }),
      },
      orderBy: { checkpointPercent: 'asc' },
      select: {
        checkpointPercent: true,
        etaSeconds: true,
        remainingMeters: true,
        source: true,
        capturedAt: true,
      },
    });
    const visibleSnapshots = snapshots.filter((row) => {
      if (row.source === PROVIDER_ATTEMPT_SOURCE) return false;
      if (isCreator || safetyDelayMs === 0) return true;
      return now.getTime() - row.capturedAt.getTime() > safetyDelayMs;
    });
    const latestSnapshot = visibleSnapshots.length
      ? visibleSnapshots[visibleSnapshots.length - 1]
      : null;
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
        : delayedEvent?.etaMinutes ?? snapshotEtaMinutes ?? (delayedViewer ? null : timedProgress.etaMinutes);
    const liveEtaMinutes =
      room.status === 'live' && derivedEtaMinutes === 0 ? 1 : derivedEtaMinutes;

    const visibleProgress = viewerShouldStillWait ? 0 : delayedEvent?.progressPercentage ??
      (delayedViewer ? latestSnapshot?.checkpointPercent ?? 0 : timedProgress.progressPercentage);
    const milestoneBanner = this.buildMilestoneBanner(visibleProgress);

    // Privacy boundary: viewer-facing live state uses safety-delayed progress and must never expose raw or exact GPS coordinates.
    return {
      roomId: room.roomId,
      status: room.status,
      journeyStatus: room.journeyStatus,
      journeyScheduledStartAt: room.journeyScheduledStartAt?.toISOString() ?? null,
      journeyStartedAt: room.journeyStartedAt?.toISOString() ?? null,
      lastTravellerUpdateAt: room.lastTravellerUpdateAt?.toISOString() ?? null,
      expectedDurationSeconds: delayedViewer ? null : room.expectedDurationSeconds ?? null,
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
      progressPercentage: visibleProgress,
      etaMinutes: viewerShouldStillWait ? null : liveEtaMinutes,
      // Participant-safe milestone ETAs from RoomMilestoneSnapshot only (no coordinates).
      checkpointEtas: this.publicCheckpointEtas(visibleSnapshots),
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

  /**
   * Persist the actual crossed checkpoint. Earlier skipped marks are reconstructed
   * as derived — never stamped with the same Google reading as the current mark.
   * The current provider checkpoint is claimed before any network call. A lost
   * claim or an existing row does not call Google and does not overwrite the owner.
   */
  private async recordCrossedMilestones(input: {
    roomId: string;
    room: {
      startTime: Date | null;
      expectedDurationSeconds: number | null;
      journeyRoute?: { travelMode?: string | null } | null;
    };
    lat: number;
    lng: number;
    capturedAt: Date;
    currentCheckpoint: number;
    earlierMissed: number[];
    destLat: number | null;
    destLng: number | null;
    remainingMeters: number | null;
    billableCallsSoFar: number;
  }): Promise<{ etaSeconds: number; source: string; owned: boolean }> {
    const {
      roomId,
      room,
      lat,
      lng,
      capturedAt,
      currentCheckpoint,
      earlierMissed,
      destLat,
      destLng,
      remainingMeters,
      billableCallsSoFar,
    } = input;

    const captured = await this.captureMilestoneReading({
      roomId,
      checkpoint: currentCheckpoint,
      lat,
      lng,
      capturedAt,
      room,
      destLat,
      destLng,
      remainingMeters,
      billableCallsSoFar,
      existing: null,
    });
    if (!captured.persistCurrent) {
      return { etaSeconds: captured.etaSeconds, source: captured.source, owned: false };
    }
    const currentEtaSeconds = captured.etaSeconds;
    const currentSource = captured.source;
    const currentRemaining = captured.remainingMeters;

    const writes = [];
    for (const checkpoint of earlierMissed) {
      const reconstructed =
        currentCheckpoint === 100
          ? 0
          : currentSource === 'google'
            ? Math.max(
                60,
                Math.round(
                  (currentEtaSeconds * (100 - checkpoint)) / Math.max(1, 100 - currentCheckpoint),
                ),
              )
            : this.deriveEtaSeconds(room, capturedAt, checkpoint);
      const reconstructedRemaining =
        remainingMeters == null
          ? null
          : currentCheckpoint === 100
            ? Math.max(0, Math.round(remainingMeters))
            : Math.round(
                (remainingMeters * (100 - checkpoint)) / Math.max(1, 100 - currentCheckpoint),
              );
      writes.push(
        ...this.milestoneWriteOps({
          roomId,
          checkpoint,
          lat,
          lng,
          capturedAt,
          etaSeconds: reconstructed,
          remainingMeters: reconstructedRemaining,
          source: 'derived',
          preserveExisting: true,
        }),
      );
    }

    writes.push(
      ...this.milestoneWriteOps({
        roomId,
        checkpoint: currentCheckpoint,
        lat,
        lng,
        capturedAt,
        etaSeconds: currentEtaSeconds,
        remainingMeters: currentRemaining,
        source: currentSource,
      }),
    );

    await this.prisma.$transaction(writes);
    return { etaSeconds: currentEtaSeconds, source: currentSource, owned: true };
  }

  /**
   * One provider attempt per room+checkpoint. The unique snapshot insert is the
   * claim and commits before the Google call, so the network request is never
   * held inside a database transaction. A lost claim does not call the provider
   * and does not overwrite the winner. Provider failure is stored as
   * `provider-failed` with a derived ETA and counts toward the five-call cap.
   */
  private async captureMilestoneReading(input: {
    roomId: string;
    checkpoint: number;
    lat: number;
    lng: number;
    capturedAt: Date;
    room: {
      startTime: Date | null;
      expectedDurationSeconds: number | null;
      journeyRoute?: { travelMode?: string | null } | null;
    };
    destLat: number | null;
    destLng: number | null;
    remainingMeters: number | null;
    billableCallsSoFar: number;
    existing: {
      source: string | null;
      etaSeconds: number | null;
      remainingMeters: number | null;
    } | null;
  }): Promise<{
    etaSeconds: number;
    remainingMeters: number | null;
    source: string;
    persistCurrent: boolean;
  }> {
    const {
      roomId,
      checkpoint,
      lat,
      lng,
      capturedAt,
      room,
      destLat,
      destLng,
      remainingMeters,
      billableCallsSoFar,
      existing,
    } = input;
    const derivedSeconds = this.deriveEtaSeconds(room, capturedAt, null);

    if (existing) {
      return {
        etaSeconds: existing.etaSeconds ?? derivedSeconds,
        remainingMeters: existing.remainingMeters ?? remainingMeters,
        source: existing.source === PROVIDER_ATTEMPT_SOURCE ? 'derived' : existing.source ?? 'derived',
        persistCurrent: false,
      };
    }

    if (checkpoint === 100) {
      return {
        etaSeconds: 0,
        remainingMeters: remainingMeters ?? 0,
        source: 'arrived',
        persistCurrent: true,
      };
    }

    if (checkpoint === 90 || !(PROVIDER_ETA_CHECKPOINTS as readonly number[]).includes(checkpoint)) {
      return {
        etaSeconds: derivedSeconds,
        remainingMeters,
        source: 'derived',
        persistCurrent: true,
      };
    }

    if (
      billableCallsSoFar >= MAX_BILLABLE_ETA_CALLS ||
      destLat == null ||
      destLng == null ||
      !this.googleMapsKeyConfigured()
    ) {
      return {
        etaSeconds: derivedSeconds,
        remainingMeters,
        source: billableCallsSoFar >= MAX_BILLABLE_ETA_CALLS ? 'fallback' : 'derived',
        persistCurrent: true,
      };
    }

    const claimed = await this.claimProviderAttempt(roomId, checkpoint, capturedAt);
    if (!claimed) {
      return {
        etaSeconds: derivedSeconds,
        remainingMeters,
        source: 'derived',
        persistCurrent: false,
      };
    }

    try {
      const traffic = await fetchGoogleDurationInTraffic(
        this.configService,
        { latitude: lat, longitude: lng },
        { latitude: destLat, longitude: destLng },
        room.journeyRoute?.travelMode ?? undefined,
      );
      if (!traffic) {
        return {
          etaSeconds: derivedSeconds,
          remainingMeters,
          source: PROVIDER_FAILED_SOURCE,
          persistCurrent: true,
        };
      }
      return {
        etaSeconds: traffic.durationInTrafficSeconds,
        remainingMeters: traffic.distanceMeters,
        source: 'google',
        persistCurrent: true,
      };
    } catch {
      return {
        etaSeconds: derivedSeconds,
        remainingMeters,
        source: PROVIDER_FAILED_SOURCE,
        persistCurrent: true,
      };
    }
  }

  private async claimProviderAttempt(roomId: string, checkpoint: number, capturedAt: Date) {
    try {
      await this.prisma.roomMilestoneSnapshot.create({
        data: {
          roomId,
          checkpointPercent: checkpoint,
          capturedAt,
          etaSeconds: null,
          remainingMeters: null,
          source: PROVIDER_ATTEMPT_SOURCE,
        },
      });
      return true;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) return false;
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }

  private googleMapsKeyConfigured() {
    const read = (key: string) => this.configService.get<string>(key)?.trim();
    return Boolean(
      read('GOOGLE_DIRECTIONS_API_KEY') || read('GOOGLE_MAPS_API_KEY') || read('GOOGLE_PLACES_API_KEY'),
    );
  }

  private milestoneWriteOps(input: {
    roomId: string;
    checkpoint: number;
    lat: number;
    lng: number;
    capturedAt: Date;
    etaSeconds: number;
    remainingMeters: number | null;
    source: string;
    preserveExisting?: boolean;
  }) {
    const { roomId, checkpoint, lat, lng, capturedAt, etaSeconds, remainingMeters, source } = input;
    return [
      this.prisma.roomCheckpoint.upsert({
        where: { roomId_checkpoint: { roomId, checkpoint } },
        update: input.preserveExisting ? {} : { lat, lng, capturedAt, etaSeconds, source },
        create: { roomId, checkpoint, lat, lng, capturedAt, etaSeconds, source },
      }),
      this.prisma.roomMilestoneSnapshot.upsert({
        where: { roomId_checkpointPercent: { roomId, checkpointPercent: checkpoint } },
        update: input.preserveExisting ? {} : { capturedAt, etaSeconds, remainingMeters, source },
        create: {
          roomId,
          checkpointPercent: checkpoint,
          capturedAt,
          etaSeconds,
          remainingMeters,
          source,
        },
      }),
    ];
  }

  private deriveEtaSeconds(
    room: { startTime: Date | null; expectedDurationSeconds: number | null },
    capturedAt: Date,
    _checkpoint: number | null,
  ) {
    const timed = this.buildTimedProgress({ status: 'live', ...room }, capturedAt);
    if (timed.etaMinutes == null) return 60;
    return Math.max(0, timed.etaMinutes * 60);
  }

  private publicCheckpointEtas(
    snapshots: Array<{
      checkpointPercent: number;
      etaSeconds: number | null;
      remainingMeters: number | null;
      source: string | null;
      capturedAt: Date;
    }>,
  ) {
    const out: Record<
      string,
      {
        checkpoint: number;
        etaSeconds: number | null;
        etaMinutes: number | null;
        remainingMeters: number | null;
        source: string | null;
        capturedAt: string;
      }
    > = {};
    for (const row of snapshots) {
      out[String(row.checkpointPercent)] = {
        checkpoint: row.checkpointPercent,
        etaSeconds: row.etaSeconds,
        etaMinutes:
          row.etaSeconds == null ? null : Math.max(0, Math.ceil(row.etaSeconds / 60)),
        remainingMeters: row.remainingMeters,
        source: row.source,
        capturedAt: row.capturedAt.toISOString(),
      };
    }
    return out;
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
