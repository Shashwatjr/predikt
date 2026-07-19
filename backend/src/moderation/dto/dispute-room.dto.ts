import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class DisputeRoomDto {
  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'proofWaMeLink must be a valid URL' })
  proofWaMeLink?: string;
}
