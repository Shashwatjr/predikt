import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { safeAdminAuditItem } from './utils/safe-admin-projections';
import {
  safeAdminUserDetail,
  safeAdminUserListItem,
} from './utils/safe-admin-projections';
import {
  AdminLoginDto,
  AdminStatusChangeDto,
  CreateAiSystemDto,
  CreateCampaignDto,
  CreateDropDto,
  CreateSponsorDto,
  PatchCreatorStatusDto,
  RemoveRoomDto,
  ResolveDisputeDto,
  ReverseCreditsDto,
  UpdateAiSystemDto,
  UpdateDropDto,
  UpdatePrivacyRequestDto,
} from './dto/admin.dto';
import { AdminAuthenticatedUser } from '../common/types/admin-authenticated-user';
import { RequestMeta } from '../common/types/http-request-context';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async login(body: AdminLoginDto, meta: RequestMeta) {
    const email = body.email.trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!admin) {
      await this.auditService.log({
        actorType: 'admin',
        action: 'admin.login.failed',
        targetType: 'admin_user',
        reason: 'Unknown email',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.status !== 'active') {
      await this.auditService.log({
        actorType: 'admin',
        actorId: admin.adminUserId,
        actorRole: admin.role.roleName,
        action: 'admin.login.failed',
        targetType: 'admin_user',
        targetId: admin.adminUserId,
        reason: 'Account unavailable',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(body.password, admin.passwordHash);
    if (!valid) {
      await this.auditService.log({
        actorType: 'admin',
        actorId: admin.adminUserId,
        actorRole: admin.role.roleName,
        action: 'admin.login.failed',
        targetType: 'admin_user',
        targetId: admin.adminUserId,
        reason: 'Invalid password',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const secret = this.configService.get<string>('ADMIN_JWT_SECRET');
    const accessToken = await this.jwtService.signAsync(
      {
        sub: admin.adminUserId,
        email: admin.email,
        role: admin.role.roleName,
        tokenType: 'admin_access',
      },
      {
        secret,
        expiresIn: `${this.configService.get<number>('ADMIN_JWT_TTL_SECONDS') ?? 3600}s`,
      },
    );

    await this.prisma.adminUser.update({
      where: { adminUserId: admin.adminUserId },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      actorType: 'admin',
      actorId: admin.adminUserId,
      actorRole: admin.role.roleName,
      action: 'admin.login.success',
      targetType: 'admin_user',
      targetId: admin.adminUserId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      admin: {
        adminUserId: admin.adminUserId,
        name: admin.name,
        role: admin.role.roleName,
      },
    };
  }

  me(adminUser: AdminAuthenticatedUser) {
    return {
      adminUserId: adminUser.adminUserId,
      name: adminUser.name,
      role: adminUser.role.roleName,
      status: adminUser.status,
    };
  }

  async dashboard() {
    const [
      totalUsers,
      totalCreators,
      liveRooms,
      completedRooms,
      predictionsSubmitted,
      dropsUnlocked,
      activeCampaigns,
      pendingPrivacyRequests,
      recentAdminActions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.creatorProfile.count(),
      this.prisma.predictionRoom.count({ where: { status: 'live' } }),
      this.prisma.predictionRoom.count({ where: { status: 'completed' } }),
      this.prisma.milestonePrediction.count(),
      this.prisma.userDrop.count(),
      this.prisma.campaign.count({ where: { status: 'active' } }),
      this.prisma.privacyRequest.count({ where: { status: { in: ['submitted', 'in_review', 'verified', 'processing'] } } }),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return {
      totalUsers,
      totalCreators,
      liveRooms,
      completedRooms,
      predictionsSubmitted,
      dropsUnlocked,
      activeCampaigns,
      pendingPrivacyRequests,
      recentAdminActions: recentAdminActions.map((row) =>
        safeAdminAuditItem(row as unknown as Record<string, unknown>),
      ),
    };
  }

  async users() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        name: true,
        prediktHandle: true,
        isGuest: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        roomsCreatedCount: true,
        predictionsMadeCount: true,
        totalAura: true,
      },
    });
    return users.map((user) => safeAdminUserListItem(user as unknown as Record<string, unknown>));
  }

  async user(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    return safeAdminUserDetail(user as unknown as Record<string, unknown> | null);
  }

  async patchUserStatus(userId: string, body: AdminStatusChangeDto, adminUser: AdminAuthenticatedUser) {
    const before = await this.prisma.user.findUnique({ where: { userId } });
    if (!before) {
      throw new BadRequestException('User not found');
    }
    const after = await this.prisma.user.update({
      where: { userId },
      data: { status: body.status },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'user.status.updated',
      targetType: 'user',
      targetId: userId,
      beforeValue: safeAdminUserDetail(before as unknown as Record<string, unknown> | null),
      afterValue: safeAdminUserDetail(after as unknown as Record<string, unknown> | null),
      reason: body.reason,
    });
    return safeAdminUserDetail(after as unknown as Record<string, unknown> | null);
  }

  async suspendUser(userId: string, body: AdminStatusChangeDto, adminUser: AdminAuthenticatedUser) {
    const before = await this.prisma.user.findUnique({ where: { userId } });
    const after = await this.prisma.user.update({
      where: { userId },
      data: { status: body.status ?? 'suspended' },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'user.suspended',
      targetType: 'user',
      targetId: userId,
      beforeValue: safeAdminUserDetail(before as unknown as Record<string, unknown> | null),
      afterValue: safeAdminUserDetail(after as unknown as Record<string, unknown> | null),
      reason: body.reason,
    });
    return safeAdminUserDetail(after as unknown as Record<string, unknown> | null);
  }

  rooms() {
    // Explicit select: never return raw room rows here — PredictionRoom carries
    // exact start/destination coordinates and place labels, which must not leak
    // through the admin surface (Ghost Mode applies to admins too).
    return this.prisma.predictionRoom.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        roomId: true,
        inviteCode: true,
        roomTitle: true,
        category: true,
        eventType: true,
        status: true,
        journeyStatus: true,
        createdAt: true,
        lockTime: true,
        actualEndTime: true,
        rematchOfRoomId: true,
        creator: {
          select: {
            userId: true,
            name: true,
            prediktHandle: true,
            avatarKey: true,
          },
        },
      },
    });
  }

  async removeRoom(roomId: string, body: RemoveRoomDto, adminUser: AdminAuthenticatedUser) {
    const before = await this.prisma.predictionRoom.findUnique({ where: { roomId } });
    const after = await this.prisma.predictionRoom.update({
      where: { roomId },
      data: { status: 'cancelled', rewardsSuppressed: true },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'room.removed',
      targetType: 'room',
      targetId: roomId,
      beforeValue: before,
      afterValue: after,
      reason: body.reason,
    });
    return after;
  }

  reports() {
    return this.prisma.report.findMany({
      include: {
        reporter: { select: { userId: true, prediktHandle: true, avatarKey: true } },
        targetUser: { select: { userId: true, prediktHandle: true, avatarKey: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  creditLedger() {
    return this.prisma.creditLedger.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async reverseCredits(body: ReverseCreditsDto, adminUser: AdminAuthenticatedUser) {
    const amount = Math.abs(Number(body.amount ?? 0));
    if (!amount) {
      throw new BadRequestException('amount is required');
    }

    // Namespaced so an admin key can never collide with signup/other ledger keys.
    const idempotencyKey = body.idempotencyKey?.trim()
      ? `admin_reverse:${body.idempotencyKey.trim()}`
      : undefined;

    // Idempotent replay: a repeated key returns the original entry, never re-decrements.
    if (idempotencyKey) {
      const existing = await this.prisma.creditLedger.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    let ledger;
    try {
      // Single transaction: read balance, guard against negative, decrement, and
      // write the ledger atomically so a partial reversal can never persist.
      ledger = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { userId: body.userId },
          select: { creditBalance: true },
        });
        if (!user) {
          throw new NotFoundException('User not found');
        }
        if (amount > user.creditBalance) {
          throw new BadRequestException(
            `Reversal of ${amount} exceeds the user's current balance of ${user.creditBalance}. Balances cannot go negative.`,
          );
        }
        const updatedUser = await tx.user.update({
          where: { userId: body.userId },
          data: { creditBalance: { decrement: amount } },
        });
        return tx.creditLedger.create({
          data: {
            userId: body.userId,
            eventType: 'admin_reverse',
            delta: -amount,
            balanceAfter: updatedUser.creditBalance,
            sourceType: 'admin',
            ...(idempotencyKey ? { idempotencyKey } : {}),
            metadata: { reason: body.reason, adminUserId: adminUser.adminUserId },
          },
        });
      });
    } catch (error) {
      // Concurrent replay of the same key: the unique constraint tripped — return the winner.
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.creditLedger.findUnique({ where: { idempotencyKey } });
        if (existing) return existing;
      }
      throw error;
    }

    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'credits.reversed',
      targetType: 'user',
      targetId: body.userId,
      afterValue: ledger,
      reason: body.reason,
    });
    return ledger;
  }

  disputes() {
    return this.prisma.roomDispute.findMany({
      include: {
        user: { select: { userId: true, prediktHandle: true, avatarKey: true } },
        room: { select: { roomId: true, roomTitle: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resolveDispute(disputeId: string, body: ResolveDisputeDto, adminUser: AdminAuthenticatedUser) {
    const before = await this.prisma.roomDispute.findUnique({ where: { disputeId } });
    const after = await this.prisma.roomDispute.update({
      where: { disputeId },
      data: {
        status: (body.status ?? 'resolved') as Prisma.RoomDisputeUpdateInput['status'],
        resolution: body.resolution,
        resolvedAt: new Date(),
      },
    });
    if (body.releaseRewards && after.roomId) {
      await this.prisma.predictionRoom.update({
        where: { roomId: after.roomId },
        data: { resultDisputed: false, rewardsSuppressed: false },
      });
    }
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'dispute.resolved',
      targetType: 'dispute',
      targetId: disputeId,
      beforeValue: before,
      afterValue: after,
      reason: body.resolution,
    });
    return after;
  }

  creators() {
    return this.prisma.creatorProfile.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async patchCreatorStatus(creatorProfileId: string, body: PatchCreatorStatusDto, adminUser: AdminAuthenticatedUser) {
    const before = await this.prisma.creatorProfile.findUnique({ where: { creatorProfileId } });
    const after = await this.prisma.creatorProfile.update({
      where: { creatorProfileId },
      data: { verificationStatus: body.status },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'creator.status.updated',
      targetType: 'creator_profile',
      targetId: creatorProfileId,
      beforeValue: before,
      afterValue: after,
      reason: body.reason,
    });
    return after;
  }

  drops() {
    return this.prisma.drop.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createDrop(body: CreateDropDto, adminUser: AdminAuthenticatedUser) {
    const created = await this.prisma.drop.create({
      data: {
        title: body.title,
        description: body.description,
        dropType: body.dropType,
        sponsorName: body.sponsorName,
        cloutCost: body.cloutCost ?? 0,
        terms: body.terms,
      },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'drop.created',
      targetType: 'drop',
      targetId: created.dropId,
      afterValue: created,
    });
    return created;
  }

  async updateDrop(dropId: string, body: UpdateDropDto, adminUser: AdminAuthenticatedUser) {
    const before = await this.prisma.drop.findUnique({ where: { dropId } });
    const after = await this.prisma.drop.update({
      where: { dropId },
      data: body,
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'drop.updated',
      targetType: 'drop',
      targetId: dropId,
      beforeValue: before,
      afterValue: after,
    });
    return after;
  }

  sponsors() {
    return this.prisma.sponsor.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createSponsor(body: CreateSponsorDto, adminUser: AdminAuthenticatedUser) {
    const sponsor = await this.prisma.sponsor.create({
      data: {
        sponsorName: body.sponsorName,
        logoUrl: body.logoUrl,
        brandColor: body.brandColor,
        websiteUrl: body.websiteUrl,
        industry: body.industry,
      },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'sponsor.created',
      targetType: 'sponsor',
      targetId: sponsor.sponsorId,
      afterValue: sponsor,
    });
    return sponsor;
  }

  campaigns() {
    return this.prisma.campaign.findMany({
      include: {
        sponsor: true,
        creator: {
          select: {
            userId: true,
            name: true,
            prediktHandle: true,
            avatarKey: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(body: CreateCampaignDto, adminUser: AdminAuthenticatedUser) {
    const campaign = await this.prisma.campaign.create({
      data: {
        sponsorId: body.sponsorId,
        campaignName: body.campaignName,
        campaignType: body.campaignType,
        creatorUserId: body.creatorUserId,
        budgetLabel: body.budgetLabel,
        status: body.status ?? 'draft',
      },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'campaign.created',
      targetType: 'campaign',
      targetId: campaign.campaignId,
      afterValue: campaign,
    });
    return campaign;
  }

  auditLogs() {
    return this.prisma.auditLog
      .findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
      .then((rows) => rows.map((row) => safeAdminAuditItem(row as unknown as Record<string, unknown>)));
  }

  async searchAuditLogs(query: {
    actorId?: string;
    action?: string;
    targetId?: string;
    targetType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25)));
    const where: Record<string, unknown> = {};
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = { contains: query.action };
    if (query.targetId) where.targetId = query.targetId;
    if (query.targetType) where.targetType = query.targetType;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(query.dateFrom);
      if (query.dateTo) (where.createdAt as Record<string, Date>).lte = new Date(query.dateTo);
    }

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: items.map((item) => safeAdminAuditItem(item as unknown as Record<string, unknown>)),
    };
  }

  privacyRequests() {
    return this.prisma.privacyRequest.findMany({
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            prediktHandle: true,
            avatarKey: true,
          },
        },
        assignedAdmin: {
          select: {
            adminUserId: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePrivacyRequest(privacyRequestId: string, body: UpdatePrivacyRequestDto, adminUser: AdminAuthenticatedUser) {
    const before = await this.prisma.privacyRequest.findUnique({
      where: { privacyRequestId },
    });
    const after = await this.prisma.privacyRequest.update({
      where: { privacyRequestId },
      data: {
        status: body.status,
        resolutionNotes: body.resolutionNotes,
        assignedAdminId: adminUser.adminUserId,
        verifiedAt: body.status === 'verified' ? new Date() : before?.verifiedAt,
        completedAt: body.status === 'completed' ? new Date() : before?.completedAt,
      },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'privacy_request.updated',
      targetType: 'privacy_request',
      targetId: privacyRequestId,
      beforeValue: before,
      afterValue: after,
      reason: body.resolutionNotes,
    });
    return after;
  }

  aiSystems() {
    return this.prisma.aiSystemInventory.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createAiSystem(body: CreateAiSystemDto, adminUser: AdminAuthenticatedUser) {
    const aiSystem = await this.prisma.aiSystemInventory.create({
      data: {
        featureName: body.featureName,
        purpose: body.purpose,
        provider: body.provider,
        modelName: body.modelName,
        inputDataCategories: body.inputDataCategories as Prisma.InputJsonValue | undefined,
        outputType: body.outputType,
        riskClassification: body.riskClassification,
        humanOversight: body.humanOversight,
        transparencyNotice: body.transparencyNotice,
        version: body.version,
        status: body.status ?? 'planned',
        lastReviewedAt: body.lastReviewedAt ? new Date(body.lastReviewedAt) : undefined,
      },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'ai_system.created',
      targetType: 'ai_system',
      targetId: aiSystem.aiSystemId,
      afterValue: aiSystem,
    });
    return aiSystem;
  }

  async updateAiSystem(aiSystemId: string, body: UpdateAiSystemDto, adminUser: AdminAuthenticatedUser) {
    const before = await this.prisma.aiSystemInventory.findUnique({ where: { aiSystemId } });
    const after = await this.prisma.aiSystemInventory.update({
      where: { aiSystemId },
      data: {
        featureName: body.featureName,
        purpose: body.purpose,
        provider: body.provider,
        modelName: body.modelName,
        inputDataCategories: body.inputDataCategories as Prisma.InputJsonValue | undefined,
        outputType: body.outputType,
        riskClassification: body.riskClassification,
        humanOversight: body.humanOversight,
        transparencyNotice: body.transparencyNotice,
        version: body.version,
        status: body.status,
        lastReviewedAt: body.lastReviewedAt ? new Date(body.lastReviewedAt) : undefined,
      },
    });
    await this.auditService.log({
      actorType: 'admin',
      actorId: adminUser.adminUserId,
      actorRole: adminUser.role.roleName,
      action: 'ai_system.updated',
      targetType: 'ai_system',
      targetId: aiSystemId,
      beforeValue: before,
      afterValue: after,
    });
    return after;
  }
}
