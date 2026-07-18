import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import {
  MovementAvatarType,
  RoomCategory,
  SocialMode,
  User,
  Visibility,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  defaultSafetyDelayMinutes,
  safeMilestones,
  safeRoomProjection,
} from '../common/utils/location-privacy';
import { findBannedBettingTerms } from '../common/utils/content-policy';
import { POLICY_BLOCK_MESSAGE } from '../common/constants/policy.constants';
import { safePublicUser } from '../common/utils/safe-user-select';
import { ShareRoomEventDto } from './dto/share-room-event.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { featureFlags } from '../config/feature-flags';
import {
  buildPredictionWindow,
  getLatePredictionDeadline,
  isLatePredictionWindowOpen,
} from '../common/utils/late-prediction';

interface RoomCreatorIdentity {
  userId: string;
}

const ROOM_CREATOR_SELECT = {
  userId: true,
  name: true,
  prediktHandle: true,
  profileImage: true,
  avatarKey: true,
  totalAura: true,
  weeklyAura: true,
  cloutBalance: true,
  creditBalance: true,
  winsCount: true,
  userFlexes: { include: { flex: true } },
  creatorProfile: true,
} as const;

// Rooms whose creator physically travels and streams live GPS. The creator can
// only be in one place at a time, so at most one of these may be active at once.
// Everything else (delivery/food ETA tracked via an external app, weather,
// custom, brand, ai_vs_human) consumes no exclusive resource and runs unlimited
// in parallel — and skips the movement start-delay.
const GPS_TRACKED_ROOM_CATEGORIES = new Set<string>([
  'journey',
  'milestone_journey',
  'travel',
  'fitness',
]);

export function usesExclusiveLocationResource(roomCategory?: string | null): boolean {
  return !!roomCategory && GPS_TRACKED_ROOM_CATEGORIES.has(roomCategory);
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 5 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
}

function defaultMovementAvatarType(roomCategory: RoomCategory): MovementAvatarType {
  switch (roomCategory) {
    case 'fitness':
      return 'runner';
    case 'delivery':
      return 'delivery_bike';
    case 'travel':
      return 'flight';
    case 'creator_challenge':
      return 'walker';
    case 'brand_room':
      return 'car';
    case 'ai_vs_human':
      return 'custom';
    default:
      return 'car';
  }
}

function normalizeCategory(dto: CreateRoomDto) {
  if (dto.category) return dto.category;
  if (dto.templateKey) return dto.templateKey;
  if (dto.eventType === 'Beat the Forecast') return 'weather_rain';
  return dto.roomCategory ?? 'arrival_time';
}

function buildOracleBotPrediction(dto: CreateRoomDto) {
  if (dto.oracleBotPrediction !== undefined) return dto.oracleBotPrediction;
  const category = normalizeCategory(dto);
  if (category !== 'weather_rain') return null;

  const snapshot = dto.baselineSnapshot ?? {};
  const chance = Number(snapshot.forecastChancePercent ?? dto.baselineValue);
  const forecastWindow =
    typeof snapshot.forecastWindow === 'string' ? snapshot.forecastWindow.toLowerCase() : '';
  if (!Number.isFinite(chance) || chance < 60) {
    return {
      selectedOptionKey: 'no_rain',
      label: 'No Rain',
      reason: 'Forecast chance is below the 60% benchmark line.',
    };
  }
  const selectedOptionKey =
    forecastWindow.includes('before 6') || forecastWindow.includes('5')
      ? 'rain_before_6'
      : 'rain_after_6';
  return {
    selectedOptionKey,
    label: selectedOptionKey === 'rain_before_6' ? 'Yes, before 6 PM' : 'Yes, after 6 PM',
    reason: 'Simple benchmark from the stored forecast snapshot.',
  };
}

function categoryResultShareText(category: string, inviteCode: string) {
  switch (category) {
    case 'weather_rain':
      return 'I beat the forecast on PREDIKT. Rain Oracle unlocked.';
    case 'food_eta':
      return 'I called the delivery ETA closest on PREDIKT.';
    case 'arrival_time':
      return 'Route Oracle unlocked. Closest guess wins Aura.';
    case 'whos_late':
      return 'Time Oracle unlocked. Group chaos, friendly only.';
    case 'gym_habit':
      return 'Consistency Streak unlocked on PREDIKT.';
    default:
      return `Predict what happens next with code ${inviteCode}.`;
  }
}

function buildPinnedComment(inviteCode: string) {
  return `Join my PREDIKT room. Code: ${inviteCode}. Predict my next milestone. Exact location is hidden for safety.`;
}

function buildShareKit(room: any) {
  return {
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    roomLink: `predikt://rooms/code/${room.inviteCode}`,
    pinnedCommentText:
      room.pinnedCommentText ?? buildPinnedComment(room.inviteCode),
    instagramStoryText:
      room.instagramStoryText ??
      `Predict what’s next in ${room.roomTitle}. Code: ${room.inviteCode}`,
    facebookPostText:
      room.facebookPostText ??
      `Predict what’s next with me on PREDIKT. Join with code ${room.inviteCode}.`,
    qrCodePayload: room.qrCodePayload ?? `PREDIKT:${room.inviteCode}`,
    resultShareText:
      room.resultShareText ??
      categoryResultShareText(room.category ?? room.templateKey ?? room.roomCategory, room.inviteCode),
    creatorSocialHandle: room.creatorSocialHandle,
    socialMode: room.socialMode,
  };
}

function normalizeRoomStatus(status: string) {
  return status === 'prediction_open' ? 'predictions_open' : status;
}

function buildInviteQuestion(room: any) {
  const creationMeta = (room.scoringRule as Record<string, unknown> | null)?.creationMeta as
    | Record<string, unknown>
    | undefined;
  const storedQuestion =
    typeof creationMeta?.question === 'string' ? creationMeta.question : undefined;
  if (storedQuestion) {
    return storedQuestion;
  }
  if (room.category === 'weather_rain' || room.templateKey === 'weather_rain') {
    return 'Beat the Forecast';
  }
  if (room.answerType === 'multiple_choice' && room.roomCategory === 'custom') {
    return 'What do you think will happen?';
  }
  if (room.answerType === 'multiple_choice' && room.eventType === 'weather_rain') {
    return 'Beat the Forecast';
  }
  if (room.answerType === 'yes_no') {
    return `Will this ${room.roomCategory === 'delivery' ? 'delivery' : 'journey'} happen as predicted?`;
  }
  if (room.answerType === 'duration') {
    return room.roomCategory === 'delivery'
      ? 'How long will this delivery take?'
      : 'How long will the journey take?';
  }
  return room.roomCategory === 'delivery'
    ? 'When will this delivery arrive?'
    : 'When will this journey finish?';
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalizes an Arrival Time room's benchmark hierarchy for the client:
 * Maps ETA (primary) → Host prediction → Oracle Bot, each as an absolute arrival
 * time so the UI can anchor the picker and show live diffs.
 *
 * Values are immutable snapshots captured at creation. Provenance is honest: a
 * provider label (e.g. "Google Maps") is only emitted for provider-verified
 * estimates; heuristic/approximate estimates surface as "Route estimate".
 */
export function buildArrivalBenchmarks(room: any) {
  const category = room.category ?? room.templateKey ?? room.roomCategory;
  const isArrival =
    category === 'arrival_time' ||
    room.templateKey === 'arrival_time' ||
    (room.roomCategory === 'journey' && room.answerType === 'exact_time');
  if (!isArrival) return null;

  const snapshot = (room.baselineSnapshot ?? {}) as Record<string, any>;
  const route = room.journeyRoute ?? room.route ?? null;

  // Anchor: when the journey is expected to begin. arrival = anchor + eta.
  const anchorStart =
    room.journeyScheduledStartAt ?? room.predictionCloseTime ?? room.baselineCapturedAt ?? null;
  const anchorMs = anchorStart ? new Date(anchorStart).getTime() : null;

  const etaSeconds =
    toFiniteNumber(room.baselineValue) ??
    toFiniteNumber(snapshot.durationSeconds) ??
    toFiniteNumber(room.expectedDurationSeconds) ??
    (route ? toFiniteNumber(route.estimatedDurationSeconds) : null);

  const provider = room.providerName ?? room.baselineSource ?? snapshot.provider ?? null;
  const providerLabel = room.baselineLabel ?? snapshot.providerLabel ?? null;
  const isApproximate =
    snapshot.isApproximate === true || provider === 'approximate' || provider === 'manual' || !provider;
  const verifiedProviders = ['google', 'openstreetmap', 'ola', 'mapbox'];
  const verified = !isApproximate && verifiedProviders.includes(String(provider));

  const arrivalFrom = (seconds: number | null) =>
    seconds != null && anchorMs != null ? new Date(anchorMs + seconds * 1000).toISOString() : null;

  const mapsArrival = arrivalFrom(etaSeconds);
  const mapsEta = mapsArrival
    ? {
        label: verified ? providerLabel ?? 'Maps' : 'Route estimate',
        provider: verified ? provider : null,
        verified,
        arrivalTime: mapsArrival,
        etaSeconds,
        confidence: room.providerConfidence ?? snapshot.confidenceLevel ?? null,
      }
    : null;

  const oracleSeconds = toFiniteNumber(room.oracleBotPrediction?.predictedDurationSeconds);
  const oracleArrival = arrivalFrom(oracleSeconds);
  const oracle = oracleArrival
    ? {
        label: 'Oracle Bot',
        arrivalTime: oracleArrival,
        reason: room.oracleBotPrediction?.reason ?? room.oracleBotPrediction?.label ?? null,
      }
    : null;

  const hostArrival = room.hostPrediction?.arrivalTime;
  const hostPrediction = hostArrival ? { arrivalTime: new Date(hostArrival).toISOString() } : null;

  return {
    category: 'arrival_time',
    anchorStartAt: anchorStart ? new Date(anchorStart).toISOString() : null,
    hasBenchmark: !!(mapsEta || oracle || hostPrediction),
    mapsEta,
    hostPrediction,
    oracle,
    capturedAt: room.baselineCapturedAt ?? snapshot.capturedAt ?? null,
  };
}

function buildSafeInvitePreview(room: any) {
  const participantIds = new Set<string>();
  (room.roomMemberships ?? [])
    .filter((membership: { status: string }) => membership.status === 'joined')
    .forEach((membership: { userId: string }) => participantIds.add(membership.userId));
  (room.milestonePredictions ?? []).forEach((prediction: { userId: string }) =>
    participantIds.add(prediction.userId),
  );

  return {
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    title: room.roomTitle,
    question: buildInviteQuestion(room),
    answerType: room.answerType,
    status: normalizeRoomStatus(room.status),
    lockTime: room.lockTime ?? room.predictionCloseTime,
    visibility: room.visibility,
    participantCount: participantIds.size,
    creatorDisplayName: room.creator?.name ?? null,
    creatorHandle: room.creator?.prediktHandle ?? null,
    benchmarks: buildArrivalBenchmarks(room),
    canLateJoinPredict: canUserStillPredictAfterJourneyStart(room),
    predictionWindow: buildPredictionWindow(room),
    lateJoinPredictionWindowEndsAt: getLateJoinPredictionWindowEndsAt(room)?.toISOString() ?? null,
    lateJoinPredictionArrivalCutoffAt: getLateJoinPredictionArrivalCutoffAt(room)?.toISOString() ?? null,
    selectedBackgroundKey: room.selectedBackground ?? null,
    selectedRoomTheme: room.selectedRoomTheme ?? null,
    routeSummary: room.journeyRoute
      ? {
          startLabel: room.journeyRoute.startLabel,
          destinationLabel: room.journeyRoute.destinationLabel,
          travelMode: room.journeyRoute.travelMode,
        }
      : null,
    safePreview: safeRoomProjection(room, { includeInviteCode: true }),
  };
}

// Late-join prediction timing now lives in a shared util keyed off a live
// pace-projected arrival (no fixed 10-min window). `lateJoinPredictionWindowEndsAt`
// and `lateJoinPredictionArrivalCutoffAt` both map to that single deadline for
// backward-compatible payloads. Requires `locationEvents` (newest first, take 1).
function getLateJoinPredictionWindowEndsAt(room: any): Date | null {
  return getLatePredictionDeadline(room);
}

function getLateJoinPredictionArrivalCutoffAt(room: any): Date | null {
  return getLatePredictionDeadline(room);
}

function canUserStillPredictAfterJourneyStart(room: any): boolean {
  return isLatePredictionWindowOpen(room);
}

function buildInviteUrl(inviteCode: string, configuredBaseUrl?: string | null) {
  const baseUrl = configuredBaseUrl?.trim() || 'http://localhost:8081';
  return `${baseUrl.replace(/\/+$/, '')}?joinCode=${encodeURIComponent(inviteCode)}`;
}

function buildShareCopy(room: any, inviteUrl: string) {
  const question = buildInviteQuestion(room);
  const category = room.category ?? room.templateKey;
  const lines = [
    `Join my PREDIKT room: ${room.roomTitle}`,
    category === 'weather_rain'
      ? 'Beat the Forecast with me.'
      : room.roomCategory === 'journey' || room.roomCategory === 'delivery'
      ? 'Predict this journey outcome with me.'
      : question,
    'Closest guess wins Aura.',
    `Room code: ${room.inviteCode}`,
    room.predictionCloseTime ? `Lock time: ${new Date(room.predictionCloseTime).toLocaleString('en-IN')}` : null,
    `Open: ${inviteUrl}`,
  ].filter(Boolean);

  return lines.join('\n');
}

function safeRoomSummary(room: any) {
  return {
    ...safeRoomProjection(room, { includeInviteCode: true }),
    pinnedCommentText: room.pinnedCommentText,
    instagramStoryText: room.instagramStoryText,
    facebookPostText: room.facebookPostText,
    resultShareText: room.resultShareText,
    creator: safePublicUser(room.creator),
  };
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createFromRoute(dto: any, creator: RoomCreatorIdentity) {
    const room = await this.create(dto, creator);
    if (dto.routeMeta) {
      await this.prisma.journeyRoute.create({
        data: {
          roomId: room.roomId,
          startPlaceId: dto.routeMeta.startPlaceId,
          startLabel: dto.routeMeta.startLabel,
          startLat: dto.routeMeta.startLat,
          startLng: dto.routeMeta.startLng,
          destinationPlaceId: dto.routeMeta.destinationPlaceId,
          destinationLabel: dto.routeMeta.destinationLabel,
          destinationLat: dto.routeMeta.destinationLat,
          destinationLng: dto.routeMeta.destinationLng,
          travelMode: dto.routeMeta.travelMode,
          distanceMeters: dto.routeMeta.distanceMeters,
          estimatedDurationSeconds: dto.routeMeta.estimatedDurationSeconds,
          routeSummary: dto.routeMeta.routeSummary,
          privacyMode: dto.routeMeta.privacyMode ?? 'approximate_delayed',
          safetyDelayMinutes: dto.routeMeta.safetyDelayMinutes ?? room.safetyDelayMinutes,
        },
      });
    }
    return room;
  }

  async create(dto: CreateRoomDto, creator: RoomCreatorIdentity) {
    await this.enforceContentPolicy(
      {
        roomTitle: dto.roomTitle,
        eventType: dto.eventType,
        startingPointLabel: dto.startingPointLabel,
        destinationLabel: dto.destinationLabel,
        creatorSocialHandle: dto.creatorSocialHandle,
        sponsorName: dto.sponsorName,
        resultCardSponsorText: dto.resultCardSponsorText,
        milestones: dto.milestones?.map((m) => `${m.milestoneName} ${m.locationLabel ?? ''}`).join(' '),
      },
      creator.userId,
    );

    let inviteCode: string;
    let attempts = 0;

    do {
      inviteCode = generateInviteCode();
      attempts++;
      if (attempts > 20) {
        throw new Error('Could not generate unique invite code');
      }
    } while (await this.prisma.predictionRoom.findUnique({ where: { inviteCode } }));

    const visibility = dto.visibility ?? 'invite_only';
    const roomCategory = dto.roomCategory ?? 'journey';
    const category = normalizeCategory(dto);

    // Exclusive-resource rule: a location-tracked room ties up the creator's live
    // GPS (they can't be on two journeys at once), so only one may be active at a
    // time. Non-GPS rooms (delivery, weather, custom, …) run unlimited in parallel.
    if (usesExclusiveLocationResource(roomCategory)) {
      const activeTracked = await this.prisma.predictionRoom.findFirst({
        where: {
          creatorUserId: creator.userId,
          status: { notIn: ['completed', 'cancelled'] },
          roomCategory: { in: [...GPS_TRACKED_ROOM_CATEGORIES] as never },
        },
        select: { roomId: true, roomTitle: true },
      });
      if (activeTracked) {
        throw new ConflictException(
          `You're already tracking a live journey ("${activeTracked.roomTitle}"). ` +
            'Finish or cancel it before starting another location-tracked room — non-GPS rooms (delivery, weather, custom) can run in parallel.',
        );
      }
    }

    const oracleBotPrediction = buildOracleBotPrediction(dto);
    const isSponsored = dto.isSponsored ?? false;
    const safetyDelayMinutes =
      dto.safetyDelayMinutes ??
      defaultSafetyDelayMinutes(visibility, roomCategory, isSponsored);

    if (safetyDelayMinutes < 5 || safetyDelayMinutes > 30) {
      throw new BadRequestException('safetyDelayMinutes must be between 5 and 30');
    }

    if (isSponsored && !dto.sponsorName) {
      throw new BadRequestException('sponsorName is required for sponsored rooms');
    }

    if (
      dto.movementAvatarUrl &&
      !isSponsored &&
      roomCategory !== 'custom' &&
      roomCategory !== 'brand_room'
    ) {
      throw new BadRequestException(
        'movementAvatarUrl is only allowed for sponsored or custom-style rooms',
      );
    }

    const socialMode = dto.socialMode ?? 'none';
    const pinnedCommentText =
      socialMode !== 'none' ? buildPinnedComment(inviteCode) : undefined;

    const defaultFinalMilestone: {
      milestoneName: string;
      locationLabel: string;
      predictionCloseTime: string;
      milestoneLat?: number;
      milestoneLng?: number;
      auraMultiplier: number;
      isFinalDestination: boolean;
      milestoneOrder?: number;
    } = {
      milestoneName: dto.destinationLabel,
      locationLabel: dto.destinationLabel,
      predictionCloseTime: dto.predictionCloseTime,
      milestoneLat: dto.destinationLat,
      milestoneLng: dto.destinationLng,
      auraMultiplier: 1,
      isFinalDestination: true,
    };

    const normalizedMilestones = (dto.milestones?.length
      ? dto.milestones
      : [defaultFinalMilestone]
    ).map((milestone, index) => ({
      ...milestone,
      milestoneOrder: milestone.milestoneOrder ?? index + 1,
      predictionCloseTime:
        milestone.predictionCloseTime ?? dto.predictionCloseTime,
      auraMultiplier: milestone.auraMultiplier ?? 1,
    }));

    if (!normalizedMilestones.some((milestone) => milestone.isFinalDestination)) {
      normalizedMilestones.push({
        ...defaultFinalMilestone,
        milestoneOrder: normalizedMilestones.length + 1,
      });
    }

    const sortedMilestones = normalizedMilestones
      .sort((a, b) => a.milestoneOrder - b.milestoneOrder)
      .map((milestone, index, list) => ({
        milestoneOrder: index + 1,
        milestoneName: milestone.milestoneName,
        locationLabel: milestone.locationLabel ?? milestone.milestoneName,
        milestoneLat: milestone.milestoneLat,
        milestoneLng: milestone.milestoneLng,
        predictionCloseTime: milestone.predictionCloseTime
          ? new Date(milestone.predictionCloseTime)
          : null,
        milestoneType:
          milestone.isFinalDestination || index === list.length - 1
            ? ('final_destination' as const)
            : ('intermediate' as const),
        status: 'prediction_open' as const,
        auraMultiplier: milestone.auraMultiplier,
      }));

    const creationMeta = {
      category,
      mode: dto.mode ?? dto.roomType ?? 'friends',
      templateKey: dto.templateKey ?? null,
      baselineSource: dto.baselineSource ?? null,
      baselineLabel: dto.baselineLabel ?? null,
      baselineValue: dto.baselineValue ?? null,
      baselineSnapshot: dto.baselineSnapshot ?? null,
      oracleBotPrediction,
      options: dto.options ?? null,
      question: dto.question ?? dto.eventType,
    };

    const room = await this.prisma.predictionRoom.create({
      data: {
        creatorUserId: creator.userId,
        roomTitle: dto.roomTitle,
        eventType: dto.eventType,
        category,
        mode: dto.mode ?? dto.roomType ?? 'friends',
        templateKey: dto.templateKey,
        baselineSource: dto.baselineSource,
        baselineLabel: dto.baselineLabel,
        baselineValue: dto.baselineValue as never,
        baselineSnapshot: dto.baselineSnapshot as never,
        // Immutable benchmark snapshot — captured once at creation, never overwritten.
        baselineCapturedAt: dto.baselineValue != null ? new Date() : undefined,
        providerName: dto.providerName ?? null,
        providerConfidence: dto.providerConfidence ?? null,
        hostPrediction: dto.hostPrediction as never,
        oracleBotPrediction: oracleBotPrediction as never,
        options: dto.options as never,
        roomType: dto.roomType ?? 'journey',
        answerType: dto.answerType ?? 'exact_time',
        predictionMode: dto.mode ?? 'milestone',
        predictionVisibilityMode: dto.predictionVisibilityMode ?? 'hidden_until_lock',
        roomCategory,
        startingPointLabel: dto.startingPointLabel,
        destinationLabel: dto.destinationLabel,
        predictionCloseTime: new Date(dto.predictionCloseTime),
        resultDeadline: dto.resultDeadline ? new Date(dto.resultDeadline) : undefined,
        journeyStatus: dto.journeyStatus ?? 'scheduled',
        journeyScheduledStartAt: dto.journeyScheduledStartAt
          ? new Date(dto.journeyScheduledStartAt)
          : dto.plannedStartTime
            ? new Date(dto.plannedStartTime)
            : undefined,
        expectedDurationSeconds: dto.expectedDurationSeconds,
        gracePeriodSeconds: dto.gracePeriodSeconds,
        autoCloseAt: dto.autoCloseAt ? new Date(dto.autoCloseAt) : undefined,
        noStartCutoffAt: dto.noStartCutoffAt ? new Date(dto.noStartCutoffAt) : undefined,
        scoringRule: {
          ...(dto.scoringRule ?? {}),
          creationMeta,
        } as never,
        outcomeSource: dto.outcomeSource,
        confidenceLevel: dto.confidenceLevel,
        selectedBackground: dto.selectedBackground,
        selectedRoomTheme: dto.selectedRoomTheme,
        startingLat: dto.startingLat,
        startingLng: dto.startingLng,
        destinationLat: dto.destinationLat,
        destinationLng: dto.destinationLng,
        visibility,
        locationDisplayMode: dto.locationDisplayMode ?? 'delayed',
        safetyDelayMinutes,
        disableRouteReplay: dto.disableRouteReplay ?? true,
        hideExactStart: dto.hideExactStart ?? true,
        hideExactDestination: dto.hideExactDestination ?? true,
        autoPauseNearDestination: dto.autoPauseNearDestination ?? true,
        socialMode,
        creatorSocialPlatform: dto.creatorSocialPlatform,
        creatorSocialHandle: dto.creatorSocialHandle,
        socialLiveUrl: dto.socialLiveUrl,
        pinnedCommentText,
        shareCardTitle: dto.roomTitle,
        shareCardSubtitle: 'Predict what’s next.',
        instagramStoryText:
          socialMode !== 'none'
            ? `Predict what’s next. Join with code ${inviteCode}.`
            : undefined,
        facebookPostText:
          socialMode !== 'none'
            ? `Predict right. Build Aura. Earn Clout. Code: ${inviteCode}`
            : undefined,
        qrCodePayload: socialMode !== 'none' ? `PREDIKT:${inviteCode}` : undefined,
        resultShareText:
          socialMode !== 'none'
            ? categoryResultShareText(category, inviteCode)
            : undefined,
        movementAvatarType:
          dto.movementAvatarType ?? defaultMovementAvatarType(roomCategory),
        movementAvatarUrl: dto.movementAvatarUrl,
        isSponsored,
        sponsorName: dto.sponsorName,
        sponsorLogoUrl: dto.sponsorLogoUrl,
        sponsorBrandColor: dto.sponsorBrandColor,
        sponsorTagline: dto.sponsorTagline,
        resultCardSponsorText: dto.resultCardSponsorText,
        plannedStartTime: dto.plannedStartTime
          ? new Date(dto.plannedStartTime)
          : undefined,
        inviteCode,
        status: 'predictions_open',
        milestones: { create: sortedMilestones },
      },
      include: {
        creator: { select: ROOM_CREATOR_SELECT },
        milestones: { orderBy: { milestoneOrder: 'asc' } },
        journeyRoute: true,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.roomMembership.upsert({
        where: { roomId_userId: { roomId: room.roomId, userId: creator.userId } },
        create: {
          roomId: room.roomId,
          userId: creator.userId,
          role: 'creator',
          status: 'joined',
          joinedAt: room.createdAt,
        },
        update: {
          role: 'creator',
          status: 'joined',
          joinedAt: room.createdAt,
          leftAt: null,
        },
      });
      await tx.user.update({
        where: { userId: creator.userId },
        data: { roomsCreatedCount: { increment: 1 } },
      });
      const firstRoomCredit = await tx.creditLedger.findUnique({
        where: { idempotencyKey: `first_room:${creator.userId}` },
      });
      if (!firstRoomCredit) {
        const updatedUser = await tx.user.update({
          where: { userId: creator.userId },
          data: { creditBalance: { increment: 15 } },
        });
        await tx.creditLedger.create({
          data: {
            userId: creator.userId,
            eventType: 'first_room',
            delta: 15,
            balanceAfter: updatedUser.creditBalance,
            sourceId: room.roomId,
            sourceType: 'room',
            idempotencyKey: `first_room:${creator.userId}`,
            metadata: { label: 'First room credit bonus' },
          },
        });
      }
    });

    await this.auditService.log({
      actorType: 'user',
      actorId: creator.userId,
      action: 'room.created',
      targetType: 'room',
      targetId: room.roomId,
      afterValue: {
        visibility: room.visibility,
        category: room.category,
        mode: room.mode,
        locationDisplayMode: room.locationDisplayMode,
        safetyDelayMinutes: room.safetyDelayMinutes,
        predictionVisibilityMode: room.predictionVisibilityMode,
        predictionMode: room.predictionMode,
      },
    });
    await this.auditService.log({
      actorType: 'user',
      actorId: creator.userId,
      action: 'room_created',
      targetType: 'room',
      targetId: room.roomId,
      afterValue: {
        category: room.category,
        mode: room.mode,
        answerType: room.answerType,
        visibility: room.visibility,
      },
    });
    await this.auditService.log({
      actorType: 'user',
      actorId: creator.userId,
      action: 'privacy_mode.changed',
      targetType: 'room',
      targetId: room.roomId,
      afterValue: {
        locationDisplayMode: room.locationDisplayMode,
        safetyDelayMinutes: room.safetyDelayMinutes,
      },
      reason: 'Room privacy defaults set during creation',
    });

    return {
      ...room,
      shareKit: buildShareKit(room),
    };
  }

  /**
   * Starts a fresh room with the same structure as a completed one. Clones shape
   * only — title, category, mode, milestone layout, privacy settings — never state:
   * no predictions, results, coordinates, route geometry, or provider snapshots
   * carry over. Any joined member (including guests) may rematch; they become the
   * creator of the new room, which gets its own invite code and links back via
   * rematchOfRoomId.
   */
  async rematch(sourceRoomId: string, requestingUser: RoomCreatorIdentity) {
    if (!featureFlags.rematch) {
      throw new BadRequestException('Rematch is currently unavailable.');
    }

    const source = await this.prisma.predictionRoom.findUnique({
      where: { roomId: sourceRoomId },
      include: { milestones: { orderBy: { milestoneOrder: 'asc' } } },
    });
    if (!source) throw new NotFoundException('Room not found');

    if (source.status !== 'completed') {
      throw new BadRequestException('You can only rematch a completed room.');
    }

    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId: sourceRoomId, userId: requestingUser.userId } },
    });
    const isMember =
      source.creatorUserId === requestingUser.userId ||
      (membership?.status === 'joined');
    if (!isMember) {
      throw new ForbiddenException('Only members of the room can start a rematch.');
    }

    // Preserve the *length* of the original prediction window (structure), applied
    // from now — never the original absolute close time (state, and now in the past).
    const originalWindowMs =
      source.predictionCloseTime.getTime() - source.createdAt.getTime();
    const windowMs = Math.min(
      Math.max(Number.isFinite(originalWindowMs) ? originalWindowMs : 0, 15 * 60_000),
      24 * 60 * 60_000,
    );
    const predictionCloseTime = new Date(Date.now() + windowMs).toISOString();

    const creationMeta = (source.scoringRule as Record<string, unknown> | null)?.creationMeta as
      | Record<string, unknown>
      | undefined;
    const question =
      typeof creationMeta?.question === 'string' ? creationMeta.question : source.eventType;

    const clonedMilestones = source.milestones.map((milestone) => ({
      milestoneName: milestone.milestoneName,
      locationLabel: milestone.locationLabel ?? milestone.milestoneName,
      auraMultiplier: Number(milestone.auraMultiplier),
      isFinalDestination: milestone.milestoneType === 'final_destination',
      milestoneOrder: milestone.milestoneOrder,
      // intentionally no lat/lng and no per-milestone close time — structure only
    }));

    const dto: CreateRoomDto = {
      roomTitle: source.roomTitle,
      eventType: source.eventType,
      question,
      roomType: source.roomType,
      answerType: source.answerType,
      mode: source.mode ?? 'friends',
      category: source.category ?? undefined,
      templateKey: source.templateKey ?? undefined,
      predictionVisibilityMode: source.predictionVisibilityMode,
      startingPointLabel: source.startingPointLabel,
      destinationLabel: source.destinationLabel,
      predictionCloseTime,
      visibility: source.visibility,
      locationDisplayMode: source.locationDisplayMode,
      safetyDelayMinutes: source.safetyDelayMinutes,
      disableRouteReplay: source.disableRouteReplay,
      hideExactStart: source.hideExactStart,
      hideExactDestination: source.hideExactDestination,
      autoPauseNearDestination: source.autoPauseNearDestination,
      socialMode: source.socialMode,
      roomCategory: source.roomCategory,
      movementAvatarType: source.movementAvatarType,
      selectedBackground: source.selectedBackground ?? undefined,
      selectedRoomTheme: source.selectedRoomTheme ?? undefined,
      options: Array.isArray(source.options) ? (source.options as string[]) : undefined,
      milestones: clonedMilestones,
    };

    const created = await this.create(dto, requestingUser);

    await this.prisma.predictionRoom.update({
      where: { roomId: created.roomId },
      data: { rematchOfRoomId: sourceRoomId },
    });

    await this.auditService.log({
      actorType: 'user',
      actorId: requestingUser.userId,
      action: 'room.rematch_created',
      targetType: 'room',
      targetId: created.roomId,
      afterValue: { rematchOfRoomId: sourceRoomId, category: created.category },
    });

    return { ...created, rematchOfRoomId: sourceRoomId };
  }

  async findById(roomId: string, requestingUser: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: {
        creator: { select: ROOM_CREATOR_SELECT },
        milestones: { orderBy: { milestoneOrder: 'asc' } },
        journeyRoute: true,
        roomMemberships: {
          where: { userId: requestingUser.userId, status: 'joined' },
        },
        locationEvents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { progressPercentage: true, createdAt: true },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const isCreator = room.creatorUserId === requestingUser.userId;
    const isMember = isCreator || room.roomMemberships.length > 0;

    if (room.visibility === 'private' && !isMember) {
      throw new ForbiddenException('Join this room to view details.');
    }

    // Has the viewer already locked in a (non-revoked) prediction? Drives whether
    // the app should still route them to the prediction screen while live.
    const viewerHasPredicted =
      (await this.prisma.milestonePrediction.count({
        where: { roomId, userId: requestingUser.userId, revokedAt: null },
      })) > 0;
    const predictionWindow = buildPredictionWindow(room);

    if (isCreator) {
      return {
        ...room,
        creator: safePublicUser(room.creator),
        milestones: safeMilestones(room.milestones),
        route: room.journeyRoute,
        benchmarks: buildArrivalBenchmarks(room),
        shareKit: buildShareKit(room),
        viewerHasPredicted,
        predictionWindow,
        canLateJoinPredict: canUserStillPredictAfterJourneyStart(room),
        lateJoinPredictionWindowEndsAt: getLateJoinPredictionWindowEndsAt(room)?.toISOString() ?? null,
        lateJoinPredictionArrivalCutoffAt: getLateJoinPredictionArrivalCutoffAt(room)?.toISOString() ?? null,
      };
    }

    const {
      startingLat,
      startingLng,
      destinationLat,
      destinationLng,
      milestones,
      journeyRoute,
      roomMemberships,
      ...safe
    } = room;
    void startingLat;
    void startingLng;
    void destinationLat;
    void destinationLng;
    void roomMemberships;
    return {
      ...safeRoomProjection({ ...safe, journeyRoute }, { includeInviteCode: true }),
      milestones: safeMilestones(milestones),
      creator: safePublicUser(room.creator),
      benchmarks: buildArrivalBenchmarks({ ...safe, journeyRoute }),
      shareKit: buildShareKit(room),
      membershipStatus: isMember ? 'joined' : null,
      viewerHasPredicted,
      predictionWindow,
      canLateJoinPredict: canUserStillPredictAfterJourneyStart(room),
      lateJoinPredictionWindowEndsAt: getLateJoinPredictionWindowEndsAt(room)?.toISOString() ?? null,
      lateJoinPredictionArrivalCutoffAt: getLateJoinPredictionArrivalCutoffAt(room)?.toISOString() ?? null,
    };
  }

  async join(roomId: string, requestingUser: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      select: {
        roomId: true,
        roomTitle: true,
        creatorUserId: true,
        status: true,
        visibility: true,
        journeyStatus: true,
        journeyStartedAt: true,
        startTime: true,
        plannedStartTime: true,
        expectedDurationSeconds: true,
        locationEvents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { progressPercentage: true, createdAt: true },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.visibility === 'private' && room.creatorUserId !== requestingUser.userId) {
      throw new ForbiddenException('This private room requires an invite from the creator.');
    }

    const existing = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId: requestingUser.userId } },
    });
    if (existing?.status === 'blocked') {
      throw new ForbiddenException('You cannot join this room.');
    }

    const role = room.creatorUserId === requestingUser.userId ? 'creator' : 'participant';
    const existingPredictions = await this.prisma.milestonePrediction.count({
      where: {
        roomId,
        userId: requestingUser.userId,
        revokedAt: null,
      },
    });
    const hasSubmittedPrediction = existingPredictions > 0;
    const canLateJoinPredict = canUserStillPredictAfterJourneyStart(room);
    const now = new Date();
    const membership = await this.prisma.roomMembership.upsert({
      where: { roomId_userId: { roomId, userId: requestingUser.userId } },
      create: {
        roomId,
        userId: requestingUser.userId,
        role,
        status: 'joined',
        joinedAt: now,
      },
      update: {
        role,
        status: 'joined',
        joinedAt: existing?.status === 'left' ? now : existing?.joinedAt ?? now,
        leftAt: null,
      },
    });

    await this.notificationsService.create({
      userId: requestingUser.userId,
      roomId,
      type: 'room_joined',
      title: 'Room joined',
      body: `You're in ${room.roomTitle}. Add your prediction when you're ready.`,
      severity: 'success',
      actionLabel: this.nextActionLabel(room.status),
      actionTarget: this.nextActionTarget(roomId, room.status, room.journeyStatus),
      metadata: { roomStatus: room.status, role },
      idempotencyKey: `room_joined:${roomId}:${requestingUser.userId}:${membership.joinedAt.toISOString()}`,
    });

    if (role === 'participant') {
      await this.notificationsService.create({
        userId: room.creatorUserId,
        roomId,
        type: 'room_invite_accepted',
        title: 'Invite accepted',
        body: `${requestingUser.name} joined ${room.roomTitle}.`,
        severity: 'info',
        actionLabel: 'View room',
        actionTarget: this.nextActionTarget(roomId, room.status, room.journeyStatus),
        metadata: { participantUserId: requestingUser.userId },
        idempotencyKey: `room_invite_accepted:${roomId}:${requestingUser.userId}:${membership.joinedAt.toISOString()}`,
      });
    }

    if (room.status === 'predictions_open') {
      await this.notificationsService.create({
        userId: requestingUser.userId,
        roomId,
        type: 'prediction_needed',
        title: 'Prediction needed',
        body: 'This room is ready for your prediction.',
        severity: 'action_required',
        actionLabel: 'Predict',
        actionTarget: `room:${roomId}:prediction`,
        metadata: { roomStatus: room.status },
        idempotencyKey: `prediction_needed:${roomId}:${requestingUser.userId}:${membership.joinedAt.toISOString()}`,
      });
    }

    return {
      roomId,
      membershipId: membership.membershipId,
      role: membership.role,
      status: membership.status,
      joinedAt: membership.joinedAt,
      nextAction: this.nextAction(
        room.status,
        room.journeyStatus,
        hasSubmittedPrediction,
        canLateJoinPredict,
      ),
      hasSubmittedPrediction,
      canLateJoinPredict,
      predictionWindow: buildPredictionWindow(room),
      lateJoinPredictionWindowEndsAt: getLateJoinPredictionWindowEndsAt(room)?.toISOString() ?? null,
      lateJoinPredictionArrivalCutoffAt: getLateJoinPredictionArrivalCutoffAt(room)?.toISOString() ?? null,
    };
  }

  async leave(roomId: string, requestingUser: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      select: { roomId: true, creatorUserId: true, status: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId: requestingUser.userId } },
    });
    if (!membership || membership.status !== 'joined') {
      throw new NotFoundException('Active membership not found');
    }
    if (
      membership.role === 'creator' &&
      !['completed', 'cancelled'].includes(room.status)
    ) {
      throw new BadRequestException('Creator cannot leave an active room.');
    }

    const left = await this.prisma.roomMembership.update({
      where: { membershipId: membership.membershipId },
      data: { status: 'left', leftAt: new Date() },
    });

    return {
      roomId,
      membershipId: left.membershipId,
      role: left.role,
      status: left.status,
      joinedAt: left.joinedAt,
      leftAt: left.leftAt,
    };
  }

  async ensureJoinedMembership(roomId: string, user: User) {
    return this.join(roomId, user);
  }

  async findByInviteCode(inviteCode: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { inviteCode },
      include: {
        creator: { select: ROOM_CREATOR_SELECT },
        milestones: { orderBy: { milestoneOrder: 'asc' } },
        journeyRoute: true,
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    return safeRoomSummary(room);
  }

  async getInvitePreview(inviteCode: string) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { inviteCode },
      include: {
        creator: { select: ROOM_CREATOR_SELECT },
        milestones: { orderBy: { milestoneOrder: 'asc' } },
        journeyRoute: true,
        milestonePredictions: { select: { userId: true } },
        roomMemberships: { select: { userId: true, status: true } },
        locationEvents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { progressPercentage: true, createdAt: true },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    await this.auditService.log({
      actorType: 'system',
      actorId: null,
      action: 'invite_opened',
      targetType: 'room',
      targetId: room.roomId,
      afterValue: {
        category: room.category,
        mode: room.mode,
      },
    });
    return buildSafeInvitePreview(room);
  }

  async getShareKit(roomId: string, requestingUser: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      include: {
        creator: { select: ROOM_CREATOR_SELECT },
        milestones: { orderBy: { milestoneOrder: 'asc' } },
        journeyRoute: true,
        milestonePredictions: { select: { userId: true } },
        roomMemberships: { select: { userId: true, status: true } },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const inviteUrl = buildInviteUrl(
      room.inviteCode,
      this.prisma ? process.env.EXPO_PUBLIC_WEB_BASE_URL ?? process.env.WEB_BASE_URL ?? null : null,
    );
    const shareText = buildShareCopy(room, inviteUrl);

    await this.auditService.log({
      actorType: 'user',
      actorId: requestingUser.userId,
      action: 'ROOM_INVITE_VIEWED',
      targetType: 'room',
      targetId: room.roomId,
      afterValue: { channel: 'link' },
    });

    return {
      inviteCode: room.inviteCode,
      inviteUrl,
      shareTitle: room.roomTitle,
      shareText,
      whatsappText: shareText,
      instagramCaption: shareText,
      safePreview: buildSafeInvitePreview(room),
      shareKit: buildShareKit(room),
    };
  }

  async trackShareEvent(roomId: string, dto: ShareRoomEventDto, requestingUser: User) {
    const room = await this.prisma.predictionRoom.findUnique({
      where: { roomId },
      select: { roomId: true, category: true, mode: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    await this.auditService.log({
      actorType: 'user',
      actorId: requestingUser.userId,
      action: dto.action === 'ROOM_INVITE_SHARED' ? 'room_shared' : dto.action,
      targetType: 'room',
      targetId: roomId,
      afterValue: { channel: dto.channel ?? null, category: room.category, mode: room.mode },
    });

    return { success: true };
  }

  private async enforceContentPolicy(fields: Record<string, unknown>, userId: string) {
    const blocked = Object.entries(fields).flatMap(([field, value]) => {
      if (typeof value !== 'string') return [];
      return findBannedBettingTerms(value).map((term) => ({ field, term }));
    });
    if (!blocked.length) return;

    await this.auditService.log({
      actorType: 'user',
      actorId: userId,
      action: 'policy.keyword_blocked',
      targetType: 'room',
      afterValue: { blocked },
      reason: POLICY_BLOCK_MESSAGE,
    });
    throw new BadRequestException({
      message: POLICY_BLOCK_MESSAGE,
      blockedTerms: blocked,
    });
  }

  private nextAction(status: string, journeyStatus?: string | null, hasSubmittedPrediction = false, canLateJoinPredict = false) {
    if (!hasSubmittedPrediction && (status === 'predictions_open' || canLateJoinPredict)) return 'prediction';
    if (['live', 'predictions_locked'].includes(status) || journeyStatus === 'overdue') return 'live';
    return 'result';
  }

  private nextActionLabel(status: string) {
    if (status === 'predictions_open') return 'Predict';
    if (['live', 'predictions_locked'].includes(status)) return 'View live';
    return 'View result';
  }

  private nextActionTarget(roomId: string, status: string, journeyStatus?: string | null) {
    return `room:${roomId}:${this.nextAction(status, journeyStatus)}`;
  }
}
