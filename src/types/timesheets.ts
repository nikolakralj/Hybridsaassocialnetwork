/**
 * Timesheet Types - Production Ready
 * Extracted from demo data and consolidated for production use
 */

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export type OrganizationType = 'company' | 'agency' | 'freelancer';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  logo?: string;
}

// ============================================================================
// CONTRACTS
// ============================================================================

export type ContractType = 'hourly' | 'daily' | 'fixed' | 'custom';
export type ContractorRole = 'individual_contributor' | 'company_employee' | 'agency_contractor';

export interface ProjectContract {
  id: string;
  userId: string;
  userName: string;
  userRole: ContractorRole;
  organizationId: string;
  projectId: string;
  contractType: ContractType;
  rate: number; // Unified rate field
  hourlyRate?: number;
  dailyRate?: number;
  fixedAmount?: number;
  hideRate?: boolean; // Role-based rate visibility
  startDate: string;
  endDate?: string;
}

// ============================================================================
// APPROVAL STATUS & FLAGS
// ============================================================================

// Database status values (matches Postgres CHECK constraint)
export type ApprovalStatus = 
  | 'draft' 
  | 'submitted' 
  | 'manager_approved' 
  | 'client_approved' 
  | 'fully_approved' 
  | 'rejected'
  // Legacy values for backward compatibility
  | 'pending' 
  | 'approved' 
  | 'changes_requested';

export interface ReviewFlag {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AllocatedTask {
  id: string;
  name: string;
  allocatedHours: number;
  loggedHours: number;
  status: 'on_track' | 'over' | 'under' | 'not_started';
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
  size: number; // bytes
}

// ============================================================================
// TIMESHEET PERIODS (WEEKLY)
// ============================================================================

export interface TimesheetPeriod {
  id: string;
  contractId: string;
  weekStartDate: string; // ISO date (Monday)
  weekEndDate: string; // ISO date (Sunday)
  totalHours: number;
  totalDays?: number;
  totalAmount?: number; // Calculated amount for this period
  status: ApprovalStatus;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  approvalHistory: ApprovalHistoryEntry[];
  
  // Enhanced approval context
  contractorNotes?: string;
  attachments?: Attachment[];
  reviewFlags?: ReviewFlag[];
  allocatedTasks?: AllocatedTask[];
  projectBudget?: {
    allocated: number;
    spent: number;
    thisPeriod: number;
  };
  
  // Entries for this period (populated when needed for drawer)
  entries?: TimesheetEntry[];
}

export interface ApprovalHistoryEntry {
  timestamp: string;
  actor: string;
  action: 'submitted' | 'approved' | 'rejected' | 'changes_requested';
  comment?: string;
}

// ============================================================================
// TIMESHEET ENTRIES (DAILY)
// ============================================================================

export interface TimesheetEntry {
  id: string;
  periodId: string;
  date: string; // ISO date
  hours?: number;
  days?: number;
  taskDescription: string;
  billable: boolean;
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  breakMinutes?: number;
  notes?: string;
}

// ============================================================================
// MONTHLY AGGREGATION
// ============================================================================

export interface MonthlyTimesheetView {
  contractId: string;
  month: string; // YYYY-MM format
  monthStart: string; // First day of month (ISO date)
  monthEnd: string; // Last day of month (ISO date)
  weeks: TimesheetPeriod[];
  totalHours: number;
  totalDays: number;
  totalAmount: number | null;
  aggregatedFlags: ReviewFlag[];
  aggregatedTasks: AllocatedTask[];
  aggregatedBudget: {
    allocated: number;
    spent: number;
    monthPeriod: number;
  } | null;
  monthlyStatus: ApprovalStatus; // Overall status
  allAttachments: Attachment[];
  combinedNotes: string[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface TimesheetStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  changesRequested?: number;
}

export interface ContractWithPeriods extends ProjectContract {
  periods: TimesheetPeriod[];
  currentPeriod?: TimesheetPeriod;
  monthlyView?: MonthlyTimesheetView;
}

export interface OrganizationWithContracts extends Organization {
  contracts: ContractWithPeriods[];
  stats: TimesheetStats;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export type OrganizationFilter = 'all' | string; // 'all' or specific org ID
export type StatusFilter = 'all' | ApprovalStatus;
export type RoleFilter = 'all' | ContractorRole;

export interface TimesheetFilters {
  organization: OrganizationFilter;
  status: StatusFilter;
  role: RoleFilter;
  dateRange?: {
    start: string;
    end: string;
  };
}