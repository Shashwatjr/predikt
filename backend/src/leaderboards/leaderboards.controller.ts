import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller()
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @Get('rooms/:roomId/leaderboard')
  roomLeaderboard(@Param('roomId') roomId: string) {
    return this.leaderboardsService.roomLeaderboard(roomId);
  }

  // Provisional mid-journey standings. Guarded so private-room membership and
  // per-viewer "isCurrentUser" can be resolved. Returns both checkpoints in one
  // call; each is { available: false } until the journey crosses that mark.
  @UseGuards(JwtAuthGuard)
  @Get('rooms/:roomId/checkpoint-leaderboards')
  async checkpointLeaderboards(
    @Param('roomId') roomId: string,
    @CurrentUser() user: User,
    @Query('checkpoint') checkpoint?: string,
  ) {
    if (checkpoint != null) {
      const value = Number(checkpoint);
      if (value !== 50 && value !== 80) {
        throw new BadRequestException('checkpoint must be 50 or 80');
      }
      return { [value]: await this.leaderboardsService.checkpointLeaderboard(roomId, value, user) };
    }

    const [fifty, eighty] = await Promise.all([
      this.leaderboardsService.checkpointLeaderboard(roomId, 50, user),
      this.leaderboardsService.checkpointLeaderboard(roomId, 80, user),
    ]);
    return { 50: fifty, 80: eighty };
  }

  @Get('leaderboard/weekly')
  weeklyLeaderboard() {
    return this.leaderboardsService.weeklyLeaderboard();
  }
}
