import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class ActivePredictionOrderItemDto {
  @IsString()
  roomId: string;

  @IsInt()
  @Min(0)
  displayOrder: number;

  @IsBoolean()
  pinned: boolean;
}

export class UpdateActivePredictionsOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivePredictionOrderItemDto)
  items: ActivePredictionOrderItemDto[];
}
