import { IsString, MaxLength } from 'class-validator';

export class DisputeRoomDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
