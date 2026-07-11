import { IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RoomCategory, Visibility } from '@prisma/client';

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

export class RoutePreviewDto {
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
  @IsInt()
  @Min(3)
  @Max(15)
  startDelayMinutes?: number;
}
