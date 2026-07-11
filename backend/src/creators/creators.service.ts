import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { UpsertCreatorDto } from './dto/upsert-creator.dto';

function optionalValue(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value === 'string') return value;
  return String(value);
}

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMe(user: AuthenticatedUser, body: UpsertCreatorDto) {
    const existing = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.userId },
    });

    return this.prisma.creatorProfile.upsert({
      where: { userId: user.userId },
      update: {
        displayName: optionalValue(body.displayName),
        handle: optionalValue(body.handle),
        instagramHandle: optionalValue(body.instagramHandle),
        facebookPage: optionalValue(body.facebookPage),
        youtubeHandle: optionalValue(body.youtubeHandle),
        creatorCategory: optionalValue(body.creatorCategory),
        audienceSizeLabel: optionalValue(body.audienceSizeLabel),
      },
      create: {
        userId: user.userId,
        displayName: optionalValue(body.displayName),
        handle: optionalValue(body.handle),
        instagramHandle: optionalValue(body.instagramHandle),
        facebookPage: optionalValue(body.facebookPage),
        youtubeHandle: optionalValue(body.youtubeHandle),
        creatorCategory: optionalValue(body.creatorCategory),
        audienceSizeLabel: optionalValue(body.audienceSizeLabel),
        subscriptionPlan: existing?.subscriptionPlan ?? 'free',
      },
    });
  }

  async getMe(user: AuthenticatedUser) {
    return this.prisma.creatorProfile.findUnique({
      where: { userId: user.userId },
    });
  }

  async patchMe(user: AuthenticatedUser, body: UpsertCreatorDto) {
    const existing = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.userId },
    });
    if (!existing) {
      throw new ForbiddenException('Create a creator profile first');
    }

    return this.prisma.creatorProfile.update({
      where: { userId: user.userId },
      data: {
        displayName: body.displayName ?? existing.displayName,
        handle: body.handle ?? existing.handle,
        instagramHandle:
          body.instagramHandle === undefined
            ? existing.instagramHandle
            : optionalValue(body.instagramHandle),
        facebookPage:
          body.facebookPage === undefined
            ? existing.facebookPage
            : optionalValue(body.facebookPage),
        youtubeHandle:
          body.youtubeHandle === undefined
            ? existing.youtubeHandle
            : optionalValue(body.youtubeHandle),
        creatorCategory:
          body.creatorCategory === undefined
            ? existing.creatorCategory
            : optionalValue(body.creatorCategory),
        audienceSizeLabel:
          body.audienceSizeLabel === undefined
            ? existing.audienceSizeLabel
            : optionalValue(body.audienceSizeLabel),
      },
    });
  }
}
