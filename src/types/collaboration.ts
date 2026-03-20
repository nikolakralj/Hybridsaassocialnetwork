// Phase 5 M5.1: Collaboration Types
// Types for multi-user project collaboration

/**
 * Project
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  region: 'US' | 'EU' | 'UK';
  currency: 'USD' | 'EUR' | 'GBP';
  startDate: string;
  endDate?: string;
  workWeek: WorkWeek;
  ownerId: string;
  status?: 'active' | 'archived' | 'draft';
  supplyChainStatus?: 'complete' | 'incomplete';
  createdAt: string;
  updatedAt: string;
}

export interface WorkWeek {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

/**
 * Project Member & Roles
 */
export type ProjectRole = 'Owner' | 'Editor' | 'Contributor' | 'Commenter' | 'Viewer';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role: ProjectRole;
  scope?: string; // For Contributor: which org they represent
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string;
  invitationId?: string;
}

/**
 * Permissions
 */
export type Permission =
  | 'create_party'
  | 'edit_party'
  | 'delete_party'
  | 'create_person'
  | 'edit_person'
  | 'create_contract'
  | 'edit_contract'
  | 'delete_contract'
  | 'create_compliance'
  | 'edit_compliance'
  | 'upload_compliance'
  | 'change_visibility'
  | 'add_comment'
  | 'resolve_comment'
  | 'publish'
  | 'manage_roles'
  | 'invite_members';

export const ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  Owner: ['*'] as any, // All permissions
  
  Editor: [
    'create_party', 'edit_party', 'delete_party',
    'create_person', 'edit_person',
    'create_contract', 'edit_contract', 'delete_contract',
    'create_compliance', 'edit_compliance', 'upload_compliance',
    'change_visibility', 'add_comment', 'resolve_comment',
    'invite_members'
  ],
  
  Contributor: [
    'edit_party', // Only their org (scope-limited)
    'create_person', 'edit_person', // Only from their org
    'create_contract', // If they're a signatory
    'create_compliance', // For their party
    'upload_compliance',
    'add_comment'
  ],
  
  Commenter: [
    'add_comment'
  ],
  
  Viewer: []
};

/**
 * Real-time Presence
 */
export interface Presence {
  userId: string;
  projectId: string;
  userName: string;
  userColor: string; // Hex color for cursor
  cursorX: number;
  cursorY: number;
  selectedNodeId?: string;
  lastSeen: number;
}

/**
 * Node Locking
 */
export interface NodeLock {
  nodeId: string;
  lockedBy: string;
  lockedByName: string;
  lockedAt: number;
  expiresAt: number; // Auto-release after timeout
}

/**
 * Comments
 */
export interface Comment {
  id: string;
  projectId: string;
  nodeId?: string; // Pinned to node
  edgeId?: string; // Pinned to edge
  x?: number; // Canvas position if not pinned
  y?: number;
  userId: string;
  userName?: string;
  text: string;
  mentions: string[]; // User IDs
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByName?: string;
}

export interface CommentThread {
  id: string;
  rootComment: Comment;
  replies: Comment[];
  nodeId?: string;
  edgeId?: string;
  isResolved: boolean;
}

/**
 * Activity
 */
export type ActivityAction =
  | 'project_created'
  | 'member_invited'
  | 'member_joined'
  | 'node_added'
  | 'node_edited'
  | 'node_deleted'
  | 'edge_added'
  | 'edge_edited'
  | 'edge_deleted'
  | 'comment_added'
  | 'comment_resolved'
  | 'policy_published';

export interface Activity {
  id: string;
  projectId: string;
  userId: string;
  userName?: string;
  action: ActivityAction;
  entityType?: 'Party' | 'Person' | 'Contract' | 'Compliance' | 'Edge' | 'Comment';
  entityId?: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

/**
 * Project Invitation
 */
export interface ProjectInvitation {
  id: string;
  projectId: string;
  projectName?: string;
  email: string;
  role: ProjectRole;
  scope?: string;
  invitedBy: string;
  invitedByName?: string;
  invitedAt: string;
  expiresAt?: string;
  acceptedAt?: string;
  token?: string; // For email link
  status?: 'pending' | 'accepted' | 'declined';
  declinedAt?: string;
  acceptedByUserId?: string;
}

/**
 * Publish Settings
 */
export interface PublishSettings {
  generateReadOnlyLink: boolean;
  notifyMembers: boolean;
  lockEditing: boolean; // Prevent further edits after publish
  requireApproval: boolean; // Require approvals before publish
}

/**
 * Share Link
 */
export interface ShareLink {
  id: string;
  projectId: string;
  token: string;
  role: 'Commenter' | 'Viewer';
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
  accessCount: number;
  lastAccessedAt?: string;
}

/**
 * Collaboration Stats
 */
export interface CollaborationStats {
  projectId: string;
  totalMembers: number;
  activeNow: number; // Currently editing
  totalComments: number;
  unresolvedComments: number;
  totalActivities: number;
  lastActivityAt?: string;
}

/**
 * Permission Check Context
 */
export interface PermissionContext {
  nodeId?: string;
  orgId?: string; // For scope checking
  contractId?: string;
  requiresSignatory?: boolean;
}
