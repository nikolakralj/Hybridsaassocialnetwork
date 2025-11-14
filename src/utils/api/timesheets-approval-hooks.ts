/**
 * React Query Hooks for Timesheet Approval System
 * 
 * Provides hooks for data fetching with caching, loading states, and error handling
 * Uses @tanstack/react-query for optimal performance
 */

import { useQuery, useMutation, useQueryClient, useQueries, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import * as api from './timesheets-approval';
import type { 
  Organization,
  ProjectContract,
  TimesheetPeriod,
  TimesheetEntry,
  MonthlyTimesheetView,
} from '../../types';
import { useMemo } from 'react';

// ✅ TEST MODE: Import persona context
import { usePersona, TEST_PERSONAS } from '../../contexts/PersonaContext';

// ============================================================================
// QUERY KEYS (for cache management)
// ============================================================================

export const queryKeys = {
  organizations: ['organizations'] as const,
  organizationById: (id: string) => ['organizations', id] as const,
  
  contracts: ['contracts'] as const,
  contractsByOrg: (orgId: string) => ['contracts', 'org', orgId] as const,
  contractById: (id: string) => ['contracts', id] as const,
  
  periods: ['periods'] as const,
  periodsByContract: (contractId: string) => ['periods', 'contract', contractId] as const,
  periodById: (id: string) => ['periods', id] as const,
  
  entries: ['entries'] as const,
  entriesByPeriod: (periodId: string) => ['entries', 'period', periodId] as const,
  
  monthlyView: (contractId: string, month: string) => ['monthlyView', contractId, month] as const,
};

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export function useOrganizations(
  options?: Omit<UseQueryOptions<Organization[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Organization[], Error>({
    queryKey: queryKeys.organizations,
    queryFn: api.fetchOrganizations,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function useOrganizationById(
  id: string,
  options?: Omit<UseQueryOptions<Organization | null, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Organization | null, Error>({
    queryKey: queryKeys.organizationById(id),
    queryFn: () => api.fetchOrganizationById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// CONTRACTS
// ============================================================================

export function useAllContracts(
  options?: Omit<UseQueryOptions<ProjectContract[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ProjectContract[], Error>({
    queryKey: queryKeys.contracts,
    queryFn: api.fetchAllContracts,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useContractsByOrganization(
  organizationId: string,
  options?: Omit<UseQueryOptions<ProjectContract[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ProjectContract[], Error>({
    queryKey: queryKeys.contractsByOrg(organizationId),
    queryFn: () => api.fetchContractsByOrganization(organizationId),
    enabled: !!organizationId,
    staleTime: 3 * 60 * 1000,
    ...options,
  });
}

export function useContractById(
  id: string,
  options?: Omit<UseQueryOptions<ProjectContract | null, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ProjectContract | null, Error>({
    queryKey: queryKeys.contractById(id),
    queryFn: () => api.fetchContractById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// TIMESHEET PERIODS
// ============================================================================

export function usePeriodsByContract(
  contractId: string,
  options?: Omit<UseQueryOptions<TimesheetPeriod[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TimesheetPeriod[], Error>({
    queryKey: queryKeys.periodsByContract(contractId),
    queryFn: () => api.fetchPeriodsByContract(contractId),
    enabled: !!contractId,
    staleTime: 1 * 60 * 1000, // 1 minute (fresher data for timesheets)
    ...options,
  });
}

export function usePeriodById(
  id: string,
  options?: Omit<UseQueryOptions<TimesheetPeriod | null, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TimesheetPeriod | null, Error>({
    queryKey: queryKeys.periodById(id),
    queryFn: () => api.fetchPeriodById(id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// TIMESHEET ENTRIES
// ============================================================================

export function useEntriesByPeriod(
  periodId: string,
  options?: Omit<UseQueryOptions<TimesheetEntry[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TimesheetEntry[], Error>({
    queryKey: queryKeys.entriesByPeriod(periodId),
    queryFn: () => api.fetchEntriesByPeriod(periodId),
    enabled: !!periodId,
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}

/**
 * Fetch entries by user and date range
 * Useful for attaching entries to periods in the approval drawer
 */
export function useEntriesByUserAndDateRange(
  userId: string,
  startDate: string,
  endDate: string,
  options?: Omit<UseQueryOptions<TimesheetEntry[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TimesheetEntry[], Error>({
    queryKey: ['entries', 'user', userId, 'range', startDate, endDate],
    queryFn: () => api.fetchEntriesByUserAndDateRange(userId, startDate, endDate),
    enabled: !!userId && !!startDate && !!endDate,
    staleTime: 30 * 1000,
    ...options,
  });
}

// ============================================================================
// MONTHLY AGGREGATION
// ============================================================================

export function useMonthlyView(
  contractId: string,
  month: string, // YYYY-MM format
  options?: Omit<UseQueryOptions<MonthlyTimesheetView | null, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<MonthlyTimesheetView | null, Error>({
    queryKey: queryKeys.monthlyView(contractId, month),
    queryFn: () => api.fetchMonthlyView(contractId, month),
    enabled: !!contractId && !!month,
    staleTime: 1 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// APPROVAL ACTIONS (MUTATIONS)
// ============================================================================

interface ApproveTimesheetParams {
  periodId: string;
  approverId: string;
  approverName: string;
}

export function useApproveTimesheet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ periodId, approverId, approverName }: ApproveTimesheetParams) =>
      api.approveTimesheet(periodId, approverId, approverName),
    
    onSuccess: (_, variables) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.periods });
      queryClient.invalidateQueries({ queryKey: queryKeys.periodById(variables.periodId) });
      
      // Show success toast
      toast.success('Timesheet approved successfully', {
        description: 'The contractor has been notified.',
      });
    },
    
    onError: (error: Error, variables) => {
      console.error('Failed to approve timesheet:', error);
      toast.error('Failed to approve timesheet', {
        description: error.message,
      });
    },
  });
}

interface RejectTimesheetParams {
  periodId: string;
  approverId: string;
  approverName: string;
  reason: string;
}

export function useRejectTimesheet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ periodId, approverId, approverName, reason }: RejectTimesheetParams) =>
      api.rejectTimesheet(periodId, approverId, approverName, reason),
    
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods });
      queryClient.invalidateQueries({ queryKey: queryKeys.periodById(variables.periodId) });
      
      toast.success('Timesheet rejected', {
        description: 'The contractor has been notified to make corrections.',
      });
    },
    
    onError: (error: Error) => {
      console.error('Failed to reject timesheet:', error);
      toast.error('Failed to reject timesheet', {
        description: error.message,
      });
    },
  });
}

interface BulkApproveParams {
  periodIds: string[];
  approverId: string;
  approverName: string;
}

export function useBulkApprove() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ periodIds, approverId, approverName }: BulkApproveParams) =>
      api.bulkApproveTimesheets(periodIds, approverId, approverName),
    
    onSuccess: (result, variables) => {
      // Invalidate all periods to refresh
      queryClient.invalidateQueries({ queryKey: queryKeys.periods });
      
      const total = variables.periodIds.length;
      const succeeded = result.succeeded.length;
      const failed = result.failed.length;
      
      if (failed === 0) {
        toast.success(`${succeeded} timesheets approved`, {
          description: 'All contractors have been notified.',
        });
      } else {
        toast.warning(`${succeeded} approved, ${failed} failed`, {
          description: `${succeeded} of ${total} timesheets were approved successfully.`,
        });
      }
    },
    
    onError: (error: Error) => {
      console.error('Bulk approve failed:', error);
      toast.error('Bulk approval failed', {
        description: error.message,
      });
    },
  });
}

interface BulkRejectParams {
  periodIds: string[];
  approverId: string;
  approverName: string;
  reason: string;
}

export function useBulkReject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ periodIds, approverId, approverName, reason }: BulkRejectParams) =>
      api.bulkRejectTimesheets(periodIds, approverId, approverName, reason),
    
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods });
      
      const total = variables.periodIds.length;
      const succeeded = result.succeeded.length;
      const failed = result.failed.length;
      
      if (failed === 0) {
        toast.success(`${succeeded} timesheets rejected`, {
          description: 'All contractors have been notified.',
        });
      } else {
        toast.warning(`${succeeded} rejected, ${failed} failed`, {
          description: `${succeeded} of ${total} timesheets were rejected.`,
        });
      }
    },
    
    onError: (error: Error) => {
      console.error('Bulk reject failed:', error);
      toast.error('Bulk rejection failed', {
        description: error.message,
      });
    },
  });
}

// ============================================================================
// COMBINED DATA HOOKS (for common patterns)
// ============================================================================

/**
 * Fetches organizations with their contracts
 * Useful for the main approval table view
 */
export function useOrganizationsWithContracts() {
  const { data: organizations, isLoading: orgsLoading, error: orgsError } = useOrganizations();
  const { data: contracts, isLoading: contractsLoading, error: contractsError } = useAllContracts();
  
  const isLoading = orgsLoading || contractsLoading;
  const error = orgsError || contractsError;
  
  // Group contracts by organization
  const organizationsWithContracts = organizations?.map(org => ({
    ...org,
    contracts: contracts?.filter(c => c.organizationId === org.id) || [],
  })) || [];
  
  return {
    data: organizationsWithContracts,
    isLoading,
    error,
  };
}

/**
 * Prefetch data for faster navigation
 * Call this when user hovers over a row
 */
export function usePrefetchPeriodData() {
  const queryClient = useQueryClient();
  
  return {
    prefetchPeriod: (periodId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.periodById(periodId),
        queryFn: () => api.fetchPeriodById(periodId),
        staleTime: 1 * 60 * 1000,
      });
    },
    
    prefetchEntries: (periodId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.entriesByPeriod(periodId),
        queryFn: () => api.fetchEntriesByPeriod(periodId),
        staleTime: 30 * 1000,
      });
    },
  };
}

// ============================================================================
// ORGANIZATION DATA WITH NESTED CONTRACTS AND PERIODS
// ============================================================================

export interface OrganizationWithData extends Organization {
  contracts: (ProjectContract & { periods: TimesheetPeriod[] })[];
}

/**
 * Fetches complete approval data structure:
 * Organizations → Contracts → Periods (with all related data)
 * 
 * This is the main hook for the approval table view
 * 
 * ✅ TEST MODE: Filters by persona (will be removed in Phase 9)
 */
export function useApprovalsData() {
  const { data: organizations, isLoading: orgsLoading, error: orgsError } = useOrganizations();
  const { data: contracts, isLoading: contractsLoading, error: contractsError } = useAllContracts();
  
  // ✅ TEST MODE: Get current persona
  const { currentPersona } = usePersona();
  
  // Fetch periods for all contracts in parallel
  const contractIds = contracts?.map(c => c.id) || [];
  
  const periodQueries = contractIds.map(contractId => ({
    queryKey: queryKeys.periodsByContract(contractId),
    queryFn: () => api.fetchPeriodsByContract(contractId),
    staleTime: 1 * 60 * 1000,
    enabled: !!contractId,
  }));

  // Use useQueries to fetch all periods in parallel
  const periodResults = useQueries({
    queries: periodQueries,
  }) as any[]; // Type assertion to avoid complex typing

  const isLoading = orgsLoading || contractsLoading || periodResults.some(r => r.isLoading);
  const error = orgsError || contractsError || periodResults.find(r => r.error)?.error;

  // Combine data into nested structure
  // ✅ FIX: Create stable key from periodResults to prevent infinite loops
  const periodResultsKey = useMemo(() => 
    periodResults.map((r, i) => `${i}:${r.isLoading}:${r.data?.length || 0}`).join(','),
    [periodResults]
  );
  
  const data: OrganizationWithData[] = useMemo(() => {
    if (!organizations || !contracts) return [];

    // ✅ Build organization groups (including virtual group for freelancers)
    const orgGroups = organizations
      .map(org => {
        const orgContracts = contracts
          .filter(c => c.organizationId === org.id)
          .map((contract, index) => {
            const periodResult = periodResults[contracts.indexOf(contract)];
            const periods = periodResult?.data || [];
            
            return {
              ...contract,
              periods,
            };
          });

        return {
          ...org,
          contracts: orgContracts,
        };
      })
      // ✅ Filter out organizations with no contracts
      .filter(org => org.contracts.length > 0);
    
    // ✅ NEW: Add virtual "Individual Contributors" organization for freelancers
    const freelancerContracts = contracts
      .filter(c => !c.organizationId) // Freelancers have null organizationId
      .map((contract) => {
        const periodResult = periodResults[contracts.indexOf(contract)];
        const periods = periodResult?.data || [];
        
        return {
          ...contract,
          periods,
        };
      });
    
    if (freelancerContracts.length > 0) {
      orgGroups.push({
        id: 'freelancers-virtual',
        name: 'Individual Contributors',
        type: 'freelancer' as const,
        contracts: freelancerContracts,
      });
    }
    
    return orgGroups;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations, contracts, periodResultsKey]);

  // ✅ TEST MODE: Filter by persona
  const filteredData = useMemo(() => {
    if (!currentPersona) {
      console.log('[TEST MODE] No persona selected - returning empty array');
      return [];
    }

    console.log(`[TEST MODE] Filtering ${data.length} orgs for persona: ${currentPersona.name} (${currentPersona.role})`);
    console.log('[TEST MODE] Current persona details:', {
      id: currentPersona.id,
      name: currentPersona.name,
      role: currentPersona.role,
    });
    
    // 🔍 DEBUG: Log all contracts before filtering
    const allContracts = data.flatMap(org => org.contracts);
    console.log(`[TEST MODE] Total contracts before filtering: ${allContracts.length}`);
    allContracts.forEach((contract, index) => {
      console.log(`[TEST MODE] Contract ${index + 1}:`, {
        id: contract.id,
        userId: contract.userId,
        userName: contract.userName,
        matchesId: contract.userId === currentPersona.id,
        matchesName: contract.userName === currentPersona.name,
        matchesNameLower: contract.userName.toLowerCase() === currentPersona.name.toLowerCase(),
      });
    });

    // Filter based on role
    switch (currentPersona.role) {
      case 'contractor':
        // Contractors only see their own timesheets
        const contractorFiltered = data.map(org => ({
          ...org,
          contracts: org.contracts.filter(contract => {
            const matches = contract.userId === currentPersona.id || 
              contract.userName === currentPersona.name ||
              contract.userName.toLowerCase() === currentPersona.name.toLowerCase();
            
            console.log(`[TEST MODE] Filtering contract ${contract.id} for contractor:`, {
              contractUserId: contract.userId,
              personaId: currentPersona.id,
              contractUserName: contract.userName,
              personaName: currentPersona.name,
              matches,
            });
            
            return matches;
          }),
        })).filter(org => org.contracts.length > 0);
        
        console.log(`[TEST MODE] Contractor filtered: ${contractorFiltered.flatMap(o => o.contracts).length} contracts`);
        return contractorFiltered;

      case 'manager':
      case 'client':
        // Managers and clients see all timesheets
        console.log(`[TEST MODE] ${currentPersona.role} view - showing all ${data.flatMap(o => o.contracts).length} contracts`);
        return data;

      default:
        return data;
    }
  }, [data, currentPersona]);

  return {
    data: filteredData,
    isLoading,
    error: error as Error | null,
  };
}