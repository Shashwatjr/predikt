import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { RewardService } from './reward.service';
import { RewardHistoryQueryDto } from './dto/reward.dto';

@UseGuards(JwtAuthGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardService: RewardService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardService.getMe(user.userId);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RewardHistoryQueryDto,
  ) {
    return this.rewardService.history(user.userId, {
      type: query.type,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get('rules')
  rules() {
    return this.rewardService.publicRules();
  }
}
