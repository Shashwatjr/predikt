import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { AdminFeatureEnabledGuard } from './admin-feature-enabled.guard';
import { AdminAuthGuard } from './admin-auth.guard';
import { RequireAdminPermission } from './admin-permissions.decorator';
import { AdminRoleGuard } from './admin-role.guard';
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
import { AdminRequest } from '../common/types/http-request-context';

@Controller('admin')
@UseGuards(AdminFeatureEnabledGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('auth/login')
  login(@Body() body: AdminLoginDto, @Req() req: Request) {
    return this.adminService.login(body, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @Get('me')
  me(@Req() req: AdminRequest) {
    return this.adminService.me(req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.dashboard.read')
  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.users.read')
  @Get('users')
  users() {
    return this.adminService.users();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.users.read')
  @Get('users/:userId')
  user(@Param('userId') userId: string) {
    return this.adminService.user(userId);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.users.disable')
  @Patch('users/:userId/status')
  patchUserStatus(@Param('userId') userId: string, @Body() body: AdminStatusChangeDto, @Req() req: AdminRequest) {
    return this.adminService.patchUserStatus(userId, body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.users.disable')
  @Post('users/:userId/suspend')
  suspendUser(@Param('userId') userId: string, @Body() body: AdminStatusChangeDto, @Req() req: AdminRequest) {
    return this.adminService.suspendUser(userId, body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.rooms.read')
  @Get('rooms')
  rooms() {
    return this.adminService.rooms();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.rooms.disable')
  @Post('rooms/:roomId/remove')
  removeRoom(@Param('roomId') roomId: string, @Body() body: RemoveRoomDto, @Req() req: AdminRequest) {
    return this.adminService.removeRoom(roomId, body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.moderation.read')
  @Get('reports')
  reports() {
    return this.adminService.reports();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.credits.read')
  @Get('credit-ledger')
  creditLedger() {
    return this.adminService.creditLedger();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.credits.reverse')
  @Post('credits/reverse')
  reverseCredits(@Body() body: ReverseCreditsDto, @Req() req: AdminRequest) {
    return this.adminService.reverseCredits(body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.moderation.read')
  @Get('disputes')
  disputes() {
    return this.adminService.disputes();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.moderation.resolve')
  @Post('disputes/:disputeId/resolve')
  resolveDispute(
    @Param('disputeId') disputeId: string,
    @Body() body: ResolveDisputeDto,
    @Req() req: AdminRequest,
  ) {
    return this.adminService.resolveDispute(disputeId, body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.creators.read')
  @Get('creators')
  creators() {
    return this.adminService.creators();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.creators.manage')
  @Patch('creators/:creatorProfileId/status')
  patchCreatorStatus(
    @Param('creatorProfileId') creatorProfileId: string,
    @Body() body: PatchCreatorStatusDto,
    @Req() req: AdminRequest,
  ) {
    return this.adminService.patchCreatorStatus(creatorProfileId, body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.drops.read')
  @Get('drops')
  drops() {
    return this.adminService.drops();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.drops.manage')
  @Post('drops')
  createDrop(@Body() body: CreateDropDto, @Req() req: AdminRequest) {
    return this.adminService.createDrop(body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.drops.manage')
  @Patch('drops/:dropId')
  updateDrop(@Param('dropId') dropId: string, @Body() body: UpdateDropDto, @Req() req: AdminRequest) {
    return this.adminService.updateDrop(dropId, body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.sponsors.read')
  @Get('sponsors')
  sponsors() {
    return this.adminService.sponsors();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.sponsors.manage')
  @Post('sponsors')
  createSponsor(@Body() body: CreateSponsorDto, @Req() req: AdminRequest) {
    return this.adminService.createSponsor(body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.campaigns.read')
  @Get('campaigns')
  campaigns() {
    return this.adminService.campaigns();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.campaigns.manage')
  @Post('campaigns')
  createCampaign(@Body() body: CreateCampaignDto, @Req() req: AdminRequest) {
    return this.adminService.createCampaign(body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.audit.read')
  @Get('audit-logs')
  auditLogs() {
    return this.adminService.auditLogs();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.privacy.read')
  @Get('privacy-requests')
  privacyRequests() {
    return this.adminService.privacyRequests();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.privacy.action')
  @Patch('privacy-requests/:privacyRequestId')
  updatePrivacyRequest(
    @Param('privacyRequestId') privacyRequestId: string,
    @Body() body: UpdatePrivacyRequestDto,
    @Req() req: AdminRequest,
  ) {
    return this.adminService.updatePrivacyRequest(privacyRequestId, body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.ai_systems.read')
  @Get('ai-systems')
  aiSystems() {
    return this.adminService.aiSystems();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.ai_systems.manage')
  @Post('ai-systems')
  createAiSystem(@Body() body: CreateAiSystemDto, @Req() req: AdminRequest) {
    return this.adminService.createAiSystem(body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.ai_systems.manage')
  @Patch('ai-systems/:aiSystemId')
  updateAiSystem(@Param('aiSystemId') aiSystemId: string, @Body() body: UpdateAiSystemDto, @Req() req: AdminRequest) {
    return this.adminService.updateAiSystem(aiSystemId, body, req.adminUser);
  }
}
