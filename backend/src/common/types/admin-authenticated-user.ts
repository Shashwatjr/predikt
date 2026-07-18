export interface AdminAuthenticatedUser {
  adminUserId: string;
  email: string;
  name: string;
  status: string;
  role: {
    roleName: string;
    permissions?: Record<string, unknown> | null;
  };
}
