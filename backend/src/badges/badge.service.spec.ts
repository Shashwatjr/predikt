import { Test, TestingModule } from '@nestjs/testing';
import { BadgeService } from './badge.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('BadgeService', () => {
  let service: BadgeService;
  let prisma: {
    userBadge: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      userBadge: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(BadgeService);
  });

  it('awards category winner badge deterministically', async () => {
    prisma.userBadge.findFirst.mockResolvedValue(null);
    prisma.userBadge.create.mockImplementation(({ data }) => Promise.resolve({ ...data, userBadgeId: 'b-1' }));

    const awarded = await service.awardRoomBadges({
      roomId: 'room-1',
      category: 'weather_rain',
      winnerUserId: 'user-1',
      userBeatBot: true,
      dotBonusAwarded: true,
      diffSeconds: 45,
      participantCount: 4,
      isNeutralClosure: false,
    });

    expect(awarded.some((badge) => badge.badgeKey === 'rain_oracle')).toBe(true);
    expect(awarded.some((badge) => badge.badgeKey === 'bot_beater')).toBe(true);
    expect(prisma.userBadge.create).toHaveBeenCalled();
  });

  it('skips badge awards for neutral closures', async () => {
    const awarded = await service.awardRoomBadges({
      roomId: 'room-1',
      category: 'arrival_time',
      winnerUserId: 'user-1',
      isNeutralClosure: true,
    });

    expect(awarded).toEqual([]);
    expect(prisma.userBadge.create).not.toHaveBeenCalled();
  });

  it('is idempotent for duplicate room badge awards', async () => {
    prisma.userBadge.findFirst.mockResolvedValue({
      userBadgeId: 'existing',
      badgeKey: 'route_oracle',
      title: 'Route Oracle',
    });

    const badge = await service.ensureBadge({
      userId: 'user-1',
      badgeKey: 'route_oracle',
      roomId: 'room-1',
      category: 'arrival_time',
    });

    expect(badge?.title).toBe('Route Oracle');
    expect(prisma.userBadge.create).not.toHaveBeenCalled();
  });
});
