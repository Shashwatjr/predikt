import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildNeutralCommentary, fallbackCategoryLine, isSafeCommentaryText, sanitizeInput, shouldForceNeutralMode, validatePersonality } from './commentary.guardrails';
import { renderTemplate } from './commentary.templates';
import { CommentaryInput, CommentaryResponse } from './commentary.types';
import { publicDisplayName } from '../common/utils/safe-user-select';

const MAX_REGENERATIONS = Number(process.env.AI_COMMENTARY_MAX_REGENERATIONS ?? 2);

@Injectable()
export class CommentaryService {
  private readonly logger = new Logger(CommentaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generateResultCommentary(input: CommentaryInput): Promise<CommentaryResponse> {
    const safeInput = sanitizeInput(input);
    const personality = validatePersonality(safeInput.personality);
    const commentaryEnabled = safeInput.commentaryEnabled ?? true;
    const aiCommentaryOptOut = safeInput.aiCommentaryOptOut ?? false;
    const aiEnabled = process.env.AI_COMMENTARY_ENABLED !== 'false';
    const provider = process.env.AI_COMMENTARY_PROVIDER ?? 'templates';

    const neutral = shouldForceNeutralMode(safeInput);
    if (neutral) {
      const neutralCopy = buildNeutralCommentary();
      await this.auditCommentary('neutral', 'templates', safeInput.roomId, personality, neutralCopy);
      return {
        roomId: safeInput.roomId,
        personality,
        ...neutralCopy,
        safetyMode: 'neutral',
        provider: 'templates',
        generatedAt: new Date().toISOString(),
        generationVersion: 1,
      };
    }

    if (!commentaryEnabled || aiCommentaryOptOut || !aiEnabled) {
      const fallback = this.buildFallbackCommentary(personality, safeInput);
      await this.auditCommentary('deterministic', provider, safeInput.roomId, personality, fallback);
      return {
        roomId: safeInput.roomId,
        personality,
        ...fallback,
        safetyMode: 'deterministic',
        provider: provider as 'templates' | 'local' | 'openai' | 'auto',
        generatedAt: new Date().toISOString(),
        generationVersion: 1,
      };
    }

    const rendered = renderTemplate(personality, safeInput);
    const headline = rendered.headline;
    const punchline = rendered.punchline;
    const supportingLine = rendered.supportingLine;

    const content = `${headline}\n${punchline}\n${supportingLine}`;
    const safe = isSafeCommentaryText(content);
    if (!safe) {
      const fallback = this.buildFallbackCommentary(personality, safeInput);
      await this.auditCommentary('fallback', 'templates', safeInput.roomId, personality, fallback);
      return {
        roomId: safeInput.roomId,
        personality,
        ...fallback,
        safetyMode: 'fallback',
        provider: 'templates',
        generatedAt: new Date().toISOString(),
        generationVersion: 1,
      };
    }

    await this.auditCommentary('deterministic', 'templates', safeInput.roomId, personality, { headline, punchline, supportingLine });
    return {
      roomId: safeInput.roomId,
      personality,
      headline,
      punchline,
      supportingLine,
      safetyMode: 'deterministic',
      provider: 'templates',
      generatedAt: new Date().toISOString(),
      generationVersion: 1,
    };
  }

  async getCommentary(roomId: string, userId: string) {
    await this.assertParticipant(roomId, userId);

    const existing = await this.prisma.roomCommentary.findFirst({
      where: { roomId, isCurrent: true },
      orderBy: { generationVersion: 'desc' },
    });

    if (existing) {
      return this.toCommentaryPayload(existing, await this.regenerationMeta(roomId));
    }

    const generated = await this.generateAndPersist(roomId, userId);
    return generated;
  }

  async regenerateCommentary(roomId: string, userId: string) {
    await this.assertParticipant(roomId, userId);

    const historyCount = await this.prisma.roomCommentary.count({ where: { roomId } });
    if (historyCount >= MAX_REGENERATIONS) {
      throw new ForbiddenException('Commentary regeneration limit reached');
    }

    const current = await this.prisma.roomCommentary.findFirst({
      where: { roomId, isCurrent: true },
      orderBy: { generationVersion: 'desc' },
    });

    if (current) {
      await this.prisma.roomCommentary.update({
        where: { commentaryId: current.commentaryId },
        data: { isCurrent: false },
      });
    }

    const generated = await this.generateAndPersist(roomId, userId, {
      generationVersion: (current?.generationVersion ?? 0) + 1,
      regenerated: true,
    });

    await this.auditService.log({
      actorType: 'user',
      actorId: userId,
      action: 'commentary.regenerated',
      targetType: 'room',
      targetId: roomId,
      afterValue: { generationVersion: generated.generationVersion },
    });

    return generated;
  }

  async getCommentaryHistory(roomId: string, userId: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      select: { creatorUserId: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorUserId !== userId) {
      throw new ForbiddenException('Only the room creator can view commentary history');
    }

    const history = await this.prisma.roomCommentary.findMany({
      where: { roomId },
      orderBy: { generationVersion: 'desc' },
      select: {
        commentaryId: true,
        personality: true,
        safetyMode: true,
        provider: true,
        generationVersion: true,
        generatedAt: true,
        regeneratedAt: true,
        moderationStatus: true,
        isCurrent: true,
      },
    });

    return history.map((entry) => ({
      ...entry,
      generatedAt: entry.generatedAt.toISOString(),
      regeneratedAt: entry.regeneratedAt?.toISOString() ?? null,
    }));
  }

  async updateUserPreference(
    userId: string,
    body: {
      commentaryEnabled?: boolean;
      aiCommentaryOptOut?: boolean;
      preferredCommentaryPersonality?: string;
      toneLevel?: 'gentle' | 'playful' | 'spicy';
      aiOptOut?: boolean;
      personality?: string;
      enabled?: boolean;
    },
  ) {
    const updated = await this.prisma.user.update({
      where: { userId },
      data: {
        commentaryEnabled:
          typeof body.enabled === 'boolean'
            ? body.enabled
            : typeof body.commentaryEnabled === 'boolean'
              ? body.commentaryEnabled
              : undefined,
        aiCommentaryOptOut:
          typeof body.aiOptOut === 'boolean'
            ? body.aiOptOut
            : typeof body.aiCommentaryOptOut === 'boolean'
              ? body.aiCommentaryOptOut
              : undefined,
        preferredCommentaryPersonality:
          body.personality ?? body.preferredCommentaryPersonality ?? undefined,
        commentaryToneLevel: body.toneLevel ?? undefined,
      },
    });

    return {
      enabled: updated.commentaryEnabled,
      commentaryEnabled: updated.commentaryEnabled,
      aiOptOut: updated.aiCommentaryOptOut,
      aiCommentaryOptOut: updated.aiCommentaryOptOut,
      personality: updated.preferredCommentaryPersonality,
      preferredCommentaryPersonality: updated.preferredCommentaryPersonality,
      toneLevel: updated.commentaryToneLevel,
    };
  }

  private async generateAndPersist(
    roomId: string,
    userId: string,
    options?: { generationVersion?: number; regenerated?: boolean },
  ) {
    const context = await this.buildCommentaryContext(roomId, userId);
    const generated = await this.generateResultCommentary(context);
    const generationVersion = options?.generationVersion ?? 1;

    const persisted = await this.prisma.roomCommentary.create({
      data: {
        roomId,
        generatedByUserId: userId,
        personality: generated.personality,
        headline: generated.headline,
        punchline: generated.punchline,
        supportingLine: generated.supportingLine,
        safetyMode: generated.safetyMode,
        provider: generated.provider,
        providerVersion: generated.provider,
        generationVersion,
        generatedAt: new Date(generated.generatedAt),
        regeneratedAt: options?.regenerated ? new Date() : null,
        isCurrent: true,
        metadata: {
          category: context.category,
          resultType: context.resultType,
        },
      },
    });

    return this.toCommentaryPayload(persisted, await this.regenerationMeta(roomId));
  }

  private async buildCommentaryContext(roomId: string, userId: string): Promise<CommentaryInput> {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: {
        milestones: { orderBy: { milestoneOrder: 'asc' } },
        results: {
          include: { user: true },
          orderBy: [{ overallRank: 'asc' }, { totalRoomAura: 'desc' }],
        },
        roomMemberships: { where: { status: 'joined' } },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        commentaryEnabled: true,
        aiCommentaryOptOut: true,
        preferredCommentaryPersonality: true,
        commentaryToneLevel: true,
      },
    });

    const winner = room.results[0];
    const finalMilestone =
      room.milestones.find((m) => m.milestoneType === 'final_destination')
      ?? room.milestones[room.milestones.length - 1];
    const winnerPrediction = winner
      ? await this.prisma.milestonePrediction.findFirst({
          where: { roomId, userId: winner.userId, milestoneId: finalMilestone?.milestoneId },
        })
      : null;

    const oracleLabel = this.extractOracleLabel(room.oracleBotPrediction);
    const actualOutcomeLabel = this.formatActualOutcome(finalMilestone, room);
    const winnerPredictionLabel = winnerPrediction
      ? this.formatPredictionLabel(winnerPrediction, room.answerType)
      : undefined;
    const differenceLabel = this.formatDifferenceLabel(winnerPrediction);
    const userBeatBot = this.didUserBeatBot(winnerPrediction, finalMilestone, room.oracleBotPrediction, room.answerType);

    const primaryBadge = await this.prisma.userBadge.findFirst({
      where: { roomId, userId: winner?.userId ?? undefined },
      orderBy: { awardedAt: 'asc' },
    });

    const resultType = this.resolveResultType(room.status, room.journeyStatus, room.resultDisputed);
    const safeMode =
      room.resultDisputed ||
      room.rewardsSuppressed ||
      ['cancelled', 'abandoned', 'auto_closed', 'disputed'].includes(resultType);

    return {
      roomId,
      category: room.category ?? room.templateKey ?? room.roomCategory ?? 'arrival_time',
      personality: user?.preferredCommentaryPersonality ?? 'Oracle',
      roomTitle: room.roomTitle,
      resultType,
      winnerHandle: winner ? publicDisplayName(winner.user) : null,
      winnerPredictionLabel,
      actualOutcomeLabel,
      differenceLabel,
      baselineLabel: room.baselineLabel ?? undefined,
      oracleBotLabel: oracleLabel,
      badgeLabel: primaryBadge?.title ?? null,
      userBeatBot,
      comebackEligible: Boolean(winner && winner.userId !== userId),
      participantCount: room.roomMemberships.length,
      commentaryEnabled: user?.commentaryEnabled ?? true,
      aiCommentaryOptOut: user?.aiCommentaryOptOut ?? false,
      safeMode,
    };
  }

  private async regenerationMeta(roomId: string) {
    const count = await this.prisma.roomCommentary.count({ where: { roomId } });
    return {
      canRegenerate: count < MAX_REGENERATIONS,
      remainingRegenerations: Math.max(0, MAX_REGENERATIONS - count),
    };
  }

  private toCommentaryPayload(
    row: {
      commentaryId: string;
      roomId: string;
      personality: string;
      headline: string;
      punchline: string;
      supportingLine: string | null;
      safetyMode: string;
      provider: string;
      generationVersion: number;
      generatedAt: Date;
    },
    meta: { canRegenerate: boolean; remainingRegenerations: number },
  ) {
    return {
      commentaryId: row.commentaryId,
      roomId: row.roomId,
      personality: row.personality,
      headline: row.headline,
      punchline: row.punchline,
      supportingLine: row.supportingLine ?? '',
      safetyMode: row.safetyMode,
      provider: row.provider,
      generationVersion: row.generationVersion,
      generatedAt: row.generatedAt.toISOString(),
      canRegenerate: meta.canRegenerate,
      remainingRegenerations: meta.remainingRegenerations,
    };
  }

  private buildFallbackCommentary(personality: string, input: CommentaryInput) {
    if (shouldForceNeutralMode(input)) {
      return buildNeutralCommentary();
    }

    if (personality === 'Oracle') {
      return {
        headline: 'The benchmark had a theory. The room had the receipts.',
        punchline: `${input.winnerHandle ?? 'The closest guess'} beat ${input.oracleBotLabel ?? input.baselineLabel ?? 'the benchmark'}. Oracle Bot is requesting a recount.`,
        supportingLine: input.badgeLabel
          ? `${input.badgeLabel} unlocked. The spreadsheet is taking it well.`
          : 'The math was respectable. The instinct was better.',
      };
    }

    if (personality === 'Chaos') {
      return {
        headline: 'A normal prediction. An unnecessary amount of drama.',
        punchline: input.oracleBotLabel
          ? `${input.winnerHandle ?? 'The winner'} trusted instinct over ${input.oracleBotLabel}. Rude. Correct, but rude.`
          : `${input.winnerHandle ?? 'The winner'} called it clean and now gets to be unbearable about it.`,
        supportingLine: input.comebackEligible
          ? 'A rematch is basically inevitable now.'
          : 'No scandal. Just one person being right a little too loudly.',
      };
    }

    return {
      headline: 'Somebody was right and will not let it go.',
      punchline: `${input.winnerHandle ?? 'The closest guess'} made the sharper call. The rest of the room is calling it character development.`,
      supportingLine: input.comebackEligible
        ? 'Fair result, mild chaos, strong case for a rematch.'
        : fallbackCategoryLine(input.category),
    };
  }

  private resolveResultType(status: string, journeyStatus?: string | null, resultDisputed?: boolean | null) {
    if (resultDisputed) return 'disputed';
    if (status === 'cancelled') return 'cancelled';
    if (journeyStatus === 'auto_closed') return 'auto_closed';
    if (journeyStatus === 'abandoned') return 'abandoned';
    if (journeyStatus === 'plan_changed') return 'cancelled';
    return 'completed';
  }

  private extractOracleLabel(oracleBotPrediction: unknown) {
    if (!oracleBotPrediction || typeof oracleBotPrediction !== 'object') {
      return undefined;
    }
    const label = (oracleBotPrediction as Record<string, unknown>).label;
    return typeof label === 'string' ? label : undefined;
  }

  private formatActualOutcome(
    milestone: { actualReachedTime?: Date | null; actualOptionKey?: string | null } | null | undefined,
    room: { actualEndTime?: Date | null },
  ) {
    if (milestone?.actualOptionKey) {
      return String(milestone.actualOptionKey).replace(/_/g, ' ');
    }
    const actual = milestone?.actualReachedTime ?? room.actualEndTime;
    return actual ? new Date(actual).toLocaleString() : 'Result recorded';
  }

  private formatPredictionLabel(
    prediction: { predictedReachedTime: Date; selectedOptionKey?: string | null },
    answerType: string,
  ) {
    if (answerType === 'multiple_choice' || answerType === 'yes_no') {
      return prediction.selectedOptionKey?.replace(/_/g, ' ') ?? 'Closest valid guess';
    }
    return new Date(prediction.predictedReachedTime).toLocaleString();
  }

  private formatDifferenceLabel(prediction: { differenceFromActualMinutes?: number | null; differenceFromActualSeconds?: number | null } | null) {
    if (!prediction) return undefined;
    if (typeof prediction.differenceFromActualSeconds === 'number') {
      if (prediction.differenceFromActualSeconds === 0) return 'Exact';
      if (prediction.differenceFromActualSeconds < 60) return `${prediction.differenceFromActualSeconds} seconds`;
    }
    if (typeof prediction.differenceFromActualMinutes === 'number') {
      return `${prediction.differenceFromActualMinutes.toFixed(1)} min`;
    }
    return undefined;
  }

  private didUserBeatBot(
    winnerPrediction: { differenceFromActualSeconds?: number | null } | null,
    milestone: { actualReachedTime?: Date | null } | null | undefined,
    oracleBotPrediction: unknown,
    answerType: string,
  ) {
    if (!winnerPrediction || !milestone?.actualReachedTime || !oracleBotPrediction || typeof oracleBotPrediction !== 'object') {
      return false;
    }
    const oracleMinutes = (oracleBotPrediction as Record<string, unknown>).predictedDurationMinutes;
    if (typeof oracleMinutes !== 'number' || answerType === 'multiple_choice' || answerType === 'yes_no') {
      const oracleLabel = (oracleBotPrediction as Record<string, unknown>).label;
      return typeof oracleLabel === 'string' && (winnerPrediction.differenceFromActualSeconds ?? 999) <= 120;
    }
    return (winnerPrediction.differenceFromActualSeconds ?? 999) < oracleMinutes * 60;
  }

  private async assertParticipant(roomId: string, userId: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      select: { creatorUserId: true, status: true, journeyStatus: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    const membership = await this.prisma.roomMembership.findFirst({
      where: { roomId, userId, status: 'joined' },
    });
    if (room.creatorUserId !== userId && !membership) {
      throw new ForbiddenException('Only room participants can view commentary');
    }

    const eligible =
      room.status === 'completed' ||
      ['completed', 'auto_closed', 'abandoned', 'plan_changed', 'cancelled_by_host'].includes(room.journeyStatus ?? '');
    if (!eligible) {
      throw new ForbiddenException('Commentary is available after the room result is ready');
    }
  }

  private async auditCommentary(mode: string, provider: string, roomId: string, personality: string, payload: { headline: string; punchline: string; supportingLine: string }) {
    try {
      await this.auditService.log({
        actorType: 'system',
        action: 'commentary.generated',
        targetType: 'room',
        targetId: roomId,
        afterValue: { mode, provider, personality, payload },
      });
    } catch (error) {
      this.logger.warn(`Commentary audit failed: ${(error as Error).message}`);
    }
  }
}
