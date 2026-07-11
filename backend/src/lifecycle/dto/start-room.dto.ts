import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class StartRoomDto {
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  startDelayMinutes?: number;
}
