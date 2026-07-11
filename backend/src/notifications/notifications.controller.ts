import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.notificationsService.list(user);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: User) {
    return this.notificationsService.unreadCount(user);
  }

  @Patch(':notificationId/read')
  markRead(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: User,
  ) {
    return this.notificationsService.markRead(notificationId, user);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllRead(user);
  }
}
