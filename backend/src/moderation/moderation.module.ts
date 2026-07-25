import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [AuditModule, NotificationsModule, RewardsModule],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
