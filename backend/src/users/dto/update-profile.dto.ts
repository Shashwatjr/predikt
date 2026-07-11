import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  prediktHandle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  avatarKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  selectedBackgroundKey?: string;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  aiPersonalisationOptOut?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  locationConsentStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  profileImage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  profileText?: string;
}
