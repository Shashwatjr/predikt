import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { featureFlags } from '../config/feature-flags';

// v2 (checkpoint_leaderboard_v2) uses six time-based checkpoints; v1 uses 50/80.
const V2_CHECKPOINTS = [20, 40, 60, 80, 90, 100] as const;
const V1_CHECKPOINTS = [50, 80] as const;

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
    const allowed = featureFlags.checkpointLeaderboardV2 ? V2_CHECKPOINTS : V1_CHECKPOINTS;

    if (checkpoint != null) {
      const value = Number(checkpoint);
      if (!allowed.includes(value as never)) {
        throw new BadRequestException(`checkpoint must be one of ${allowed.join(', ')}`);
      }
      return { [value]: await this.leaderboardsService.checkpointLeaderboard(roomId, value, user) };
    }

    const boards = await Promise.all(
      allowed.map((value) => this.leaderboardsService.checkpointLeaderboard(roomId, value, user)),
    );
    return Object.fromEntries(allowed.map((value, i) => [value, boards[i]]));
  }

  @Get('leaderboard/weekly')
  weeklyLeaderboard() {
    return this.leaderboardsService.weeklyLeaderboard();
  }
}
