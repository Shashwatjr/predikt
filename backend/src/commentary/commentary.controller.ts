import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CommentaryService } from './commentary.service';

@Controller('rooms')
export class CommentaryController {
  constructor(private readonly commentaryService: CommentaryService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':roomId/commentary')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getCommentary(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.commentaryService.getCommentary(roomId, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':roomId/commentary/regenerate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async regenerate(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.commentaryService.regenerateCommentary(roomId, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':roomId/commentary/history')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async history(@Param('roomId') roomId: string, @CurrentUser() user: User) {
    return this.commentaryService.getCommentaryHistory(roomId, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/commentary-preference')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updatePreferenceLegacy(
    @CurrentUser() user: User,
    @Body()
    body: {
      commentaryEnabled?: boolean;
      aiCommentaryOptOut?: boolean;
      preferredCommentaryPersonality?: string;
      enabled?: boolean;
      aiOptOut?: boolean;
      personality?: string;
      toneLevel?: 'gentle' | 'playful' | 'spicy';
    },
  ) {
    return this.commentaryService.updateUserPreference(user.userId, body);
  }
}
