import { CreatorsService } from './creators.service';

describe('CreatorsService', () => {
  it('allows empty social handles on create', async () => {
    const prisma = {
      creatorProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          instagramHandle: null,
          facebookPage: null,
          youtubeHandle: null,
        }),
      },
    } as any;

    const service = new CreatorsService(prisma);
    const result = await service.upsertMe({ userId: 'u1' } as any, {
      displayName: 'Aarav',
      instagramHandle: '',
      facebookPage: '',
      youtubeHandle: '',
    });

    expect(prisma.creatorProfile.upsert).toHaveBeenCalled();
    expect(result.instagramHandle).toBeNull();
  });

  it('allows empty social handles on patch', async () => {
    const prisma = {
      creatorProfile: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'u1',
          instagramHandle: '@demo',
          facebookPage: 'fb',
          youtubeHandle: '@yt',
          creatorCategory: 'travel',
          audienceSizeLabel: '1k-10k',
        }),
        update: jest.fn().mockResolvedValue({
          instagramHandle: null,
          facebookPage: null,
          youtubeHandle: null,
        }),
      },
    } as any;

    const service = new CreatorsService(prisma);
    const result = await service.patchMe({ userId: 'u1' } as any, {
      instagramHandle: '',
      facebookPage: '',
      youtubeHandle: '',
    });

    expect(prisma.creatorProfile.update).toHaveBeenCalled();
    expect(result.facebookPage).toBeNull();
  });
});
