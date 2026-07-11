import { Module } from '@nestjs/common';
import { AdminJourneyLifecycleController, LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';
import { AuditModule } from '../audit/audit.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BadgeModule } from '../badges/badge.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuditModule, AdminModule, NotificationsModule, BadgeModule, PrismaModule],
  controllers: [LifecycleController, AdminJourneyLifecycleController],
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class LifecycleModule {}
