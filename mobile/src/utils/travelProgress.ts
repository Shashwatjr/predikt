export type TravelStage = {
  checkpoint: 20 | 40 | 60 | 80 | 90 | 100;
  creatorLabel: string;
  guestLabel: string;
  shortLabel: string;
};

const TRAVEL_STAGES: TravelStage[] = [
  { checkpoint: 20, creatorLabel: 'Journey underway', guestLabel: "They're on the move", shortLabel: 'On the move' },
  { checkpoint: 40, creatorLabel: 'Making progress', guestLabel: 'The journey is moving', shortLabel: 'Making progress' },
  { checkpoint: 60, creatorLabel: 'Past halfway', guestLabel: 'More than halfway there', shortLabel: 'Past halfway' },
  { checkpoint: 80, creatorLabel: 'Getting close', guestLabel: 'Arrival is getting closer', shortLabel: 'Getting close' },
  { checkpoint: 90, creatorLabel: 'Nearly there', guestLabel: 'Final stretch', shortLabel: 'Nearly there' },
  { checkpoint: 100, creatorLabel: 'Arrived', guestLabel: 'Arrival confirmed', shortLabel: 'Arrived' },
];

/** First matching stage for progress > 0. Returns null at 0% so callers do not invent a 20% checkpoint. */
export function getTravelStage(progressPercentage: number | null | undefined): TravelStage | null {
  const progress = Math.max(0, Math.min(100, progressPercentage ?? 0));
  if (progress <= 0) return null;
  return TRAVEL_STAGES.find((stage) => progress <= stage.checkpoint) ?? TRAVEL_STAGES[TRAVEL_STAGES.length - 1];
}

export function getTravelStageFromProgress(
  progressPercentage: number | null | undefined,
  audience: 'creator' | 'guest' = 'guest',
  options?: { journeyStarted?: boolean },
) {
  if (progressPercentage == null || progressPercentage <= 0) {
    if (options?.journeyStarted) {
      return audience === 'creator' ? 'Journey underway' : 'On the way — progress delayed';
    }
    return audience === 'creator' ? 'Ready to start' : 'Waiting for the journey to begin';
  }
  const stage = getTravelStage(progressPercentage)!;
  return audience === 'creator' ? stage.creatorLabel : stage.guestLabel;
}

/** Status line with real rounded percent — never the stage checkpoint. */
export function formatTravelStatusWithPercent(
  progressPercentage: number | null | undefined,
  audience: 'creator' | 'guest' = 'creator',
  options?: { journeyStarted?: boolean },
) {
  const pct = Math.round(Math.max(0, Math.min(100, progressPercentage ?? 0)));
  const label = getTravelStageFromProgress(pct, audience, options);
  return `${label} · ${pct}%`;
}
