// Phase 5 M5.1: Permission System
// Role-based access control for project collaboration

import { ProjectRole, Permission, ROLE_PERMISSIONS, PermissionContext } from '../../types/collaboration';

/**
 * Check if a user has a specific permission in a project
 * 
 * @param userRole - User's role in the project
 * @param permission - Permission to check
 * @param context - Additional context (nodeId, orgId for scope checks)
 * @returns true if user has permission
 */
export function canUserPerform(
  userRole: ProjectRole | null | undefined,
  permission: Permission,
  context?: PermissionContext
): boolean {
  // No role = no access
  if (!userRole) return false;
  
  // Owner can do everything
  if (userRole === 'Owner') return true;
  
  // Check role permissions
  const allowedPermissions = ROLE_PERMISSIONS[userRole];
  
  // Handle wildcard for Owner (already checked above, but be safe)
  if (allowedPermissions.includes('*' as any)) return true;
  
  // Check if permission is in allowed list
  if (!allowedPermissions.includes(permission)) return false;
  
  // Additional scope checks for Contributor role
  if (userRole === 'Contributor' && context) {
    return checkContributorScope(permission, context);
  }
  
  return true;
}

/**
 * Contributor role has limited scope - can only edit their own org's nodes
 */
function checkContributorScope(
  permission: Permission,
  context: PermissionContext
): boolean {
  // For now, simple check: if they're editing a party/person,
  // they should only edit nodes from their org
  // This will be enforced more strictly when we add scope to project_members
  
  // Permissions that require scope check
  const scopedPermissions: Permission[] = [
    'edit_party',
    'edit_person',
    'create_contract', // Only if they're a signatory
  ];
  
  if (scopedPermissions.includes(permission)) {
    // TODO: Implement actual scope checking against context.orgId
    // For minimal M5.1, we allow it (will add scope enforcement in M5.1.1)
    return true;
  }
  
  return true;
}

/**
 * Check multiple permissions at once
 */
export function canUserPerformAny(
  userRole: ProjectRole | null | undefined,
  permissions: Permission[],
  context?: PermissionContext
): boolean {
  return permissions.some(p => canUserPerform(userRole, p, context));
}

/**
 * Check if user has all permissions
 */
export function canUserPerformAll(
  userRole: ProjectRole | null | undefined,
  permissions: Permission[],
  context?: PermissionContext
): boolean {
  return permissions.every(p => canUserPerform(userRole, p, context));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: ProjectRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if a role can perform an action
 * (Static check without user context)
 */
export function roleCanPerform(
  role: ProjectRole,
  permission: Permission
): boolean {
  if (role === 'Owner') return true;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Get the highest role from a list of roles
 */
export function getHighestRole(roles: ProjectRole[]): ProjectRole | null {
  const roleHierarchy: ProjectRole[] = ['Owner', 'Editor', 'Contributor', 'Commenter', 'Viewer'];
  
  for (const role of roleHierarchy) {
    if (roles.includes(role)) return role;
  }
  
  return null;
}

/**
 * Check if roleA is more powerful than roleB
 */
export function isRoleHigher(roleA: ProjectRole, roleB: ProjectRole): boolean {
  const hierarchy: ProjectRole[] = ['Owner', 'Editor', 'Contributor', 'Commenter', 'Viewer'];
  return hierarchy.indexOf(roleA) < hierarchy.indexOf(roleB);
}

/**
 * Get a human-readable description of a role
 */
export function getRoleDescription(role: ProjectRole): string {
  const descriptions: Record<ProjectRole, string> = {
    Owner: 'Full control over project, can publish and manage members',
    Editor: 'Can edit all nodes, contracts, and compliance items',
    Contributor: 'Can edit their organization\'s nodes and add comments',
    Commenter: 'Can add comments and participate in discussions',
    Viewer: 'Read-only access to the project',
  };
  
  return descriptions[role];
}

/**
 * Get icon name for a role (for UI display)
 */
export function getRoleIcon(role: ProjectRole): string {
  const icons: Record<ProjectRole, string> = {
    Owner: 'Crown',
    Editor: 'Edit',
    Contributor: 'Users',
    Commenter: 'MessageSquare',
    Viewer: 'Eye',
  };
  
  return icons[role];
}

/**
 * Get color for a role (for badges)
 */
export function getRoleColor(role: ProjectRole): string {
  const colors: Record<ProjectRole, string> = {
    Owner: 'bg-purple-100 text-purple-800',
    Editor: 'bg-blue-100 text-blue-800',
    Contributor: 'bg-green-100 text-green-800',
    Commenter: 'bg-yellow-100 text-yellow-800',
    Viewer: 'bg-gray-100 text-gray-800',
  };
  
  return colors[role];
}

const DEFAULT_INVITABLE_ROLES: ProjectRole[] = ['Editor', 'Contributor', 'Commenter', 'Viewer'];

/**
 * Validate if a role can invite another role.
 * Owners can grant admin/editor access; Editors can only add lower-trust roles.
 * Owner transfer should be a separate explicit flow, not a normal invitation.
 */
export function canRoleInviteRole(
  inviterRole: ProjectRole | null | undefined,
  inviteeRole: ProjectRole
): boolean {
  if (inviterRole === 'Owner') return inviteeRole !== 'Owner';
  if (inviterRole === 'Editor') {
    return ['Contributor', 'Commenter', 'Viewer'].includes(inviteeRole);
  }
  return false;
}

export function getInvitableRolesForRole(inviterRole: ProjectRole | null | undefined): ProjectRole[] {
  return DEFAULT_INVITABLE_ROLES.filter((role) => canRoleInviteRole(inviterRole, role));
}

/**
 * Permission checks for common UI scenarios
 */
export const UIPermissions = {
  canEditNodes: (role: ProjectRole | null) => 
    canUserPerform(role, 'edit_party'),
  
  canCreateContracts: (role: ProjectRole | null) => 
    canUserPerform(role, 'create_contract'),
  
  canPublish: (role: ProjectRole | null) => 
    canUserPerform(role, 'publish'),
  
  canManageRoles: (role: ProjectRole | null) => 
    canUserPerform(role, 'manage_roles'),
  
  canInviteMembers: (role: ProjectRole | null) => 
    canUserPerform(role, 'invite_members'),
  
  canComment: (role: ProjectRole | null) => 
    canUserPerform(role, 'add_comment'),
  
  canChangeVisibility: (role: ProjectRole | null) => 
    canUserPerform(role, 'change_visibility'),
};

/**
 * Permission error messages
 */
export function getPermissionDeniedMessage(permission: Permission): string {
  const messages: Partial<Record<Permission, string>> = {
    publish: 'Only project owners can publish policies',
    manage_roles: 'Only project owners can manage member roles',
    invite_members: 'You don\'t have permission to invite members',
    create_party: 'You don\'t have permission to add parties',
    edit_party: 'You don\'t have permission to edit this party',
    create_contract: 'You don\'t have permission to create contracts',
    change_visibility: 'You don\'t have permission to change visibility settings',
  };
  
  return messages[permission] || 'You don\'t have permission to perform this action';
}

/**
 * React hook-friendly permission checker
 */
export function createPermissionChecker(userRole: ProjectRole | null) {
  return {
    can: (permission: Permission, context?: PermissionContext) => 
      canUserPerform(userRole, permission, context),
    
    canAny: (permissions: Permission[], context?: PermissionContext) => 
      canUserPerformAny(userRole, permissions, context),
    
    canAll: (permissions: Permission[], context?: PermissionContext) => 
      canUserPerformAll(userRole, permissions, context),
    
    is: (role: ProjectRole) => userRole === role,
    
    isAtLeast: (role: ProjectRole) => 
      userRole ? isRoleHigher(userRole, role) || userRole === role : false,
  };
}
