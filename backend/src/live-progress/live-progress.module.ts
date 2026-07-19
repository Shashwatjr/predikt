import { Module } from '@nestjs/common';
import { LiveProgressController } from './live-progress.controller';
import { LiveProgressService } from './live-progress.service';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [LifecycleModule, NotificationsModule],
  controllers: [LiveProgressController],
  providers: [LiveProgressService],
})
export class LiveProgressModule {}
