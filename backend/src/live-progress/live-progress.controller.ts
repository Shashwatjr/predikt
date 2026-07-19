import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { LiveProgressService } from './live-progress.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { CheckpointUpdateDto } from './dto/checkpoint-update.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('rooms/:roomId')
export class LiveProgressController {
  constructor(private readonly liveProgressService: LiveProgressService) {}

  @UseGuards(JwtAuthGuard)
  @Post('location-update')
  postUpdate(
    @Param('roomId') roomId: string,
    @Body() dto: LocationUpdateDto,
    @CurrentUser() user: User,
  ) {
    return this.liveProgressService.postUpdate(roomId, dto, user);
  }

  // v2 (checkpoint_leaderboard_v2): a single discrete checkpoint from the
  // creator's one-shot timer. The server does the ETA re-read + leaderboard.
  @UseGuards(JwtAuthGuard)
  @Post('checkpoint')
  recordCheckpoint(
    @Param('roomId') roomId: string,
    @Body() dto: CheckpointUpdateDto,
    @CurrentUser() user: User,
  ) {
    return this.liveProgressService.recordClientCheckpoint(roomId, dto, user);
  }

  @Get('live-state')
  getLiveState(@Param('roomId') roomId: string) {
    return this.liveProgressService.getLiveState(roomId);
  }
}
