import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CancelJourneyDto {
  @IsIn(['plan_changed', 'emergency', 'wrong_route', 'other'])
  reasonCode: 'plan_changed' | 'emergency' | 'wrong_route' | 'other';

  @IsOptional()
  @IsString()
  @Length(1, 240)
  note?: string;
}
