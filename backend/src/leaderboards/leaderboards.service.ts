import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_PUBLIC_USER_SELECT, safePublicUser } from '../common/utils/safe-user-select';
import { distanceMeters } from '../common/utils/geo';

type CheckpointBoard =
  | { available: false; checkpoint: number; reason: 'predictions_open' | 'not_reached' | 'insufficient_data' }
  | {
      available: true;
      checkpoint: number;
      basis: 'eta_reread' | 'gps' | 'pace_fallback' | 'plan_fallback';
      projectedArrivalAt: string;
      capturedAt: string;
      standings: Array<{
        rank: number;
        user: ReturnType<typeof safePublicUser>;
        userId: string;
        predictedReachedTime: string;
        diffSeconds: number;
        isCurrentUser: boolean;
      }>;
    };

const toNum = (value: unknown): number | null =>
  value == null ? null : Number(value);

@Injectable()
export class LeaderboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async roomLeaderboard(roomId: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
    });
    if (!room) throw new NotFoundException('Room not found');

    const results = await this.prisma.roomResult.findMany({
      where: { roomId },
      include: { user: { select: SAFE_PUBLIC_USER_SELECT } },
      orderBy: [{ overallRank: 'asc' }, { totalRoomAura: 'desc' }],
    });

    return results.map((result) => ({
      user: safePublicUser(result.user),
      userId: result.user.userId,
      name: result.user.prediktHandle ? `@${result.user.prediktHandle}` : result.user.name,
      prediktHandle: result.user.prediktHandle,
      overallRank: result.overallRank,
      totalRoomAura: result.totalRoomAura,
      milestonesWon: result.milestonesWon,
      auraEarned: result.totalRoomAura,
    }));
  }

  /**
   * Provisional standings at the 50% / 80% journey checkpoint. Ranks each
   * locked-in prediction by how close it is to a projected arrival derived from
   * the traveller's real GPS pace so far. Awards nothing — real Aura is still
   * granted only at room end (scoreMilestone / finalizeRoom).
   */
  async checkpointLeaderboard(
    roomId: string,
    checkpoint: number,
    requestingUser: User,
  ): Promise<CheckpointBoard> {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: {
        journeyRoute: true,
        checkpoints: true,
        milestones: { where: { milestoneType: 'final_destination' } },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    // Private-room gating mirrors PredictionsService.listMilestonePredictions.
    if (room.visibility === 'private') {
      const membership = await this.prisma.roomMembership.findUnique({
        where: { roomId_userId: { roomId, userId: requestingUser.userId } },
      });
      if (room.creatorUserId !== requestingUser.userId && membership?.status !== 'joined') {
        throw new ForbiddenException('Join this room to view standings.');
      }
    }

    // Fairness: never reveal peer prediction values while the room is still open.
    if (room.status === 'predictions_open') {
      return { available: false, checkpoint, reason: 'predictions_open' };
    }

    const cp = room.checkpoints.find((c) => c.checkpoint === checkpoint);
    if (!cp) {
      return { available: false, checkpoint, reason: 'not_reached' };
    }

    const projected = this.projectArrival(room, cp, checkpoint);
    if (!projected) {
      return { available: false, checkpoint, reason: 'insufficient_data' };
    }

    const finalMilestoneIds = room.milestones.map((m) => m.milestoneId);
    const predictions = await this.prisma.milestonePrediction.findMany({
      where: {
        roomId,
        revokedAt: null,
        ...(finalMilestoneIds.length ? { milestoneId: { in: finalMilestoneIds } } : {}),
      },
      include: { user: { select: SAFE_PUBLIC_USER_SELECT } },
    });

    const ranked = predictions
      .map((p) => ({
        p,
        diffSeconds: Math.round(
          Math.abs(p.predictedReachedTime.getTime() - projected.arrival.getTime()) / 1000,
        ),
      }))
      // Closest to the projected arrival wins; earliest submission breaks ties
      // (same rule as scoreMilestone at room end).
      .sort((a, b) =>
        a.diffSeconds !== b.diffSeconds
          ? a.diffSeconds - b.diffSeconds
          : a.p.submittedAt.getTime() - b.p.submittedAt.getTime(),
      );

    return {
      available: true,
      checkpoint,
      basis: projected.basis,
      projectedArrivalAt: projected.arrival.toISOString(),
      capturedAt: cp.capturedAt.toISOString(),
      standings: ranked.map((entry, index) => ({
        rank: index + 1,
        user: safePublicUser(entry.p.user),
        userId: entry.p.userId,
        predictedReachedTime: entry.p.predictedReachedTime.toISOString(),
        diffSeconds: entry.diffSeconds,
        isCurrentUser: entry.p.userId === requestingUser.userId,
      })),
    };
  }

  /**
   * Live room-wide leaderboard for the LiveRoom screen (polled every 5s). Ranks
   * every locked-in prediction against the current best projected arrival, which is
   * recomputed as milestones cross (latest RoomMilestoneSnapshot ETA, else GPS/pace
   * fallback). NEVER surfaces standings before predictionsLockedAt — that would let
   * a late guesser reverse-engineer peers' predictions. Awards nothing (real Aura is
   * still granted only at room end).
   */
  async liveLeaderboard(roomId: string, requestingUser: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: {
        journeyRoute: true,
        checkpoints: true,
        milestoneSnapshots: { orderBy: [{ checkpointPercent: 'desc' }, { capturedAt: 'desc' }] },
        milestones: { where: { milestoneType: 'final_destination' } },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    if (room.visibility === 'private') {
      const membership = await this.prisma.roomMembership.findUnique({
        where: { roomId_userId: { roomId, userId: requestingUser.userId } },
      });
      if (room.creatorUserId !== requestingUser.userId && membership?.status !== 'joined') {
        throw new ForbiddenException('Join this room to view standings.');
      }
    }

    // Privacy boundary: the live leaderboard is hidden until predictions lock.
    if (!room.predictionsLockedAt) {
      return { revealed: false as const, reason: 'not_locked' as const, standings: [] };
    }

    // Current best projected arrival: prefer the freshest milestone snapshot ETA,
    // then the checkpoint-based projection, then the static plan.
    const latestSnapshot = room.milestoneSnapshots[0];
    let projectedArrival: Date | null = null;
    let basis: 'snapshot_eta' | 'checkpoint' | 'plan' = 'plan';
    if (latestSnapshot?.etaSeconds != null) {
      projectedArrival = new Date(latestSnapshot.capturedAt.getTime() + latestSnapshot.etaSeconds * 1000);
      basis = 'snapshot_eta';
    } else {
      const latestCp = [...room.checkpoints].sort((a, b) => b.checkpoint - a.checkpoint)[0];
      const projected = latestCp ? this.projectArrival(room, latestCp, latestCp.checkpoint) : null;
      if (projected) {
        projectedArrival = projected.arrival;
        basis = 'checkpoint';
      } else if (room.startTime && room.expectedDurationSeconds) {
        projectedArrival = new Date(room.startTime.getTime() + room.expectedDurationSeconds * 1000);
        basis = 'plan';
      }
    }
    if (!projectedArrival) {
      return { revealed: false as const, reason: 'insufficient_data' as const, standings: [] };
    }

    const finalMilestoneIds = room.milestones.map((m) => m.milestoneId);
    const predictions = await this.prisma.milestonePrediction.findMany({
      where: {
        roomId,
        revokedAt: null,
        ...(finalMilestoneIds.length ? { milestoneId: { in: finalMilestoneIds } } : {}),
      },
      include: { user: { select: SAFE_PUBLIC_USER_SELECT } },
    });

    const ranked = predictions
      .map((p) => ({
        p,
        diffSeconds: Math.round(
          Math.abs(p.predictedReachedTime.getTime() - projectedArrival!.getTime()) / 1000,
        ),
      }))
      .sort((a, b) =>
        a.diffSeconds !== b.diffSeconds
          ? a.diffSeconds - b.diffSeconds
          : a.p.submittedAt.getTime() - b.p.submittedAt.getTime(),
      );

    // Winner-eligibility must match end-of-room scoreMilestone: the creator's own
    // guess (they confirm their own arrival) and Late-tier guesses are recorded and
    // shown, but cannot win. "Winner so far" is the top ELIGIBLE prediction, and
    // deltas are measured from that eligible leader — never from an excluded entry.
    const creatorId = room.creatorUserId;
    const isEligible = (e: (typeof ranked)[number]) =>
      e.p.auraEligible !== false && e.p.userId !== creatorId;
    const firstEligibleIdx = ranked.findIndex(isEligible);
    const bestEligibleDiff = firstEligibleIdx >= 0 ? ranked[firstEligibleIdx].diffSeconds : null;

    return {
      revealed: true as const,
      basis,
      projectedArrivalAt: projectedArrival.toISOString(),
      capturedAt: (latestSnapshot?.capturedAt ?? room.lastTravellerUpdateAt ?? new Date()).toISOString(),
      standings: ranked.map((entry, index) => {
        const isHost = entry.p.userId === creatorId;
        const eligibleToWin = isEligible(entry);
        return {
          rank: index + 1,
          isWinnerSoFar: index === firstEligibleIdx,
          eligibleToWin,
          isHost,
          user: safePublicUser(entry.p.user),
          userId: entry.p.userId,
          prediktHandle: entry.p.user.prediktHandle,
          predictedReachedTime: entry.p.predictedReachedTime.toISOString(),
          // Delta from the eligible leader: 0 for that leader, positive for others.
          deltaFromBestSeconds:
            bestEligibleDiff != null ? entry.diffSeconds - bestEligibleDiff : 0,
          diffFromProjectedSeconds: entry.diffSeconds,
          hotTake: entry.p.hotTake ?? null,
          auraEligible: entry.p.auraEligible,
          isCurrentUser: entry.p.userId === requestingUser.userId,
        };
      }),
    };
  }

  /**
   * Projects the real arrival time at a checkpoint. Preferred basis: observed
   * GPS speed (distance covered / elapsed) applied to the straight-line
   * distance remaining to the destination. Falls back to pace-time
   * extrapolation, then to the static planned duration.
   */
  private projectArrival(
    room: any,
    cp: { lat: number; lng: number; capturedAt: Date; checkpoint: number; etaSeconds?: number | null },
    checkpoint: number,
  ): { arrival: Date; basis: 'eta_reread' | 'gps' | 'pace_fallback' | 'plan_fallback' } | null {
    // v2: prefer the ETA re-read captured at this checkpoint (the traveller's real
    // remaining time), when present. Legacy 0/50/80/100 rows have no etaSeconds.
    const etaSeconds = toNum(cp.etaSeconds);
    if (etaSeconds != null && etaSeconds >= 0) {
      return { arrival: new Date(cp.capturedAt.getTime() + etaSeconds * 1000), basis: 'eta_reread' };
    }

    const destLat = toNum(room.destinationLat) ?? toNum(room.journeyRoute?.destinationLat);
    const destLng = toNum(room.destinationLng) ?? toNum(room.journeyRoute?.destinationLng);

    const startCp = room.checkpoints.find((c: any) => c.checkpoint === 0);
    const startLat = toNum(startCp?.lat) ?? toNum(room.journeyRoute?.startLat);
    const startLng = toNum(startCp?.lng) ?? toNum(room.journeyRoute?.startLng);
    const startTime: Date | null = startCp?.capturedAt ?? room.startTime ?? null;

    // GPS basis: derive the traveller's real speed from the leg completed so far.
    if (destLat != null && destLng != null && startLat != null && startLng != null && startTime) {
      const elapsedSeconds = (cp.capturedAt.getTime() - startTime.getTime()) / 1000;
      const covered = distanceMeters(startLat, startLng, cp.lat, cp.lng);
      const remaining = distanceMeters(cp.lat, cp.lng, destLat, destLng);
      if (elapsedSeconds > 0 && covered > 0) {
        const speed = covered / elapsedSeconds; // metres/second
        const etaSeconds = remaining / speed;
        return { arrival: new Date(cp.capturedAt.getTime() + etaSeconds * 1000), basis: 'gps' };
      }
    }

    // Pace fallback: extrapolate total time from the elapsed fraction.
    if (room.startTime) {
      const elapsedMs = cp.capturedAt.getTime() - new Date(room.startTime).getTime();
      if (elapsedMs > 0) {
        const totalMs = elapsedMs / (checkpoint / 100);
        return { arrival: new Date(new Date(room.startTime).getTime() + totalMs), basis: 'pace_fallback' };
      }
    }

    // Last resort: the original planned arrival.
    if (room.startTime && room.expectedDurationSeconds) {
      return {
        arrival: new Date(new Date(room.startTime).getTime() + room.expectedDurationSeconds * 1000),
        basis: 'plan_fallback',
      };
    }
    return null;
  }

  async weeklyLeaderboard() {
    const users = await this.prisma.user.findMany({
      where: { weeklyAura: { gt: 0 } },
      orderBy: { weeklyAura: 'desc' },
      take: 50,
      select: SAFE_PUBLIC_USER_SELECT,
    });
    return users.map((user, index) => ({
      rank: index + 1,
      ...safePublicUser(user),
      weeklyAura: user.weeklyAura,
      totalAura: user.totalAura,
    }));
  }
}
