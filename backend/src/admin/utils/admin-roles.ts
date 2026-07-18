/** Platform admin roles that may access the private-beta admin portal. */
export const ADMIN_PORTAL_ROLES = [
  'super_admin',
  'platform_ops',
  'privacy_officer',
  'compliance_auditor',
  'campaign_manager',
] as const;

export type AdminPortalRole = (typeof ADMIN_PORTAL_ROLES)[number];

export const SUPER_ADMIN_ROLES = ['super_admin'] as const;

export function isAdminPortalRole(
  roleName: string | null | undefined,
  permissions?: Record<string, unknown> | null,
): boolean {
  if (!roleName) return false;
  if (ADMIN_PORTAL_ROLES.includes(roleName as AdminPortalRole)) return true;
  if (permissions && (permissions as { all?: boolean }).all === true) return true;
  return false;
}

export function hasAdminPermission(
  roleName: string | null | undefined,
  permissions: Record<string, unknown> | null | undefined,
  permission: string,
): boolean {
  if (!roleName) return false;
  if ((permissions as { all?: boolean } | null | undefined)?.all === true) return true;
  return permissions?.[permission] === true;
}

export function isSuperAdminRole(roleName: string | null | undefined): boolean {
  return roleName === 'super_admin';
}

export function normalizeAdminRoleLabel(roleName: string): 'SUPER_ADMIN' | 'ADMIN' {
  return isSuperAdminRole(roleName) ? 'SUPER_ADMIN' : 'ADMIN';
}
