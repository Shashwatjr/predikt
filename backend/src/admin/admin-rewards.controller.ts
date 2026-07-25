import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminRoleGuard } from './admin-role.guard';
import { AdminFeatureEnabledGuard } from './admin-feature-enabled.guard';
import { RequireAdminPermission } from './admin-permissions.decorator';
import { AdminRequest } from '../common/types/http-request-context';
import { RewardService } from '../rewards/reward.service';
import { AdminRewardAdjustDto } from '../rewards/dto/reward.dto';

@Controller('admin/rewards')
@UseGuards(AdminFeatureEnabledGuard)
export class AdminRewardsController {
  constructor(private readonly rewardService: RewardService) {}

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.credits.reverse')
  @Post('adjust')
  adjust(@Body() body: AdminRewardAdjustDto, @Req() req: AdminRequest) {
    return this.rewardService.adminAdjust({
      userId: body.userId,
      rewardType: body.rewardType,
      amount: body.amount,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      adminId: req.adminUser.adminUserId,
    });
  }
}
