/**
 * Late-join prediction window.
 *
 * A member who has not predicted yet may still lock in a guess *after* the
 * journey has started, right up until a cutoff measured against a LIVE
 * PACE projection of the arrival (recomputed from the traveller's real
 * progress, so it shifts as they speed up / slow down). There is no upper
 * time gate on how late they may join — only the arrival cutoff closes it.
 */
export const LATE_PREDICTION_ARRIVAL_BUFFER_MS = 3 * 60 * 1000;

export function getJourneyStartTime(room: any): Date | null {
  const value = room.journeyStartedAt ?? room.startTime ?? room.plannedStartTime ?? null;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Newest progress sample from an included `locationEvents` relation
 * (`{ orderBy: { createdAt: 'desc' }, take: 1 }`).
 */
function latestProgress(room: any): { progressPercentage: number; capturedAt: Date } | null {
  const event = room.locationEvents?.[0];
  if (!event || event.progressPercentage == null || !event.createdAt) return null;
  const capturedAt = new Date(event.createdAt);
  if (Number.isNaN(capturedAt.getTime())) return null;
  return { progressPercentage: Number(event.progressPercentage), capturedAt };
}

/**
 * Projected real arrival time. Preferred: extrapolate from the traveller's
 * observed progress (elapsed / fraction complete). Falls back to the planned
 * duration when there is no usable progress signal yet.
 */
export function projectLiveArrival(room: any): Date | null {
  const startedAt = getJourneyStartTime(room);
  if (!startedAt) return null;

  const progress = latestProgress(room);
  if (progress && progress.progressPercentage > 0 && progress.progressPercentage < 100) {
    const elapsedMs = progress.capturedAt.getTime() - startedAt.getTime();
    if (elapsedMs > 0) {
      const totalMs = elapsedMs / (progress.progressPercentage / 100);
      return new Date(startedAt.getTime() + totalMs);
    }
  }

  if (room.expectedDurationSeconds) {
    return new Date(startedAt.getTime() + room.expectedDurationSeconds * 1000);
  }
  return null;
}

/** The moment late predictions close: 3 min before the projected arrival. */
export function getLatePredictionDeadline(room: any): Date | null {
  const arrival = projectLiveArrival(room);
  return arrival ? new Date(arrival.getTime() - LATE_PREDICTION_ARRIVAL_BUFFER_MS) : null;
}

export function isLatePredictionWindowOpen(room: any, now: number = Date.now()): boolean {
  if (room.status !== 'live') return false;
  // Note: we intentionally do NOT require now >= startedAt. Rooms go 'live' with a
  // start-delay, so `startTime` sits a few minutes in the future while the traveller
  // hasn't moved yet — predictions should be OPEN then (it's the fairest, lowest-info
  // moment). projectLiveArrival falls back to the planned duration when elapsed <= 0.
  if (!getJourneyStartTime(room)) return false;
  const deadline = getLatePredictionDeadline(room);
  return !!deadline && now < deadline.getTime();
}

export interface PredictionWindow {
  open: boolean;
  projectedArrivalAt: string | null;
  deadlineAt: string | null;
}

export function buildPredictionWindow(room: any, now: number = Date.now()): PredictionWindow {
  const projected = projectLiveArrival(room);
  const deadline = getLatePredictionDeadline(room);
  return {
    open: isLatePredictionWindowOpen(room, now),
    projectedArrivalAt: projected?.toISOString() ?? null,
    deadlineAt: deadline?.toISOString() ?? null,
  };
}
