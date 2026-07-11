import { Test, TestingModule } from '@nestjs/testing';
import { CommentaryService } from './commentary.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('CommentaryService', () => {
  let service: CommentaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentaryService,
        {
          provide: PrismaService,
          useValue: {
            predictionRoom: { findUnique: jest.fn() },
            user: { findUnique: jest.fn(), update: jest.fn() },
            roomMembership: { findFirst: jest.fn() },
            roomCommentary: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            milestonePrediction: { findFirst: jest.fn() },
            userBadge: { findFirst: jest.fn() },
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CommentaryService>(CommentaryService);
  });

  it('uses deterministic fallback when commentary is opted out', async () => {
    const result = await service.generateResultCommentary({
      roomId: 'room-1',
      category: 'arrival_time',
      personality: 'Oracle',
      resultType: 'completed',
      winnerHandle: '@shashwat',
      winnerPredictionLabel: '9:31 AM',
      actualOutcomeLabel: '9:34 AM',
      differenceLabel: '3 minutes',
      baselineLabel: 'Oracle Bot: 9:35 AM',
      oracleBotLabel: '9:35 AM',
      userBeatBot: true,
      comebackEligible: true,
      participantCount: 4,
      commentaryEnabled: false,
      aiCommentaryOptOut: true,
    } as any);

    expect(result.safetyMode).toBe('deterministic');
    expect(result.provider).toBe('templates');
    expect(result.headline).toContain('@shashwat');
  });

  it('rejects unsafe personality values', async () => {
    await expect(
      service.generateResultCommentary({
        roomId: 'room-1',
        category: 'arrival_time',
        personality: 'Unsafe' as any,
        resultType: 'completed',
        winnerHandle: '@shashwat',
        winnerPredictionLabel: '9:31 AM',
        actualOutcomeLabel: '9:34 AM',
        differenceLabel: '3 minutes',
        baselineLabel: 'Oracle Bot: 9:35 AM',
        oracleBotLabel: '9:35 AM',
        userBeatBot: true,
        comebackEligible: true,
        participantCount: 4,
      } as any),
    ).rejects.toThrow('Unsupported personality');
  });

  it('uses neutral tone for cancelled rooms', async () => {
    const result = await service.generateResultCommentary({
      roomId: 'room-1',
      category: 'arrival_time',
      personality: 'Chaos',
      resultType: 'cancelled',
      winnerHandle: '@shashwat',
      winnerPredictionLabel: '9:31 AM',
      actualOutcomeLabel: 'Plan changed',
      differenceLabel: 'n/a',
      baselineLabel: 'Oracle Bot: 9:35 AM',
      oracleBotLabel: '9:35 AM',
      userBeatBot: false,
      comebackEligible: true,
      participantCount: 4,
    } as any);

    expect(result.safetyMode).toBe('neutral');
    expect(result.headline).toContain('Fair reset');
  });

  it('forces neutral commentary when safe mode is enabled', async () => {
    const result = await service.generateResultCommentary({
      roomId: 'room-1',
      category: 'arrival_time',
      personality: 'Chaos',
      resultType: 'completed',
      safeMode: true,
    } as any);

    expect(result.safetyMode).toBe('neutral');
    expect(result.punchline).toContain('closed fairly');
  });

  it('returns persisted commentary without regenerating on repeat fetch', async () => {
    const prisma = (service as any).prisma as {
      predictionRoom: { findUnique: jest.Mock };
      roomMembership: { findFirst: jest.Mock };
      roomCommentary: { findFirst: jest.Mock; count: jest.Mock };
    };
    prisma.predictionRoom.findUnique.mockResolvedValue({
      creatorUserId: 'user-1',
      status: 'completed',
      journeyStatus: 'completed',
    });
    prisma.roomMembership.findFirst.mockResolvedValue({ status: 'joined' });
    prisma.roomCommentary.findFirst.mockResolvedValue({
      commentaryId: 'c-1',
      roomId: 'room-1',
      personality: 'Oracle',
      headline: 'Saved headline',
      punchline: 'Saved punchline',
      supportingLine: 'Saved support',
      safetyMode: 'deterministic',
      provider: 'templates',
      generationVersion: 1,
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    prisma.roomCommentary.count.mockResolvedValue(1);

    const result = await service.getCommentary('room-1', 'user-1');

    expect(result.headline).toBe('Saved headline');
    expect(result.canRegenerate).toBe(true);
    expect(result.remainingRegenerations).toBe(1);
  });
});
