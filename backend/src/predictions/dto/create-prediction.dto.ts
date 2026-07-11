import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MilestonePredictionInputDto {
  @IsString()
  milestoneId: string;

  @IsDateString()
  predictedReachedTime: string;
}

export class CreatePredictionDto {
  @IsOptional()
  @IsDateString()
  predictedArrivalTime?: string;

  @IsOptional()
  @IsString()
  selectedOptionKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestonePredictionInputDto)
  predictions?: MilestonePredictionInputDto[];
}
