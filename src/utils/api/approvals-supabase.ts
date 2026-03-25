// Supabase-backed Approvals API
// Handles approval records and queue

import { createClient } from '../supabase/client';

const supabase = createClient();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ApprovalRecord {
  id: string;
  projectId: string;
  projectName?: string;
  subjectType: 'timesheet' | 'expense' | 'invoice' | 'contract' | 'deliverable';
  subjectId: string;
  approverUserId: string;
  approverName: string;
  approverNodeId?: string;
  approvalLayer: number;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  notes?: string;
  submittedAt?: string;
  decidedAt?: string;
  graphVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalQueueItem extends ApprovalRecord {
  // Additional fields from joined data
  timesheetData?: {
    weekStart: string;
    weekEnd: string;
    totalHours: number;
    contractorName: string;
    hourlyRate?: number;
  };
}

export interface ApprovalQueueFilters {
  status?: 'all' | 'pending' | 'approved' | 'rejected';
  subjectType?: 'all' | 'timesheet' | 'expense' | 'invoice' | 'contract';
  projectId?: string;
  approverUserId?: string;
  approverNodeId?: string; // Graph node ID (e.g. "org-nas") — used when UUID mapping is unavailable
}

// ============================================================================
// APPROVAL OPERATIONS
// ============================================================================

/**
 * Create a new approval record (when timesheet is submitted)
 */
export async function createApproval(
  approval: Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ApprovalRecord> {
  try {
    const { data, error } = await supabase
      .from('approval_records')
      .insert([{
        project_id: approval.projectId,
        subject_type: approval.subjectType,
        subject_id: approval.subjectId,
        approver_user_id: approval.approverUserId,
        approver_name: approval.approverName,
        approver_node_id: approval.approverNodeId,
        approval_layer: approval.approvalLayer,
        status: approval.status || 'pending',
        notes: approval.notes,
        submitted_at: approval.submittedAt || new Date().toISOString(),
        graph_version_id: approval.graphVersionId,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating approval:', error);
      throw new Error(`Failed to create approval: ${error.message}`);
    }

    return transformApproval(data);
  } catch (error) {
    console.error('Error in createApproval:', error);
    throw error;
  }
}

/**
 * Get approval queue for a user
 */
export async function getApprovalQueue(
  filters: ApprovalQueueFilters = {}
): Promise<ApprovalQueueItem[]> {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Always query approval_records directly to avoid view schema cache issues
    let query = supabase
      .from('approval_records')
      .select('*');

    // Apply status filter — only restrict when a specific status is requested.
    // 'all' or undefined = no filter (show everything for the approver).
    // Default behaviour changed: callers must explicitly pass 'pending' to restrict.
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.subjectType && filters.subjectType !== 'all') {
      query = query.eq('subject_type', filters.subjectType);
    }

    // Only filter by project_id when it's a valid UUID — seed IDs like
    // "proj-alpha" would cause a Postgres 22P02 parse error on UUID columns.
    if (filters.projectId && uuidRegex.test(filters.projectId)) {
      query = query.eq('project_id', filters.projectId);
    }

    // approver_node_id filter: supports graph-node-based approval routing.
    // When John views as org-nas, we match approval records that target that node.
    if (filters.approverNodeId) {
      query = query.eq('approver_node_id', filters.approverNodeId);
    } else if (filters.approverUserId) {
      query = query.eq('approver_user_id', filters.approverUserId);
    }

    // Order by submission date (newest first)
    query = query.order('submitted_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching approval queue:', error);
      throw new Error(`Failed to fetch approval queue: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    // Manually fetch related data since we're bypassing the view
    // Filter out non-UUID project IDs to avoid Postgres UUID parse errors
    const projectIds = [...new Set(data.map(d => d.project_id))].filter(Boolean);
    const validUuidProjectIds = projectIds.filter(id => uuidRegex.test(id));
    let projectMap = new Map<string, string>();
    if (validUuidProjectIds.length > 0) {
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', validUuidProjectIds);
      projectMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);
    }
    // Also map non-UUID project IDs using their raw ID as a display name
    projectIds.filter(id => !uuidRegex.test(id)).forEach(id => {
      projectMap.set(id, id);
    });

    const timesheetIds = data.filter(d => d.subject_type === 'timesheet').map(d => d.subject_id).filter(Boolean);
    const validUuidTimesheetIds = timesheetIds.filter(id => uuidRegex.test(id));
    let timesheetMap = new Map();
    if (validUuidTimesheetIds.length > 0) {
      const { data: timesheetData } = await supabase
        .from('timesheet_periods')
        .select(`
          id,
          week_start_date,
          week_end_date,
          total_hours,
          project_contracts (
            user_name,
            hourly_rate
          )
        `)
        .in('id', validUuidTimesheetIds);
      timesheetMap = new Map(timesheetData?.map((t: any) => [t.id, t]) || []);
    }

    return data.map((dbItem: any) => {
      const approval = transformApproval(dbItem);
      approval.projectName = projectMap.get(dbItem.project_id) || 'Unknown Project';

      if (dbItem.subject_type === 'timesheet') {
        const ts = timesheetMap.get(dbItem.subject_id);
        if (ts) {
          // Handle arrays from Supabase relationship depending on exactly how it returns
          const contract = Array.isArray(ts.project_contracts) ? ts.project_contracts[0] : ts.project_contracts;
          (approval as ApprovalQueueItem).timesheetData = {
            weekStart: ts.week_start_date,
            weekEnd: ts.week_end_date,
            totalHours: parseFloat(ts.total_hours || '0'),
            contractorName: contract?.user_name || 'Unknown Contractor',
            hourlyRate: contract?.hourly_rate ? parseFloat(contract.hourly_rate) : undefined,
          };
        }
      }

      return approval as ApprovalQueueItem;
    });
  } catch (error) {
    console.error('Error in getApprovalQueue:', error);
    throw error;
  }
}

/**
 * Approve an item
 */
export async function approveItem(
  approvalId: string,
  data?: { approvedBy?: string; notes?: string }
): Promise<ApprovalRecord> {
  try {
    const { data: result, error } = await supabase
      .from('approval_records')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        notes: data?.notes || null,
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (error) {
      console.error('Error approving item:', error);
      throw new Error(`Failed to approve item: ${error.message}`);
    }

    // TODO: Trigger next approval layer or mark as complete

    return transformApproval(result);
  } catch (error) {
    console.error('Error in approveItem:', error);
    throw error;
  }
}

/**
 * Reject an item
 */
export async function rejectItem(
  approvalId: string,
  data?: { rejectedBy?: string; reason?: string }
): Promise<ApprovalRecord> {
  try {
    const { data: result, error } = await supabase
      .from('approval_records')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
        notes: data?.reason || null,
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting item:', error);
      throw new Error(`Failed to reject item: ${error.message}`);
    }

    return transformApproval(result);
  } catch (error) {
    console.error('Error in rejectItem:', error);
    throw error;
  }
}

/**
 * Request changes for an item
 */
export async function requestChanges(
  approvalId: string,
  notes: string
): Promise<ApprovalRecord> {
  try {
    const { data, error } = await supabase
      .from('approval_records')
      .update({
        status: 'changes_requested',
        decided_at: new Date().toISOString(),
        notes,
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (error) {
      console.error('Error requesting changes:', error);
      throw new Error(`Failed to request changes: ${error.message}`);
    }

    return transformApproval(data);
  } catch (error) {
    console.error('Error in requestChanges:', error);
    throw error;
  }
}

/**
 * Bulk approve multiple items
 */
export async function bulkApprove(data: {
  approvedBy?: string;
  itemIds: string[];
  notes?: string;
}): Promise<ApprovalRecord[]> {
  try {
    const { data: result, error } = await supabase
      .from('approval_records')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        notes: data.notes || null,
      })
      .in('id', data.itemIds)
      .select();

    if (error) {
      console.error('Error bulk approving:', error);
      throw new Error(`Failed to bulk approve: ${error.message}`);
    }

    return (result || []).map(transformApproval);
  } catch (error) {
    console.error('Error in bulkApprove:', error);
    throw error;
  }
}

/**
 * Bulk reject multiple items
 */
export async function bulkReject(
  approvalIds: string[],
  notes?: string
): Promise<ApprovalRecord[]> {
  try {
    const { data, error } = await supabase
      .from('approval_records')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
        notes: notes || null,
      })
      .in('id', approvalIds)
      .select();

    if (error) {
      console.error('Error bulk rejecting:', error);
      throw new Error(`Failed to bulk reject: ${error.message}`);
    }

    return (data || []).map(transformApproval);
  } catch (error) {
    console.error('Error in bulkReject:', error);
    throw error;
  }
}

/**
 * Get approval history for a subject (e.g., a timesheet)
 */
export async function getApprovalHistory(
  subjectType: string,
  subjectId: string
): Promise<ApprovalRecord[]> {
  try {
    const { data, error } = await supabase
      .from('approval_records')
      .select('*')
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .order('approval_layer', { ascending: true });

    if (error) {
      console.error('Error fetching approval history:', error);
      throw new Error(`Failed to fetch approval history: ${error.message}`);
    }

    return (data || []).map(transformApproval);
  } catch (error) {
    console.error('Error in getApprovalHistory:', error);
    throw error;
  }
}

/**
 * Get pending approvals count for a user
 */
export async function getPendingCount(approverUserId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('approval_records')
      .select('*', { count: 'exact', head: true })
      .eq('approver_user_id', approverUserId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching pending count:', error);
      throw new Error(`Failed to fetch pending count: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getPendingCount:', error);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function transformApproval(dbApproval: any): ApprovalRecord {
  return {
    id: dbApproval.id,
    projectId: dbApproval.project_id,
    subjectType: dbApproval.subject_type,
    subjectId: dbApproval.subject_id,
    approverUserId: dbApproval.approver_user_id,
    approverName: dbApproval.approver_name,
    approverNodeId: dbApproval.approver_node_id,
    approvalLayer: dbApproval.approval_layer,
    status: dbApproval.status,
    notes: dbApproval.notes,
    submittedAt: dbApproval.submitted_at,
    decidedAt: dbApproval.decided_at,
    graphVersionId: dbApproval.graph_version_id,
    createdAt: dbApproval.created_at,
    updatedAt: dbApproval.updated_at,
  };
}