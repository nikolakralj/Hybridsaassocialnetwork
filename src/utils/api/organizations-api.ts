import { createClient } from '../supabase/client';

const supabase = createClient();

export interface AssignProjectWorkerInput {
  projectId: string;
  memberId: string;
  organizationName: string;
  displayName?: string;
  placementTitle?: string;
}

export interface ProjectWorkerAssignmentResult {
  projectId: string;
  memberId: string;
  userId: string;
  organizationId: string;
  organizationMemberId: string;
  rosterId: string;
  graphNodeId: string;
  partyGraphNodeId: string;
  organizationName: string;
  displayName: string;
  placementTitle: string;
}

export async function assignProjectMemberAsWorker(
  input: AssignProjectWorkerInput,
): Promise<ProjectWorkerAssignmentResult> {
  const { data, error } = await supabase.rpc('wg_assign_project_member_as_worker', {
    p_project_id: input.projectId,
    p_member_id: input.memberId,
    p_organization_name: input.organizationName.trim(),
    p_display_name: input.displayName?.trim() || null,
    p_placement_title: input.placementTitle?.trim() || null,
  });

  if (error) {
    if (error.code === '42501') {
      throw new Error('Only the project owner can set up employees.');
    }
    if (error.code === '23505') {
      throw new Error('This member already has a project identity.');
    }
    throw new Error(error.message || 'Could not set up this employee.');
  }

  return data as ProjectWorkerAssignmentResult;
}

export interface AssignPartyApproverInput {
  projectId: string;
  partyGraphNodeId: string;
  email: string;
  displayName?: string;
  canViewRates?: boolean;
}

export interface PartyApproverResult {
  nodeId: string;
  partyGraphNodeId: string;
  name: string;
  email: string;
}

/**
 * Add an approver to a party (e.g. give the agency G2 another approving agent).
 * Server-authorized to the project owner or a verified admin/manager of that
 * party's organization (migration 027).
 */
export async function assignPartyApprover(
  input: AssignPartyApproverInput,
): Promise<PartyApproverResult> {
  const { data, error } = await supabase.rpc('wg_assign_party_approver', {
    p_project_id: input.projectId,
    p_party_graph_node_id: input.partyGraphNodeId,
    p_email: input.email.trim(),
    p_display_name: input.displayName?.trim() || null,
    p_can_view_rates: input.canViewRates ?? false,
  });

  if (error) {
    if (error.code === '42501') {
      throw new Error('Only the project owner or a verified admin of this organization can add its approvers.');
    }
    if (error.code === '23505') {
      throw new Error('Someone with that email is already on this organization.');
    }
    if (error.code === '22023') {
      throw new Error(error.message || 'A valid email is required.');
    }
    throw new Error(error.message || 'Could not add the approver.');
  }

  return data as PartyApproverResult;
}
