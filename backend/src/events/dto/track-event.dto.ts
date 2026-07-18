import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export const TRACKED_EVENTS = [
  'homepage_visited',
  'category_selected',
  'mode_selected',
  'demo_started',
  'room_created',
  'invite_created',
  'room_shared',
  'invite_opened',
  'invite_preview_loaded',
  'invite_preview_failed',
  'guest_join_started',
  'guest_prediction_started',
  'guest_prediction_submitted',
  'registered_prediction_submitted',
  'prediction_submitted',
  'prediction_submission_failed',
  'result_viewed',
  'result_declared',
  'tea_viewed',
  'result_shared',
  'whatsapp_share_selected',
  'native_share_selected',
  'moment_card_shared',
  'rematch_started',
  'rematch_created',
  'rematch_failed',
  'guest_upgrade_started',
  'guest_upgrade_completed',
  'guest_upgrade_failed',
  'feedback_submitted',
  'commentary_reported',
  'room_cancelled',
  'room_abandoned',
  'room_auto_closed',
] as const;

export type TrackedEventType = (typeof TRACKED_EVENTS)[number];

export class TrackEventDto {
  @IsIn(TRACKED_EVENTS)
  eventType: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  eventVersion?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
