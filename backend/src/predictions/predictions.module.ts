import { Module } from '@nestjs/common';
import { PredictionEditsController, PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { AuditModule } from '../audit/audit.module';
import { RoomsModule } from '../rooms/rooms.module';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [AuditModule, RoomsModule, RewardsModule],
  controllers: [PredictionsController, PredictionEditsController],
  providers: [PredictionsService],
  exports: [PredictionsService],
})
export class PredictionsModule {}
