import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthenticatedUser } from '../common/types/admin-authenticated-user';
import { AdminRequest } from '../common/types/http-request-context';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing admin token');
    }

    const token = auth.slice(7);
    const secret = this.configService.get<string>('ADMIN_JWT_SECRET');

    try {
      const payload = await this.jwtService.verifyAsync(token, { secret });
      if (payload.tokenType === 'access' || payload.tokenType === 'refresh') {
        throw new ForbiddenException('Admin access required');
      }
      if (payload.tokenType !== 'admin_access') {
        throw new UnauthorizedException('Invalid admin token');
      }
      const admin = await this.prisma.adminUser.findUnique({
        where: { adminUserId: payload.sub },
        include: { role: true },
      });
      if (!admin || admin.status !== 'active') {
        throw new UnauthorizedException('Admin account unavailable');
      }
      request.adminUser = admin as AdminAuthenticatedUser;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      try {
        const userSecret = this.configService.get<string>('JWT_SECRET');
        const userPayload = await this.jwtService.verifyAsync(token, { secret: userSecret });
        if (userPayload?.tokenType === 'access' || userPayload?.tokenType === 'refresh') {
          throw new ForbiddenException('Admin access required');
        }
      } catch (userError) {
        if (userError instanceof ForbiddenException) {
          throw userError;
        }
      }
      throw new UnauthorizedException('Invalid admin token');
    }
  }
}
