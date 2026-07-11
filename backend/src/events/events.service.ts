import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { TrackEventDto } from './dto/track-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(dto: TrackEventDto, user: User) {
    const event = await this.prisma.activityEvent.create({
      data: {
        userId: user.userId,
        eventType: dto.eventType,
        message: dto.message ?? dto.eventType.replace(/_/g, ' '),
        metadata: dto.metadata as never,
      },
    });

    return {
      activityEventId: event.activityEventId,
      eventType: event.eventType,
      createdAt: event.createdAt,
    };
  }
}
