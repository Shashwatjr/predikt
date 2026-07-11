import { IsBoolean } from 'class-validator';

export class AiOptOutDto {
  @IsBoolean()
  optOut: boolean;
}
