// ============================================================================
// useProjectContracts Hook - Local Scope Visibility
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  getProjectGraph,
  getMyContracts,
  createProjectContract,
  acceptContractInvitation,
  declineContractInvitation,
  getPendingInvitations,
  requestDisclosure,
  approveDisclosure,
  declineDisclosure,
  getPendingDisclosureRequests,
} from '../utils/api/project-contracts';
import type {
  ViewerContract,
  ProjectGraph,
  ContractInvitation,
  DisclosureRequest,
  CreateProjectContractRequest,
  GetProjectGraphResponse,
  ProjectRoleAssignment,
} from '../types/project-contracts';

interface UseProjectContractsOptions {
  projectId: string;
  viewerOrgId: string;
  autoFetch?: boolean;
}

interface UseProjectContractsReturn {
  // Data
  graph: ProjectGraph | null;
  contracts: ViewerContract[];
  workers: ProjectRoleAssignment[];
  invitations: ContractInvitation[];
  disclosureRequests: DisclosureRequest[];
  
  // Actions
  createContract: (data: CreateProjectContractRequest) => Promise<void>;
  acceptInvitation: (contractId: string) => Promise<void>;
  declineInvitation: (contractId: string) => Promise<void>;
  requestContractDisclosure: (contractId: string, notes?: string) => Promise<void>;
  approveContractDisclosure: (contractId: string, disclosedToOrgId: string) => Promise<void>;
  declineContractDisclosure: (contractId: string, reason?: string) => Promise<void>;
  
  // Utilities
  refresh: () => Promise<void>;
  
  // States
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to manage project contracts with local scope visibility
 * 
 * Usage:
 * ```tsx
 * const { contracts, graph, createContract, acceptInvitation } = useProjectContracts({
 *   projectId: 'proj-123',
 *   viewerOrgId: user.org_id,
 * });
 * ```
 */
export function useProjectContracts({
  projectId,
  viewerOrgId,
  autoFetch = true,
}: UseProjectContractsOptions): UseProjectContractsReturn {
  const [graph, setGraph] = useState<ProjectGraph | null>(null);
  const [contracts, setContracts] = useState<ViewerContract[]>([]);
  const [workers, setWorkers] = useState<ProjectRoleAssignment[]>([]);
  const [invitations, setInvitations] = useState<ContractInvitation[]>([]);
  const [disclosureRequests, setDisclosureRequests] = useState<DisclosureRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch project graph and related data
  const fetchData = useCallback(async () => {
    if (!projectId || !viewerOrgId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch graph and contracts
      const graphData = await getProjectGraph(projectId, viewerOrgId);
      setGraph(graphData.graph);
      setContracts(graphData.my_contracts);
      setWorkers(graphData.my_workers);
      
      // Fetch pending invitations
      const pendingInvitations = await getPendingInvitations(viewerOrgId);
      setInvitations(pendingInvitations);
      
      // Fetch disclosure requests
      const pendingDisclosures = await getPendingDisclosureRequests(viewerOrgId);
      setDisclosureRequests(pendingDisclosures);
      
      console.log('[PROJECT CONTRACTS] Data loaded:', {
        contracts: graphData.my_contracts.length,
        nodes: graphData.graph.nodes.length,
        edges: graphData.graph.edges.length,
        invitations: pendingInvitations.length,
        disclosures: pendingDisclosures.length,
      });
    } catch (err) {
      console.error('[PROJECT CONTRACTS] Error fetching data:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [projectId, viewerOrgId]);
  
  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);
  
  // Create a new contract (invitation)
  const handleCreateContract = useCallback(
    async (data: CreateProjectContractRequest) => {
      try {
        await createProjectContract(data);
        await fetchData(); // Refresh
      } catch (err) {
        console.error('[CREATE CONTRACT] Error:', err);
        throw err;
      }
    },
    [fetchData]
  );
  
  // Accept pending invitation
  const handleAcceptInvitation = useCallback(
    async (contractId: string) => {
      try {
        // TODO: Get current user ID
        await acceptContractInvitation(contractId, 'current-user-id');
        await fetchData(); // Refresh
      } catch (err) {
        console.error('[ACCEPT INVITATION] Error:', err);
        throw err;
      }
    },
    [fetchData]
  );
  
  // Decline pending invitation
  const handleDeclineInvitation = useCallback(
    async (contractId: string) => {
      try {
        await declineContractInvitation(contractId);
        await fetchData(); // Refresh
      } catch (err) {
        console.error('[DECLINE INVITATION] Error:', err);
        throw err;
      }
    },
    [fetchData]
  );
  
  // Request disclosure of a sub to client
  const handleRequestDisclosure = useCallback(
    async (contractId: string, notes?: string) => {
      try {
        // TODO: Get current user ID
        await requestDisclosure(contractId, viewerOrgId, 'current-user-id', notes);
        await fetchData(); // Refresh
      } catch (err) {
        console.error('[REQUEST DISCLOSURE] Error:', err);
        throw err;
      }
    },
    [viewerOrgId, fetchData]
  );
  
  // Approve disclosure request
  const handleApproveDisclosure = useCallback(
    async (contractId: string, disclosedToOrgId: string) => {
      try {
        // TODO: Get current user ID
        await approveDisclosure(contractId, disclosedToOrgId, 'current-user-id');
        await fetchData(); // Refresh
      } catch (err) {
        console.error('[APPROVE DISCLOSURE] Error:', err);
        throw err;
      }
    },
    [fetchData]
  );
  
  // Decline disclosure request
  const handleDeclineDisclosure = useCallback(
    async (contractId: string, reason?: string) => {
      try {
        await declineDisclosure(contractId, reason);
        await fetchData(); // Refresh
      } catch (err) {
        console.error('[DECLINE DISCLOSURE] Error:', err);
        throw err;
      }
    },
    [fetchData]
  );
  
  return {
    // Data
    graph,
    contracts,
    workers,
    invitations,
    disclosureRequests,
    
    // Actions
    createContract: handleCreateContract,
    acceptInvitation: handleAcceptInvitation,
    declineInvitation: handleDeclineInvitation,
    requestContractDisclosure: handleRequestDisclosure,
    approveContractDisclosure: handleApproveDisclosure,
    declineContractDisclosure: handleDeclineDisclosure,
    
    // Utilities
    refresh: fetchData,
    
    // States
    loading,
    error,
  };
}

/**
 * Hook to get contract margin (for agencies with both buying and selling contracts)
 */
export function useContractMargin(
  contracts: ViewerContract[]
) {
  const sellingContract = contracts.find(c => c.relationship === 'selling');
  const buyingContract = contracts.find(c => c.relationship === 'buying');
  
  if (!sellingContract || !buyingContract || !sellingContract.rate || !buyingContract.rate) {
    return null;
  }
  
  const marginAmount = sellingContract.rate - buyingContract.rate;
  const marginPercentage = (marginAmount / sellingContract.rate) * 100;
  
  return {
    selling_rate: sellingContract.rate,
    buying_rate: buyingContract.rate,
    margin_amount: marginAmount,
    margin_percentage: marginPercentage,
    currency: sellingContract.currency,
  };
}

/**
 * Hook to categorize contracts by relationship
 */
export function useCategorizedContracts(contracts: ViewerContract[]) {
  const upstream = contracts.filter(c => c.relationship === 'buying'); // I buy from them (they're my vendor)
  const downstream = contracts.filter(c => c.relationship === 'selling'); // I sell to them (they're my client)
  const disclosed = contracts.filter(c => c.relationship === 'disclosed'); // Visible via disclosure
  
  return { upstream, downstream, disclosed };
}
