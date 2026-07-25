import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MilestonePredictionInputDto {
  @IsString()
  milestoneId: string;

  @IsDateString()
  predictedReachedTime: string;

  // Optional one-line "hot take" shown next to the entry on the leaderboard and
  // The Tea. Capped at 80 chars; guardrail-checked before Chaos Bot may quote it.
  @IsOptional()
  @IsString()
  @Length(0, 80)
  hotTake?: string;
}

export class CreatePredictionDto {
  @IsOptional()
  @IsDateString()
  predictedArrivalTime?: string;

  @IsOptional()
  @IsString()
  selectedOptionKey?: string;

  // Room-level hot take (single-target arrival rooms have one prediction).
  @IsOptional()
  @IsString()
  @Length(0, 80)
  hotTake?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestonePredictionInputDto)
  predictions?: MilestonePredictionInputDto[];
}
