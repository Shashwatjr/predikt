import { IsDateString, IsOptional } from 'class-validator';

export class ReachMilestoneDto {
  @IsOptional()
  @IsDateString()
  actualReachedTime?: string;
}
