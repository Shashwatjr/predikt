import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';

@Module({
  imports: [PrismaModule, LifecycleModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
