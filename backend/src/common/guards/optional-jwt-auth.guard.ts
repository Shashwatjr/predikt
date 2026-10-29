import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attaches a user when a valid access token is present (creator or guest session).
 * Missing or rejected credentials stay anonymous so guest polling of public
 * live-state does not fail closed. Anonymous and non-creator viewers receive
 * the safety-delayed checkpoint snapshot.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: unknown, user: TUser): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
