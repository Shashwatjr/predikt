import { IsDateString, IsOptional } from 'class-validator';

export class UpdatePredictionDto {
  @IsOptional()
  @IsDateString()
  predictedReachedTime?: string;

  @IsOptional()
  @IsDateString()
  predictedArrivalTime?: string;

  @IsOptional()
  selectedOptionKey?: string;
}
