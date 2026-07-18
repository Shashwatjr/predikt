import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { featureFlags } from '../config/feature-flags';

@Injectable()
export class AdminFeatureEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!featureFlags.adminPortalEnabled) {
      throw new NotFoundException();
    }
    return true;
  }
}
