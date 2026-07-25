import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminPortalController } from './admin-portal.controller';
import { AdminRewardsController } from './admin-rewards.controller';
import { RewardsModule } from '../rewards/rewards.module';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminRoleGuard } from './admin-role.guard';
import { AdminFeatureEnabledGuard } from './admin-feature-enabled.guard';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminOperationsService } from './admin-operations.service';
import { AdminFeedbackService } from './admin-feedback.service';
import { AdminModerationService } from './admin-moderation.service';
import { AdminSystemService } from './admin-system.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule, JwtModule.register({}), RewardsModule],
  controllers: [AdminController, AdminPortalController, AdminRewardsController],
  providers: [
    AdminService,
    AdminFeatureEnabledGuard,
    AdminAuthGuard,
    AdminRoleGuard,
    AdminAnalyticsService,
    AdminOperationsService,
    AdminFeedbackService,
    AdminModerationService,
    AdminSystemService,
  ],
  exports: [AdminFeatureEnabledGuard, AdminAuthGuard, AdminRoleGuard, JwtModule],
})
export class AdminModule {}
