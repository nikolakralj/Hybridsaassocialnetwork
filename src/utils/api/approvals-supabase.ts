// Supabase-backed Approvals API
// Handles approval records and queue

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    let query = supabase
      .from('approval_queue')
      .select('*');

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.subjectType && filters.subjectType !== 'all') {
      query = query.eq('subject_type', filters.subjectType);
    }

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    if (filters.approverUserId) {
      query = query.eq('approver_user_id', filters.approverUserId);
    }

    // Order by submission date (newest first)
    query = query.order('submitted_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching approval queue:', error);
      throw new Error(`Failed to fetch approval queue: ${error.message}`);
    }

    return (data || []).map(transformQueueItem);
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
  notes?: string
): Promise<ApprovalRecord> {
  try {
    const { data, error } = await supabase
      .from('approval_records')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (error) {
      console.error('Error approving item:', error);
      throw new Error(`Failed to approve item: ${error.message}`);
    }

    // TODO: Trigger next approval layer or mark as complete

    return transformApproval(data);
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
  notes?: string
): Promise<ApprovalRecord> {
  try {
    const { data, error } = await supabase
      .from('approval_records')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting item:', error);
      throw new Error(`Failed to reject item: ${error.message}`);
    }

    return transformApproval(data);
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
export async function bulkApprove(
  approvalIds: string[],
  notes?: string
): Promise<ApprovalRecord[]> {
  try {
    const { data, error } = await supabase
      .from('approval_records')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        notes: notes || null,
      })
      .in('id', approvalIds)
      .select();

    if (error) {
      console.error('Error bulk approving:', error);
      throw new Error(`Failed to bulk approve: ${error.message}`);
    }

    return (data || []).map(transformApproval);
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

function transformQueueItem(dbItem: any): ApprovalQueueItem {
  const approval = transformApproval(dbItem);
  
  // Add project name
  approval.projectName = dbItem.project_name;
  
  // Add timesheet data if available
  if (dbItem.timesheet_data) {
    const ts = dbItem.timesheet_data;
    (approval as ApprovalQueueItem).timesheetData = {
      weekStart: ts.week_start,
      weekEnd: ts.week_end,
      totalHours: parseFloat(ts.total_hours),
      contractorName: ts.contractor_name,
      hourlyRate: ts.hourly_rate ? parseFloat(ts.hourly_rate) : undefined,
    };
  }
  
  return approval as ApprovalQueueItem;
}
