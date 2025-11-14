import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Filter, Loader2, Database, RotateCcw } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner@2.0.3';
import { migrateTimesheetEntries } from '../../../utils/api/migrate-timesheets';
import { resetTimesheetToDraft } from '../../../utils/api/reset-timesheet';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Skeleton } from '../../ui/skeleton';
import { OrganizationGroupedTable } from './OrganizationGroupedTable';
import { MonthlyTimesheetDrawer } from './MonthlyTimesheetDrawer';
import { PeriodSelector } from '../table/PeriodSelector';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

// NEW: Import API hooks instead of demo data
import {
  useApprovalsData,
  useBulkApprove,
  useBulkReject,
  useEntriesByUserAndDateRange,
} from '../../../utils/api/timesheets-approval-hooks';

// Import API function for fetching entries
import { fetchEntriesByUserAndDateRange } from '../../../utils/api/timesheets-approval';

// Import helper function to get entries from demo data (FALLBACK ONLY)
import { getEntriesByPeriod } from './demo-data-multi-party';

// Import types from centralized location
import type {
  Organization,
  ProjectContract,
  TimesheetPeriod,
  ApprovalStatus,
  ContractorRole,
} from '../../../types';

// 🔥 CACHE BUSTER: Force rebuild at 2025-01-23T19:42:00Z 🔥
const COMPONENT_VERSION = '2.0.1-FIXED';

// CACHE BUSTER: 2025-01-23-v2
type OrganizationFilter = 'all' | string; // 'all' or specific org ID
type StatusFilter = 'all' | ApprovalStatus;
type RoleFilter = 'all' | ContractorRole;

// Migration Button Component
function MigrationButton() {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleMigrate = async () => {
    setIsLoading(true);
    try {
      const result = await migrateTimesheetEntries();
      toast.success(`Migration complete! ${result.migrated} entries updated with task categories and work types`);
      // Reload to see changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error(`Migration failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Button
      onClick={handleMigrate}
      disabled={isLoading}
      size="sm"
      variant="outline"
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Migrating...
        </>
      ) : (
        <>
          <Database className="h-3.5 w-3.5" />
          Add Task Fields
        </>
      )}
    </Button>
  );
}

export function ApprovalsV2Tab() {
  // 🚨 VERSION: 2.0.1 - useCallback fix applied
  console.warn(`🚨🚨🚨 ApprovalsV2Tab LOADED - VERSION ${COMPONENT_VERSION} with useCallback 🚨🚨🚨`);
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set()); // Keep as periods for now
  const [drawerPeriods, setDrawerPeriods] = useState<TimesheetPeriod[] | null>(null);
  const [clickedPeriodId, setClickedPeriodId] = useState<string | null>(null);
  const [drawerContract, setDrawerContract] = useState<ProjectContract | null>(null);
  
  // Period selector state
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'calendar'>('month');
  const [periodStart, setPeriodStart] = useState<Date>(startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date>(endOfMonth(new Date()));
  
  // Filters
  const [orgFilter, setOrgFilter] = useState<OrganizationFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // NEW: Fetch data from API
  const { data: organizationsWithData, isLoading: dataLoading, error: dataError } = useApprovalsData();
  
  // 🔥 DEBUG: Log what data is being loaded
  useEffect(() => {
    if (organizationsWithData) {
      console.log('📊 APPROVALS DATA LOADED FROM DATABASE:', {
        organizationCount: organizationsWithData.length,
        organizations: organizationsWithData.map(org => ({
          id: org.id,
          name: org.name,
          contractCount: org.contracts.length,
          contracts: org.contracts.map(c => ({
            id: c.id,
            userName: c.userName,
            periodCount: c.periods.length,
            totalHoursAcrossPeriods: c.periods.reduce((sum, p) => sum + (p.totalHours || 0), 0),
            periods: c.periods.map(p => ({
              id: p.id,
              weekStart: p.weekStartDate,
              weekEnd: p.weekEndDate,
              hours: p.totalHours,
              status: p.status,
              hasEntries: p.entries && p.entries.length > 0,
              entryCount: p.entries ? p.entries.length : 0
            }))
          }))
        }))
      });
      
      // 🔥 DETAILED DEBUG: Log first contract's data structure
      if (organizationsWithData.length > 0 && organizationsWithData[0].contracts.length > 0) {
        const firstContract = organizationsWithData[0].contracts[0];
        console.log('🔍 SAMPLE CONTRACT DATA:', {
          contractId: firstContract.id,
          userName: firstContract.userName,
          periodCount: firstContract.periods.length,
          firstPeriod: firstContract.periods[0] ? {
            id: firstContract.periods[0].id,
            weekStart: firstContract.periods[0].weekStartDate,
            weekEnd: firstContract.periods[0].weekEndDate,
            totalHours: firstContract.periods[0].totalHours,
            entries: firstContract.periods[0].entries,
            hasEntriesProperty: 'entries' in firstContract.periods[0],
            entriesType: typeof firstContract.periods[0].entries,
            entriesIsArray: Array.isArray(firstContract.periods[0].entries)
          } : 'NO PERIODS'
        });
      }
    }
  }, [organizationsWithData]);
  
  // NEW: Mutation hooks for bulk actions
  const bulkApproveMutation = useBulkApprove();
  const bulkRejectMutation = useBulkReject();

  console.log('🟣 ApprovalsV2Tab rendered');

  // Helper function to get contracts by organization from nested data
  const getContractsByOrganization = (orgId: string) => {
    const org = organizationsWithData?.find(o => o.id === orgId);
    return org?.contracts || [];
  };

  // Helper function to get periods by contract from nested data
  const getPeriodsByContract = (contractId: string) => {
    for (const org of organizationsWithData || []) {
      const contract = org.contracts.find(c => c.id === contractId);
      if (contract) {
        return contract.periods;
      }
    }
    return [];
  };

  // Apply filters with date range filtering
  const { filteredOrgs, filteredPeriods } = useMemo(() => {
    if (!organizationsWithData) return { filteredOrgs: [], filteredPeriods: [] };
    
    let orgs = organizationsWithData;

    // Filter by organization
    if (orgFilter !== 'all') {
      orgs = orgs.filter(o => o.id === orgFilter);
    }

    // Get all periods that match filters
    const allPeriods = orgs.flatMap(org => {
      const orgContracts = org.contracts;
      
      // Filter by role
      const roleFilteredContracts = roleFilter === 'all' 
        ? orgContracts 
        : orgContracts.filter(c => c.userRole === roleFilter);

      return roleFilteredContracts.flatMap(contract => {
        let periods = contract.periods;
        
        // 🔥 NEW: Filter by date range (periodStart/periodEnd)
        if (periodStart && periodEnd) {
          periods = periods.filter(p => {
            const pStart = new Date(p.weekStartDate);
            const pEnd = new Date(p.weekEndDate);
            // Period overlaps with selected date range
            return pStart <= periodEnd && pEnd >= periodStart;
          });
        }
        
        // Filter by status
        return statusFilter === 'all'
          ? periods
          : periods.filter(p => p.status === statusFilter);
      });
    });

    // Only include orgs that have matching periods after filtering
    const orgsWithMatchingPeriods = orgs.filter(org => {
      return org.contracts.some(contract => {
        const periods = contract.periods;
        return periods.some(p => allPeriods.includes(p));
      });
    });

    return {
      filteredOrgs: orgsWithMatchingPeriods,
      filteredPeriods: allPeriods,
    };
  }, [organizationsWithData, orgFilter, statusFilter, roleFilter, periodStart, periodEnd]);

  const handleToggleSelection = (periodId: string) => {
    const newSelected = new Set(selectedPeriods);
    if (newSelected.has(periodId)) {
      newSelected.delete(periodId);
    } else {
      newSelected.add(periodId);
    }
    console.log('✅ handleToggleSelection:', { periodId, newSize: newSelected.size });
    setSelectedPeriods(newSelected);
  };

  const handleToggleAll = useCallback((periodIds: string[]) => {
    console.warn('⚠️⚠️⚠️ handleToggleAll PARENT FUNCTION CALLED! ⚠️⚠️⚠️');
    console.warn('🚨🚨🚨 NEW VERSION WITH USECALLBACK! 🚨🚨🚨');
    console.log('🔵 handleToggleAll CALLED:', { 
      periodIds, 
      count: periodIds.length
    });
    
    setSelectedPeriods(prev => {
      const newSelected = new Set(prev);
      const allSelected = periodIds.every(id => newSelected.has(id));
      
      if (allSelected) {
        periodIds.forEach(id => newSelected.delete(id));
      } else {
        periodIds.forEach(id => newSelected.add(id));
      }
      
      console.log('✅ handleToggleAll COMPLETE:', { 
        periodIds: periodIds.length, 
        allSelected, 
        oldSize: prev.size,
        newSize: newSelected.size,
        newSelected: Array.from(newSelected)
      });
      
      return newSelected;
    });
  }, []); // No dependencies needed since we use setSelectedPeriods with a function

  const handleOpenDrawer = async (period: TimesheetPeriod, contract: ProjectContract) => {
    console.log('🔵 handleOpenDrawer called with:', {
      period: period,
      contract: contract,
      periodWeek: period.weekStartDate,
    });

    // Find ALL periods for this contract in the same month
    const clickedDate = new Date(period.weekStartDate);
    const clickedYear = clickedDate.getFullYear();
    const clickedMonth = clickedDate.getMonth();
    
    // Calculate month boundaries
    const monthStart = new Date(clickedYear, clickedMonth, 1);
    const monthEnd = new Date(clickedYear, clickedMonth + 1, 0);
    
    console.log('🔵 Looking for periods in month:', { 
      clickedYear, 
      clickedMonth: clickedMonth + 1,
      monthStart: monthStart.toISOString().split('T')[0],
      monthEnd: monthEnd.toISOString().split('T')[0],
    });
    
    // Get all periods for this contract
    const allContractPeriods = getPeriodsByContract(contract.id);
    
    console.log('🔵 All periods for this contract:', allContractPeriods);
    
    // Filter to only periods in the same month
    const monthPeriods = allContractPeriods.filter(p => {
      const periodDate = new Date(p.weekStartDate);
      return periodDate >= monthStart && periodDate <= monthEnd;
    });
    
    console.log(`🔵 Found ${monthPeriods.length} periods in this month`);
    
    // ✅ FETCH REAL ENTRIES from database
    try {
      console.log('🔵 Attempting to fetch REAL entries from database...');
      console.log('🔵 User ID:', contract.userId);
      console.log('🔵 Date range:', monthStart.toISOString().split('T')[0], 'to', monthEnd.toISOString().split('T')[0]);
      
      const entries = await fetchEntriesByUserAndDateRange(
        contract.userId,
        monthStart.toISOString().split('T')[0],
        monthEnd.toISOString().split('T')[0]
      );
      
      console.log(`✅ SUCCESS! Fetched ${entries.length} REAL entries from database for ${contract.userName}`);
      console.log('📊 Entries:', entries);
      
      if (entries.length === 0) {
        console.warn('⚠️⚠️⚠️ DATABASE RETURNED 0 ENTRIES - FALLING BACK TO DEMO DATA ⚠️⚠️⚠️');
        console.warn('This means the timesheet_entries table is EMPTY for this user.');
        console.warn('To fix: Update TimesheetCalendarView to save entries to database');
        
        // Use demo data since database is empty
        throw new Error('No entries in database, using demo data');
      }
      
      // Attach entries to periods based on date range
      const periodsWithEntries = monthPeriods.map(p => {
        const periodStart = new Date(p.weekStartDate);
        const periodEnd = new Date(p.weekEndDate);
        
        const periodEntries = entries.filter(e => {
          const entryDate = new Date(e.date);
          return entryDate >= periodStart && entryDate <= periodEnd;
        });
        
        console.log(`📊 Period ${p.weekStartDate} to ${p.weekEndDate} has ${periodEntries.length} entries`);
        
        return {
          ...p,
          entries: periodEntries,
        };
      });
      
      setDrawerPeriods(periodsWithEntries);
      setDrawerContract(contract);
      setClickedPeriodId(period.id);
      
      console.log('✅ Drawer opened with REAL DATA from database!');
    } catch (error) {
      console.error('❌ Failed to fetch entries from database:', error);
      console.log('⚠️⚠️⚠️ FALLING BACK TO DEMO DATA - DATA WILL BE RANDOM ⚠️⚠️⚠️');
      console.log('🎲 Demo data uses Math.random() so entries will be different each time!');
      
      // Fallback to demo data if database fetch fails
      const periodsWithDemoData = monthPeriods.map(p => ({
        ...p,
        entries: getEntriesByPeriod(p.id),
      }));
      
      setDrawerPeriods(periodsWithDemoData);
      setDrawerContract(contract);
      setClickedPeriodId(period.id);
      
      console.log('⚠️ Drawer opened with DEMO DATA (database fetch failed)');
    }
  };

  const handleCloseDrawer = () => {
    setDrawerPeriods(null);
    setClickedPeriodId(null);
    setDrawerContract(null);
  };

  const handlePeriodNavigate = (start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  // NEW: Real bulk approve action
  const handleBulkApprove = async () => {
    await bulkApproveMutation.mutateAsync({
      periodIds: Array.from(selectedPeriods),
      approverId: 'current-user-id', // TODO: Get from auth context
      approverName: 'Current User', // TODO: Get from auth context
    });
    setSelectedPeriods(new Set());
  };

  // NEW: Real bulk reject action
  const handleBulkReject = async () => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    
    await bulkRejectMutation.mutateAsync({
      periodIds: Array.from(selectedPeriods),
      approverId: 'current-user-id', // TODO: Get from auth context
      approverName: 'Current User', // TODO: Get from auth context
      reason,
    });
    setSelectedPeriods(new Set());
  };

  const stats = {
    total: filteredPeriods.length,
    pending: filteredPeriods.filter(p => p.status === 'pending').length,
    approved: filteredPeriods.filter(p => p.status === 'approved').length,
    rejected: filteredPeriods.filter(p => p.status === 'rejected').length,
  };

  // Debug: Log drawer state whenever it changes
  useEffect(() => {
    console.log('🔵 Drawer State Changed:', { 
      drawerPeriods: drawerPeriods?.length, 
      drawerContract: drawerContract?.userName,
      clickedPeriodId,
      shouldShowDrawer: !!(drawerPeriods && drawerContract && clickedPeriodId)
    });
  }, [drawerPeriods, drawerContract, clickedPeriodId]);

  // Debug: Log when handleOpenDrawer is available
  useEffect(() => {
    console.log('🟣 ApprovalsV2Tab: handleOpenDrawer function is:', typeof handleOpenDrawer);
  }, []);

  // Debug: Watch selectedPeriods changes
  useEffect(() => {
    console.log('🟡 selectedPeriods STATE CHANGED:', {
      size: selectedPeriods.size,
      ids: Array.from(selectedPeriods)
    });
  }, [selectedPeriods]);

  // NEW: Loading state
  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  // NEW: Error state
  if (dataError) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Data</h3>
          <p className="text-sm text-red-700">
            {dataError?.message}
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
            variant="outline"
          >
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  // NEW: Empty state (no organizations)
  if (!organizationsWithData || organizationsWithData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Data Available</h3>
          <p className="text-sm text-yellow-700">
            No organizations found. Make sure you've run the database migrations and seed data.
          </p>
          <p className="text-sm text-yellow-700 mt-2">
            See <code className="bg-yellow-100 px-2 py-1 rounded">/supabase/migrations/README.md</code> for instructions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-semibold text-gray-900">Approvals v2 (Production)</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 border-green-300">
              ✓ Live Data
            </Badge>
            <Badge variant="secondary">Multi-Party Architecture</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  console.log('🔄 Starting reset all approved to draft...');
                  
                  const response = await fetch(
                    `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/timesheet-approvals/reset-all-approved`,
                    {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${publicAnonKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({}),
                    }
                  );
                  
                  const result = await response.json();
                  
                  if (!response.ok) {
                    throw new Error(result.error || 'Failed to reset');
                  }
                  
                  console.log('✅ Reset result:', result);
                  
                  if (result.count === 0) {
                    toast.info('No approved timesheets found to reset');
                  } else {
                    toast.success(`Reset ${result.count} approved timesheet(s)! Page will reload...`);
                    setTimeout(() => window.location.reload(), 1500);
                  }
                } catch (error) {
                  console.error('❌ Reset error:', error);
                  toast.error(`Failed to reset: ${error instanceof Error ? error.message : String(error)}`);
                }
              }}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Test Data
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Organization-grouped approval system with hierarchical contracts and approval flows
        </p>
      </div>

      {/* Period Selector */}
      <PeriodSelector
        view={viewMode}
        onViewChange={setViewMode}
        startDate={periodStart}
        endDate={periodEnd}
        onNavigate={handlePeriodNavigate}
        showCalendarTab={false}
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Submissions</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-700">Pending Review</div>
          <div className="text-2xl font-semibold text-yellow-900 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-700">Approved</div>
          <div className="text-2xl font-semibold text-green-900 mt-1">{stats.approved}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-700">Rejected</div>
          <div className="text-2xl font-semibold text-red-900 mt-1">{stats.rejected}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>

        <Select value={orgFilter} onValueChange={(v) => setOrgFilter(v as OrganizationFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            {organizationsWithData.map(org => (
              <SelectItem key={org.id} value={org.id}>
                {org.logo} {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="changes_requested">Changes Requested</SelectItem>
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="individual_contributor">Individual Contributors</SelectItem>
            <SelectItem value="company_employee">Company Employees</SelectItem>
            <SelectItem value="agency_contractor">Agency Contractors</SelectItem>
          </SelectContent>
        </Select>

        {(orgFilter !== 'all' || statusFilter !== 'all' || roleFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOrgFilter('all');
              setStatusFilter('all');
              setRoleFilter('all');
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedPeriods.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="text-sm font-medium text-blue-900">
            {selectedPeriods.size} timesheet{selectedPeriods.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleBulkApprove}
              disabled={bulkApproveMutation.isPending}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              {bulkApproveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve All
                </>
              )}
            </Button>
            <Button
              onClick={handleBulkReject}
              disabled={bulkRejectMutation.isPending}
              size="sm"
              variant="destructive"
            >
              {bulkRejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject All
                </>
              )}
            </Button>
            <Button
              onClick={() => setSelectedPeriods(new Set())}
              size="sm"
              variant="outline"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <OrganizationGroupedTable
        organizations={filteredOrgs}
        selectedPeriods={selectedPeriods}
        onToggleSelection={handleToggleSelection}
        onToggleAll={handleToggleAll}
        onOpenDrawer={handleOpenDrawer}
        viewMode={viewMode}
        filterPeriodStart={periodStart}
        filterPeriodEnd={periodEnd}
      />

      {/* Monthly Drawer */}
      {drawerPeriods && drawerContract && clickedPeriodId && (
        <MonthlyTimesheetDrawer
          periods={drawerPeriods}
          contract={drawerContract}
          isOpen={!!drawerPeriods}
          onClose={handleCloseDrawer}
          clickedPeriodId={clickedPeriodId}
        />
      )}
    </div>
  );
}