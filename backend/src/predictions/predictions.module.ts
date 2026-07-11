import { Module } from '@nestjs/common';
import { PredictionEditsController, PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { AuditModule } from '../audit/audit.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [AuditModule, RoomsModule],
  controllers: [PredictionsController, PredictionEditsController],
  providers: [PredictionsService],
  exports: [PredictionsService],
})
export class PredictionsModule {}
