import { Module } from '@nestjs/common';
import { LiveProgressController } from './live-progress.controller';
import { LiveProgressService } from './live-progress.service';
import { LifecycleModule } from '../lifecycle/lifecycle.module';

@Module({
  imports: [LifecycleModule],
  controllers: [LiveProgressController],
  providers: [LiveProgressService],
})
export class LiveProgressModule {}
