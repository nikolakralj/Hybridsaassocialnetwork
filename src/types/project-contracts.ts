// ============================================================================
// Local Scope Visibility - TypeScript Types
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  type: 'client' | 'agency' | 'vendor' | 'freelancer' | 'internal';
  logo?: string;
  email_domain?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  project_code?: string;
  description?: string;
  currency: string;
  start_date?: string;
  end_date?: string;
  created_by_org_id: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'archived' | 'cancelled';
}

export type ContractStatus = 'pending' | 'active' | 'terminated';
export type ContractType = 'tm' | 'fixed' | 'milestone' | 'capped_tm' | 'retainer';

export interface ProjectContract {
  id: string;
  project_id: string;
  
  // Parties
  from_org_id: string; // Vendor/Worker
  to_org_id: string;   // Client/Customer
  
  // Contract details
  contract_type: ContractType;
  rate?: number;
  currency: string;
  status: ContractStatus;
  
  // Invitation tracking
  invited_at: string;
  invited_by?: string;
  accepted_at?: string;
  accepted_by?: string;
  terminated_at?: string;
  terminated_by?: string;
  termination_reason?: string;
  
  // Disclosure (optional)
  disclosed_to_org_id?: string;
  disclosure_requested_at?: string;
  disclosure_requested_by?: string;
  disclosure_approved_at?: string;
  disclosure_approved_by?: string;
  disclosure_notes?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Enriched contract with org details
export interface ProjectContractWithOrgs extends ProjectContract {
  from_org: Organization;
  to_org: Organization;
  disclosed_to_org?: Organization;
}

// Viewer-specific contract metadata
export interface ViewerContract extends ProjectContractWithOrgs {
  // Relationship to viewer
  relationship: 'selling' | 'buying' | 'disclosed';
  
  // Is this visible via disclosure grant?
  is_disclosed: boolean;
  
  // Computed fields
  worker_count: number;
  counterparty_org: Organization; // The "other" org from viewer's perspective
}

export interface ProjectParticipant {
  project_id: string;
  org_id: string;
  role: 'creator' | 'client' | 'vendor' | 'subcontractor' | 'partner';
  joined_at: string;
  left_at?: string;
}

export interface ProjectRoleAssignment {
  id: string;
  project_id: string;
  org_id: string;
  user_id: string;
  role: 'contractor' | 'approver' | 'manager' | 'observer' | 'admin';
  contract_id?: string;
  valid_from?: string;
  valid_to?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Graph Types (for visualization)
// ============================================================================

export type GraphNodeType = 'party' | 'contract' | 'person';
export type GraphEdgeType = 'contract' | 'employs' | 'approves';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  data: {
    name: string;
    // Party-specific
    logo?: string;
    orgType?: Organization['type'];
    isViewer?: boolean;
    
    // Person-specific
    email?: string;
    role?: string;
    org_id?: string;
    
    // Contract-specific
    rate?: number;
    currency?: string;
    contract_type?: ContractType;
  };
  
  // React Flow position
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: GraphEdgeType;
  data: {
    // Contract edge
    rate?: number;
    currency?: string;
    contract_type?: ContractType;
    status?: ContractStatus;
    is_disclosed?: boolean;
    
    // Employs edge
    role?: string;
    
    // Approval edge
    order?: number;
    required?: boolean;
  };
}

export interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============================================================================
// Invitation Types
// ============================================================================

export interface ContractInvitation {
  id: string;
  project_id: string;
  project_name: string;
  
  from_org_id: string;
  from_org_name: string;
  from_org_logo?: string;
  
  to_org_id: string;
  to_org_name: string;
  
  contract_type: ContractType;
  rate?: number;
  currency: string;
  
  invited_at: string;
  invited_by?: string;
  invited_by_name?: string;
  
  status: 'pending' | 'accepted' | 'declined';
}

export interface DisclosureRequest {
  contract_id: string;
  project_id: string;
  project_name: string;
  
  // Who's requesting
  requesting_org_id: string;
  requesting_org_name: string;
  
  // Which relationship to disclose
  vendor_org_id: string;
  vendor_org_name: string;
  subcontractor_org_id: string;
  subcontractor_org_name: string;
  
  requested_at: string;
  requested_by: string;
  requested_by_name?: string;
  
  status: 'pending' | 'approved' | 'declined';
  notes?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateProjectContractRequest {
  project_id: string;
  from_org_id: string;
  to_org_id: string;
  contract_type: ContractType;
  rate?: number;
  currency?: string;
  
  // Optional: Send invitation email immediately
  send_invitation?: boolean;
}

export interface AcceptContractInvitationRequest {
  contract_id: string;
  accepted_by: string; // user_id
}

export interface RequestDisclosureRequest {
  contract_id: string; // The vendor→sub contract to disclose
  requesting_org_id: string;
  requesting_user_id: string;
  notes?: string;
}

export interface ApproveDisclosureRequest {
  contract_id: string;
  approved_by: string; // user_id of subcontractor admin
}

export interface GetProjectGraphRequest {
  project_id: string;
  viewer_org_id: string;
}

export interface GetProjectGraphResponse {
  graph: ProjectGraph;
  my_contracts: ViewerContract[];
  my_workers: ProjectRoleAssignment[];
}

// ============================================================================
// Context/State Types (for React hooks)
// ============================================================================

export interface ProjectContractContext {
  contracts: ViewerContract[];
  invitations: ContractInvitation[];
  disclosureRequests: DisclosureRequest[];
  
  // Actions
  createContract: (data: CreateProjectContractRequest) => Promise<ProjectContract>;
  acceptInvitation: (contractId: string) => Promise<void>;
  declineInvitation: (contractId: string) => Promise<void>;
  requestDisclosure: (data: RequestDisclosureRequest) => Promise<void>;
  approveDisclosure: (contractId: string) => Promise<void>;
  declineDisclosure: (contractId: string) => Promise<void>;
  
  // Loading states
  loading: boolean;
  error: Error | null;
}

// ============================================================================
// Utility Types
// ============================================================================

// Helper to compute margin for agencies
export interface ContractMargin {
  selling_rate: number;
  buying_rate: number;
  margin_amount: number;
  margin_percentage: number;
  currency: string;
}

// Worker assignment with approval context
export interface WorkerWithContext {
  user_id: string;
  name: string;
  email: string;
  role: string;
  org_id: string;
  org_name: string;
  
  // If worker is from a sub, show "via Agency"
  represented_by?: {
    org_id: string;
    org_name: string;
  };
  
  // Contract they're working under
  contract_id: string;
  contract_rate?: number; // May be hidden
}

// ============================================================================
// Validation Schemas (Zod-compatible)
// ============================================================================

export const contractTypeValues: readonly ContractType[] = ['tm', 'fixed', 'milestone', 'capped_tm', 'retainer'];
export const contractStatusValues: readonly ContractStatus[] = ['pending', 'active', 'terminated'];

export const isValidContractType = (type: string): type is ContractType => {
  return contractTypeValues.includes(type as ContractType);
};

export const isValidContractStatus = (status: string): status is ContractStatus => {
  return contractStatusValues.includes(status as ContractStatus);
};
