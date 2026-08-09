import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CommentaryService } from '../commentary/commentary.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly commentaryService: CommentaryService,
  ) {}

  @Get('handle-available/:handle')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  handleAvailable(@Param('handle') handle: string) {
    return this.usersService.handleAvailable(handle);
  }

  @UseGuards(JwtAuthGuard)
  @Get('handle-suggestions')
  handleSuggestions(@CurrentUser() user: User) {
    return this.usersService.handleSuggestions(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':userId/follow')
  follow(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.usersService.follow(user, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':userId/follow')
  unfollow(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.usersService.unfollow(user, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/following')
  following(@CurrentUser() user: User) {
    return this.usersService.following(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/followers')
  followers(@CurrentUser() user: User) {
    return this.usersService.followers(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  updateProfile(@CurrentUser() user: User, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/commentary-preference')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  updateCommentaryPreference(
    @CurrentUser() user: User,
    @Body()
    body: {
      enabled?: boolean;
      commentaryEnabled?: boolean;
      aiOptOut?: boolean;
      aiCommentaryOptOut?: boolean;
      personality?: string;
      preferredCommentaryPersonality?: string;
      toneLevel?: 'gentle' | 'playful' | 'spicy';
    },
  ) {
    return this.commentaryService.updateUserPreference(user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  async stats(@CurrentUser() user: User) {
    const reliability = await this.usersService.reliabilitySummary(user.userId);
    return {
      totalAura: user.totalAura,
      weeklyAura: user.weeklyAura,
      cloutBalance: user.cloutBalance,
      creditBalance: user.creditBalance,
      lifetimeCloutEarned: user.lifetimeCloutEarned,
      winsCount: user.winsCount,
      predictionsMadeCount: user.predictionsMadeCount,
      roomsCreatedCount: user.roomsCreatedCount,
      predictionAccuracyScore: user.predictionAccuracyScore,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      ...reliability,
    };
  }
}
