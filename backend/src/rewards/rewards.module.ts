import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RewardService } from './reward.service';
import { RewardsController } from './rewards.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RewardsController],
  providers: [RewardService],
  exports: [RewardService],
})
export class RewardsModule {}
