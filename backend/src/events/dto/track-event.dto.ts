import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

const TRACKED_EVENTS = [
  'homepage_visited',
  'category_selected',
  'mode_selected',
  'demo_started',
  'room_created',
  'room_shared',
  'invite_opened',
  'prediction_submitted',
  'result_declared',
  'moment_card_shared',
  'rematch_created',
] as const;

export class TrackEventDto {
  @IsIn(TRACKED_EVENTS)
  eventType: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
