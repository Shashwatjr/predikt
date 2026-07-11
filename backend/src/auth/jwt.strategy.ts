import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_SELF_USER_SELECT } from '../common/utils/safe-user-select';

export interface JwtPayload {
  sub: string;
  email: string;
  tokenType: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }
    const user = await this.prisma.user.findUnique({
      where: { userId: payload.sub },
      select: SAFE_SELF_USER_SELECT,
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
