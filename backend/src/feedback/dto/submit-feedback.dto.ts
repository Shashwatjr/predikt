import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitFeedbackDto {
  @IsIn(['bug', 'feature_request', 'safety_privacy', 'confusing_experience', 'other'])
  feedbackType: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsBoolean()
  contactAllowed?: boolean;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  roomId?: string;
}
