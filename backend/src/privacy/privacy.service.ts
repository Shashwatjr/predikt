import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrivacyRequestDto } from './dto/create-privacy-request.dto';
import { CreateConsentDto } from './dto/create-consent.dto';
import { RequestMeta } from '../common/types/http-request-context';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createPrivacyRequest(user: AuthenticatedUser, body: CreatePrivacyRequestDto) {
    // Privacy workflow note: requests are captured immediately even though fulfillment is
    // still admin-driven, so the audit log can prove intake timing and user intent.
    const request = await this.prisma.privacyRequest.create({
      data: {
        userId: user.userId,
        requestType: body.requestType,
        resolutionNotes: body.resolutionNotes,
      },
    });
    await this.auditService.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'privacy_request.created',
      targetType: 'privacy_request',
      targetId: request.privacyRequestId,
      afterValue: request,
    });
    if (body.requestType === 'export' || body.requestType === 'delete') {
      await this.auditService.log({
        actorType: 'user',
        actorId: user.userId,
        action:
          body.requestType === 'export'
            ? 'privacy.data_export_requested'
            : 'privacy.data_deletion_requested',
        targetType: 'privacy_request',
        targetId: request.privacyRequestId,
        afterValue: request,
      });
    }
    return request;
  }

  listMyPrivacyRequests(user: AuthenticatedUser) {
    return this.prisma.privacyRequest.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordConsent(
    user: AuthenticatedUser,
    body: CreateConsentDto,
    meta: RequestMeta,
  ) {
    const consent = await this.prisma.consentRecord.create({
      data: {
        userId: user.userId,
        consentType: body.consentType,
        status: body.status,
        policyVersion: body.policyVersion,
        source: body.source,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        consentedAt: body.status === 'granted' ? new Date() : null,
        withdrawnAt: body.status === 'withdrawn' ? new Date() : null,
      },
    });
    await this.auditService.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'consent.recorded',
      targetType: 'consent',
      targetId: consent.consentId,
      afterValue: consent,
    });
    return consent;
  }

  listMyConsents(user: AuthenticatedUser) {
    return this.prisma.consentRecord.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  policy(slug: string) {
    const policies: Record<string, Record<string, unknown>> = {
      privacy: {
        title: 'My Prediktion Privacy Policy',
        version: 'mvp-2026-07',
        summary:
          'My Prediktion uses data to run social prediction rooms. Exact location is used for verification where needed and is not shown in participant or public views.',
        principles: [
          'Ghost Mode and delayed approximate location are the default.',
          'No public route history, live trail, or exact GPS coordinates.',
          'Users can request export or deletion of their data.',
          'AI personalization is optional and uses only privacy-safe minimal data.',
        ],
      },
      terms: {
        title: 'My Prediktion Terms',
        version: 'mvp-2026-07',
        summary:
          'My Prediktion is a privacy-safe social prediction app. Aura is reputation, Clout is social influence, and Credits are feature unlocks.',
      },
      'community-guidelines': {
        title: 'Community Guidelines',
        version: 'mvp-2026-07',
        summary:
          'Keep predictions friendly, opt-in, and safe. No harassment, doxxing, unsafe location sharing, spam, fake results, or humiliating loser cards.',
      },
      safety: {
        title: 'Safety Policy',
        version: 'mvp-2026-07',
        summary:
          'My Prediktion is for social predictions only. Credits are in-app feature unlocks and are not transferable or withdrawable.',
      },
    };
    return policies[slug] ?? policies.privacy;
  }

  async setAiPersonalisationOptOut(user: AuthenticatedUser, optOut: boolean) {
    // AI governance boundary: this flag is user-controlled and should be checked before
    // any future copy-personalisation flow reads profile or activity context.
    const updated = await this.prisma.user.update({
      where: { userId: user.userId },
      data: { aiPersonalisationOptOut: optOut },
    });
    await this.auditService.log({
      actorType: 'user',
      actorId: user.userId,
      action: 'privacy.ai_personalisation_opt_out.updated',
      targetType: 'user',
      targetId: user.userId,
      afterValue: { aiPersonalisationOptOut: updated.aiPersonalisationOptOut },
    });
    return { aiPersonalisationOptOut: updated.aiPersonalisationOptOut };
  }
}
