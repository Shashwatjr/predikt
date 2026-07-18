import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { TrackEventDto } from './dto/track-event.dto';

const SENSITIVE_METADATA_KEYS = new Set([
  'guestKey',
  'accessToken',
  'refreshToken',
  'passwordHash',
  'startingLat',
  'startingLng',
  'destinationLat',
  'destinationLng',
  'encodedPolyline',
  'exactAddress',
  'rawGps',
  'predictionValue',
  'feedbackText',
  'commentaryText',
]);

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(dto: TrackEventDto, user: User) {
    const metadata = sanitizeMetadata(dto.metadata);
    const roomId = dto.roomId ?? (metadata?.roomId as string | undefined);
    const category = dto.category ?? (metadata?.category as string | undefined);
    const platform = dto.platform ?? (metadata?.platform as string | undefined);
    const sessionId = dto.sessionId ?? (metadata?.sessionId as string | undefined);

    const event = await this.prisma.activityEvent.create({
      data: {
        userId: user.userId,
        roomId,
        category,
        platform,
        sessionId,
        eventVersion: dto.eventVersion ?? '1',
        eventType: dto.eventType,
        message: dto.message ?? dto.eventType.replace(/_/g, ' '),
        metadata: metadata as never,
      },
    });

    return {
      activityEventId: event.activityEventId,
      eventType: event.eventType,
      createdAt: event.createdAt,
    };
  }
}

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.has(key)) continue;
    if (typeof value === 'string' && value.length > 500) {
      safe[key] = `${value.slice(0, 500)}…`;
      continue;
    }
    safe[key] = value;
  }
  return safe;
}
