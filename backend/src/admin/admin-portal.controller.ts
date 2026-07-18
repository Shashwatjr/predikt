import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminFeatureEnabledGuard } from './admin-feature-enabled.guard';
import { AdminAuthGuard } from './admin-auth.guard';
import { RequireAdminPermission } from './admin-permissions.decorator';
import { AdminRoleGuard } from './admin-role.guard';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminOperationsService } from './admin-operations.service';
import { AdminFeedbackService } from './admin-feedback.service';
import { AdminModerationService } from './admin-moderation.service';
import { AdminSystemService } from './admin-system.service';
import { AdminService } from './admin.service';
import { AdminRequest } from '../common/types/http-request-context';
import {
  AdminAuditQueryDto,
  AdminFeedbackUpdateDto,
  AdminModerationUpdateDto,
  AdminReasonDto,
} from './dto/admin.dto';
import { featureFlags } from '../config/feature-flags';

function assertAnalyticsEnabled() {
  if (!featureFlags.adminAnalyticsEnabled) {
    throw new ForbiddenException('Admin analytics is disabled');
  }
}

function assertFeedbackEnabled() {
  if (!featureFlags.adminFeedbackQueueEnabled) {
    throw new ForbiddenException('Admin feedback queue is disabled');
  }
}

function assertModerationEnabled() {
  if (!featureFlags.adminModerationEnabled) {
    throw new ForbiddenException('Admin moderation is disabled');
  }
}

function assertSystemHealthEnabled() {
  if (!featureFlags.adminSystemHealthEnabled) {
    throw new ForbiddenException('Admin system health is disabled');
  }
}

@Controller('admin')
@UseGuards(AdminFeatureEnabledGuard)
export class AdminPortalController {
  constructor(
    private readonly analyticsService: AdminAnalyticsService,
    private readonly operationsService: AdminOperationsService,
    private readonly feedbackService: AdminFeedbackService,
    private readonly moderationService: AdminModerationService,
    private readonly systemService: AdminSystemService,
    private readonly adminService: AdminService,
  ) {}

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.analytics.read')
  @Get('analytics/summary')
  summary(@Query() query: Record<string, string | undefined>) {
    assertAnalyticsEnabled();
    return this.analyticsService.summary(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.analytics.read')
  @Get('analytics/funnel')
  funnel(@Query() query: Record<string, string | undefined>) {
    assertAnalyticsEnabled();
    return this.analyticsService.funnel(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.analytics.read')
  @Get('analytics/categories')
  categories(@Query() query: Record<string, string | undefined>) {
    assertAnalyticsEnabled();
    return this.analyticsService.categories(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.analytics.read')
  @Get('analytics/guest-journey')
  guestJourney(@Query() query: Record<string, string | undefined>) {
    assertAnalyticsEnabled();
    return this.analyticsService.guestJourney(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.analytics.read')
  @Get('analytics/room-health')
  roomHealth(@Query() query: Record<string, string | undefined>) {
    assertAnalyticsEnabled();
    return this.analyticsService.roomHealth(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.analytics.read')
  @Get('analytics/sharing')
  sharing(@Query() query: Record<string, string | undefined>) {
    assertAnalyticsEnabled();
    return this.analyticsService.sharing(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.analytics.read')
  @Get('analytics/errors')
  errors(@Query() query: Record<string, string | undefined>) {
    assertAnalyticsEnabled();
    return this.analyticsService.errors(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.rooms.read')
  @Get('operations/rooms')
  rooms(@Query() query: Record<string, string | undefined>) {
    return this.operationsService.listRooms(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.rooms.read')
  @Get('operations/rooms/:roomId')
  roomDetail(@Param('roomId') roomId: string) {
    return this.operationsService.roomDetail(roomId);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.rooms.review')
  @Post('operations/rooms/:roomId/mark-review')
  markRoomReview(
    @Param('roomId') roomId: string,
    @Body() body: AdminReasonDto,
    @Req() req: AdminRequest,
  ) {
    return this.operationsService.markRoomForReview(roomId, body.reason, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.users.read')
  @Get('operations/users')
  users(@Query() query: Record<string, string | undefined>) {
    return this.operationsService.listUsers(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.users.read')
  @Get('operations/users/:userId')
  userDetail(@Param('userId') userId: string) {
    return this.operationsService.userDetail(userId);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.users.disable')
  @Post('operations/users/:userId/disable')
  disableUser(
    @Param('userId') userId: string,
    @Body() body: AdminReasonDto,
    @Req() req: AdminRequest,
  ) {
    return this.operationsService.disableUser(userId, body.reason, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.users.enable')
  @Post('operations/users/:userId/enable')
  enableUser(
    @Param('userId') userId: string,
    @Body() body: AdminReasonDto,
    @Req() req: AdminRequest,
  ) {
    return this.operationsService.enableUser(userId, body.reason, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.users.review')
  @Post('operations/users/:userId/mark-review')
  markUserReview(
    @Param('userId') userId: string,
    @Body() body: AdminReasonDto,
    @Req() req: AdminRequest,
  ) {
    return this.operationsService.markUserForReview(userId, body.reason, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.feedback.read')
  @Get('feedback')
  feedback(@Query() query: Record<string, string | undefined>) {
    assertFeedbackEnabled();
    return this.feedbackService.list(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.feedback.update')
  @Patch('feedback/:feedbackId')
  updateFeedback(
    @Param('feedbackId') feedbackId: string,
    @Body() body: AdminFeedbackUpdateDto,
    @Req() req: AdminRequest,
  ) {
    assertFeedbackEnabled();
    return this.feedbackService.update(feedbackId, body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.moderation.read')
  @Get('moderation/queue')
  moderationQueue(@Query() query: Record<string, string | undefined>) {
    assertModerationEnabled();
    return this.moderationService.list(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.moderation.resolve')
  @Patch('moderation/reports/:reportId')
  updateReport(
    @Param('reportId') reportId: string,
    @Body() body: AdminModerationUpdateDto,
    @Req() req: AdminRequest,
  ) {
    assertModerationEnabled();
    return this.moderationService.updateReport(reportId, body, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.moderation.force_fallback')
  @Post('moderation/rooms/:roomId/commentary-fallback')
  commentaryFallback(
    @Param('roomId') roomId: string,
    @Body() body: AdminReasonDto,
    @Req() req: AdminRequest,
  ) {
    assertModerationEnabled();
    return this.moderationService.forceSafeCommentaryFallback(roomId, body.reason, req.adminUser);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.audit.read')
  @Get('audit-logs/search')
  auditLogs(@Query() query: AdminAuditQueryDto) {
    return this.adminService.searchAuditLogs(query);
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.system.health.read')
  @Get('system/health')
  systemHealth() {
    assertSystemHealthEnabled();
    return this.systemService.health();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.system.health.read')
  @Get('system/version')
  systemVersion() {
    return this.systemService.version();
  }

  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminPermission('admin.system.flags.read')
  @Get('system/feature-flags')
  systemFeatureFlags() {
    return this.systemService.featureFlags();
  }
}
