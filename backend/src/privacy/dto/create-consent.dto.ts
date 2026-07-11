import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ConsentStatus, ConsentType } from '@prisma/client';

export class CreateConsentDto {
  @IsEnum(ConsentType)
  consentType: ConsentType;

  @IsEnum(ConsentStatus)
  status: ConsentStatus;

  @IsString()
  @MaxLength(80)
  policyVersion: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}
