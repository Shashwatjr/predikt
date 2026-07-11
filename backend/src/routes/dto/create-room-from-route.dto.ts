import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoomCategory, Visibility } from '@prisma/client';

class RouteMilestoneDto {
  @IsString()
  @Length(1, 120)
  milestoneName: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  locationLabel?: string;

  @IsOptional()
  @IsBoolean()
  isFinalDestination?: boolean;
}

class PrimaryPredictionDto {
  @IsString()
  @Length(1, 60)
  type: string;

  @IsString()
  @IsIn(['exact_time', 'duration', 'yes_no'])
  answerType: string;

  @IsString()
  @Length(1, 160)
  question: string;
}

class RoutePointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  label?: string;
}

export class CreateRoomFromRouteDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  mode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  category?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  roomType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  startPlaceId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RoutePointDto)
  startLocation?: RoutePointDto;

  @IsString()
  @Length(1, 120)
  destinationPlaceId: string;

  @IsOptional()
  @IsIn([
    'car',
    'bike',
    'walk',
    'cycle',
    'driving',
    'walking',
    'cycling',
    'transit',
    'flying',
    'running',
    'custom',
  ])
  travelMode?: string;

  @IsOptional()
  @IsIn(Object.values(RoomCategory))
  roomCategory?: RoomCategory;

  @IsOptional()
  @IsIn(Object.values(Visibility))
  visibility?: Visibility;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @IsDateString()
  predictionClosesAt?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  safetyDelayMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  startDelayMinutes?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RouteMilestoneDto)
  milestones?: RouteMilestoneDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PrimaryPredictionDto)
  primaryPrediction?: PrimaryPredictionDto;
}
