import { IsNumber, IsOptional, Min, Max, IsString } from 'class-validator';

export class LocationUpdateDto {
  @IsOptional()
  @IsNumber()
  rawLat?: number;

  @IsOptional()
  @IsNumber()
  rawLng?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  etaMinutes?: number;

  @IsOptional()
  @IsString()
  currentMilestoneId?: string;
}
