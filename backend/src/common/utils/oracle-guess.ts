/**
 * Oracle's frozen guess (checkpoint_leaderboard_v2).
 *
 * Oracle is the Maps ETA wearing a persona — NOT a second prediction engine. Its guess
 * for each round was already frozen during the journey: at every 20/40/60/80 checkpoint,
 * `LiveProgressService.recordClientCheckpoint` committed the ETA re-read to
 * `RoomCheckpoint.etaSeconds` + `capturedAt`. That stored pair IS Oracle's guess for that
 * round (`capturedAt + etaSeconds`).
 *
 * This helper only READS those frozen rows to pick Oracle's final guess (the latest round
 * it was allowed to predict in — highest checkpoint <= 80, else the start-time ETA). It
 * MUST NOT call the maps provider / getRoutePreview: re-reading the live ETA at resolution
 * would let Oracle quote a near-perfect number and win every game. Freeze happens at the
 * checkpoint; this is the read used at scoring time — deliberately separate.
 */

// Highest first: Oracle's final guess is its most recent allowed round (locked out after 80).
const ORACLE_CHECKPOINTS = [80, 60, 40, 20] as const;

export interface OracleGuess {
  /** The frozen predicted arrival time. */
  arrivalTime: Date;
  /** Which round it was frozen in (20/40/60/80, or 0 for the start-time ETA). */
  frozenAtCheckpoint: number;
}

interface CheckpointRow {
  checkpoint: number;
  capturedAt: Date | string;
  etaSeconds?: number | null;
}

export function computeOracleGuess(
  room: { startTime?: Date | string | null; expectedDurationSeconds?: number | null },
  checkpoints: CheckpointRow[],
): OracleGuess | null {
  for (const cp of ORACLE_CHECKPOINTS) {
    const row = checkpoints.find((c) => c.checkpoint === cp && c.etaSeconds != null);
    if (row) {
      return {
        arrivalTime: new Date(new Date(row.capturedAt).getTime() + (row.etaSeconds as number) * 1000),
        frozenAtCheckpoint: cp,
      };
    }
  }
  // Start-round fallback: the initial Maps ETA, frozen at journey start.
  if (room.startTime && room.expectedDurationSeconds) {
    return {
      arrivalTime: new Date(new Date(room.startTime).getTime() + room.expectedDurationSeconds * 1000),
      frozenAtCheckpoint: 0,
    };
  }
  return null;
}
