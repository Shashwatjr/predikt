import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClearActivePredictionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}
