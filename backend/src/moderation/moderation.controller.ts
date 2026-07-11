import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ModerationService } from './moderation.service';
import { CreateReportDto } from './dto/report.dto';
import { BlockUserDto } from './dto/block-user.dto';
import { DisputeRoomDto } from './dto/dispute-room.dto';
import { ResultReactionDto } from './dto/result-reaction.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('reports')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  report(@CurrentUser() user: User, @Body() body: CreateReportDto) {
    return this.moderationService.report(user, body);
  }

  @Post('users/:userId/block')
  block(
    @CurrentUser() user: User,
    @Param('userId') userId: string,
    @Body() body: BlockUserDto,
  ) {
    return this.moderationService.block(user, userId, body.reason);
  }

  @Delete('users/:userId/block')
  unblock(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.moderationService.unblock(user, userId);
  }

  @Get('users/me/blocked')
  blocked(@CurrentUser() user: User) {
    return this.moderationService.blocked(user);
  }

  @Post('rooms/:roomId/disputes')
  dispute(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() body: DisputeRoomDto,
  ) {
    return this.moderationService.disputeRoom(user, roomId, body);
  }

  @Post('rooms/:roomId/reactions')
  react(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() body: ResultReactionDto,
  ) {
    return this.moderationService.reactToResult(user, roomId, body);
  }
}
