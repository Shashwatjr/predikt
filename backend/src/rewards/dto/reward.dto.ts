import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RewardType } from '@prisma/client';

export class RewardHistoryQueryDto {
  @IsOptional()
  @IsEnum(RewardType)
  type?: RewardType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class AdminRewardAdjustDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsEnum(RewardType)
  rewardType!: RewardType;

  @IsInt()
  @NotEquals(0)
  amount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(280)
  reason!: string;

  /** Client-supplied stable key so retries don't double-adjust. */
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;
}
