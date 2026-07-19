import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class EndRoomDto {
  @IsOptional()
  @IsDateString()
  actualEndTime?: string;

  @IsOptional()
  @IsString()
  actualOptionKey?: string;

  @IsOptional()
  @IsIn([
    'host_declared',
    'creator_attest',
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
  @IsIn(['low', 'medium', 'high', 'verified', 'creator_attested'])
  confidenceLevel?: string;

  @IsOptional()
  @IsString()
  resultText?: string;

  @IsOptional()
  location?: {
    lat: number;
    lng: number;
  };

  @IsOptional()
  confirmAnyway?: boolean;
}
