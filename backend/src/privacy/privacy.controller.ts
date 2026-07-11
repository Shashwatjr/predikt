import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePrivacyRequestDto } from './dto/create-privacy-request.dto';
import { AiOptOutDto } from './dto/ai-opt-out.dto';
import { CreateConsentDto } from './dto/create-consent.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { Request } from 'express';

@Controller()
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get('policies/privacy')
  privacyPolicy() {
    return this.privacyService.policy('privacy');
  }

  @Get('policies/terms')
  terms() {
    return this.privacyService.policy('terms');
  }

  @Get('policies/community-guidelines')
  communityGuidelines() {
    return this.privacyService.policy('community-guidelines');
  }

  @Get('policies/anti-betting')
  antiBetting() {
    return this.privacyService.policy('safety');
  }

  @Get('policies/safety')
  safetyPolicy() {
    return this.privacyService.policy('safety');
  }

  @UseGuards(JwtAuthGuard)
  @Post('privacy/requests')
  createRequest(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePrivacyRequestDto) {
    return this.privacyService.createPrivacyRequest(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('privacy/data-export-request')
  dataExportRequest(@CurrentUser() user: AuthenticatedUser) {
    return this.privacyService.createPrivacyRequest(user, { requestType: 'export' });
  }

  @UseGuards(JwtAuthGuard)
  @Post('privacy/data-deletion-request')
  dataDeletionRequest(@CurrentUser() user: AuthenticatedUser) {
    return this.privacyService.createPrivacyRequest(user, { requestType: 'delete' });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('privacy/ai-personalisation-opt-out')
  aiOptOut(@CurrentUser() user: AuthenticatedUser, @Body() body: AiOptOutDto) {
    return this.privacyService.setAiPersonalisationOptOut(user, body.optOut);
  }

  @UseGuards(JwtAuthGuard)
  @Get('privacy/requests/me')
  myRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.privacyService.listMyPrivacyRequests(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('consents')
  createConsent(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateConsentDto, @Req() req: Request) {
    return this.privacyService.recordConsent(user, body, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('consents/me')
  myConsents(@CurrentUser() user: AuthenticatedUser) {
    return this.privacyService.listMyConsents(user);
  }
}
