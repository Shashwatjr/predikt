import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { UpdateActivePredictionsOrderDto } from './dto/update-active-predictions-order.dto';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { ClearActivePredictionsDto } from './dto/clear-active-predictions.dto';
import { RewardReason } from '../rewards/reward.constants';
import { RewardService } from '../rewards/reward.service';

const DAILY_SPIN_REWARDS = [
  { rewardType: 'AURA', rewardValue: 10, label: '+10 Aura', reasonCode: RewardReason.AURA_ADMIN_ADJUSTMENT },
  { rewardType: 'AURA', rewardValue: 25, label: '+25 Aura', reasonCode: RewardReason.AURA_ADMIN_ADJUSTMENT },
  { rewardType: 'RIZZ', rewardValue: 5, label: '+5 Rizz', reasonCode: RewardReason.RIZZ_ADMIN_ADJUSTMENT },
  { rewardType: 'GEMS', rewardValue: 10, label: '+10 Gems', reasonCode: RewardReason.GEM_ADMIN_ADJUSTMENT },
  { rewardType: 'GEMS', rewardValue: 20, label: '+20 Gems', reasonCode: RewardReason.GEM_ADMIN_ADJUSTMENT },
  { rewardType: 'streak_shield', rewardValue: null, label: 'Streak Shield' },
  { rewardType: 'profile_boost', rewardValue: null, label: 'Profile Boost' },
  { rewardType: 'better_luck_tomorrow', rewardValue: null, label: 'Better Luck Tomorrow' },
] as const;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type ActivePredictionRoom = Prisma.PredictionRoomGetPayload<{
  include: {
    creator: { select: { userId: true } };
    journeyRoute: true;
    results: {
      orderBy: { overallRank: 'asc' };
      take: 1;
      include: {
        user: {
          select: {
            name: true;
            prediktHandle: true;
          };
        };
      };
    };
    milestonePredictions: {
      select: {
        userId: true;
        predictedReachedTime: true;
        revokedAt: true;
      };
    };
    locationEvents: {
      orderBy: { createdAt: 'desc' };
      take: 1;
      select: {
        progressPercentage: true;
        etaMinutes: true;
        createdAt: true;
      };
    };
    roomPreferences: true;
    roomMemberships: true;
  };
}>;

function roundApproximateProgress(progress: number) {
  const clamped = Math.max(0, Math.min(100, progress));
  return Math.round(clamped / 5) * 5;
}

function formatEtaTime(date: Date | null) {
  return date
    ? date.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;
}

function formatMinutesLabel(totalMinutes: number | null) {
  if (totalMinutes === null) return null;
  if (totalMinutes <= 1) return 'Less than a minute';
  if (totalMinutes < 60) return `${totalMinutes} min left`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m left` : `${hours}h left`;
}

function progressStatusLabel(progress: number, roomStatus: string) {
  if (roomStatus === 'completed') return 'Result ready';
  // Live rooms at 0% are delayed-start / privacy hold — not "Not started".
  if (roomStatus === 'live' && progress <= 0) return 'Journey underway';
  if (progress <= 0) return 'Not started';
  if (progress <= 20) return 'Journey underway';
  if (progress <= 40) return 'Making progress';
  if (progress <= 60) return 'Past halfway';
  if (progress <= 80) return 'Getting close';
  if (progress <= 90) return 'Nearly there';
  return 'Arrived';
}

function publicWinnerName(result: { user: { name: string | null; prediktHandle: string | null } } | undefined) {
  if (!result) return null;
  return result.user.prediktHandle ? `@${result.user.prediktHandle.replace(/^@/, '')}` : result.user.name;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycleService: LifecycleService,
    private readonly rewardService: RewardService,
  ) {}

  async summary(user: User) {
    const followingIds = await this.getFollowingIds(user.userId);
    const leaderboard = await this.getFollowingLeaderboardData(user.userId, followingIds);
    const currentIndex = leaderboard.findIndex((entry) => entry.userId === user.userId);

    return {
      welcomeMessage: `Welcome back, ${user.prediktHandle ? `@${user.prediktHandle}` : user.name}.`,
      name: user.name,
      prediktHandle: user.prediktHandle,
      totalAura: user.totalAura,
      weeklyAura: user.weeklyAura,
      currentStreak: user.currentStreak,
      rankAmongFollowing: currentIndex >= 0 ? currentIndex + 1 : null,
      motivationalLine:
        currentIndex > 0
          ? 'A little more Aura will move you up the board.'
          : "You're ready to make your next prediction.",
    };
  }

  async followingLeaderboard(user: User) {
    const followingIds = await this.getFollowingIds(user.userId);
    const leaderboard = await this.getFollowingLeaderboardData(user.userId, followingIds);
    return leaderboard.map((entry, index, all) => {
      const previous = all[index - 1];
      const next = all[index + 1];
      const trend = previous
        ? entry.weeklyAura > previous.weeklyAura
          ? 'up'
          : entry.weeklyAura < previous.weeklyAura
            ? 'down'
            : 'same'
        : next
          ? 'same'
          : 'same';
      return {
        rank: index + 1,
        ...entry,
        trend,
        isCurrentUser: entry.userId === user.userId,
      };
    });
  }

  async recommendations(user: User) {
    const leaderboard = await this.followingLeaderboard(user);
    const personAhead = leaderboard.find(
      (entry) => entry.rank && entry.rank > 0 && !entry.isCurrentUser && entry.weeklyAura > user.weeklyAura,
    );
    const recommendations = [];
    if (personAhead) {
      recommendations.push(`Earn ${personAhead.weeklyAura - user.weeklyAura + 1} more Aura to overtake ${personAhead.prediktHandle ? `@${personAhead.prediktHandle}` : personAhead.name}.`);
    }
    recommendations.push('Join 1 active room to build Aura and earn Gems.');
    recommendations.push('Predict all milestones in a room to boost your score.');
    if (!user.prediktHandle) {
      recommendations.push('Set your PREDIKT handle to appear on leaderboards.');
    }
    return { recommendations };
  }

  async activeRooms(user: User) {
    const followingIds = await this.getFollowingIds(user.userId);
    const rooms = await this.prisma.predictionRoom.findMany({
      where: { status: { in: ['predictions_open', 'live'] } },
      include: {
        creator: { select: { userId: true, name: true, prediktHandle: true } },
        milestonePredictions: true,
        roomMemberships: {
          where: { status: 'joined' },
          select: { userId: true },
        },
      },
      orderBy: [{ predictionCloseTime: 'asc' }, { createdAt: 'desc' }],
      take: 12,
    });

    return rooms.map((room) => ({
      roomId: room.roomId,
      roomTitle: room.roomTitle,
      status: room.status,
      answerType: room.answerType,
      startingPointLabel: room.startingPointLabel,
      destinationLabel: room.destinationLabel,
      category: room.roomCategory,
      creatorName: room.creator.prediktHandle ? `@${room.creator.prediktHandle}` : room.creator.name,
      creatorUserId: room.creator.userId,
      participantCount: new Set([
        ...room.roomMemberships.map((membership) => membership.userId),
        ...room.milestonePredictions.map((prediction) => prediction.userId),
      ]).size,
      predictionCloseTime: room.predictionCloseTime,
      potentialAuraLabel: room.roomCategory === 'ai_vs_human' ? 'High Aura' : 'Steady Aura',
      cta: room.status === 'predictions_open' ? 'Predict Now' : 'Watch',
      isFollowedCreator: followingIds.includes(room.creator.userId),
      isSponsored: room.isSponsored,
    }));
  }

  async activePredictions(user: User) {
    const rooms = await this.prisma.predictionRoom.findMany({
      where: {
        status: { in: ['predictions_open', 'predictions_locked', 'live', 'completed'] },
        OR: [
          { creatorUserId: user.userId },
          { roomMemberships: { some: { userId: user.userId, status: 'joined' } } },
        ],
      },
      include: {
        creator: { select: { userId: true } },
        journeyRoute: true,
        results: {
          orderBy: { overallRank: 'asc' },
          take: 1,
          include: {
            user: {
              select: {
                name: true,
                prediktHandle: true,
              },
            },
          },
        },
        milestonePredictions: {
          select: {
            userId: true,
            predictedReachedTime: true,
            revokedAt: true,
          },
        },
        locationEvents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            progressPercentage: true,
            etaMinutes: true,
            createdAt: true,
          },
        },
        roomPreferences: {
          where: { userId: user.userId },
        },
        roomMemberships: {
          where: { status: 'joined' },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    await Promise.all(
      rooms.map((room) =>
        this.lifecycleService.evaluateRoomLifecycle(room.roomId, {
          actorType: 'system',
          actorId: null,
        }),
      ),
    );

    const refreshedRooms = await this.prisma.predictionRoom.findMany({
      where: {
        roomId: { in: rooms.map((room) => room.roomId) },
      },
      include: {
        creator: { select: { userId: true } },
        journeyRoute: true,
        results: {
          orderBy: { overallRank: 'asc' },
          take: 1,
          include: {
            user: {
              select: {
                name: true,
                prediktHandle: true,
              },
            },
          },
        },
        milestonePredictions: {
          select: {
            userId: true,
            predictedReachedTime: true,
            revokedAt: true,
          },
        },
        locationEvents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            progressPercentage: true,
            etaMinutes: true,
            createdAt: true,
          },
        },
        roomPreferences: {
          where: { userId: user.userId },
        },
        roomMemberships: {
          where: { status: 'joined' },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return refreshedRooms
      .filter((room) => !room.roomPreferences[0]?.hiddenFromDashboard)
      .map((room, index) => this.buildActivePredictionCard(room, user.userId, index))
      .sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
        if (left.displayOrder !== right.displayOrder) return left.displayOrder - right.displayOrder;
        return new Date(right.liveProgress.lastUpdatedAt ?? 0).getTime() - new Date(left.liveProgress.lastUpdatedAt ?? 0).getTime();
      });
  }

  async updateActivePredictionsOrder(user: User, dto: UpdateActivePredictionsOrderDto) {
    const roomIds = dto.items.map((item) => item.roomId);
    if (!roomIds.length) {
      return { success: true, items: [] };
    }

    const visibleRooms = await this.prisma.predictionRoom.findMany({
      where: {
        roomId: { in: roomIds },
        OR: [
          { creatorUserId: user.userId },
          { roomMemberships: { some: { userId: user.userId, status: 'joined' } } },
        ],
      },
      select: { roomId: true },
    });

    if (visibleRooms.length !== roomIds.length) {
      throw new ForbiddenException('You can only reorder rooms you created or joined.');
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.userRoomPreference.upsert({
          where: {
            userId_roomId: {
              userId: user.userId,
              roomId: item.roomId,
            },
          },
          create: {
            userId: user.userId,
            roomId: item.roomId,
            displayOrder: item.displayOrder,
            pinned: item.pinned,
          },
          update: {
            displayOrder: item.displayOrder,
            pinned: item.pinned,
          },
        }),
      ),
    );

    return { success: true, items: dto.items };
  }

  async clearActivePredictions(user: User, dto: ClearActivePredictionsDto) {
    const visibleRooms = await this.prisma.predictionRoom.findMany({
      where: {
        status: { in: ['predictions_open', 'predictions_locked', 'live', 'completed'] },
        OR: [
          { creatorUserId: user.userId },
          { roomMemberships: { some: { userId: user.userId, status: 'joined' } } },
        ],
      },
      select: { roomId: true },
    });

    if (!visibleRooms.length) {
      return { success: true, clearedCount: 0 };
    }

    await this.prisma.$transaction(
      visibleRooms.map((room, index) =>
        this.prisma.userRoomPreference.upsert({
          where: {
            userId_roomId: {
              userId: user.userId,
              roomId: room.roomId,
            },
          },
          create: {
            userId: user.userId,
            roomId: room.roomId,
            displayOrder: index,
            pinned: false,
            hiddenFromDashboard: true,
          },
          update: {
            pinned: false,
            hiddenFromDashboard: true,
          },
        }),
      ),
    );

    return {
      success: true,
      clearedCount: visibleRooms.length,
      reason: dto.reason?.trim() || null,
    };
  }

  async dailyChallenge(user: User) {
    return {
      challengeId: 'daily-challenge-001',
      title: 'Daily Milestone Streak',
      description: 'Submit predictions in one active room today.',
      progress: Math.min(user.predictionsMadeCount, 1),
      target: 1,
      rewardAura: 25,
      status: user.predictionsMadeCount > 0 ? 'in_progress' : 'not_started',
    };
  }

  async dailySpin(user: User) {
    const claim = await this.prisma.dailySpinClaim.findUnique({
      where: {
        userId_claimDate: {
          userId: user.userId,
          claimDate: todayKey(),
        },
      },
    });

    return {
      canClaim: !claim,
      lastClaim: claim,
      rewardPool: DAILY_SPIN_REWARDS.map((reward) => reward.label),
      disclaimer: 'Virtual rewards only.',
    };
  }

  async claimDailySpin(user: User) {
    const existing = await this.prisma.dailySpinClaim.findUnique({
      where: {
        userId_claimDate: {
          userId: user.userId,
          claimDate: todayKey(),
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Daily spin already claimed today.');
    }

    const reward = DAILY_SPIN_REWARDS[user.userId.charCodeAt(0) % DAILY_SPIN_REWARDS.length];
    const claim = await this.prisma.dailySpinClaim.create({
      data: {
        userId: user.userId,
        rewardType: reward.rewardType,
        rewardValue: reward.rewardValue,
        claimDate: todayKey(),
      },
    });

    if (
      reward.rewardType !== 'streak_shield' &&
      reward.rewardType !== 'profile_boost' &&
      reward.rewardType !== 'better_luck_tomorrow' &&
      reward.rewardValue
    ) {
      await this.rewardService.grant({
        userId: user.userId,
        rewardType: reward.rewardType,
        reasonCode: reward.reasonCode,
        amount: reward.rewardValue,
        sourceType: 'daily_spin',
        sourceId: claim.spinClaimId,
        idempotencyKey: `daily_spin:${claim.spinClaimId}`,
        metadata: { label: reward.label, claimDate: claim.claimDate },
      });
    }

    return {
      ...claim,
      rewardLabel: reward.label,
      disclaimer: 'Virtual rewards only.',
    };
  }

  async dropsNearUnlock(_user: User) {
    return [];
  }

  async activityFeed(user: User) {
    const followingIds = await this.getFollowingIds(user.userId);
    const events = await this.prisma.activityEvent.findMany({
      where: {
        OR: [
          { userId: user.userId },
          { userId: { in: followingIds } },
        ],
      },
      include: {
        user: { select: { name: true, prediktHandle: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    if (events.length === 0) {
      return [
        {
          activityEventId: 'starter',
          message: 'Create your first room and invite friends.',
          eventType: 'starter_tip',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return events.map((event) => ({
      activityEventId: event.activityEventId,
      eventType: event.eventType,
      message: event.message,
      actor: event.user?.prediktHandle ? `@${event.user.prediktHandle}` : event.user?.name ?? 'PREDIKT user',
      createdAt: event.createdAt,
    }));
  }

  async suggestedFollows(user: User) {
    const followingIds = await this.getFollowingIds(user.userId);
    const users = await this.prisma.user.findMany({
      where: {
        NOT: [
          { userId: user.userId },
          { userId: { in: followingIds } },
        ],
      },
      include: { creatorProfile: true, followers: true },
      orderBy: [{ weeklyAura: 'desc' }, { winsCount: 'desc' }],
      take: 8,
    });

    return users.map((entry) => ({
      userId: entry.userId,
      name: entry.name,
      prediktHandle: entry.prediktHandle,
      category: entry.creatorProfile?.creatorCategory ?? 'predictor',
      followerCount: entry.followers.length,
    }));
  }

  private async getFollowingIds(userId: string) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    return following.map((entry) => entry.followingId);
  }

  private async getFollowingLeaderboardData(userId: string, followingIds: string[]) {
    const ids = Array.from(new Set([userId, ...followingIds]));
    return this.prisma.user.findMany({
      where: { userId: { in: ids } },
      orderBy: [{ weeklyAura: 'desc' }, { winsCount: 'desc' }],
      select: {
        userId: true,
        name: true,
        prediktHandle: true,
        weeklyAura: true,
        winsCount: true,
      },
    });
  }

  private buildActivePredictionCard(room: ActivePredictionRoom, userId: string, fallbackOrder: number) {
    const preference = room.roomPreferences[0];
    const membership = room.roomMemberships.find((entry) => entry.userId === userId);
    const participantIds = new Set([
      ...room.roomMemberships.map((entry) => entry.userId),
      ...room.milestonePredictions.map((prediction) => prediction.userId),
    ]);
    const userPredictions = room.milestonePredictions.filter(
      (prediction) => prediction.userId === userId && !prediction.revokedAt,
    );
    const liveProgress = this.buildLiveProgress(room, userPredictions);
    const normalizedStatus = room.status === 'completed' ? 'result_ready' : room.status;
    const winner = room.results?.[0];
    const completionTime = room.actualEndTime ?? room.arrivalConfirmedAt ?? room.updatedAt;

    return {
      roomId: room.roomId,
      inviteCode: room.inviteCode,
      title: room.roomTitle,
      question: room.eventType,
      roomType: room.roomType,
      roomMode: room.roomType,
      status: normalizedStatus,
      answerType: room.answerType,
      visibility: room.visibility,
      isCreator: room.creatorUserId === userId,
      userRole: membership?.role ?? (room.creatorUserId === userId ? 'creator' : 'participant'),
      participantCount: participantIds.size,
      hasSubmittedPrediction: userPredictions.length > 0,
      predictionsLocked: room.status !== 'predictions_open',
      lockTime: room.lockTime ?? room.predictionCloseTime,
      resultDeadline: room.resultDeadline,
      journeyStatus: room.journeyStatus,
      selectedBackgroundKey: room.selectedBackground,
      selectedRoomTheme: room.selectedRoomTheme,
      routeSummary: room.journeyRoute
        ? {
            startLabel: room.journeyRoute.startLabel,
            destinationLabel: room.journeyRoute.destinationLabel,
            travelMode: room.journeyRoute.travelMode,
          }
        : {
            startLabel: room.startingPointLabel,
            destinationLabel: room.destinationLabel,
            travelMode: 'custom',
          },
      winnerName: publicWinnerName(winner),
      completedAt: completionTime?.toISOString?.() ?? null,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      liveProgress,
      quickAction: this.buildQuickAction(
        normalizedStatus,
        room.journeyStatus,
        userPredictions.length > 0,
        room.creatorUserId === userId,
        room.category ?? room.templateKey ?? null,
      ),
      pinned: preference?.pinned ?? false,
      displayOrder: preference?.displayOrder ?? fallbackOrder,
    };
  }

  private buildLiveProgress(
    room: ActivePredictionRoom,
    userPredictions: Array<{ predictedReachedTime: Date; userId: string; revokedAt: Date | null }>,
  ) {
    const latestEvent = room.locationEvents[0];
    const estimatedDurationSeconds = room.journeyRoute?.estimatedDurationSeconds ?? null;
    // Align with live-progress: don't clock progress from createdAt before start,
    // and zero while the privacy-delayed visible start hasn't arrived.
    const visibleStartTime = room.visibleMovementStartTime ?? room.startTime;
    const now = Date.now();
    const waitingForDelayedStart = !!visibleStartTime && now < visibleStartTime.getTime();
    const progressStartTime = room.startTime ?? room.plannedStartTime;
    const elapsedSeconds =
      progressStartTime && !waitingForDelayedStart
        ? Math.max(0, Math.round((now - progressStartTime.getTime()) / 1000))
        : 0;
    const timedProgress =
      !waitingForDelayedStart && progressStartTime && estimatedDurationSeconds && estimatedDurationSeconds > 0
        ? (elapsedSeconds / estimatedDurationSeconds) * 100
        : 0;
    const rawProgress = waitingForDelayedStart
      ? 0
      : latestEvent?.progressPercentage ?? timedProgress;
    const progressPercentApprox =
      room.status === 'completed' ? 100 : roundApproximateProgress(rawProgress);
    const etaMinutes =
      room.status === 'completed'
        ? 0
        : waitingForDelayedStart
          ? null
          : latestEvent?.etaMinutes ??
            (estimatedDurationSeconds && progressStartTime
              ? Math.max(0, Math.round((estimatedDurationSeconds - elapsedSeconds) / 60))
              : null);
    const etaDate = etaMinutes !== null ? new Date(Date.now() + etaMinutes * 60_000) : null;
    const myPrediction = userPredictions[0]?.predictedReachedTime ?? null;

    return {
      statusLabel: progressStatusLabel(progressPercentApprox, room.status),
      progressPercentApprox,
      etaLabel: etaMinutes !== null ? 'Approx. ETA' : 'Estimated ETA pending',
      etaTime: formatEtaTime(etaDate),
      etaVsMyPredictionLabel:
        myPrediction && etaDate
          ? this.buildEtaVsPredictionLabel(etaDate, myPrediction)
          : userPredictions.length
            ? 'Prediction submitted'
            : 'Needs your prediction',
      timeToDestinationLabel: formatMinutesLabel(etaMinutes),
      lastUpdatedAt: latestEvent?.createdAt?.toISOString() ?? room.updatedAt.toISOString(),
      confidenceLevel: room.confidenceLevel ?? 'approximate',
      lifecycleLabel: this.buildLifecycleLabel(room),
    };
  }

  private buildEtaVsPredictionLabel(etaDate: Date, predictionDate: Date) {
    const diffMinutes = Math.round((etaDate.getTime() - predictionDate.getTime()) / 60_000);
    if (Math.abs(diffMinutes) <= 2) return 'ETA is close to your prediction';
    if (Math.abs(diffMinutes) > 720) {
      return 'ETA and your guess are way apart';
    }
    if (diffMinutes > 0) return `ETA is about ${diffMinutes} min later than your prediction`;
    return `ETA is about ${Math.abs(diffMinutes)} min earlier than your prediction`;
  }

  private buildQuickAction(
    status: string,
    journeyStatus: string,
    hasPrediction: boolean,
    isCreator: boolean,
    category: string | null,
  ) {
    if (
      ['result_ready', 'completed', 'cancelled'].includes(status) ||
      ['completed', 'auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'].includes(journeyStatus)
    ) {
      return { label: 'View Result', targetScreen: 'Result' };
    }

    if (category === 'open_prediction') {
      if (status === 'predictions_open' && !hasPrediction) {
        return { label: 'Predikt', targetScreen: 'Prediction' };
      }
      if (status === 'predictions_open' && hasPrediction) {
        return { label: 'Go to Room', targetScreen: 'LiveRoom' };
      }
      if (status === 'predictions_locked' || status === 'live') {
        return { label: 'Go to Room', targetScreen: 'LiveRoom' };
      }
      return { label: 'View Result', targetScreen: 'Result' };
    }

    if (isCreator && ['scheduled', 'open', 'locked'].includes(journeyStatus)) {
      return { label: 'Start Journey', targetScreen: 'LiveRoom' };
    }
    if (isCreator && ['live', 'inactive', 'overdue', 'started'].includes(journeyStatus)) {
      return { label: 'Finish Journey', targetScreen: 'LiveRoom' };
    }
    if (['auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'].includes(journeyStatus)) {
      return { label: 'View Result', targetScreen: 'Result' };
    }
    if (status === 'predictions_open' && !hasPrediction) {
      return { label: 'Predict Now', targetScreen: 'Prediction' };
    }
    if (status === 'predictions_open' && hasPrediction) {
      return { label: 'Go to Room', targetScreen: 'LiveRoom' };
    }
    if (status === 'predictions_locked') {
      return { label: 'Go to Room', targetScreen: 'LiveRoom' };
    }
    if (status === 'live') {
      return { label: 'Go to Room', targetScreen: 'LiveRoom' };
    }
    return { label: 'View Result', targetScreen: 'Result' };
  }

  private buildLifecycleLabel(room: ActivePredictionRoom) {
    if (room.journeyStatus === 'overdue') return 'Journey is overdue';
    if (room.journeyStatus === 'inactive') return 'Waiting for traveller update';
    if (room.journeyStatus === 'auto_closed') return 'Predictions neutralized after auto-close';
    if (room.journeyStatus === 'abandoned') return 'Plans changed — nobody counted as a loss';
    if (room.journeyStatus === 'plan_changed' || room.journeyStatus === 'cancelled_by_host') {
      return 'Journey closed fairly after a plan change';
    }
    return null;
  }
}
