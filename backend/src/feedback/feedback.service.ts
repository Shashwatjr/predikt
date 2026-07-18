import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(dto: SubmitFeedbackDto, user: User) {
    const feedback = await this.prisma.userFeedback.create({
      data: {
        userId: user.userId,
        feedbackType: dto.feedbackType,
        category: dto.category,
        message: dto.message,
        contactAllowed: dto.contactAllowed ?? false,
        platform: dto.platform,
        roomId: dto.roomId,
        priority: dto.feedbackType === 'safety_privacy' ? 'high' : 'normal',
      },
    });

    await this.prisma.activityEvent.create({
      data: {
        userId: user.userId,
        roomId: dto.roomId,
        category: dto.category,
        platform: dto.platform,
        eventType: 'feedback_submitted',
        message: 'Feedback submitted',
        metadata: {
          feedbackId: feedback.feedbackId,
          feedbackType: dto.feedbackType,
        },
      },
    });

    return {
      feedbackId: feedback.feedbackId,
      status: feedback.status,
      createdAt: feedback.createdAt,
    };
  }
}
