import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PredictionsService } from './predictions.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { UpdatePredictionDto } from './dto/update-prediction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Post('predictions')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  submit(
    @Param('roomId') roomId: string,
    @Body() dto: CreatePredictionDto,
    @CurrentUser() user: User,
  ) {
    return this.predictionsService.submit(roomId, dto, user);
  }

  @Get('predictions')
  list(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.predictionsService.list(roomId, user);
  }

  @Post('milestone-predictions')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  submitMilestones(
    @Param('roomId') roomId: string,
    @Body() dto: CreatePredictionDto,
    @CurrentUser() user: User,
  ) {
    return this.predictionsService.submitMilestonePredictions(roomId, dto, user);
  }

  @Get('milestone-predictions')
  listMilestones(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.predictionsService.listMilestonePredictions(roomId, user);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('predictions')
export class PredictionEditsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Patch(':predictionId')
  updatePrediction(
    @Param('predictionId') predictionId: string,
    @Body() dto: UpdatePredictionDto,
    @CurrentUser() user: User,
  ) {
    return this.predictionsService.updatePrediction(predictionId, dto, user);
  }

  @Post(':predictionId/revoke')
  revokePrediction(
    @Param('predictionId') predictionId: string,
    @CurrentUser() user: User,
  ) {
    return this.predictionsService.revokePrediction(predictionId, user);
  }
}
