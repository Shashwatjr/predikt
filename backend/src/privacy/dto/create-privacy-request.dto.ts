import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrivacyRequestType } from '@prisma/client';

export class CreatePrivacyRequestDto {
  @IsEnum(PrivacyRequestType)
  requestType: PrivacyRequestType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNotes?: string;
}
