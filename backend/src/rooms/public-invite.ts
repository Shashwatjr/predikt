/** Public invite allowlist. Never reuse the authenticated room projection here:
 * provider snapshots, creation metadata and route summaries can contain geometry.
 */
export function publicInviteRoom(room: any) {
  return {
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    roomTitle: room.roomTitle,
    roomType: room.roomType,
    answerType: room.answerType,
    eventType: room.eventType,
    category: room.category,
    mode: room.mode,
    templateKey: room.templateKey,
    roomCategory: room.roomCategory,
    status: room.status,
    visibility: room.visibility,
    locationDisplayMode: room.locationDisplayMode,
    predictionMode: room.predictionMode,
    predictionVisibilityMode: room.predictionVisibilityMode,
    predictionCloseTime: room.predictionCloseTime,
    lockTime: room.lockTime,
    journeyStatus: room.journeyStatus,
    journeyScheduledStartAt: room.journeyScheduledStartAt,
    journeyStartedAt: room.journeyStartedAt,
    expectedDurationSeconds: room.expectedDurationSeconds,
    noStartCutoffAt: room.noStartCutoffAt,
    selectedBackground: room.selectedBackground,
    selectedRoomTheme: room.selectedRoomTheme,
    startingPointLabel: null,
    destinationLabel: null,
    route: room.journeyRoute ? {
      startLabel: null,
      destinationLabel: null,
      travelMode: room.journeyRoute.travelMode,
      estimatedDurationSeconds: room.journeyRoute.estimatedDurationSeconds,
    } : null,
    // Prediction UI needs milestone IDs, not addresses, coordinates or histories.
    milestones: (room.milestones ?? []).map((m: any) => ({
      milestoneId: m.milestoneId,
      milestoneOrder: m.milestoneOrder,
      milestoneType: m.milestoneType,
      predictionCloseTime: m.predictionCloseTime,
      status: m.status,
    })),
  };
}
