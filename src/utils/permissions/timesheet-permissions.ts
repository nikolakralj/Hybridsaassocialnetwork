/**
 * Timesheet Visibility & Permission Model
 * Implements the rules from TIMESHEET_VISIBILITY_AND_PERMISSIONS.md
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TimesheetStatus = 'draft' | 'submitted' | 'in_review' | 'rejected' | 'approved' | 'locked';
export type UserRole = 'contractor' | 'manager' | 'client' | 'finance' | 'admin';

export interface Timesheet {
  id: string;
  contractorId: string;
  contractId: string;
  projectId: string;
  status: TimesheetStatus;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  graphNodeId?: string;
}

export interface User {
  id: string;
  role: UserRole;
  companyId: string;
}

export interface Contract {
  id: string;
  projectId: string;
  userId: string;
  companyId: string;
  clientTimesheetVisibility: 'none' | 'after_approval' | 'after_submission' | 'real_time';
  allowManagerTimesheetEdits: boolean;
}

// ============================================================================
// PERMISSION RULES
// ============================================================================

/**
 * Can this user view this timesheet?
 */
export async function canViewTimesheet(
  timesheet: Timesheet,
  viewer: User
): Promise<boolean> {
  
  // Rule 1: Contractor can always view their own timesheets
  if (viewer.id === timesheet.contractorId) {
    return true;
  }
  
  // Rule 2: Draft timesheets are private to contractor only
  if (timesheet.status === 'draft') {
    return false;
  }
  
  // Rule 3: Manager can view submitted+ timesheets in their projects
  if (viewer.role === 'manager') {
    const isManagerForProject = await checkManagerForProject(viewer.id, timesheet.projectId);
    if (isManagerForProject && timesheet.status !== 'draft') {
      return true;
    }
  }
  
  // Rule 4: Client visibility depends on contract settings
  if (viewer.role === 'client') {
    const contract = await getContract(timesheet.contractId);
    if (!contract) return false;
    
    const visibility = contract.clientTimesheetVisibility;
    
    if (visibility === 'none') return false;
    
    if (visibility === 'after_approval') {
      return timesheet.status === 'approved' || timesheet.status === 'locked';
    }
    
    if (visibility === 'after_submission') {
      return ['submitted', 'in_review', 'approved', 'locked'].includes(timesheet.status);
    }
    
    if (visibility === 'real_time') {
      return true; // Client sees everything (rare!)
    }
  }
  
  // Rule 5: Finance can view submitted+ timesheets
  if (viewer.role === 'finance') {
    return timesheet.status !== 'draft';
  }
  
  // Rule 6: Admin can view everything
  if (viewer.role === 'admin') {
    return true;
  }
  
  return false;
}

/**
 * Can this user edit this timesheet?
 */
export async function canEditTimesheet(
  timesheet: Timesheet,
  editor: User
): Promise<boolean> {
  
  // Rule 1: Only contractor can edit draft or rejected timesheets
  if (editor.id === timesheet.contractorId) {
    return timesheet.status === 'draft' || timesheet.status === 'rejected';
  }
  
  // Rule 2: Manager conditional edit (if enabled in contract)
  if (editor.role === 'manager' && timesheet.status === 'submitted') {
    const contract = await getContract(timesheet.contractId);
    if (!contract) return false;
    
    // Check if manager edit is allowed for this contract
    if (contract.allowManagerTimesheetEdits) {
      const isManagerForProject = await checkManagerForProject(editor.id, timesheet.projectId);
      return isManagerForProject;
    }
  }
  
  // Rule 3: Nobody else can edit
  return false;
}

/**
 * Can this user submit this timesheet for approval?
 */
export async function canSubmitTimesheet(
  timesheet: Timesheet,
  submitter: User
): Promise<boolean> {
  
  // Only contractor can submit, and only if draft
  return submitter.id === timesheet.contractorId && timesheet.status === 'draft';
}

/**
 * Can this user approve/reject this timesheet?
 */
export async function canApproveTimesheet(
  timesheet: Timesheet,
  approver: User
): Promise<boolean> {
  
  // Only submitted or in_review timesheets can be approved
  if (!['submitted', 'in_review'].includes(timesheet.status)) {
    return false;
  }
  
  // Check if user is the current approver in the chain
  if (timesheet.graphNodeId) {
    const isCurrentApprover = await checkIsCurrentApprover(
      timesheet.graphNodeId,
      approver.id
    );
    return isCurrentApprover;
  }
  
  // Fallback: Check if user is manager for this project
  if (approver.role === 'manager') {
    return await checkManagerForProject(approver.id, timesheet.projectId);
  }
  
  return false;
}

/**
 * Can this user recall this timesheet (withdraw from approval)?
 */
export async function canRecallTimesheet(
  timesheet: Timesheet,
  user: User
): Promise<boolean> {
  
  // Only contractor can recall their own timesheet
  if (user.id !== timesheet.contractorId) {
    return false;
  }
  
  // Can only recall if submitted and not yet approved by anyone
  if (timesheet.status !== 'submitted') {
    return false;
  }
  
  // Check if anyone has approved yet (via graph)
  if (timesheet.graphNodeId) {
    const hasApprovals = await checkHasAnyApprovals(timesheet.graphNodeId);
    return !hasApprovals;
  }
  
  return true;
}

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

async function getContract(contractId: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('project_contracts')
    .select('*')
    .eq('id', contractId)
    .single();
  
  if (error || !data) return null;
  
  return {
    id: data.id,
    projectId: data.project_id,
    userId: data.user_id,
    companyId: data.company_id,
    clientTimesheetVisibility: data.client_timesheet_visibility || 'after_approval',
    allowManagerTimesheetEdits: data.allow_manager_timesheet_edits || false,
  };
}

async function checkManagerForProject(userId: string, projectId: string): Promise<boolean> {
  // Check if user is assigned as manager for this project
  const { data: project } = await supabase
    .from('projects')
    .select('manager_id, company_id')
    .eq('id', projectId)
    .single();
  
  if (!project) return false;
  
  // Direct assignment
  if (project.manager_id === userId) return true;
  
  // Check if user is a manager in the project's company
  const { data: user } = await supabase
    .from('users')
    .select('user_type, company_id')
    .eq('id', userId)
    .single();
  
  if (!user) return false;
  
  return user.user_type === 'manager' && user.company_id === project.company_id;
}

async function checkIsCurrentApprover(
  timesheetNodeId: string,
  userId: string
): Promise<boolean> {
  
  // Get timesheet node to find current step
  const { data: nodeData } = await supabase
    .from('kv_store_f8b491be')
    .select('value')
    .eq('key', `graph:node:${timesheetNodeId}`)
    .single();
  
  if (!nodeData) return false;
  
  const node = nodeData.value;
  const currentStep = node.properties.currentStep;
  
  // Find approval edge for this user at current step
  const { data: edgeData } = await supabase
    .from('kv_store_f8b491be')
    .select('value')
    .like('key', `graph:edge:${timesheetNodeId}:requires_approval:${userId}:step${currentStep}`)
    .single();
  
  if (!edgeData) return false;
  
  const edge = edgeData.value;
  return edge.metadata.status === 'pending';
}

async function checkHasAnyApprovals(timesheetNodeId: string): Promise<boolean> {
  
  // Find any approval edges that are already approved
  const { data: edges } = await supabase
    .from('kv_store_f8b491be')
    .select('value')
    .like('key', `graph:edge:${timesheetNodeId}:requires_approval:%`);
  
  if (!edges || edges.length === 0) return false;
  
  return edges.some((item: any) => item.value?.metadata?.status === 'approved');
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get permission summary for UI (what actions are available)
 */
export async function getTimesheetPermissions(
  timesheet: Timesheet,
  user: User
): Promise<{
  canView: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRecall: boolean;
  isViewOnly: boolean;
  message?: string;
}> {
  
  const canView = await canViewTimesheet(timesheet, user);
  const canEdit = await canEditTimesheet(timesheet, user);
  const canSubmit = await canSubmitTimesheet(timesheet, user);
  const canApprove = await canApproveTimesheet(timesheet, user);
  const canRecall = await canRecallTimesheet(timesheet, user);
  
  const isViewOnly = canView && !canEdit;
  
  let message: string | undefined;
  
  if (!canView) {
    message = "You don't have permission to view this timesheet.";
  } else if (isViewOnly) {
    if (user.id === timesheet.contractorId) {
      if (timesheet.status === 'submitted') {
        message = "This timesheet has been submitted and cannot be edited. If you need to make changes, please contact your manager.";
      } else if (timesheet.status === 'approved') {
        message = "This timesheet has been approved and is locked.";
      }
    } else {
      message = "You have view-only access to this timesheet.";
    }
  }
  
  return {
    canView,
    canEdit,
    canSubmit,
    canApprove,
    canReject: canApprove, // Same permission
    canRecall,
    isViewOnly,
    message,
  };
}

/**
 * Get status badge info for UI
 */
export function getStatusBadgeInfo(status: TimesheetStatus, viewerRole: UserRole) {
  const badges = {
    draft: {
      variant: 'secondary' as const,
      label: 'Draft',
      description: viewerRole === 'contractor' 
        ? 'Not visible to others' 
        : 'Work in progress',
    },
    submitted: {
      variant: 'outline' as const,
      label: 'Submitted',
      description: viewerRole === 'contractor'
        ? 'Awaiting approval - Locked'
        : 'Pending review',
    },
    in_review: {
      variant: 'warning' as const,
      label: 'In Review',
      description: 'Being reviewed by approvers',
    },
    rejected: {
      variant: 'destructive' as const,
      label: 'Rejected',
      description: 'Needs changes',
    },
    approved: {
      variant: 'success' as const,
      label: 'Approved',
      description: 'Ready for payment',
    },
    locked: {
      variant: 'default' as const,
      label: 'Locked',
      description: 'Invoiced - No changes allowed',
    },
  };
  
  return badges[status] || badges.draft;
}
