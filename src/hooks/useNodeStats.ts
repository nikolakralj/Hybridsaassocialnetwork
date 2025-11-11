/**
 * useNodeStats Hook
 * 
 * Fetches real-time statistics for nodes in the WorkGraph
 * - Person nodes: hours worked, pending timesheets, last activity
 * - Party nodes: employee count, contract count, total hours
 * - Contract nodes: usage stats, workers, billing totals
 * 
 * Phase 5: Database Integration ✅
 * ✅ Now synced with selected month from MonthContext
 */

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { useMonthContextSafe } from '../contexts/MonthContext';
import type { BaseNode } from '../types/workgraph';

// Database types (from our schema)
interface TimesheetPeriod {
  id: string;
  total_hours: number;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  submitted_at: string | null;
  week_start_date: string;
}

interface TimesheetEntry {
  hours: number;
  days: number | null;
  date: string;
}

interface ProjectContract {
  id: string;
  user_id: string;
  user_name: string;
  organization_id: string;
  hourly_rate: number | null;
  daily_rate: number | null;
}

export interface PersonStats {
  totalHoursWorked: number;
  totalHoursThisMonth: number;
  lastTimesheetSubmitted: Date | null;
  pendingTimesheets: number;
  currentWeekHours: number;
  currentMonthHours: number;
  weeklyLimit: number;
  monthlyLimit: number;
}

export interface PartyStats {
  totalEmployees: number;
  activeWorkers: number;
  totalContracts: number;
  totalHoursThisMonth: number;
  lastActivity: Date | null;
  employeeNames: string[];
  contractNames: string[];
}

export interface ContractStats {
  totalHoursWorked: number;
  totalAmountBilled: number;
  currentWeekHours: number;
  currentMonthHours: number;
  budgetUtilization: number;
  workersCount: number;
  workerNames: string[];
}

export interface ApprovalEdgeStats {
  totalApprovals: number;
  approved: number;
  rejected: number;
  averageApprovalTimeHours: number;
}

type NodeStats = PersonStats | PartyStats | ContractStats | null;

export function useNodeStats(
  node: BaseNode | null,
  allNodes: BaseNode[],
  allEdges: any[]
): {
  stats: NodeStats;
  loading: boolean;
  error: Error | null;
} {
  const [stats, setStats] = useState<NodeStats>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { selectedMonth } = useMonthContextSafe();

  useEffect(() => {
    if (!node) {
      setStats(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Simulate async data fetching
    // In Phase 5, this will be replaced with real Supabase queries
    const fetchStats = async () => {
      try {
        let nodeStats: NodeStats = null;

        if (node.type === 'person') {
          nodeStats = await fetchPersonStats(node, allNodes, allEdges, selectedMonth);
        } else if (node.type === 'party') {
          nodeStats = await fetchPartyStats(node, allNodes, allEdges, selectedMonth);
        } else if (node.type === 'contract') {
          nodeStats = await fetchContractStats(node, allNodes, allEdges, selectedMonth);
        }

        setStats(nodeStats);
        setError(null); // Clear error on success
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError(err as Error);
        // Set default stats so UI doesn't break
        if (node.type === 'person') {
          setStats(getDefaultPersonStats());
        } else if (node.type === 'party') {
          setStats({
            totalEmployees: 0,
            activeWorkers: 0,
            totalContracts: 0,
            totalHoursThisMonth: 0,
            lastActivity: null,
            employeeNames: [],
            contractNames: [],
          });
        } else if (node.type === 'contract') {
          setStats(getDefaultContractStats([], 0, 40, 160));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [node, allNodes, allEdges, selectedMonth]);

  return { stats, loading, error };
}

// Real database implementation - Phase 5 ✅
// ✅ Now accepts selectedMonth parameter to show stats for the viewing month
async function fetchPersonStats(
  node: BaseNode,
  allNodes: BaseNode[],
  allEdges: any[],
  selectedMonth: Date = new Date()
): Promise<PersonStats> {
  const supabase = createClient();
  
  try {
    // Map node ID to user_id (for real data, node.id should match user_id)
    // For testing with mock data, we'll use node.data?.userId or fall back to node.id
    const userId = node.data?.userId || node.id;
    
    // 1. Get all contracts for this user
    const { data: contracts, error: contractsError } = await supabase
      .from('project_contracts')
      .select('id, user_id, user_name')
      .eq('user_id', userId);
    
    if (contractsError) {
      // Check if error is due to missing table
      if (contractsError.code === 'PGRST205' || contractsError.message?.includes('not find')) {
        console.error('⚠️ DATABASE NOT SETUP: Tables do not exist.');
        console.error('📖 Please run the database migrations. See /docs/DATABASE_SETUP.md');
        console.error('🔗 Or visit: /setup');
        // Throw error so it's caught by the UI
        throw new Error(`PGRST205: ${contractsError.message}`);
      }
      
      console.error('Error fetching contracts:', contractsError);
      throw new Error(`Database error: ${contractsError.message}`);
    }
    
    if (!contracts || contracts.length === 0) {
      console.warn('No contracts found for user:', userId);
      return getDefaultPersonStats();
    }
    
    const contractIds = contracts.map(c => c.id);
    
    // 2. Get all timesheet periods for these contracts
    const { data: periods, error: periodsError } = await supabase
      .from('timesheet_periods')
      .select('id, total_hours, status, submitted_at, week_start_date')
      .in('contract_id', contractIds);
    
    if (periodsError) {
      if (periodsError.code === 'PGRST205' || periodsError.message?.includes('not find')) {
        console.error('⚠️ DATABASE NOT SETUP: timesheet_periods table does not exist.');
        console.error('📖 See /docs/DATABASE_SETUP.md for setup instructions');
        console.error('🔗 Or visit: /setup');
        return getDefaultPersonStats();
      }
      
      console.error('Error fetching periods:', periodsError);
      return getDefaultPersonStats();
    }
    
    // 3. Calculate stats based on selectedMonth instead of current month
    const viewingMonth = selectedMonth.getMonth();
    const viewingYear = selectedMonth.getFullYear();
    
    // Get current week start (Monday) for the viewing month
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay() + 1);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    let totalHours = 0;
    let currentMonthHours = 0;
    let currentWeekHours = 0;
    let lastSubmitted: Date | null = null;
    let pendingCount = 0;
    
    periods?.forEach(period => {
      const hours = parseFloat(period.total_hours?.toString() || '0');
      totalHours += hours;
      
      // Check if period is in viewing month
      const weekStart = new Date(period.week_start_date);
      if (weekStart.getMonth() === viewingMonth && weekStart.getFullYear() === viewingYear) {
        currentMonthHours += hours;
      }
      
      // Check if period is in current week (still use actual current week for this)
      if (weekStart >= currentWeekStart) {
        currentWeekHours += hours;
      }
      
      // Track latest submission
      if (period.submitted_at) {
        const submitted = new Date(period.submitted_at);
        if (!lastSubmitted || submitted > lastSubmitted) {
          lastSubmitted = submitted;
        }
      }
      
      // Count pending
      if (period.status === 'pending') {
        pendingCount++;
      }
    });
    
    return {
      totalHoursWorked: totalHours,
      totalHoursThisMonth: currentMonthHours,
      lastTimesheetSubmitted: lastSubmitted,
      pendingTimesheets: pendingCount,
      currentWeekHours,
      currentMonthHours,
      weeklyLimit: 40, // TODO: Get from contract
      monthlyLimit: 160, // TODO: Get from contract
    };
  } catch (error) {
    console.error('Error in fetchPersonStats:', error);
    return getDefaultPersonStats();
  }
}

function getDefaultPersonStats(): PersonStats {
  return {
    totalHoursWorked: 0,
    totalHoursThisMonth: 0,
    lastTimesheetSubmitted: null,
    pendingTimesheets: 0,
    currentWeekHours: 0,
    currentMonthHours: 0,
    weeklyLimit: 40,
    monthlyLimit: 160,
  };
}

// Real database implementation for Party stats
async function fetchPartyStats(
  node: BaseNode,
  allNodes: BaseNode[],
  allEdges: any[],
  selectedMonth: Date = new Date()
): Promise<PartyStats> {
  const supabase = createClient();
  
  // Count employees from graph (people this party employs)
  const employeeEdges = allEdges.filter(
    e => e.source === node.id && e.data?.edgeType === 'employs'
  );
  const employees = allNodes.filter(n =>
    employeeEdges.some(e => e.target === n.id)
  );

  // Count contracts from graph (contracts where this party is A or B)
  const contracts = allNodes.filter(
    n => n.type === 'contract' &&
      (n.data?.parties?.partyA === node.id || n.data?.parties?.partyB === node.id)
  );
  
  try {
    // Map node ID to organization_id
    const orgId = node.data?.organizationId || node.id;
    
    // Get contracts from database for this organization
    const { data: dbContracts, error: contractsError } = await supabase
      .from('project_contracts')
      .select('id, user_name')
      .eq('organization_id', orgId);
    
    if (contractsError) {
      console.error('Error fetching party contracts:', contractsError);
    }
    
    const contractIds = dbContracts?.map(c => c.id) || [];
    
    let totalHoursThisMonth = 0;
    let lastActivity: Date | null = null;
    
    if (contractIds.length > 0) {
      // Get all periods for these contracts
      const { data: periods, error: periodsError } = await supabase
        .from('timesheet_periods')
        .select('total_hours, submitted_at, week_start_date')
        .in('contract_id', contractIds);
      
      if (!periodsError && periods) {
        const viewingMonth = selectedMonth.getMonth();
        const viewingYear = selectedMonth.getFullYear();
        
        periods.forEach(period => {
          // Sum hours for viewing month
          const weekStart = new Date(period.week_start_date);
          if (weekStart.getMonth() === viewingMonth && weekStart.getFullYear() === viewingYear) {
            totalHoursThisMonth += parseFloat(period.total_hours?.toString() || '0');
          }
          
          // Track latest activity
          if (period.submitted_at) {
            const submitted = new Date(period.submitted_at);
            if (!lastActivity || submitted > lastActivity) {
              lastActivity = submitted;
            }
          }
        });
      }
    }
    
    return {
      totalEmployees: employees.length,
      activeWorkers: employees.length,
      totalContracts: contracts.length,
      totalHoursThisMonth,
      lastActivity,
      employeeNames: employees.map(e => e.data?.name || 'Unnamed'),
      contractNames: contracts.map(c => c.data?.name || 'Unnamed Contract'),
    };
  } catch (error) {
    console.error('Error in fetchPartyStats:', error);
    // Return graph-based stats even if DB query fails
    return {
      totalEmployees: employees.length,
      activeWorkers: employees.length,
      totalContracts: contracts.length,
      totalHoursThisMonth: 0,
      lastActivity: null,
      employeeNames: employees.map(e => e.data?.name || 'Unnamed'),
      contractNames: contracts.map(c => c.data?.name || 'Unnamed Contract'),
    };
  }
}

// Real database implementation for Contract stats
async function fetchContractStats(
  node: BaseNode,
  allNodes: BaseNode[],
  allEdges: any[],
  selectedMonth: Date = new Date()
): Promise<ContractStats> {
  const supabase = createClient();
  
  // Find workers from graph
  const partyA = node.data?.parties?.partyA;
  const partyB = node.data?.parties?.partyB;
  
  const workers = allNodes.filter(n => {
    if (n.type !== 'person') return false;
    
    // Check if person is employed by party A or B
    const employedBy = allEdges.find(
      e => e.target === n.id && e.data?.edgeType === 'employs'
    );
    
    return employedBy && (employedBy.source === partyA || employedBy.source === partyB);
  });

  const hourlyRate = node.data?.hourlyRate || 0;
  const weeklyLimit = node.data?.weeklyHourLimit || 40;
  const monthlyLimit = node.data?.monthlyHourLimit || 160;
  
  try {
    // Map node ID to contract_id
    const contractId = node.data?.contractId || node.id;
    
    // Get all periods for this contract
    const { data: periods, error: periodsError } = await supabase
      .from('timesheet_periods')
      .select('id, total_hours, week_start_date')
      .eq('contract_id', contractId);
    
    if (periodsError) {
      console.error('Error fetching contract periods:', periodsError);
      return getDefaultContractStats(workers, hourlyRate, weeklyLimit, monthlyLimit);
    }
    
    if (!periods || periods.length === 0) {
      console.warn('No periods found for contract:', contractId);
      return getDefaultContractStats(workers, hourlyRate, weeklyLimit, monthlyLimit);
    }
    
    // Calculate stats
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay() + 1);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    let totalHours = 0;
    let currentMonthHours = 0;
    let currentWeekHours = 0;
    
    periods.forEach(period => {
      const hours = parseFloat(period.total_hours?.toString() || '0');
      totalHours += hours;
      
      const weekStart = new Date(period.week_start_date);
      
      // Current month
      if (weekStart.getMonth() === currentMonth && weekStart.getFullYear() === currentYear) {
        currentMonthHours += hours;
      }
      
      // Current week
      if (weekStart >= currentWeekStart) {
        currentWeekHours += hours;
      }
    });
    
    const totalBilled = totalHours * hourlyRate;
    const budgetUtilization = monthlyLimit > 0 ? (currentMonthHours / monthlyLimit) * 100 : 0;
    
    return {
      totalHoursWorked: totalHours,
      totalAmountBilled: totalBilled,
      currentWeekHours,
      currentMonthHours,
      budgetUtilization,
      workersCount: workers.length,
      workerNames: workers.map(w => w.data?.name || 'Unnamed'),
    };
  } catch (error) {
    console.error('Error in fetchContractStats:', error);
    return getDefaultContractStats(workers, hourlyRate, weeklyLimit, monthlyLimit);
  }
}

function getDefaultContractStats(
  workers: BaseNode[],
  hourlyRate: number,
  weeklyLimit: number,
  monthlyLimit: number
): ContractStats {
  return {
    totalHoursWorked: 0,
    totalAmountBilled: 0,
    currentWeekHours: 0,
    currentMonthHours: 0,
    budgetUtilization: 0,
    workersCount: workers.length,
    workerNames: workers.map(w => w.data?.name || 'Unnamed'),
  };
}

export function useEdgeStats(
  edge: any | null
): {
  stats: ApprovalEdgeStats | null;
  loading: boolean;
  error: Error | null;
} {
  const [stats, setStats] = useState<ApprovalEdgeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!edge || edge.data?.edgeType !== 'approves') {
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    const fetchStats = async () => {
      try {
        // TODO Phase 5: Replace with real query
        // const { data } = await supabase
        //   .from('approvals')
        //   .select('*')
        //   .eq('approver_id', edge.source);

        // Mock data for now
        await new Promise(resolve => setTimeout(resolve, 100));

        setStats({
          totalApprovals: 127,
          approved: 120,
          rejected: 7,
          averageApprovalTimeHours: 6,
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [edge]);

  return { stats, loading, error };
}

/**
 * Helper function to format time ago
 */
export function formatTimeAgo(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

/**
 * Helper function to format hours as progress
 */
export function formatHoursProgress(current: number, limit: number): string {
  const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;
  return `${current} / ${limit} hrs (${percentage}%)`;
}