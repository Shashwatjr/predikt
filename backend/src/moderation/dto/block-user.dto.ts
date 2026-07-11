import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BlockUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}
