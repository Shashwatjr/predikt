import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DropsService } from './drops.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller()
export class DropsController {
  constructor(private readonly dropsService: DropsService) {}

  @Get('drops')
  listDrops() {
    return this.dropsService.listDrops();
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/me/drops')
  myDrops(@CurrentUser() user: User) {
    return this.dropsService.myDrops(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('drops/:dropId/unlock')
  unlockDrop(@Param('dropId') dropId: string, @CurrentUser() user: User) {
    return this.dropsService.unlockDrop(dropId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/me/drops/:userDropId/redeem')
  redeemDrop(@Param('userDropId') userDropId: string, @CurrentUser() user: User) {
    return this.dropsService.redeemDrop(userDropId, user);
  }
}
