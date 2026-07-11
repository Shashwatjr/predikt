import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TrackEventDto } from './dto/track-event.dto';
import { EventsService } from './events.service';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Throttle({ default: { limit: 80, ttl: 60_000 } })
  track(@Body() dto: TrackEventDto, @CurrentUser() user: User) {
    return this.eventsService.track(dto, user);
  }
}
