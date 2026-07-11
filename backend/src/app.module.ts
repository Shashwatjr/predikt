import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { PredictionsModule } from './predictions/predictions.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { LiveProgressModule } from './live-progress/live-progress.module';
import { LeaderboardsModule } from './leaderboards/leaderboards.module';
import { UsersModule } from './users/users.module';
import { DropsModule } from './drops/drops.module';
import { AuditModule } from './audit/audit.module';
import { CreatorsModule } from './creators/creators.module';
import { PlansModule } from './plans/plans.module';
import { PrivacyModule } from './privacy/privacy.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RoutesModule } from './routes/routes.module';
import { ModerationModule } from './moderation/moderation.module';
import { validateEnv } from './config/env.validation';
import { NotificationsModule } from './notifications/notifications.module';
import { EventsModule } from './events/events.module';
import { CommentaryModule } from './commentary/commentary.module';
import { BadgeModule } from './badges/badge.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 300,
        },
      ],
      errorMessage:
        'Too many requests. Please slow down and try again in a minute.',
    }),
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    RoomsModule,
    PredictionsModule,
    LifecycleModule,
    LiveProgressModule,
    LeaderboardsModule,
    UsersModule,
    DropsModule,
    CreatorsModule,
    PlansModule,
    PrivacyModule,
    AdminModule,
    DashboardModule,
    RoutesModule,
    ModerationModule,
    NotificationsModule,
    EventsModule,
    CommentaryModule,
    BadgeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
