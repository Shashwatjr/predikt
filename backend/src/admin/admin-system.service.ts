import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { featureFlags, MVP_CATEGORIES, MVP_MODES } from '../config/feature-flags';
import { AdminAnalyticsService } from './admin-analytics.service';

const STARTED_AT = Date.now();

@Injectable()
export class AdminSystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly analyticsService: AdminAnalyticsService,
  ) {}

  async health() {
    let databaseReachable = false;
    let latestHealthCheck = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }

    const period = this.analyticsService.parseQuery({});
    const eventWhere = {
      createdAt: { gte: period.from, lte: period.to },
    };

    const [
      roomCreationEvents,
      invitePreviewEvents,
      predictionSubmittedEvents,
      resultViewedEvents,
      rematchEvents,
      guestUpgradeEvents,
      authFailures,
      failedLifecycle,
    ] = await Promise.all([
      this.prisma.activityEvent.count({
        where: { ...eventWhere, eventType: { in: ['room_created'] } },
      }),
      this.prisma.activityEvent.count({
        where: { ...eventWhere, eventType: { in: ['invite_preview_loaded'] } },
      }),
      this.prisma.activityEvent.count({
        where: {
          ...eventWhere,
          eventType: {
            in: ['prediction_submitted', 'registered_prediction_submitted', 'guest_prediction_submitted'],
          },
        },
      }),
      this.prisma.activityEvent.count({
        where: { ...eventWhere, eventType: { in: ['result_viewed', 'result_declared', 'tea_viewed'] } },
      }),
      this.prisma.activityEvent.count({
        where: { ...eventWhere, eventType: { in: ['rematch_created'] } },
      }),
      this.prisma.activityEvent.count({
        where: { ...eventWhere, eventType: { in: ['guest_upgrade_completed'] } },
      }),
      this.prisma.auditLog.count({
        where: {
          createdAt: { gte: period.from, lte: period.to },
          action: { in: ['admin.login.failed', 'auth.login.failed'] },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          createdAt: { gte: period.from, lte: period.to },
          action: { contains: 'lifecycle.failed' },
        },
      }),
    ]);

    const roomsCreated = await this.prisma.predictionRoom.count({
      where: { createdAt: { gte: period.from, lte: period.to } },
    });

    return {
      backend: {
        apiReachable: true,
        databaseReachable,
        latestHealthCheck,
        environment: this.configService.get<string>('NODE_ENV') ?? 'development',
        uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
      },
      productServices: {
        roomCreationHealth: this.successRate(roomCreationEvents, roomsCreated),
        invitePreviewSuccess: this.successRate(
          invitePreviewEvents,
          await this.prisma.activityEvent.count({
            where: { ...eventWhere, eventType: { in: ['invite_opened'] } },
          }),
        ),
        predictionSubmissionSuccess: this.successRate(
          predictionSubmittedEvents,
          predictionSubmittedEvents +
            (await this.prisma.activityEvent.count({
              where: { ...eventWhere, eventType: 'prediction_submission_failed' },
            })),
        ),
        resultFinalizationSuccess: this.successRate(resultViewedEvents, resultViewedEvents),
        rematchSuccess: this.successRate(
          rematchEvents,
          rematchEvents +
            (await this.prisma.activityEvent.count({
              where: { ...eventWhere, eventType: 'rematch_failed' },
            })),
        ),
        guestUpgradeSuccess: this.successRate(
          guestUpgradeEvents,
          guestUpgradeEvents +
            (await this.prisma.activityEvent.count({
              where: { ...eventWhere, eventType: 'guest_upgrade_failed' },
            })),
        ),
      },
      errorRates: {
        recentAuthFailures: authFailures,
        failedLifecycleEvaluations: failedLifecycle,
        recentApi5xxCount: 0,
        failedBackgroundJobs: failedLifecycle,
      },
      database: {
        reachable: databaseReachable,
        migrationStatus: 'managed_via_prisma',
      },
    };
  }

  version() {
    return {
      app: 'predikt-api',
      version: process.env.npm_package_version ?? '0.0.1',
      environment: this.configService.get<string>('NODE_ENV') ?? 'development',
      build: process.env.BUILD_SHA ?? 'local',
    };
  }

  featureFlags() {
    return {
      mvpCategories: MVP_CATEGORIES,
      mvpModes: MVP_MODES,
      flags: {
        ...featureFlags,
        adminPortalEnabled: featureFlags.adminPortalEnabled,
        adminAnalyticsEnabled: featureFlags.adminAnalyticsEnabled,
        adminFeedbackQueueEnabled: featureFlags.adminFeedbackQueueEnabled,
        adminModerationEnabled: featureFlags.adminModerationEnabled,
        adminSystemHealthEnabled: featureFlags.adminSystemHealthEnabled,
      },
    };
  }

  private successRate(success: number, total: number) {
    if (total <= 0) return 100;
    return Math.round((success / total) * 1000) / 10;
  }
}
