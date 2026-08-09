import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [PrismaModule, LifecycleModule, RewardsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
