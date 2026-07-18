import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalyticsQuery,
  buildEventWhere,
  buildRoomWhere,
  conversionRate,
  parseAnalyticsQuery,
} from './utils/analytics-query';

const FUNNEL_STAGES = [
  { key: 'invite_opened', label: 'Invite opened', events: ['invite_opened'] },
  { key: 'invite_preview_loaded', label: 'Invite preview loaded', events: ['invite_preview_loaded'] },
  {
    key: 'prediction_started',
    label: 'Prediction started',
    events: ['guest_prediction_started', 'guest_join_started'],
  },
  {
    key: 'prediction_submitted',
    label: 'Prediction submitted',
    events: ['prediction_submitted', 'registered_prediction_submitted', 'guest_prediction_submitted'],
  },
  { key: 'result_viewed', label: 'Result viewed', events: ['result_viewed', 'result_declared', 'tea_viewed'] },
  { key: 'result_shared', label: 'Result shared', events: ['result_shared', 'moment_card_shared', 'room_shared'] },
  { key: 'rematch_created', label: 'Rematch created', events: ['rematch_created', 'rematch_started'] },
] as const;

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  parseQuery(query: Record<string, string | undefined>) {
    return parseAnalyticsQuery(query);
  }

  async summary(query: Record<string, string | undefined>) {
    const period = this.parseQuery(query);
    const eventWhere = buildEventWhere(period);
    const roomWhere = buildRoomWhere(period);

    const [
      roomsCreated,
      completedRooms,
      inviteOpened,
      invitePreviewLoaded,
      predictionsSubmitted,
      resultViewed,
      resultShared,
      rematchesCreated,
      guestUsers,
      registeredUsers,
      guestPredictions,
      guestUpgradeStarted,
      guestUpgradeCompleted,
      reportsOpened,
      blockedUsers,
      unresolvedReports,
      roomsAbandoned,
      roomsCancelled,
      roomsAutoClosed,
      failedSubmissions,
      failedRematches,
    ] = await Promise.all([
      this.prisma.predictionRoom.count({ where: roomWhere }),
      this.prisma.predictionRoom.count({ where: { ...roomWhere, status: 'completed' } }),
      this.countEvents(eventWhere, ['invite_opened']),
      this.countEvents(eventWhere, ['invite_preview_loaded']),
      this.countEvents(eventWhere, [
        'prediction_submitted',
        'registered_prediction_submitted',
        'guest_prediction_submitted',
      ]),
      this.countEvents(eventWhere, ['result_viewed', 'result_declared', 'tea_viewed']),
      this.countEvents(eventWhere, ['result_shared', 'moment_card_shared', 'room_shared']),
      this.countEvents(eventWhere, ['rematch_created', 'rematch_started']),
      this.prisma.user.count({
        where: { isGuest: true, createdAt: { gte: period.from, lte: period.to } },
      }),
      this.prisma.user.count({
        where: { isGuest: false, createdAt: { gte: period.from, lte: period.to } },
      }),
      this.countEvents(eventWhere, ['guest_prediction_submitted']),
      this.countEvents(eventWhere, ['guest_upgrade_started']),
      this.countEvents(eventWhere, ['guest_upgrade_completed']),
      this.prisma.report.count({ where: { createdAt: { gte: period.from, lte: period.to } } }),
      this.prisma.userBlock.count({ where: { createdAt: { gte: period.from, lte: period.to } } }),
      this.prisma.report.count({
        where: {
          createdAt: { gte: period.from, lte: period.to },
          status: { in: ['submitted', 'in_review'] },
        },
      }),
      this.prisma.predictionRoom.count({ where: { ...roomWhere, abandonedAt: { not: null } } }),
      this.prisma.predictionRoom.count({ where: { ...roomWhere, status: 'cancelled' } }),
      this.prisma.predictionRoom.count({ where: { ...roomWhere, autoClosedAt: { not: null } } }),
      this.countEvents(eventWhere, ['prediction_submission_failed']),
      this.countEvents(eventWhere, ['rematch_failed']),
    ]);

    const guestUpgradeConversion = conversionRate(guestUpgradeCompleted, guestUpgradeStarted);

    return {
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      betaHealth: {
        roomsCreated,
        completedRooms,
        completionRate: conversionRate(completedRooms, roomsCreated),
        unresolvedReports,
      },
      inviteFunnel: {
        inviteOpened,
        invitePreviewLoaded,
        predictionsSubmitted,
        resultViewed,
        resultShared,
        rematchesCreated,
      },
      guestJourney: {
        guestUsers,
        registeredUsers,
        guestPredictions,
        guestUpgradeStarted,
        guestUpgradeCompleted,
        guestUpgradeConversion,
      },
      reliability: {
        roomsAbandoned,
        roomsCancelled,
        roomsAutoClosed,
        failedSubmissions,
        failedRematches,
      },
      moderation: {
        reportsOpened,
        blockedUsers,
        unresolvedReports,
      },
    };
  }

  async funnel(query: Record<string, string | undefined>) {
    const period = this.parseQuery(query);
    const eventWhere = buildEventWhere(period);
    const counts: number[] = [];

    for (const stage of FUNNEL_STAGES) {
      counts.push(await this.countEvents(eventWhere, [...stage.events]));
    }

    const stages = FUNNEL_STAGES.map((stage, index) => ({
      key: stage.key,
      label: stage.label,
      count: counts[index],
      conversionFromPrevious:
        index === 0 ? null : conversionRate(counts[index], counts[index - 1]),
    }));

    return { period: { from: period.from.toISOString(), to: period.to.toISOString() }, stages };
  }

  async categories(query: Record<string, string | undefined>) {
    const period = this.parseQuery(query);
    const categories = await this.prisma.predictionRoom.groupBy({
      by: ['category'],
      where: buildRoomWhere(period),
      _count: { roomId: true },
    });

    const rows = await Promise.all(
      categories.map(async (row) => {
        const category = row.category ?? 'unknown';
        const roomWhere = { ...buildRoomWhere(period), category: row.category };
        const [completed, rematches] = await Promise.all([
          this.prisma.predictionRoom.count({ where: { ...roomWhere, status: 'completed' } }),
          this.prisma.predictionRoom.count({
            where: { ...roomWhere, rematchOfRoomId: { not: null } },
          }),
        ]);
        const participantAgg = await this.prisma.roomMembership.groupBy({
          by: ['roomId'],
          where: {
            room: roomWhere,
          },
          _count: { membershipId: true },
        });
        const avgParticipants =
          participantAgg.length > 0
            ? Math.round(
                (participantAgg.reduce((sum, item) => sum + item._count.membershipId, 0) /
                  participantAgg.length) *
                  10,
              ) / 10
            : 0;

        return {
          category,
          rooms: row._count.roomId,
          completedRooms: completed,
          completionRate: conversionRate(completed, row._count.roomId),
          averageParticipants: avgParticipants,
          rematchRate: conversionRate(rematches, row._count.roomId),
        };
      }),
    );

    return { period: { from: period.from.toISOString(), to: period.to.toISOString() }, categories: rows };
  }

  async guestJourney(query: Record<string, string | undefined>) {
    const period = this.parseQuery(query);
    const eventWhere = buildEventWhere(period);
    const [
      guestJoinStarted,
      guestPredictionStarted,
      guestPredictionSubmitted,
      guestUpgradeStarted,
      guestUpgradeCompleted,
      guestUpgradeFailed,
    ] = await Promise.all([
      this.countEvents(eventWhere, ['guest_join_started']),
      this.countEvents(eventWhere, ['guest_prediction_started']),
      this.countEvents(eventWhere, ['guest_prediction_submitted']),
      this.countEvents(eventWhere, ['guest_upgrade_started']),
      this.countEvents(eventWhere, ['guest_upgrade_completed']),
      this.countEvents(eventWhere, ['guest_upgrade_failed']),
    ]);

    return {
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      stages: [
        { key: 'guest_join_started', count: guestJoinStarted },
        { key: 'guest_prediction_started', count: guestPredictionStarted },
        { key: 'guest_prediction_submitted', count: guestPredictionSubmitted },
        { key: 'guest_upgrade_started', count: guestUpgradeStarted },
        { key: 'guest_upgrade_completed', count: guestUpgradeCompleted },
        { key: 'guest_upgrade_failed', count: guestUpgradeFailed },
      ],
      conversionRates: {
        joinToPrediction: conversionRate(guestPredictionSubmitted, guestJoinStarted),
        predictionToUpgrade: conversionRate(guestUpgradeStarted, guestPredictionSubmitted),
        upgradeCompletion: conversionRate(guestUpgradeCompleted, guestUpgradeStarted),
      },
    };
  }

  async roomHealth(query: Record<string, string | undefined>) {
    const period = this.parseQuery(query);
    const roomWhere = buildRoomWhere(period);
    const now = new Date();
    const [abandoned, cancelled, autoClosed, unresolvedPastExpected, total] = await Promise.all([
      this.prisma.predictionRoom.count({ where: { ...roomWhere, abandonedAt: { not: null } } }),
      this.prisma.predictionRoom.count({ where: { ...roomWhere, status: 'cancelled' } }),
      this.prisma.predictionRoom.count({ where: { ...roomWhere, autoClosedAt: { not: null } } }),
      this.prisma.predictionRoom.count({
        where: {
          ...roomWhere,
          status: { in: ['live', 'predictions_locked', 'predictions_open'] },
          resultDeadline: { lt: now },
        },
      }),
      this.prisma.predictionRoom.count({ where: roomWhere }),
    ]);

    return {
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      totalRooms: total,
      abandoned,
      cancelled,
      autoClosed,
      unresolvedPastExpected,
      healthyRate: conversionRate(total - abandoned - cancelled - autoClosed, total),
    };
  }

  async sharing(query: Record<string, string | undefined>) {
    const period = this.parseQuery(query);
    const eventWhere = buildEventWhere(period);
    const [resultViewed, resultShared, whatsappShare, nativeShare, rematchCreated, rematchFailed] =
      await Promise.all([
        this.countEvents(eventWhere, ['result_viewed', 'result_declared', 'tea_viewed']),
        this.countEvents(eventWhere, ['result_shared', 'moment_card_shared']),
        this.countEvents(eventWhere, ['whatsapp_share_selected']),
        this.countEvents(eventWhere, ['native_share_selected']),
        this.countEvents(eventWhere, ['rematch_created']),
        this.countEvents(eventWhere, ['rematch_failed']),
      ]);

    return {
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      resultViewed,
      resultShared,
      whatsappShare,
      nativeShare,
      rematchCreated,
      rematchFailed,
      shareConversion: conversionRate(resultShared, resultViewed),
      rematchConversion: conversionRate(rematchCreated, resultViewed),
    };
  }

  async errors(query: Record<string, string | undefined>) {
    const period = this.parseQuery(query);
    const eventWhere = buildEventWhere(period);
    const [failedInviteLoads, failedSubmissions, failedRematches, failedUpgrades] =
      await Promise.all([
        this.countEvents(eventWhere, ['invite_preview_failed']),
        this.countEvents(eventWhere, ['prediction_submission_failed']),
        this.countEvents(eventWhere, ['rematch_failed']),
        this.countEvents(eventWhere, ['guest_upgrade_failed']),
      ]);

    const failedLifecycle = await this.prisma.auditLog.count({
      where: {
        createdAt: { gte: period.from, lte: period.to },
        action: { contains: 'lifecycle.failed' },
      },
    });

    return {
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      failedInviteLoads,
      failedSubmissions,
      failedRematches,
      failedUpgrades,
      failedLifecycle,
    };
  }

  private countEvents(
    where: ReturnType<typeof buildEventWhere>,
    eventTypes: string[],
  ): Promise<number> {
    return this.prisma.activityEvent.count({
      where: {
        ...where,
        eventType: { in: eventTypes },
      },
    });
  }
}
