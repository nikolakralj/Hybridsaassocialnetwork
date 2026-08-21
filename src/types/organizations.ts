export type OrganizationRole =
  | 'org_admin'
  | 'org_finance'
  | 'org_manager'
  | 'org_approver'
  | 'org_worker'
  | 'org_viewer';

export type OrganizationMembershipState =
  | 'claimed'
  | 'invited'
  | 'verified'
  | 'rejected'
  | 'removed';

export type OrganizationProfileVisibility = 'public' | 'unlisted' | 'private';

export type ProjectOrganizationRole =
  | 'agency'
  | 'client'
  | 'company'
  | 'supplier'
  | 'subcontractor'
  | 'freelancer'
  | 'other';

export type ProjectOrganizationStatus = 'invited' | 'active' | 'declined' | 'removed';

export type ProjectRosterVisibility =
  | 'hidden'
  | 'contact'
  | 'worker'
  | 'approver'
  | 'finance'
  | 'anonymized';

export type ProjectRosterRole =
  | 'worker'
  | 'contact'
  | 'approver'
  | 'finance'
  | 'manager'
  | 'observer';

export type ProjectRosterAssignmentStatus = 'pending' | 'active' | 'paused' | 'removed';

export interface WorkGraphOrganization {
  id: string;
  name: string;
  slug?: string | null;
  profileVisibility: OrganizationProfileVisibility;
  ownerUserId?: string | null;
  createdBy: string;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkGraphOrganizationMember {
  id: string;
  organizationId: string;
  userId?: string | null;
  email?: string | null;
  displayName?: string | null;
  orgRole: OrganizationRole;
  membershipState: OrganizationMembershipState;
  defaultVisibility: Exclude<ProjectRosterVisibility, 'anonymized'>;
  claimedBy?: string | null;
  invitedBy?: string | null;
  verifiedBy?: string | null;
  invitedAt?: string | null;
  claimedAt?: string | null;
  verifiedAt?: string | null;
  removedAt?: string | null;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkGraphProjectOrganization {
  id: string;
  projectId: string;
  organizationId: string;
  graphNodeId?: string | null;
  partyRole: ProjectOrganizationRole;
  status: ProjectOrganizationStatus;
  invitedBy?: string | null;
  acceptedBy?: string | null;
  invitedAt?: string;
  acceptedAt?: string | null;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkGraphProjectRosterEntry {
  id: string;
  projectId: string;
  organizationId: string;
  organizationMemberId?: string | null;
  userId?: string | null;
  graphNodeId?: string | null;
  displayName?: string | null;
  visibilityMode: ProjectRosterVisibility;
  rosterRole: ProjectRosterRole;
  assignmentStatus: ProjectRosterAssignmentStatus;
  placementTitle?: string | null;
  payrollCadence?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  addedBy?: string | null;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export function isVerifiedOrganizationMember(member: Pick<WorkGraphOrganizationMember, 'membershipState'>): boolean {
  return member.membershipState === 'verified';
}

export function isVisibleProjectRosterEntry(entry: Pick<WorkGraphProjectRosterEntry, 'visibilityMode' | 'assignmentStatus'>): boolean {
  return entry.assignmentStatus !== 'removed' && entry.visibilityMode !== 'hidden';
}
