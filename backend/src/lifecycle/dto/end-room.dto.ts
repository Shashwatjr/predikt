import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class EndRoomDto {
  @IsOptional()
  @IsDateString()
  actualEndTime?: string;

  @IsOptional()
  @IsIn(['no_rain', 'rain_before_6', 'rain_after_6', 'yes', 'no'])
  actualOptionKey?: string;

  @IsOptional()
  @IsIn([
    'host_declared',
    'participant_confirmed',
    'screenshot_evidence',
    'gps_verified',
    'api_verified',
    'weather_api',
    'host_declared_plus_confirmations',
    'admin_verified',
  ])
  outcomeSource?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'verified'])
  confidenceLevel?: string;

  @IsOptional()
  @IsString()
  resultText?: string;
}
