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
