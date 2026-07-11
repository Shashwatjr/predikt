import { Controller, Get, Param } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';

@Controller()
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @Get('rooms/:roomId/leaderboard')
  roomLeaderboard(@Param('roomId') roomId: string) {
    return this.leaderboardsService.roomLeaderboard(roomId);
  }

  @Get('leaderboard/weekly')
  weeklyLeaderboard() {
    return this.leaderboardsService.weeklyLeaderboard();
  }
}
