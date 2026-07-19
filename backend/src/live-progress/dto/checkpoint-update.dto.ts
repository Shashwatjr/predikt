import { IsIn, IsNumber } from 'class-validator';

/**
 * v2 checkpoint post (checkpoint_leaderboard_v2). The creator's app fires one
 * of these at each time-based checkpoint (20/40/60/80/90/100% of the initial
 * ETA), carrying a single GPS sample. The server does the ETA re-read.
 */
export class CheckpointUpdateDto {
  @IsIn([20, 40, 60, 80, 90, 100])
  checkpointPct: 20 | 40 | 60 | 80 | 90 | 100;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}
