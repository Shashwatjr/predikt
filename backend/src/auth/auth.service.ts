import {
  BadRequestException,
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '@prisma/client';
import {
  assertHandleAvailable,
  sanitizePrediktHandle,
  validatePrediktHandle,
} from '../common/utils/predikt-handle';
import { safeSelfUser } from '../common/utils/safe-user-select';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { GuestDto } from './dto/guest.dto';
import { GuestUpgradeDto } from './dto/guest-upgrade.dto';
import { featureFlags } from '../config/feature-flags';

interface RefreshTokenPayload {
  sub: string;
  sid: string;
  tokenType: 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const prediktHandle = sanitizePrediktHandle(dto.prediktHandle);
    validatePrediktHandle(prediktHandle);
    if (prediktHandle) {
      const existingHandle = await this.prisma.user.findFirst({
        where: { prediktHandle },
      });
      assertHandleAvailable(!!existingHandle);
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email,
          prediktHandle,
          passwordHash: hash,
          creditBalance: 30,
        },
      });
      await tx.creditLedger.create({
        data: {
          userId: created.userId,
          eventType: 'signup',
          delta: 30,
          balanceAfter: 30,
          sourceType: 'auth',
          idempotencyKey: `signup:${created.userId}`,
          metadata: { label: 'Signup credit bonus' },
        },
      });
      return created;
    });

    return this.issueAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { userSessionId: payload.sid },
      include: { user: true },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has been revoked or expired');
    }

    const valid = await bcrypt.compare(dto.refreshToken, session.refreshTokenHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.userSession.update({
      where: { userSessionId: session.userSessionId },
      data: { revokedAt: new Date() },
    });

    return this.issueAuthResponse(session.user);
  }

  async logout(dto: LogoutDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { userSessionId: payload.sid },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const valid = await bcrypt.compare(dto.refreshToken, session.refreshTokenHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.userSession.update({
      where: { userSessionId: session.userSessionId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  me(user: User) {
    return safeSelfUser(user);
  }

  /**
   * Mints (or, via a matching guestKey, reuses) a guest account so someone who
   * tapped an invite link can predict without registering. Guests are real User
   * rows (no email/password) so they stay first-class in all scoring joins.
   */
  async guest(dto: GuestDto) {
    if (!featureFlags.guestJoin) {
      throw new BadRequestException('Guest join is currently unavailable.');
    }

    const displayName = dto.handle.trim().replace(/^@+/, '').slice(0, 30);
    if (!displayName) {
      throw new BadRequestException('Enter a name to join.');
    }

    // Returning guest: recognised by the device-stored guestKey.
    if (dto.guestKey) {
      const existing = await this.prisma.user.findUnique({
        where: { guestKey: dto.guestKey },
      });
      if (existing && existing.isGuest) {
        const refreshed =
          existing.name === displayName
            ? existing
            : await this.prisma.user.update({
                where: { userId: existing.userId },
                data: { name: displayName },
              });
        return { ...(await this.issueAuthResponse(refreshed)), guestKey: refreshed.guestKey };
      }
    }

    const roomSafeName = dto.roomId
      ? await this.deconflictRoomName(dto.roomId, displayName)
      : displayName;

    const guestKey = dto.guestKey?.trim() || cryptoRandomId();
    const user = await this.prisma.user.create({
      data: {
        name: roomSafeName,
        isGuest: true,
        guestKey,
        status: 'active',
      },
    });

    return { ...(await this.issueAuthResponse(user)), guestKey: user.guestKey };
  }

  /**
   * Converts the current guest into a full account, preserving their user row and
   * all Aura/Clout/prediction history. Offered after their first Tea resolves.
   */
  async upgradeGuest(currentUser: User, dto: GuestUpgradeDto) {
    const user = await this.prisma.user.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!user) throw new UnauthorizedException();
    if (!user.isGuest) {
      throw new BadRequestException('This account is already registered.');
    }

    const email = dto.email.trim().toLowerCase();
    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new ConflictException('Email already registered');

    const prediktHandle = sanitizePrediktHandle(dto.prediktHandle);
    validatePrediktHandle(prediktHandle);
    if (prediktHandle) {
      const existingHandle = await this.prisma.user.findFirst({ where: { prediktHandle } });
      assertHandleAvailable(!!existingHandle);
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const upgraded = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { userId: user.userId },
        data: {
          email,
          passwordHash: hash,
          prediktHandle,
          name: dto.name?.trim() || user.name,
          isGuest: false,
        },
      });
      const signupCredit = await tx.creditLedger.findUnique({
        where: { idempotencyKey: `signup:${user.userId}` },
      });
      if (!signupCredit) {
        const credited = await tx.user.update({
          where: { userId: user.userId },
          data: { creditBalance: { increment: 30 } },
        });
        await tx.creditLedger.create({
          data: {
            userId: user.userId,
            eventType: 'signup',
            delta: 30,
            balanceAfter: credited.creditBalance,
            sourceType: 'auth',
            idempotencyKey: `signup:${user.userId}`,
            metadata: { label: 'Signup credit bonus', source: 'guest_upgrade' },
          },
        });
        return credited;
      }
      return updated;
    });

    return this.issueAuthResponse(upgraded);
  }

  /** Keeps a guest's display name unambiguous among a room's joined members. */
  private async deconflictRoomName(roomId: string, displayName: string) {
    const members = await this.prisma.roomMembership.findMany({
      where: { roomId, status: 'joined' },
      select: { user: { select: { name: true, prediktHandle: true } } },
    });
    const taken = new Set(
      members
        .map((m) => (m.user.prediktHandle ?? m.user.name ?? '').trim().toLowerCase())
        .filter(Boolean),
    );
    if (!taken.has(displayName.toLowerCase())) return displayName;
    for (let n = 2; n < 100; n += 1) {
      const candidate = `${displayName} ${n}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${displayName} ${cryptoRandomId().slice(0, 4)}`;
  }

  private async issueAuthResponse(user: User) {
    const accessTokenTtlSeconds =
      this.configService.get<number>('JWT_ACCESS_TTL_SECONDS') ?? 900;
    const refreshTokenTtlDays =
      this.configService.get<number>('JWT_REFRESH_TTL_DAYS') ?? 30;
    const accessTokenExpiresAt = new Date(Date.now() + accessTokenTtlSeconds * 1000);
    const refreshTokenExpiresAt = new Date(
      Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    const sessionId = cryptoRandomId();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.userId, sid: sessionId, tokenType: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: `${refreshTokenTtlDays}d`,
      },
    );
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.userSession.create({
      data: {
        userSessionId: sessionId,
        userId: user.userId,
        refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.userId,
        email: user.email ?? '',
        tokenType: 'access',
      },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: `${accessTokenTtlSeconds}s`,
      },
    );

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      user: safeSelfUser(user),
    };
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}

function cryptoRandomId() {
  return randomBytes(16).toString('hex');
}
