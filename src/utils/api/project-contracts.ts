// ============================================================================
// Mock data for demo (no database required)
// ============================================================================

import type { 
  ProjectContract, 
  ContractInvitation, 
  DisclosureRequest,
  GetProjectGraphResponse,
  GraphNode,
  GraphEdge,
} from '../types/project-contracts';

const MOCK_ORGANIZATIONS = [
  { id: 'acme-inc', name: 'Acme Inc', type: 'client' },
  { id: 'techcorp-agency', name: 'TechCorp Agency', type: 'agency' },
  { id: 'devshop-sub', name: 'DevShop Subcontractor', type: 'freelancer_virtual' },
];

const MOCK_PROJECTS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'E-Commerce Platform Redesign',
    description: 'Complete redesign of customer-facing platform',
  },
];

const MOCK_CONTRACTS: Partial<ProjectContract>[] = [
  {
    id: '22222222-2222-2222-2222-222222222222',
    project_id: '11111111-1111-1111-1111-111111111111',
    from_org_id: 'acme-inc',
    to_org_id: 'techcorp-agency',
    contract_type: 'tm',
    rate: 150.0,
    currency: 'USD',
    status: 'active',
    invited_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    project_id: '11111111-1111-1111-1111-111111111111',
    from_org_id: 'techcorp-agency',
    to_org_id: 'devshop-sub',
    contract_type: 'tm',
    rate: 85.0,
    currency: 'USD',
    status: 'active',
    invited_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const MOCK_INVITATIONS: Partial<ContractInvitation>[] = [
  {
    id: '44444444-4444-4444-4444-444444444444',
    project_id: '11111111-1111-1111-1111-111111111111',
    project_name: 'E-Commerce Platform Redesign',
    from_org_id: 'techcorp-agency',
    from_org_name: 'TechCorp Agency',
    to_org_id: 'devshop-sub',
    to_org_name: 'DevShop Subcontractor',
    contract_type: 'tm',
    rate: 85.0,
    currency: 'USD',
    status: 'pending',
    invited_at: new Date().toISOString(),
  },
];

const MOCK_DISCLOSURE_REQUESTS: DisclosureRequest[] = [];

// ============================================================================
// API Functions (using mock data)
// ============================================================================

export async function fetchProjectContracts(): Promise<ProjectContract[]> {
  console.log('[API] Fetching project contracts (mock data)');
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_CONTRACTS;
}

export async function fetchContractInvitations(): Promise<ContractInvitation[]> {
  console.log('[API] Fetching contract invitations (mock data)');
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_INVITATIONS;
}

export async function fetchDisclosureRequests(): Promise<DisclosureRequest[]> {
  console.log('[API] Fetching disclosure requests (mock data)');
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_DISCLOSURE_REQUESTS;
}

export async function fetchOrganizations() {
  console.log('[API] Fetching organizations (mock data)');
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_ORGANIZATIONS;
}

export async function fetchProjects() {
  console.log('[API] Fetching projects (mock data)');
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_PROJECTS;
}

// ============================================================================
// Additional functions required by hooks
// ============================================================================

export async function getProjectGraph(projectId: string, viewerOrgId: string): Promise<GetProjectGraphResponse> {
  console.log('[API] getProjectGraph (mock data)', { projectId, viewerOrgId });
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const nodes: GraphNode[] = MOCK_ORGANIZATIONS.map(org => ({
    id: org.id,
    type: 'party' as const,
    data: {
      name: org.name,
      orgType: org.type as any,
      isViewer: org.id === viewerOrgId,
    },
  }));

  const edges: GraphEdge[] = [
    {
      id: 'edge-1',
      from: 'acme-inc',
      to: 'techcorp-agency',
      type: 'contract' as const,
      data: {
        rate: 150,
        currency: 'USD',
        contract_type: 'tm',
        status: 'active',
      },
    },
    {
      id: 'edge-2',
      from: 'techcorp-agency',
      to: 'devshop-sub',
      type: 'contract' as const,
      data: {
        rate: 85,
        currency: 'USD',
        contract_type: 'tm',
        status: 'active',
      },
    },
  ];
  
  return {
    graph: { nodes, edges },
    my_contracts: MOCK_CONTRACTS.map((c, idx) => ({
      ...c,
      relationship: c.from_org_id === viewerOrgId ? 'selling' : 'buying',
      is_disclosed: false,
      worker_count: 0,
      from_org: MOCK_ORGANIZATIONS.find(o => o.id === c.from_org_id)!,
      to_org: MOCK_ORGANIZATIONS.find(o => o.id === c.to_org_id)!,
      counterparty_org: c.from_org_id === viewerOrgId 
        ? MOCK_ORGANIZATIONS.find(o => o.id === c.to_org_id)!
        : MOCK_ORGANIZATIONS.find(o => o.id === c.from_org_id)!,
    })) as any,
    my_workers: [],
  };
}

export async function getMyContracts(viewerOrgId: string) {
  console.log('[API] getMyContracts (mock data)', { viewerOrgId });
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_CONTRACTS;
}

export async function createProjectContract(data: any) {
  console.log('[API] createProjectContract (mock data)', data);
  await new Promise(resolve => setTimeout(resolve, 300));
  // In a real implementation, this would create a new contract
}

export async function acceptContractInvitation(contractId: string, userId: string) {
  console.log('[API] acceptContractInvitation (mock data)', { contractId, userId });
  await new Promise(resolve => setTimeout(resolve, 300));
  // In a real implementation, this would accept the invitation
}

export async function declineContractInvitation(contractId: string) {
  console.log('[API] declineContractInvitation (mock data)', { contractId });
  await new Promise(resolve => setTimeout(resolve, 300));
  // In a real implementation, this would decline the invitation
}

export async function getPendingInvitations(orgId: string) {
  console.log('[API] getPendingInvitations (mock data)', { orgId });
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_INVITATIONS;
}

export async function requestDisclosure(contractId: string, requestingOrgId: string, userId: string, notes?: string) {
  console.log('[API] requestDisclosure (mock data)', { contractId, requestingOrgId, userId, notes });
  await new Promise(resolve => setTimeout(resolve, 300));
  // In a real implementation, this would create a disclosure request
}

export async function approveDisclosure(contractId: string, disclosedToOrgId: string, userId: string) {
  console.log('[API] approveDisclosure (mock data)', { contractId, disclosedToOrgId, userId });
  await new Promise(resolve => setTimeout(resolve, 300));
  // In a real implementation, this would approve the disclosure
}

export async function declineDisclosure(contractId: string, reason?: string) {
  console.log('[API] declineDisclosure (mock data)', { contractId, reason });
  await new Promise(resolve => setTimeout(resolve, 300));
  // In a real implementation, this would decline the disclosure
}

export async function getPendingDisclosureRequests(orgId: string) {
  console.log('[API] getPendingDisclosureRequests (mock data)', { orgId });
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_DISCLOSURE_REQUESTS;
}