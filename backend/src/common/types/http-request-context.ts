import { Request } from 'express';
import { AdminAuthenticatedUser } from './admin-authenticated-user';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface AdminRequest extends Request {
  adminUser: AdminAuthenticatedUser;
}
