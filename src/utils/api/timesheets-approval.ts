/**
 * Timesheet Approval System API - Production Ready
 * 
 * API layer for approval-v2 system with Supabase integration
 * Builds organizations, contracts, and periods dynamically from real database tables
 */

import { createClient } from '../supabase/client';
import type { 
  Organization,
  ProjectContract,
  TimesheetPeriod,
  TimesheetEntry,
  MonthlyTimesheetView,
  ApprovalHistoryEntry,
  Attachment,
  ReviewFlag,
  AllocatedTask,
  ApprovalStatus,
} from '../../types';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient();

// ============================================================================
// HELPER: Build Organizations from Real Data
// ============================================================================

async function buildOrganizationsFromData(): Promise<Organization[]> {
  try {
    // ✅ Query Supabase organizations table directly
    const { data: orgData, error } = await supabase
      .from('organizations')
      .select('*');
    
    if (error) {
      console.error('Error fetching organizations:', error);
      return [];
    }
    
    // If no organizations exist, return empty array
    if (!orgData || orgData.length === 0) {
      console.log('📋 No organizations found - returning empty array');
      return [];
    }
    
    // Map to Organization type
    const organizations: Organization[] = orgData.map(org => ({
      id: org.id,
      name: org.name,
      type: org.type || 'company',
    }));
    
    console.log('📋 Built organizations from DB:', organizations.length, 'companies');
    return organizations;
  } catch (error: any) {
    console.error('Error building organizations:', error);
    console.warn('⚠️ Database not set up - returning empty array. Visit /setup to configure the database.');
    return [];
  }
}

// ============================================================================
// HELPER: Build Contracts from Real Data
// ============================================================================

async function buildContractsFromData(): Promise<ProjectContract[]> {
  try {
    // ✅ Query Supabase project_contracts table directly
    const { data: contractData, error } = await supabase
      .from('project_contracts')
      .select('*');
    
    if (error) {
      console.error('Error fetching contracts:', error);
      return [];
    }
    
    if (!contractData || contractData.length === 0) {
      console.log('📋 No contracts found - returning empty array');
      return [];
    }
    
    // Map to ProjectContract type
    const contracts: ProjectContract[] = contractData.map(contract => ({
      id: contract.id,
      userId: contract.user_id,
      userName: contract.user_name,
      userRole: contract.user_role || 'individual_contributor',
      organizationId: contract.organization_id,
      projectId: contract.project_id,
      contractType: contract.contract_type || 'hourly',
      hourlyRate: contract.hourly_rate || 125,
      hideRate: contract.hide_rate || false,
      startDate: contract.start_date,
    }));
    
    console.log('📋 Built contracts from DB:', contracts.length, 'contracts');
    return contracts;
  } catch (error) {
    console.error('Error building contracts:', error);
    return [];
  }
}

// ============================================================================
// HELPER: Build Weekly Periods from Real Data
// ============================================================================

async function buildPeriodsForContract(contractId: string, userId: string, companyId: string): Promise<TimesheetPeriod[]> {
  try {
    // ✅ Query Supabase timesheet_periods table directly
    const { data: periodData, error } = await supabase
      .from('timesheet_periods')
      .select('*')
      .eq('contract_id', contractId)
      .order('week_start_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching periods:', error);
      return [];
    }
    
    if (!periodData || periodData.length === 0) {
      console.log(`📋 No periods found for contract ${contractId}`);
      return [];
    }
    
    // Map to TimesheetPeriod type
    const periods: TimesheetPeriod[] = periodData.map(period => ({
      id: period.id,
      contractId: period.contract_id,
      weekStartDate: period.week_start_date,
      weekEndDate: period.week_end_date,
      totalHours: period.total_hours,
      status: period.status || 'pending',
      approvalHistory: [],
      attachments: [],
      reviewFlags: [],
      allocatedTasks: [],
      submittedAt: period.submitted_at,
    }));
    
    console.log(`📋 Built ${periods.length} periods for contract ${contractId}`);
    return periods;
  } catch (error) {
    console.error('Error building periods for contract:', error);
    return [];
  }
}

// ============================================================================
// ORGANIZATIONS (Built from real data)
// ============================================================================

export async function fetchOrganizations(): Promise<Organization[]> {
  return buildOrganizationsFromData();
}

export async function fetchOrganizationById(id: string): Promise<Organization | null> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching organization:', error);
      throw new Error(`Failed to fetch organization: ${error.message}`);
    }
    
    return data as Organization;
  } catch (err) {
    console.error('Unexpected error in fetchOrganizationById:', err);
    throw err;
  }
}

// ============================================================================
// CONTRACTS (Built from real data)
// ============================================================================

export async function fetchAllContracts(): Promise<ProjectContract[]> {
  return buildContractsFromData();
}

export async function fetchContractsByOrganization(
  organizationId: string
): Promise<ProjectContract[]> {
  try {
    const { data, error } = await supabase
      .from('project_contracts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('user_name');
    
    if (error) {
      console.error('Error fetching contracts by organization:', error);
      throw new Error(`Failed to fetch contracts: ${error.message}`);
    }
    
    return (data || []) as ProjectContract[];
  } catch (err) {
    console.error('Unexpected error in fetchContractsByOrganization:', err);
    throw err;
  }
}

export async function fetchContractById(id: string): Promise<ProjectContract | null> {
  try {
    const { data, error } = await supabase
      .from('project_contracts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching contract:', error);
      throw new Error(`Failed to fetch contract: ${error.message}`);
    }
    
    return data as ProjectContract;
  } catch (err) {
    console.error('Unexpected error in fetchContractById:', err);
    throw err;
  }
}

// ============================================================================
// TIMESHEET PERIODS (WEEKLY) - Built from real data
// ============================================================================

export async function fetchPeriodsByContract(
  contractId: string
): Promise<TimesheetPeriod[]> {
  try {
    // ✅ Query Supabase timesheet_periods table directly by contract_id
    const { data: periodData, error } = await supabase
      .from('timesheet_periods')
      .select('*')
      .eq('contract_id', contractId)
      .order('week_start_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching periods:', error);
      return [];
    }
    
    if (!periodData || periodData.length === 0) {
      console.log(`📋 No periods found for contract ${contractId}`);
      return [];
    }
    
    // Map to TimesheetPeriod type
    const periods: TimesheetPeriod[] = periodData.map(period => ({
      id: period.id,
      contractId: period.contract_id,
      weekStartDate: period.week_start_date,
      weekEndDate: period.week_end_date,
      totalHours: period.total_hours,
      status: period.status || 'pending',
      approvalHistory: [],
      attachments: [],
      reviewFlags: [],
      allocatedTasks: [],
      submittedAt: period.submitted_at,
    }));
    
    console.log(`📋 Built ${periods.length} periods for contract ${contractId}`);
    return periods;
  } catch (error) {
    console.error('Error fetching periods for contract:', error);
    return [];
  }
}

export async function fetchPeriodById(id: string): Promise<TimesheetPeriod | null> {
  try {
    const { data: period, error } = await supabase
      .from('timesheet_periods')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching period:', error);
      throw new Error(`Failed to fetch period: ${error.message}`);
    }
    
    // Fetch related data
    const [history, attachments, flags, tasks] = await Promise.all([
      fetchApprovalHistory(period.id),
      fetchAttachments(period.id),
      fetchReviewFlags(period.id),
      fetchAllocatedTasks(period.id),
    ]);
    
    return {
      ...period,
      approvalHistory: history,
      attachments: attachments,
      reviewFlags: flags,
      allocatedTasks: tasks,
    } as TimesheetPeriod;
  } catch (err) {
    console.error('Unexpected error in fetchPeriodById:', err);
    throw err;
  }
}

// ============================================================================
// TIMESHEET ENTRIES (DAILY)
// ============================================================================

export async function fetchEntriesByPeriod(
  periodId: string
): Promise<TimesheetEntry[]> {
  try {
    const { data, error } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('period_id', periodId)
      .order('date');
    
    if (error) {
      console.error('Error fetching entries:', error);
      throw new Error(`Failed to fetch entries: ${error.message}`);
    }
    
    return (data || []) as TimesheetEntry[];
  } catch (err) {
    console.error('Unexpected error in fetchEntriesByPeriod:', err);
    throw err;
  }
}

/**
 * Fetch entries by user and date range
 * Used to attach entries to periods in the approval drawer
 */
export async function fetchEntriesByUserAndDateRange(
  userId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<TimesheetEntry[]> {
  try {
    const { data, error } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');
    
    if (error) {
      console.error('Error fetching entries by date range:', error);
      throw new Error(`Failed to fetch entries: ${error.message}`);
    }
    
    return (data || []) as TimesheetEntry[];
  } catch (err) {
    console.error('Unexpected error in fetchEntriesByUserAndDateRange:', err);
    throw err;
  }
}

// ============================================================================
// APPROVAL HISTORY
// ============================================================================

async function fetchApprovalHistory(periodId: string): Promise<ApprovalHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('approval_history')
      .select('*')
      .eq('period_id', periodId)
      .order('timestamp');
    
    if (error) {
      console.error('Error fetching approval history:', error);
      return []; // Non-critical, return empty array
    }
    
    return (data || []) as ApprovalHistoryEntry[];
  } catch (err) {
    console.error('Unexpected error in fetchApprovalHistory:', err);
    return [];
  }
}

// ============================================================================
// ATTACHMENTS (PDFs)
// ============================================================================

async function fetchAttachments(periodId: string): Promise<Attachment[]> {
  try {
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('period_id', periodId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }
    
    return (data || []) as Attachment[];
  } catch (err) {
    console.error('Unexpected error in fetchAttachments:', err);
    return [];
  }
}

// ============================================================================
// REVIEW FLAGS
// ============================================================================

async function fetchReviewFlags(periodId: string): Promise<ReviewFlag[]> {
  try {
    const { data, error } = await supabase
      .from('review_flags')
      .select('*')
      .eq('period_id', periodId)
      .order('severity', { ascending: false }); // High severity first
    
    if (error) {
      console.error('Error fetching review flags:', error);
      return [];
    }
    
    return (data || []) as ReviewFlag[];
  } catch (err) {
    console.error('Unexpected error in fetchReviewFlags:', err);
    return [];
  }
}

// ============================================================================
// ALLOCATED TASKS
// ============================================================================

async function fetchAllocatedTasks(periodId: string): Promise<AllocatedTask[]> {
  try {
    const { data, error } = await supabase
      .from('allocated_tasks')
      .select('*')
      .eq('period_id', periodId);
    
    if (error) {
      console.error('Error fetching allocated tasks:', error);
      return [];
    }
    
    return (data || []) as AllocatedTask[];
  } catch (err) {
    console.error('Unexpected error in fetchAllocatedTasks:', err);
    return [];
  }
}

// ============================================================================
// MONTHLY AGGREGATION
// ============================================================================

export async function fetchMonthlyView(
  contractId: string,
  month: string // YYYY-MM format
): Promise<MonthlyTimesheetView | null> {
  try {
    // Fetch all periods for this contract
    const periods = await fetchPeriodsByContract(contractId);
    
    // Filter to specific month (only include weeks that START in this month)
    const monthStart = new Date(month + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    
    const monthPeriods = periods.filter(p => {
      const weekStart = new Date(p.weekStartDate);
      return weekStart >= monthStart && weekStart <= monthEnd;
    });
    
    if (monthPeriods.length === 0) {
      return null;
    }
    
    // Fetch contract for rate info
    const contract = await fetchContractById(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }
    
    // Aggregate totals
    const totalHours = monthPeriods.reduce((sum, p) => sum + (p.totalHours || 0), 0);
    const totalDays = monthPeriods.reduce((sum, p) => sum + (p.totalDays || 0), 0);
    
    // Calculate amount if rate is visible
    let totalAmount: number | null = null;
    if (!contract.hideRate) {
      if (contract.contractType === 'hourly' && contract.hourlyRate) {
        totalAmount = totalHours * contract.hourlyRate;
      } else if (contract.contractType === 'daily' && contract.dailyRate) {
        totalAmount = totalDays * contract.dailyRate;
      }
    }
    
    // Aggregate flags, tasks, attachments
    const aggregatedFlags: ReviewFlag[] = [];
    const aggregatedTasks: AllocatedTask[] = [];
    const allAttachments: Attachment[] = [];
    const combinedNotes: string[] = [];
    
    monthPeriods.forEach(period => {
      if (period.reviewFlags) aggregatedFlags.push(...period.reviewFlags);
      if (period.allocatedTasks) aggregatedTasks.push(...period.allocatedTasks);
      if (period.attachments) allAttachments.push(...period.attachments);
      if (period.contractorNotes) combinedNotes.push(period.contractorNotes);
    });
    
    // Determine overall monthly status
    let monthlyStatus: ApprovalStatus = 'approved';
    if (monthPeriods.some(p => p.status === 'rejected')) {
      monthlyStatus = 'rejected';
    } else if (monthPeriods.some(p => p.status === 'pending')) {
      monthlyStatus = 'pending';
    } else if (monthPeriods.some(p => p.status === 'changes_requested')) {
      monthlyStatus = 'changes_requested';
    }
    
    // Aggregate budget (if exists)
    const aggregatedBudget = monthPeriods.some(p => p.projectBudget)
      ? {
          allocated: monthPeriods.reduce((sum, p) => sum + (p.projectBudget?.allocated || 0), 0),
          spent: monthPeriods.reduce((sum, p) => sum + (p.projectBudget?.spent || 0), 0),
          monthPeriod: monthPeriods.reduce((sum, p) => sum + (p.projectBudget?.thisPeriod || 0), 0),
        }
      : null;
    
    return {
      contractId,
      month,
      monthStart: monthStart.toISOString().split('T')[0],
      monthEnd: monthEnd.toISOString().split('T')[0],
      weeks: monthPeriods,
      totalHours,
      totalDays,
      totalAmount,
      aggregatedFlags,
      aggregatedTasks,
      aggregatedBudget,
      monthlyStatus,
      allAttachments,
      combinedNotes,
    };
  } catch (err) {
    console.error('Unexpected error in fetchMonthlyView:', err);
    throw err;
  }
}

// ============================================================================
// APPROVAL ACTIONS (MUTATIONS) - Update real database periods
// ============================================================================

export async function approveTimesheet(
  periodId: string,
  approverId: string,
  approverName: string
): Promise<void> {
  try {
    // Update the period status to 'approved' in Supabase
    const { error } = await supabase
      .from('timesheet_periods')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', periodId);
    
    if (error) {
      console.error('Error approving timesheet:', error);
      throw new Error(`Failed to approve timesheet: ${error.message}`);
    }
    
    console.log(`✅ Approved period ${periodId}`);
  } catch (err) {
    console.error('Unexpected error in approveTimesheet:', err);
    throw err;
  }
}

export async function rejectTimesheet(
  periodId: string,
  approverId: string,
  approverName: string,
  reason: string
): Promise<void> {
  try {
    // Update the period status to 'rejected' in Supabase
    const { error } = await supabase
      .from('timesheet_periods')
      .update({ 
        status: 'rejected',
        // Note: You may want to add a rejection_reason column
      })
      .eq('id', periodId);
    
    if (error) {
      console.error('Error rejecting timesheet:', error);
      throw new Error(`Failed to reject timesheet: ${error.message}`);
    }
    
    console.log(`❌ Rejected period ${periodId}. Reason: ${reason}`);
  } catch (err) {
    console.error('Unexpected error in rejectTimesheet:', err);
    throw err;
  }
}

export async function bulkApproveTimesheets(
  periodIds: string[],
  approverId: string,
  approverName: string
): Promise<{ succeeded: string[]; failed: string[] }> {
  const succeeded: string[] = [];
  const failed: string[] = [];
  
  // Process in parallel (but with error isolation)
  await Promise.all(
    periodIds.map(async (periodId) => {
      try {
        await approveTimesheet(periodId, approverId, approverName);
        succeeded.push(periodId);
      } catch (err) {
        console.error(`Failed to approve period ${periodId}:`, err);
        failed.push(periodId);
      }
    })
  );
  
  return { succeeded, failed };
}

export async function bulkRejectTimesheets(
  periodIds: string[],
  approverId: string,
  approverName: string,
  reason: string
): Promise<{ succeeded: string[]; failed: string[] }> {
  const succeeded: string[] = [];
  const failed: string[] = [];
  
  await Promise.all(
    periodIds.map(async (periodId) => {
      try {
        await rejectTimesheet(periodId, approverId, approverName, reason);
        succeeded.push(periodId);
      } catch (err) {
        console.error(`Failed to reject period ${periodId}:`, err);
        failed.push(periodId);
      }
    })
  );
  
  return { succeeded, failed };
}

// ============================================================================
// HELPERS
// ============================================================================

export function formatContractRate(contract: ProjectContract): string {
  if (contract.hideRate) return 'Hidden';
  
  switch (contract.contractType) {
    case 'hourly':
      return contract.hourlyRate ? `$${contract.hourlyRate}/hr` : 'Not set';
    case 'daily':
      return contract.dailyRate ? `$${contract.dailyRate}/day` : 'Not set';
    case 'fixed':
      return contract.fixedAmount ? `$${contract.fixedAmount.toLocaleString()}` : 'Not set';
    default:
      return 'Custom';
  }
}

export function getStatusColor(status: ApprovalStatus): string {
  switch (status) {
    case 'approved':
      return 'text-green-600 bg-green-50';
    case 'rejected':
      return 'text-red-600 bg-red-50';
    case 'pending':
      return 'text-yellow-600 bg-yellow-50';
    case 'changes_requested':
      return 'text-orange-600 bg-orange-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}