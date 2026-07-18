import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { ShareRoomEventDto } from './dto/share-room-event.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: User) {
    return this.roomsService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':roomId')
  findById(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.roomsService.findById(roomId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':roomId/join')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  join(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.roomsService.join(roomId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':roomId/leave')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  leave(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.roomsService.leave(roomId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':roomId/rematch')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  rematch(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.roomsService.rematch(roomId, user);
  }

  @Get('code/:inviteCode')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  findByCode(@Param('inviteCode') inviteCode: string) {
    return this.roomsService.findByInviteCode(inviteCode);
  }

  @Get('invite/:inviteCode')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  invitePreview(@Param('inviteCode') inviteCode: string) {
    return this.roomsService.getInvitePreview(inviteCode);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':roomId/share')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  shareKit(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.roomsService.getShareKit(roomId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':roomId/share-events')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  trackShareEvent(
    @Param('roomId') roomId: string,
    @Body() dto: ShareRoomEventDto,
    @CurrentUser() user: User,
  ) {
    return this.roomsService.trackShareEvent(roomId, dto, user);
  }
}
