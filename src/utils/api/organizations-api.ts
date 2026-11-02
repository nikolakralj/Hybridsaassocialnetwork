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

export interface OrganizationBillingProfile {
  organizationId: string;
  organizationName: string;
  legalName: string;
  address: string;
  taxId: string;
  iban: string;
  updatedAt: string | null;
}

/** Organizations the signed-in user may keep invoice details for (owner, org admin or org approver). */
export async function listMyBillingOrganizations(): Promise<OrganizationBillingProfile[]> {
  const { data, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: { message?: string } | null }>)
    .call(supabase, 'wg_list_my_billing_organizations');
  if (error) throw new Error(error.message || 'Could not load company billing details.');
  return ((data as Array<Record<string, string | null>>) || []).map((row) => ({
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name || ''),
    legalName: row.legal_name || '',
    address: row.address || '',
    taxId: row.tax_id || '',
    iban: row.iban || '',
    updatedAt: row.updated_at || null,
  }));
}

export async function saveOrganizationBillingProfile(
  profile: Pick<OrganizationBillingProfile, 'organizationId' | 'legalName' | 'address' | 'taxId' | 'iban'>,
): Promise<void> {
  const clean = (value: string) => value.trim() || null;
  const { error } = await (supabase.from as unknown as (table: string) => {
    upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message?: string; code?: string } | null }>;
  })('wg_organization_billing_profiles').upsert(
    {
      organization_id: profile.organizationId,
      legal_name: clean(profile.legalName),
      address: clean(profile.address),
      tax_id: clean(profile.taxId),
      iban: clean(profile.iban.replace(/\s+/g, ' ')),
    },
    { onConflict: 'organization_id' },
  );
  if (error) {
    if (error.code === '42501') throw new Error('Only your company\'s owner, admin or approver can change its billing details.');
    throw new Error(error.message || 'Could not save company billing details.');
  }
}
