import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import {
  Visibility,
  LocationDisplayMode,
  SocialMode,
  RoomCategory,
  MovementAvatarType,
  PredictionVisibilityMode,
} from '@prisma/client';
import { Type } from 'class-transformer';

class CreateMilestoneDto {
  @IsString()
  milestoneName: string;

  @IsOptional()
  @IsString()
  locationLabel?: string;

  @IsOptional()
  @IsDateString()
  predictionCloseTime?: string;

  @IsOptional()
  @IsNumber()
  milestoneLat?: number;

  @IsOptional()
  @IsNumber()
  milestoneLng?: number;

  @IsOptional()
  @IsNumber()
  auraMultiplier?: number;

  @IsOptional()
  @IsBoolean()
  isFinalDestination?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  milestoneOrder?: number;
}

export class CreateRoomDto {
  @IsString()
  roomTitle: string;

  @IsString()
  eventType: string;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  roomType?: string;

  @IsOptional()
  @IsString()
  answerType?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsEnum(PredictionVisibilityMode)
  predictionVisibilityMode?: PredictionVisibilityMode;

  @IsString()
  startingPointLabel: string;

  @IsString()
  destinationLabel: string;

  @IsDateString()
  predictionCloseTime: string;

  @IsOptional()
  @IsNumber()
  startingLat?: number;

  @IsOptional()
  @IsNumber()
  startingLng?: number;

  @IsOptional()
  @IsNumber()
  destinationLat?: number;

  @IsOptional()
  @IsNumber()
  destinationLng?: number;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsEnum(LocationDisplayMode)
  locationDisplayMode?: LocationDisplayMode;

  @IsOptional()
  @IsDateString()
  plannedStartTime?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneDto)
  milestones?: CreateMilestoneDto[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  safetyDelayMinutes?: number;

  @IsOptional()
  @IsBoolean()
  disableRouteReplay?: boolean;

  @IsOptional()
  @IsBoolean()
  hideExactStart?: boolean;

  @IsOptional()
  @IsBoolean()
  hideExactDestination?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPauseNearDestination?: boolean;

  @IsOptional()
  @IsEnum(SocialMode)
  socialMode?: SocialMode;

  @IsOptional()
  @IsString()
  creatorSocialHandle?: string;

  @IsOptional()
  @IsString()
  creatorSocialPlatform?: string;

  @IsOptional()
  @IsString()
  socialLiveUrl?: string;

  @IsOptional()
  @IsEnum(RoomCategory)
  roomCategory?: RoomCategory;

  @IsOptional()
  @IsEnum(MovementAvatarType)
  movementAvatarType?: MovementAvatarType;

  @IsOptional()
  @IsString()
  movementAvatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isSponsored?: boolean;

  @IsOptional()
  @IsString()
  sponsorName?: string;

  @IsOptional()
  @IsString()
  sponsorLogoUrl?: string;

  @IsOptional()
  @IsString()
  sponsorBrandColor?: string;

  @IsOptional()
  @IsString()
  sponsorTagline?: string;

  @IsOptional()
  @IsString()
  resultCardSponsorText?: string;

  @IsOptional()
  @IsDateString()
  resultDeadline?: string;

  @IsOptional()
  @IsDateString()
  journeyScheduledStartAt?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  expectedDurationSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  gracePeriodSeconds?: number;

  @IsOptional()
  @IsDateString()
  autoCloseAt?: string;

  @IsOptional()
  @IsDateString()
  noStartCutoffAt?: string;

  @IsOptional()
  @IsString()
  journeyStatus?: string;

  @IsOptional()
  @IsString()
  baselineSource?: string;

  @IsOptional()
  @IsString()
  baselineLabel?: string;

  @IsOptional()
  baselineValue?: unknown;

  @IsOptional()
  @IsObject()
  baselineSnapshot?: Record<string, unknown>;

  @IsOptional()
  oracleBotPrediction?: unknown;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsString()
  outcomeSource?: string;

  @IsOptional()
  @IsString()
  confidenceLevel?: string;

  @IsOptional()
  @IsObject()
  scoringRule?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  selectedBackground?: string;

  @IsOptional()
  @IsString()
  selectedRoomTheme?: string;
}
