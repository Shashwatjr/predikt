import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertCreatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  handle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  instagramHandle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  facebookPage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  youtubeHandle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  creatorCategory?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  audienceSizeLabel?: string | null;
}
