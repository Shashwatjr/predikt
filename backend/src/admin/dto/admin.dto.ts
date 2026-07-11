import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AiSystemStatus,
  CampaignStatus,
  CampaignType,
  CreatorVerificationStatus,
  DropStatus,
  DropType,
  PrivacyRequestStatus,
} from '@prisma/client';

export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class AdminStatusChangeDto {
  @IsString()
  @MaxLength(40)
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RemoveRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReverseCreditsDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ResolveDisputeDto {
  @IsOptional()
  @IsIn(['resolved', 'dismissed', 'in_review'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution?: string;

  @IsOptional()
  @IsBoolean()
  releaseRewards?: boolean;
}

export class PatchCreatorStatusDto {
  @IsEnum(CreatorVerificationStatus)
  status: CreatorVerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateDropDto {
  @IsString()
  @Length(1, 120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(DropType)
  dropType: DropType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sponsorName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  cloutCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  terms?: string;
}

export class UpdateDropDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(DropType)
  dropType?: DropType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sponsorName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  cloutCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  terms?: string;

  @IsOptional()
  @IsEnum(DropStatus)
  status?: DropStatus;
}

export class CreateSponsorDto {
  @IsString()
  @Length(1, 120)
  sponsorName: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  brandColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string;
}

export class CreateCampaignDto {
  @IsOptional()
  @IsString()
  sponsorId?: string;

  @IsString()
  @Length(1, 120)
  campaignName: string;

  @IsEnum(CampaignType)
  campaignType: CampaignType;

  @IsOptional()
  @IsUUID()
  creatorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  budgetLabel?: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}

export class UpdatePrivacyRequestDto {
  @IsEnum(PrivacyRequestStatus)
  status: PrivacyRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNotes?: string;
}

export class CreateAiSystemDto {
  @IsString()
  @Length(1, 120)
  featureName: string;

  @IsString()
  @MaxLength(500)
  purpose: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelName?: string;

  @IsOptional()
  @IsObject()
  inputDataCategories?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  outputType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  riskClassification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  humanOversight?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  transparencyNotice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsEnum(AiSystemStatus)
  status?: AiSystemStatus;

  @IsOptional()
  @IsDateString()
  lastReviewedAt?: string;
}

export class UpdateAiSystemDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  featureName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelName?: string;

  @IsOptional()
  @IsObject()
  inputDataCategories?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  outputType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  riskClassification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  humanOversight?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  transparencyNotice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsEnum(AiSystemStatus)
  status?: AiSystemStatus;

  @IsOptional()
  @IsDateString()
  lastReviewedAt?: string;
}
