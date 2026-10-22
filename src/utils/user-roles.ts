import type { AccessScope, Role, RolePermissionSet, User } from '../types/treasury';

/** The primary role retains defaults; supplementary roles only add permissions. */
export function getUserRoles(user: Pick<User, 'role' | 'additionalRoles'>): Role[] {
  return [...new Set([user.role, ...(Array.isArray(user.additionalRoles) ? user.additionalRoles : [])].filter(role => typeof role === 'string' && role.length > 0))];
}

export function hasSupervisorPermissions(permissions: Partial<RolePermissionSet>, scope: AccessScope | undefined, approvalLimit: number | undefined): boolean {
  return Boolean(permissions.canViewRequests && permissions.canAccessApproverCartable && permissions.canApprove && scope && scope !== 'SELF_ONLY' && Number(approvalLimit) > 0);
}
