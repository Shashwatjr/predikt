import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRequest } from '../common/types/http-request-context';
import { ADMIN_PERMISSION_KEY } from './admin-permissions.decorator';
import { hasAdminPermission, isAdminPortalRole } from './utils/admin-roles';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const roleName = request.adminUser?.role?.roleName;
    const permissions = request.adminUser?.role?.permissions as Record<string, unknown> | undefined;
    if (!isAdminPortalRole(roleName, permissions)) {
      throw new ForbiddenException('Admin access required');
    }
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      ADMIN_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredPermission && !hasAdminPermission(roleName, permissions, requiredPermission)) {
      throw new ForbiddenException('Missing required admin permission');
    }
    return true;
  }
}
