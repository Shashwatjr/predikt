import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { UpdateActivePredictionsOrderDto } from './dto/update-active-predictions-order.dto';
import { ClearActivePredictionsDto } from './dto/clear-active-predictions.dto';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: User) {
    return this.dashboardService.summary(user);
  }

  @Get('following-leaderboard')
  followingLeaderboard(@CurrentUser() user: User) {
    return this.dashboardService.followingLeaderboard(user);
  }

  @Get('recommendations')
  recommendations(@CurrentUser() user: User) {
    return this.dashboardService.recommendations(user);
  }

  @Get('active-rooms')
  activeRooms(@CurrentUser() user: User) {
    return this.dashboardService.activeRooms(user);
  }

  @Get('active-predictions')
  activePredictions(@CurrentUser() user: User) {
    return this.dashboardService.activePredictions(user);
  }

  @Patch('active-predictions/order')
  updateActivePredictionsOrder(
    @CurrentUser() user: User,
    @Body() dto: UpdateActivePredictionsOrderDto,
  ) {
    return this.dashboardService.updateActivePredictionsOrder(user, dto);
  }

  @Post('active-predictions/clear')
  clearActivePredictions(
    @CurrentUser() user: User,
    @Body() dto: ClearActivePredictionsDto,
  ) {
    return this.dashboardService.clearActivePredictions(user, dto);
  }

  @Get('daily-challenge')
  dailyChallenge(@CurrentUser() user: User) {
    return this.dashboardService.dailyChallenge(user);
  }

  @Get('daily-spin')
  dailySpin(@CurrentUser() user: User) {
    return this.dashboardService.dailySpin(user);
  }

  @Post('daily-spin/claim')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  claimDailySpin(@CurrentUser() user: User) {
    return this.dashboardService.claimDailySpin(user);
  }

  @Get('drops-near-unlock')
  dropsNearUnlock(@CurrentUser() user: User) {
    return this.dashboardService.dropsNearUnlock(user);
  }

  @Get('activity-feed')
  activityFeed(@CurrentUser() user: User) {
    return this.dashboardService.activityFeed(user);
  }

  @Get('suggested-follows')
  suggestedFollows(@CurrentUser() user: User) {
    return this.dashboardService.suggestedFollows(user);
  }
}
