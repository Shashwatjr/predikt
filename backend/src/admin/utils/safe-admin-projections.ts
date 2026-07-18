import { safeRoomProjection } from '../../common/utils/location-privacy';

const SENSITIVE_USER_KEYS = new Set([
  'passwordHash',
  'guestKey',
  'phone',
  'refreshToken',
  'accessToken',
  'sessionToken',
  'sessionData',
  'userSessions',
]);

export function safeAdminUserListItem(user: Record<string, unknown>) {
  const shortId = String(user.userId ?? '').slice(0, 8);
  return {
    userId: user.userId,
    shortId,
    handle: user.prediktHandle ?? user.name,
    accountType: user.isGuest ? 'guest' : 'registered',
    status: user.status,
    createdAt: user.createdAt,
    lastActive: user.updatedAt,
    roomCount: user.roomsCreatedCount ?? 0,
    predictionCount: user.predictionsMadeCount ?? 0,
    auraBalance: user.totalAura ?? 0,
  };
}

export function safeAdminUserDetail(
  user: Record<string, unknown> | null,
  extras: {
    roomCount?: number;
    predictionCount?: number;
    reportsSubmitted?: number;
    reportsReceived?: number;
    badgesCount?: number;
    activeRooms?: number;
    isBlocked?: boolean;
  } = {},
) {
  if (!user) return null;
  const stripped = stripSensitive(user);
  return {
    userId: stripped.userId,
    shortId: String(stripped.userId ?? '').slice(0, 8),
    name: stripped.name,
    handle: stripped.prediktHandle,
    email: stripped.email ?? null,
    accountType: stripped.isGuest ? 'guest' : 'registered',
    status: stripped.status,
    createdAt: stripped.createdAt,
    lastActive: stripped.updatedAt,
    auraBalance: stripped.totalAura ?? 0,
    badgesCount: extras.badgesCount ?? 0,
    roomCount: extras.roomCount ?? stripped.roomsCreatedCount ?? 0,
    predictionCount: extras.predictionCount ?? stripped.predictionsMadeCount ?? 0,
    reportsSubmitted: extras.reportsSubmitted ?? 0,
    reportsReceived: extras.reportsReceived ?? 0,
    activeRooms: extras.activeRooms ?? 0,
    isBlocked: extras.isBlocked ?? false,
    winsCount: stripped.winsCount ?? 0,
    currentStreak: stripped.currentStreak ?? 0,
  };
}

export function safeAdminRoomListItem(
  room: Record<string, unknown>,
  counts: { participantCount: number; predictionCount: number; reportCount: number },
) {
  const creator = room.creator as Record<string, unknown> | undefined;
  return {
    roomId: room.roomId,
    roomCode: room.inviteCode,
    category: room.category ?? room.eventType,
    creatorType: creator?.isGuest ? 'guest' : 'registered',
    creatorHandle: creator?.prediktHandle ?? creator?.name,
    status: room.status,
    journeyStatus: room.journeyStatus,
    participantCount: counts.participantCount,
    predictionCount: counts.predictionCount,
    reportCount: counts.reportCount,
    createdAt: room.createdAt,
    lockTime: room.lockTime,
    resolvedAt: room.actualEndTime ?? room.arrivalConfirmedAt,
    isRematch: Boolean(room.rematchOfRoomId),
    rematchOfRoomId: room.rematchOfRoomId ?? null,
  };
}

export function safeAdminRoomDetail(
  room: Record<string, unknown>,
  extras: {
    participantCount: number;
    predictionCount: number;
    reports: unknown[];
    auditEvents: unknown[];
    rematchChain: unknown[];
  },
) {
  const safe = safeRoomProjection(room, { includeInviteCode: true });
  return {
    ...safe,
    status: room.status,
    journeyStatus: room.journeyStatus,
    category: room.category,
    mode: room.mode,
    outcomeSource: room.outcomeSource,
    resultDisputed: room.resultDisputed,
    closureReasonCode: room.closureReasonCode,
    participantCount: extras.participantCount,
    predictionCount: extras.predictionCount,
    lockTime: room.lockTime,
    predictionCloseTime: room.predictionCloseTime,
    resolvedAt: room.actualEndTime ?? room.arrivalConfirmedAt,
    cancelledAt: room.cancelledAt,
    abandonedAt: room.abandonedAt,
    autoClosedAt: room.autoClosedAt,
    isRematch: Boolean(room.rematchOfRoomId),
    rematchOfRoomId: room.rematchOfRoomId ?? null,
    reports: extras.reports,
    auditEvents: extras.auditEvents,
    rematchChain: extras.rematchChain,
    createdAt: room.createdAt,
  };
}

export function safeAdminFeedbackItem(feedback: Record<string, unknown>) {
  const user = feedback.user as Record<string, unknown> | undefined;
  const message = String(feedback.message ?? '');
  return {
    feedbackId: feedback.feedbackId,
    type: feedback.feedbackType,
    category: feedback.category,
    status: feedback.status,
    priority: feedback.priority,
    submittedAt: feedback.createdAt,
    contactAllowed: feedback.contactAllowed,
    messagePreview: message.length > 160 ? `${message.slice(0, 160)}…` : message,
    userRef: user
      ? { userId: user.userId, handle: user.prediktHandle ?? user.name }
      : null,
    platform: feedback.platform,
    roomId: feedback.roomId,
    assignedAdminId: feedback.assignedAdminId,
  };
}

export function safeAdminReportItem(report: Record<string, unknown>) {
  const targetUser = report.targetUser as Record<string, unknown> | undefined;
  const room = report.room as Record<string, unknown> | undefined;
  return {
    reportId: report.reportId,
    reportType: report.reportType,
    reason: report.reason,
    status: report.status,
    priority: report.priority,
    createdAt: report.createdAt,
    assignedAdminId: report.assignedAdminId,
    roomRef: room ? { roomId: room.roomId, title: room.roomTitle } : null,
    userRef: targetUser
      ? { userId: targetUser.userId, handle: targetUser.prediktHandle }
      : null,
  };
}

export function safeAdminAuditItem(log: Record<string, unknown>) {
  return {
    auditLogId: log.auditLogId,
    action: log.action,
    actorType: log.actorType,
    actorId: log.actorId,
    actorRole: log.actorRole,
    targetType: log.targetType,
    targetId: log.targetId,
    timestamp: log.createdAt,
    result: log.afterValue ? 'success' : 'recorded',
    reason: log.reason,
    correlationId: log.correlationId ?? null,
    metadata: sanitizeAuditJson(log.metadata ?? log.afterValue ?? log.beforeValue),
  };
}

function stripSensitive<T extends Record<string, unknown>>(value: T): T {
  const out = { ...value };
  for (const key of SENSITIVE_USER_KEYS) {
    delete out[key];
  }
  return out;
}

function sanitizeAuditJson(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeAuditJson);
  const obj = { ...(value as Record<string, unknown>) };
  for (const key of [
    'passwordHash',
    'guestKey',
    'email',
    'phone',
    'startingLat',
    'startingLng',
    'destinationLat',
    'destinationLng',
    'rawLat',
    'rawLng',
    'encodedPolyline',
    'accessToken',
    'refreshToken',
    'sessionToken',
    'cookie',
    'cookies',
    'authorization',
    'authorizationHeader',
    'password',
    'secret',
  ]) {
    delete obj[key];
  }
  for (const [key, child] of Object.entries(obj)) {
    obj[key] = sanitizeAuditJson(child);
  }
  return obj;
}
