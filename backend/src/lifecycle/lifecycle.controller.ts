import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { LifecycleService } from './lifecycle.service';
import { EndRoomDto } from './dto/end-room.dto';
import { ReachMilestoneDto } from './dto/reach-milestone.dto';
import { StartRoomDto } from './dto/start-room.dto';
import { CancelJourneyDto } from './dto/cancel-journey.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AdminRequest } from '../common/types/http-request-context';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId')
export class LifecycleController {
  constructor(private readonly lifecycleService: LifecycleService) {}

  @Post('lock-predictions')
  lockPredictions(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.lifecycleService.lockPredictions(roomId, user);
  }

  @Post('start')
  start(
    @Param('roomId') roomId: string,
    @Body() dto: StartRoomDto,
    @CurrentUser() user: User,
  ) {
    return this.lifecycleService.start(roomId, user, dto);
  }

  @Post('journey/start')
  startJourney(
    @Param('roomId') roomId: string,
    @Body() dto: StartRoomDto,
    @CurrentUser() user: User,
  ) {
    return this.lifecycleService.start(roomId, user, dto);
  }

  @Post('journey/cancel')
  cancelJourney(
    @Param('roomId') roomId: string,
    @Body() dto: CancelJourneyDto,
    @CurrentUser() user: User,
  ) {
    return this.lifecycleService.cancelJourney(roomId, user, dto);
  }

  @Post('journey/confirm-arrival')
  confirmArrival(
    @Param('roomId') roomId: string,
    @Body() dto: EndRoomDto,
    @CurrentUser() user: User,
  ) {
    return this.lifecycleService.previewArrivalConfirmation(roomId, user, dto);
  }

  @Post('milestones/:milestoneId/reached')
  reachMilestone(
    @Param('roomId') roomId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: ReachMilestoneDto,
    @CurrentUser() user: User,
  ) {
    return this.lifecycleService.reachMilestone(roomId, milestoneId, dto, user);
  }

  @Post('end')
  end(
    @Param('roomId') roomId: string,
    @Body() dto: EndRoomDto,
    @CurrentUser() user: User,
  ) {
    return this.lifecycleService.end(roomId, dto, user);
  }

  @Post('cancel')
  cancel(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.lifecycleService.cancel(roomId, user);
  }
}

@Controller('admin/journeys')
export class AdminJourneyLifecycleController {
  constructor(private readonly lifecycleService: LifecycleService) {}

  @UseGuards(AdminAuthGuard)
  @Post('evaluate-lifecycle')
  evaluateLifecycle(@Body() body: { roomId: string }, @Req() req: AdminRequest) {
    return this.lifecycleService.evaluateRoomLifecycle(body.roomId, {
      actorType: 'admin',
      actorId: req.adminUser?.adminUserId ?? null,
    });
  }
}
