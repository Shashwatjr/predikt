import { Controller, Post, Get, Body, Param, UseGuards, Delete, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { ShareRoomEventDto } from './dto/share-room-event.dto';
import { JwtService } from '@nestjs/jwt';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly jwtService: JwtService,
  ) {}

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
  @Delete(':roomId')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  deleteRoom(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.roomsService.deleteRoom(roomId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':roomId/rematch')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  rematch(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.roomsService.rematch(roomId, user);
  }

  @Get('code/:inviteCode')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  findByCode(
    @Param('inviteCode') inviteCode: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.roomsService.findByInviteCode(
      inviteCode,
      this.resolveOptionalViewerUserId(authorization),
    );
  }

  @Get('invite/:inviteCode')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  invitePreview(
    @Param('inviteCode') inviteCode: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.roomsService.getInvitePreview(
      inviteCode,
      this.resolveOptionalViewerUserId(authorization),
    );
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

  private resolveOptionalViewerUserId(authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : null;
    if (!token) return null;
    try {
      const payload = this.jwtService.verify<{
        sub?: string;
        tokenType?: string;
      }>(token);
      return payload.tokenType === 'access' && payload.sub ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
