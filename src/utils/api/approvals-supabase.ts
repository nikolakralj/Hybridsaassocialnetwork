// Supabase-backed Approvals API
// Handles approval records and queue

import { createClient } from '../supabase/client';

const supabase = createClient();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APPROVAL_CREATE_IN_FLIGHT = new Map<string, Promise<ApprovalRecord>>();
const ROLE_PRIORITY: Record<string, number> = {
  Owner: 0,
  Editor: 1,
  Contributor: 2,
  Commenter: 3,
  Viewer: 4,
};

interface NameDirEntry {
  name?: string;
  type?: string;
  orgId?: string;
}

interface ApprovalDirPerson {
  id: string;
  name?: string;
  canApprove?: boolean;
}

interface ApprovalDirParty {
  id: string;
  name?: string;
  partyType?: string;
  people?: ApprovalDirPerson[];
}

interface WgProjectMember {
  id: string;
  user_id: string | null;
  user_name?: string | null;
  user_email?: string | null;
  role?: string | null;
  scope?: string | null;
  graph_node_id?: string | null;
}

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
  submitterUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalQueueItem extends ApprovalRecord {
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
  approverNodeId?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function isUuid(value?: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function normalizeMatchValue(value?: string | null): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function readSessionJson<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function readNameDir(projectId: string): Record<string, NameDirEntry> {
  if (!projectId) return {};
  return readSessionJson<Record<string, NameDirEntry>>(`workgraph-name-dir:${projectId}`) || {};
}

function readApprovalParties(projectId: string): ApprovalDirParty[] {
  if (!projectId) return [];
  const parsed = readSessionJson<{ parties?: ApprovalDirParty[] }>(`workgraph-approval-dir:${projectId}`);
  return Array.isArray(parsed?.parties) ? parsed.parties : [];
}

async function fetchProjectMembers(projectId: string): Promise<WgProjectMember[]> {
  const withGraphNode = await supabase
    .from('wg_project_members')
    .select('id, user_id, user_name, user_email, role, scope, graph_node_id')
    .eq('project_id', projectId);

  if (!withGraphNode.error) {
    return (withGraphNode.data || []) as WgProjectMember[];
  }

  if (!withGraphNode.error.message?.includes('graph_node_id')) {
    throw new Error(`Failed to load wg_project_members: ${withGraphNode.error.message}`);
  }

  const withoutGraphNode = await supabase
    .from('wg_project_members')
    .select('id, user_id, user_name, user_email, role, scope')
    .eq('project_id', projectId);

  if (withoutGraphNode.error) {
    throw new Error(`Failed to load wg_project_members: ${withoutGraphNode.error.message}`);
  }

  return (withoutGraphNode.data || []) as WgProjectMember[];
}

function getCandidateNodeIds(projectId: string, nodeId: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const push = (value?: string | null) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    ordered.push(value);
  };

  push(nodeId);

  const party = readApprovalParties(projectId).find((entry) => entry.id === nodeId);
  if (!party) return ordered;

  const people = [...(party.people || [])].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '') || a.id.localeCompare(b.id)
  );
  const approvers = people.filter((person) => person.canApprove);

  (approvers.length > 0 ? approvers : people).forEach((person) => push(person.id));
  return ordered;
}

function getApproverScopeNodeIds(projectId: string, viewerNodeId: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const push = (value?: string | null) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    ordered.push(value);
  };

  push(viewerNodeId);

  const parties = readApprovalParties(projectId);
  for (const party of parties) {
    if (party.id === viewerNodeId) {
      push(party.id);
      (party.people || []).forEach((person) => push(person.id));
      continue;
    }

    const viewerMembership = (party.people || []).find((person) => person.id === viewerNodeId);
    if (viewerMembership?.canApprove) {
      // Queue records are often stored against party-level approver nodes.
      // Include the party ID so person-viewers can see their party's queue.
      push(party.id);
    }
  }

  return ordered;
}

export async function resolveGraphNodeToUserId(
  projectId: string,
  nodeId?: string,
  fallbackUserId?: string
): Promise<string | undefined> {
  if (isUuid(nodeId)) return nodeId;
  if (!projectId || !nodeId) return fallbackUserId;

  // wg_project_members.project_id is UUID — skip DB lookup for non-UUID project IDs
  // (projects created locally before being persisted to DB use a text format ID)
  if (!isUuid(projectId)) return fallbackUserId;

  const members = (await fetchProjectMembers(projectId)).filter((member) => isUuid(member.user_id));
  if (members.length === 0) return fallbackUserId;

  const nameDir = readNameDir(projectId);
  const candidates = getCandidateNodeIds(projectId, nodeId)
    .map((candidateNodeId) => ({
      nodeId: candidateNodeId,
      normalizedName: normalizeMatchValue(nameDir[candidateNodeId]?.name || candidateNodeId),
      orgId: nameDir[candidateNodeId]?.orgId,
    }))
    .filter((candidate) => candidate.normalizedName.length > 0);

  const ranked = members
    .map((member) => {
      let score = 0;
      const memberName = normalizeMatchValue(member.user_name);
      const emailPrefix = normalizeMatchValue(member.user_email?.split('@')[0] || '');

      for (const candidate of candidates) {
        if (member.graph_node_id && member.graph_node_id === candidate.nodeId) {
          score = Math.max(score, 400);
        }

        if (memberName && memberName === candidate.normalizedName) {
          score = Math.max(score, 300);
        }

        if (emailPrefix && emailPrefix === candidate.normalizedName.replace(/\s+/g, '.')) {
          score = Math.max(score, 200);
        }

        if (candidate.orgId && member.scope && member.scope === candidate.orgId) {
          score += 10;
        }
      }

      if (score === 0) return null;

      return {
        member,
        score,
        rolePriority: ROLE_PRIORITY[member.role || 'Viewer'] ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((entry): entry is { member: WgProjectMember; score: number; rolePriority: number } => Boolean(entry))
    .sort((left, right) =>
      right.score - left.score ||
      left.rolePriority - right.rolePriority ||
      (left.member.user_name || '').localeCompare(right.member.user_name || '') ||
      (left.member.user_id || '').localeCompare(right.member.user_id || '')
    );

  if (ranked.length > 0) {
    return ranked[0].member.user_id || fallbackUserId;
  }

  return fallbackUserId;
}

function buildCreateApprovalKey(approval: Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt'>): string {
  return [
    approval.projectId,
    approval.subjectType,
    approval.subjectId,
    approval.approvalLayer,
    approval.approverNodeId || '',
  ].join('::');
}

async function findExistingPendingApproval(
  approval: Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ApprovalRecord | null> {
  let query = supabase
    .from('approval_records')
    .select('*')
    .eq('project_id', approval.projectId)
    .eq('subject_type', approval.subjectType)
    .eq('subject_id', approval.subjectId)
    .eq('approval_layer', approval.approvalLayer)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (approval.approverNodeId) {
    query = query.eq('approver_node_id', approval.approverNodeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing approval: ${error.message}`);
  }

  return data ? transformApproval(data) : null;
}

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

// ============================================================================
// APPROVAL OPERATIONS
// ============================================================================

export async function createApproval(
  approval: Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ApprovalRecord> {
  const createKey = buildCreateApprovalKey(approval);
  const existingPromise = APPROVAL_CREATE_IN_FLIGHT.get(createKey);
  if (existingPromise) return existingPromise;

  const createPromise = (async () => {
    try {
      const existing = await findExistingPendingApproval(approval);
      if (existing) return existing;

      const explicitApproverUuid = isUuid(approval.approverUserId) ? approval.approverUserId : undefined;
      const resolvedApproverUserId = await resolveGraphNodeToUserId(
        approval.projectId,
        approval.approverUserId || approval.approverNodeId,
        explicitApproverUuid
      );

      if (!resolvedApproverUserId) {
        // For local projects (non-UUID IDs), approver UUID cannot be looked up from DB.
        // Use the submitter's own UUID as a temporary placeholder so the record is created.
        // The approval will be queryable by approver_node_id (party ID) for the queue.
        const submitterUuid = isUuid(approval.submitterUserId) ? approval.submitterUserId : undefined;
        if (!submitterUuid) {
          throw new Error(
            `Unable to resolve approver UUID for project ${approval.projectId} and node ${approval.approverUserId || approval.approverNodeId || 'unknown'}`
          );
        }
        console.warn(
          `[Approvals] Could not resolve approver UUID for node ${approval.approverUserId || approval.approverNodeId}. ` +
          `Using submitter UUID as placeholder — project must be saved to DB for multi-user approval.`
        );
        // Use submitter UUID but keep approver_node_id pointing to the correct party
        const { data, error } = await supabase
          .from('approval_records')
          .insert([{
            project_id: approval.projectId,
            subject_type: approval.subjectType,
            subject_id: approval.subjectId,
            approver_user_id: submitterUuid,
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
        if (error) throw new Error(`Failed to create approval: ${error.message}`);
        return transformApproval(data);
      }

      const { data, error } = await supabase
        .from('approval_records')
        .insert([{
          project_id: approval.projectId,
          subject_type: approval.subjectType,
          subject_id: approval.subjectId,
          approver_user_id: resolvedApproverUserId,
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
    } finally {
      APPROVAL_CREATE_IN_FLIGHT.delete(createKey);
    }
  })();

  APPROVAL_CREATE_IN_FLIGHT.set(createKey, createPromise);
  return createPromise;
}

export async function deleteApproval(approvalId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('approval_records')
      .delete()
      .eq('id', approvalId);

    if (error) {
      console.error('Error deleting approval:', error);
      throw new Error(`Failed to delete approval: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deleteApproval:', error);
    throw error;
  }
}

export async function getApprovalQueue(
  filters: ApprovalQueueFilters = {}
): Promise<ApprovalQueueItem[]> {
  try {
    let query = supabase
      .from('approval_records')
      .select('*');

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.subjectType && filters.subjectType !== 'all') {
      query = query.eq('subject_type', filters.subjectType);
    }

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    if (filters.approverNodeId) {
      let resolvedApproverUserId: string | undefined;
      let approverNodeCandidates: string[] = [filters.approverNodeId];

      try {
        if (filters.projectId) {
          resolvedApproverUserId = await resolveGraphNodeToUserId(filters.projectId, filters.approverNodeId);
          approverNodeCandidates = getApproverScopeNodeIds(filters.projectId, filters.approverNodeId);
        }
      } catch (error) {
        console.warn('[approvals] Failed to resolve approver node for queue filter', error);
      }

      const conditions = approverNodeCandidates.map((candidate) => `approver_node_id.eq.${candidate}`);
      if (resolvedApproverUserId) {
        conditions.push(`approver_user_id.eq.${resolvedApproverUserId}`);
      }

      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      } else {
        query = query.eq('approver_node_id', filters.approverNodeId);
      }
    } else if (filters.approverUserId) {
      query = query.eq('approver_user_id', filters.approverUserId);
    }

    query = query.order('submitted_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching approval queue:', error);
      throw new Error(`Failed to fetch approval queue: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    const projectIds = [...new Set(data.map((entry) => entry.project_id))].filter(Boolean);
    const validUuidProjectIds = projectIds.filter((id) => isUuid(id));
    let projectMap = new Map<string, string>();

    if (validUuidProjectIds.length > 0) {
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', validUuidProjectIds);
      projectMap = new Map(projectsData?.map((project) => [project.id, project.name]) || []);
    }

    projectIds.filter((id) => !isUuid(id)).forEach((id) => {
      projectMap.set(id, id);
    });

    const timesheetIds = data
      .filter((entry) => entry.subject_type === 'timesheet')
      .map((entry) => entry.subject_id)
      .filter(Boolean);
    const validUuidTimesheetIds = timesheetIds.filter((id) => isUuid(id));
    let timesheetMap = new Map<string, any>();

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
      timesheetMap = new Map(timesheetData?.map((timesheet: any) => [timesheet.id, timesheet]) || []);
    }

    return data.map((dbItem: any) => {
      const approval = transformApproval(dbItem);
      approval.projectName = projectMap.get(dbItem.project_id) || 'Unknown Project';

      if (dbItem.subject_type === 'timesheet') {
        const ts = timesheetMap.get(dbItem.subject_id);
        if (ts) {
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

export async function getLatestPendingApproval(
  subjectType: ApprovalRecord['subjectType'],
  subjectId: string
): Promise<ApprovalRecord | null> {
  try {
    const { data, error } = await supabase
      .from('approval_records')
      .select('*')
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .eq('status', 'pending')
      .order('approval_layer', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch pending approval: ${error.message}`);
    }

    return data ? transformApproval(data) : null;
  } catch (error) {
    console.error('Error in getLatestPendingApproval:', error);
    throw error;
  }
}

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

    return transformApproval(result);
  } catch (error) {
    console.error('Error in approveItem:', error);
    throw error;
  }
}

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
