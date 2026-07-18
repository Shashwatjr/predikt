import { RoomCategory, Visibility } from '@prisma/client';
import {
  DEFAULT_LOCATION_PRIVACY_MODE,
  LOCATION_SAFETY_DELAY_MINUTES,
  ROUTE_PARTICIPANT_SAFETY_MESSAGE,
} from '../constants/privacy.constants';

export function defaultSafetyDelayMinutes(
  visibility: Visibility | string,
  roomCategory?: RoomCategory | string,
  isSponsored = false,
) {
  if (roomCategory === 'travel') return LOCATION_SAFETY_DELAY_MINUTES.publicTravel;
  if (isSponsored) return LOCATION_SAFETY_DELAY_MINUTES.sponsored;
  if (visibility === 'private') return LOCATION_SAFETY_DELAY_MINUTES.private;
  if (visibility === 'public') return LOCATION_SAFETY_DELAY_MINUTES.public;
  return LOCATION_SAFETY_DELAY_MINUTES.invite_only;
}

export function safeMilestones(milestones: any[] = []) {
  return milestones.map((milestone) => ({
    milestoneId: milestone.milestoneId,
    milestoneOrder: milestone.milestoneOrder,
    milestoneName: milestone.milestoneName,
    milestoneType: milestone.milestoneType,
    locationLabel: milestone.locationLabel,
    predictionCloseTime: milestone.predictionCloseTime,
    actualReachedTime: milestone.actualReachedTime,
    status: milestone.status,
    auraMultiplier: Number(milestone.auraMultiplier ?? 1),
  }));
}

export function safeRouteProjection(route: any) {
  if (!route) return null;
  return {
    // Privacy boundary: route projections are viewer-safe summaries only and must never
    // include raw coordinates, route history, or replayable movement trails.
    startLabel: route.startLabel,
    destinationLabel: route.destinationLabel,
    travelMode: route.travelMode,
    distanceMeters: route.distanceMeters,
    estimatedDurationSeconds: route.estimatedDurationSeconds,
    routeSummary: route.routeSummary,
    privacyMode: route.privacyMode ?? DEFAULT_LOCATION_PRIVACY_MODE,
    safetyDelayMinutes: route.safetyDelayMinutes,
    safetyMessage: ROUTE_PARTICIPANT_SAFETY_MESSAGE,
  };
}

export function safeRoomProjection(room: any, options: { includeInviteCode?: boolean } = {}) {
  const creationMeta =
    room.scoringRule && typeof room.scoringRule === 'object'
      ? (room.scoringRule as Record<string, unknown>).creationMeta
      : undefined;

  return {
    roomId: room.roomId,
    roomTitle: room.roomTitle,
    roomType: room.roomType,
    answerType: room.answerType,
    eventType: room.eventType,
    category: room.category,
    mode: room.mode,
    templateKey: room.templateKey,
    baselineSource: room.baselineSource,
    baselineLabel: room.baselineLabel,
    baselineValue: room.baselineValue,
    baselineSnapshot: room.baselineSnapshot,
    baselineCapturedAt: room.baselineCapturedAt,
    providerName: room.providerName,
    providerConfidence: room.providerConfidence,
    hostPrediction: room.hostPrediction,
    oracleBotPrediction: room.oracleBotPrediction,
    options: room.options,
    predictionMode: room.predictionMode,
    predictionVisibilityMode: room.predictionVisibilityMode,
    roomCategory: room.roomCategory,
    socialMode: room.socialMode,
    creatorSocialHandle: room.creatorSocialHandle,
    shareCardTitle: room.shareCardTitle,
    shareCardSubtitle: room.shareCardSubtitle,
    startingPointLabel: room.startingPointLabel,
    destinationLabel: room.destinationLabel,
    status: room.status,
    visibility: room.visibility,
    locationDisplayMode: room.locationDisplayMode,
    safetyDelayMinutes: room.safetyDelayMinutes,
    // Product trust cue: repeat the safety contract anywhere viewers inspect room state.
    participantSafetyMessage:
      room.participantSafetyMessage ?? ROUTE_PARTICIPANT_SAFETY_MESSAGE,
    selectedBackground: room.selectedBackground,
    selectedRoomTheme: room.selectedRoomTheme,
    movementAvatarType: room.movementAvatarType,
    movementAvatarUrl: room.movementAvatarUrl,
    isSponsored: room.isSponsored,
    sponsor: room.isSponsored
      ? {
          name: room.sponsorName,
          logoUrl: room.sponsorLogoUrl,
          brandColor: room.sponsorBrandColor,
          tagline: room.sponsorTagline,
        }
      : null,
    predictionCloseTime: room.predictionCloseTime,
    lockTime: room.lockTime,
    resultDeadline: room.resultDeadline,
    journeyStatus: room.journeyStatus,
    journeyScheduledStartAt: room.journeyScheduledStartAt,
    journeyStartedAt: room.journeyStartedAt,
    lastTravellerUpdateAt: room.lastTravellerUpdateAt,
    expectedDurationSeconds: room.expectedDurationSeconds,
    gracePeriodSeconds: room.gracePeriodSeconds,
    autoCloseAt: room.autoCloseAt,
    noStartCutoffAt: room.noStartCutoffAt,
    arrivalConfirmedAt: room.arrivalConfirmedAt,
    cancelledAt: room.cancelledAt,
    autoClosedAt: room.autoClosedAt,
    abandonedAt: room.abandonedAt,
    closureReasonCode: room.closureReasonCode,
    outcomeSource: room.outcomeSource,
    confidenceLevel: room.confidenceLevel,
    creationMeta,
    inviteCode: options.includeInviteCode ? room.inviteCode : undefined,
    milestones: safeMilestones(room.milestones),
    route: safeRouteProjection(room.journeyRoute),
  };
}
