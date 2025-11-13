/**
 * Demo Data for Multi-Party Approval Architecture Prototype
 * 
 * Organizations: 2 Companies + 3 Freelancers
 * Contracts: Mix of hourly, daily, fixed
 * Status Distribution: 60% pending, 30% approved, 10% rejected
 */

export type OrganizationType = 'company' | 'agency' | 'freelancer';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  logo?: string;
}

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
  hourlyRate?: number;
  dailyRate?: number;
  fixedAmount?: number;
  hideRate?: boolean; // Role-based rate visibility
  startDate: string;
  endDate?: string;
}

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

export interface TimesheetPeriod {
  id: string;
  contractId: string;
  weekStartDate: string; // ISO date (Monday)
  weekEndDate: string; // ISO date (Sunday)
  totalHours: number;
  totalDays?: number;
  totalAmount?: number; // Add total amount field
  status: ApprovalStatus;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  approvalHistory: ApprovalHistoryEntry[];
  
  // NEW: Enhanced approval context
  contractorNotes?: string;
  attachments?: Attachment[];
  reviewFlags?: ReviewFlag[];
  allocatedTasks?: AllocatedTask[];
  projectBudget?: {
    allocated: number;
    spent: number;
    thisPeriod: number;
  };
}

export interface ApprovalHistoryEntry {
  timestamp: string;
  actor: string;
  action: 'submitted' | 'approved' | 'rejected' | 'changes_requested';
  comment?: string;
}

export interface TimesheetEntry {
  id: string;
  periodId: string;
  date: string; // ISO date
  hours?: number;
  days?: number;
  taskCategory?: string; // e.g., "Development", "Design", "Meeting"
  taskDescription: string;
  workType?: 'regular' | 'overtime' | 'travel' | 'oncall';
  billable: boolean;
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  breakMinutes?: number;
  notes?: string;
}

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export const DEMO_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-company-1',
    name: 'Acme Dev Studio',
    type: 'company',
  },
  {
    id: 'org-company-2',
    name: 'BrightWorks Design',
    type: 'company',
  },
  {
    id: 'org-freelancer-1',
    name: 'Alex Chen (Freelancer)',
    type: 'freelancer',
  },
  {
    id: 'org-freelancer-2',
    name: 'Maria Rodriguez (Freelancer)',
    type: 'freelancer',
  },
  {
    id: 'org-freelancer-3',
    name: 'James Kim (Freelancer)',
    type: 'freelancer',
  },
];

// ============================================================================
// PROJECT CONTRACTS
// ============================================================================

export const DEMO_CONTRACTS: ProjectContract[] = [
  // Acme Dev Studio (15 people)
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `contract-acme-${i + 1}`,
    userId: `user-acme-${i + 1}`,
    userName: [
      'Sarah Johnson', 'Mike Chen', 'Emily Davis', 'Ryan Lee', 'Jessica Brown',
      'David Wilson', 'Laura Garcia', 'Tom Martinez', 'Nina Patel', 'Chris Anderson',
      'Sophie Taylor', 'Jake Moore', 'Olivia White', 'Ethan Harris', 'Ava Martin'
    ][i],
    userRole: 'company_employee' as ContractorRole,
    organizationId: 'org-company-1',
    projectId: 'project-main',
    contractType: i % 3 === 0 ? 'daily' : i % 5 === 0 ? 'fixed' : 'hourly',
    hourlyRate: i % 5 !== 0 ? 85 + (i * 5) : undefined,
    dailyRate: i % 3 === 0 ? 680 + (i * 20) : undefined,
    fixedAmount: i % 5 === 0 ? 50000 + (i * 2000) : undefined,
    hideRate: false,
    startDate: '2025-01-01',
  })),

  // BrightWorks Design (7 people)
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `contract-bright-${i + 1}`,
    userId: `user-bright-${i + 1}`,
    userName: [
      'Zoe Cooper', 'Marcus Lewis', 'Priya Sharma', 'Lucas Miller',
      'Isabella Clark', 'Owen Turner', 'Mia Rodriguez'
    ][i],
    userRole: 'company_employee' as ContractorRole,
    organizationId: 'org-company-2',
    projectId: 'project-main',
    contractType: i % 2 === 0 ? 'hourly' : 'daily',
    hourlyRate: i % 2 === 0 ? 95 + (i * 10) : undefined,
    dailyRate: i % 2 === 1 ? 760 + (i * 30) : undefined,
    hideRate: false,
    startDate: '2025-01-01',
  })),

  // Freelancers (3 people)
  {
    id: 'contract-freelancer-1',
    userId: 'user-freelancer-1',
    userName: 'Alex Chen',
    userRole: 'individual_contributor',
    organizationId: 'org-freelancer-1',
    projectId: 'project-main',
    contractType: 'hourly',
    hourlyRate: 125,
    hideRate: false,
    startDate: '2025-01-01',
  },
  {
    id: 'contract-freelancer-2',
    userId: 'user-freelancer-2',
    userName: 'Maria Rodriguez',
    userRole: 'individual_contributor',
    organizationId: 'org-freelancer-2',
    projectId: 'project-main',
    contractType: 'daily',
    dailyRate: 950,
    hideRate: false,
    startDate: '2025-01-01',
  },
  {
    id: 'contract-freelancer-3',
    userId: 'user-freelancer-3',
    userName: 'James Kim',
    userRole: 'individual_contributor',
    organizationId: 'org-freelancer-3',
    projectId: 'project-main',
    contractType: 'fixed',
    fixedAmount: 35000,
    hideRate: false,
    startDate: '2025-01-01',
  },
];

// ============================================================================
// TIMESHEET PERIODS (realistic status distribution)
// ============================================================================

const getWeekDates = (weeksAgo: number) => {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1 - (weeksAgo * 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
};

const createPeriod = (
  contractId: string,
  weeksAgo: number,
  status: ApprovalStatus,
  hours: number
): TimesheetPeriod => {
  const { start, end } = getWeekDates(weeksAgo);
  const history: ApprovalHistoryEntry[] = [
    {
      timestamp: new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000).toISOString(),
      actor: 'System',
      action: 'submitted',
    },
  ];

  if (status === 'approved') {
    history.push({
      timestamp: new Date(Date.now() - (weeksAgo * 7 - 1) * 24 * 60 * 60 * 1000).toISOString(),
      actor: 'Project Manager',
      action: 'approved',
    });
  } else if (status === 'rejected') {
    history.push({
      timestamp: new Date(Date.now() - (weeksAgo * 7 - 1) * 24 * 60 * 60 * 1000).toISOString(),
      actor: 'Project Manager',
      action: 'rejected',
      comment: 'Please provide more detail on task descriptions',
    });
  }

  // Generate review flags for pending items
  const reviewFlags: ReviewFlag[] = [];
  if (status === 'pending') {
    if (hours > 45) {
      reviewFlags.push({
        id: `flag-${contractId}-overtime`,
        type: 'warning',
        message: `${hours} hours logged (exceeds typical 40hr week)`,
        severity: 'medium',
      });
    }
    if (Math.random() > 0.7) {
      reviewFlags.push({
        id: `flag-${contractId}-weekend`,
        type: 'info',
        message: 'Weekend work detected (Saturday 6 hours)',
        severity: 'low',
      });
    }
  }

  // Generate allocated tasks
  const allocatedTasks: AllocatedTask[] = [
    {
      id: `task-${contractId}-1`,
      name: 'User Dashboard Development',
      allocatedHours: hours * 0.7,
      loggedHours: hours * 0.65,
      status: 'on_track',
    },
    {
      id: `task-${contractId}-2`,
      name: 'API Integration',
      allocatedHours: hours * 0.2,
      loggedHours: hours * 0.25,
      status: 'over',
    },
    {
      id: `task-${contractId}-3`,
      name: 'Bug Fixes',
      allocatedHours: hours * 0.1,
      loggedHours: hours * 0.1,
      status: 'on_track',
    },
  ];

  // Attachments - only for some pending items
  const attachments: Attachment[] = [];
  if (status === 'pending' && Math.random() > 0.5) {
    attachments.push({
      id: `attach-${contractId}-1`,
      name: 'Signed_Timesheet_Jan2025.pdf',
      type: 'application/pdf',
      url: '#',
      uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      size: 245760, // 240 KB
    });
  }

  // Contractor notes
  const contractorNotes = status === 'pending' && Math.random() > 0.6
    ? 'Spent additional time on API integration due to unexpected dependency issues. Weekend work was pre-approved by PM for Monday deadline.'
    : undefined;

  // Project budget context
  const projectBudget = {
    allocated: 480, // Total project hours
    spent: 320 + hours, // Previous weeks + this period
    thisPeriod: hours,
  };

  // Calculate total amount based on contract type
  const contract = DEMO_CONTRACTS.find(c => c.id === contractId);
  let totalAmount: number | undefined = undefined;
  if (contract) {
    if (contract.contractType === 'hourly' && contract.hourlyRate) {
      totalAmount = hours * contract.hourlyRate;
    } else if (contract.contractType === 'daily' && contract.dailyRate) {
      totalAmount = (hours / 8) * contract.dailyRate;
    } else if (contract.contractType === 'fixed' && contract.fixedAmount) {
      totalAmount = contract.fixedAmount / 4; // Divide by 4 weeks
    }
  }

  return {
    id: `period-${contractId}-w${weeksAgo}`,
    contractId,
    weekStartDate: start,
    weekEndDate: end,
    totalHours: hours,
    totalDays: hours / 8,
    totalAmount, // Add calculated amount
    status,
    submittedAt: new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000).toISOString(),
    approvedAt: status === 'approved' ? new Date(Date.now() - (weeksAgo * 7 - 1) * 24 * 60 * 60 * 1000).toISOString() : undefined,
    approvalHistory: history,
    contractorNotes,
    attachments: attachments.length > 0 ? attachments : undefined,
    reviewFlags: reviewFlags.length > 0 ? reviewFlags : undefined,
    allocatedTasks,
    projectBudget,
  } as any; // Type assertion to allow totalAmount field
};

// Generate periods for all contracts
// Generate 4 weeks per contract for monthly view (current month)
// Status distribution: 60% pending, 30% approved, 10% rejected
export const DEMO_PERIODS: TimesheetPeriod[] = DEMO_CONTRACTS.flatMap((contract, contractIndex) => {
  // Generate 4 weeks for each contract
  return [0, 1, 2, 3].map(weeksAgo => {
    const statusPattern = (contractIndex + weeksAgo) % 10;
    let status: ApprovalStatus;
    
    if (statusPattern < 6) status = 'pending'; // 60%
    else if (statusPattern < 9) status = 'approved'; // 30%
    else status = 'rejected'; // 10%

    const hours = 32 + ((contractIndex + weeksAgo) % 8) * 2; // Varying hours between 32-46

    return createPeriod(contract.id, weeksAgo, status, hours);
  });
});

// ============================================================================
// TIMESHEET ENTRIES (sample for detail view)
// ============================================================================

export const DEMO_ENTRIES: TimesheetEntry[] = DEMO_PERIODS.flatMap(period => {
  const contract = DEMO_CONTRACTS.find(c => c.id === period.contractId);
  const startDate = new Date(period.weekStartDate);
  
  return Array.from({ length: 5 }, (_, dayIndex) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + dayIndex);
    
    const dailyHours = contract?.contractType === 'daily' ? undefined : 6 + Math.random() * 3;
    const startHour = 8 + Math.floor(Math.random() * 2); // Start between 8-9am
    const endHour = startHour + Math.ceil(dailyHours || 8) + 1; // Add break hour
    
    const taskData = [
      { category: 'Development', desc: 'Frontend development - User dashboard', workType: 'regular' as const },
      { category: 'Development', desc: 'Backend API integration', workType: 'regular' as const },
      { category: 'Design', desc: 'Design system components', workType: 'regular' as const },
      { category: 'Testing', desc: 'Testing and bug fixes', workType: 'regular' as const },
      { category: 'Code Review', desc: 'Code review and documentation', workType: 'overtime' as const }
    ][dayIndex];
    
    return {
      id: `entry-${period.id}-day${dayIndex}`,
      periodId: period.id,
      date: date.toISOString().split('T')[0],
      hours: dailyHours,
      days: contract?.contractType === 'daily' ? 1 : undefined,
      taskCategory: taskData.category,
      taskDescription: taskData.desc,
      workType: taskData.workType,
      billable: true,
      startTime: contract?.contractType === 'hourly' ? `${startHour.toString().padStart(2, '0')}:00` : undefined,
      endTime: contract?.contractType === 'hourly' ? `${endHour.toString().padStart(2, '0')}:00` : undefined,
      breakMinutes: contract?.contractType === 'hourly' ? (30 + Math.floor(Math.random() * 3) * 15) : undefined, // 30, 45, or 60 min breaks
      notes: dayIndex === 4 ? 'Completed weekly sprint tasks and code review.' : undefined,
    };
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getOrganization(orgId: string): Organization | undefined {
  return DEMO_ORGANIZATIONS.find(o => o.id === orgId);
}

export function getContractsByOrganization(orgId: string): ProjectContract[] {
  return DEMO_CONTRACTS.filter(c => c.organizationId === orgId);
}

export function getPeriodsByContract(contractId: string): TimesheetPeriod[] {
  return DEMO_PERIODS.filter(p => p.contractId === contractId);
}

export function getEntriesByPeriod(periodId: string): TimesheetEntry[] {
  return DEMO_ENTRIES.filter(e => e.periodId === periodId);
}

export function formatContractRate(contract: ProjectContract): string {
  if (contract.hideRate) return 'Hidden';
  
  switch (contract.contractType) {
    case 'hourly':
      return `$${contract.hourlyRate}/hr`;
    case 'daily':
      return `$${contract.dailyRate}/day`;
    case 'fixed':
      return `$${contract.fixedAmount?.toLocaleString()} fixed`;
    default:
      return 'Custom';
  }
}

// ============================================================================
// MONTHLY AGGREGATION (NEW)
// ============================================================================

export interface MonthlyTimesheetView {
  contractId: string;
  monthStart: string; // First Monday of first week
  monthEnd: string; // Last Sunday of last week
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

/**
 * Group weekly periods by contract and aggregate into monthly view
 */
export function getMonthlyViewByContract(contractId: string): MonthlyTimesheetView | null {
  const periods = getPeriodsByContract(contractId).sort((a, b) => 
    new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime()
  );
  
  if (periods.length === 0) return null;

  const contract = DEMO_CONTRACTS.find(c => c.id === contractId);
  if (!contract) return null;

  // Calculate totals
  const totalHours = periods.reduce((sum, p) => sum + p.totalHours, 0);
  const totalDays = periods.reduce((sum, p) => sum + (p.totalDays || 0), 0);
  
  // Calculate total amount based on contract type
  let totalAmount: number | null = null;
  if (contract.contractType === 'hourly' && contract.hourlyRate) {
    totalAmount = totalHours * contract.hourlyRate;
  } else if (contract.contractType === 'daily' && contract.dailyRate) {
    totalAmount = totalDays * contract.dailyRate;
  } else if (contract.contractType === 'fixed' && contract.fixedAmount) {
    totalAmount = contract.fixedAmount;
  }

  // Aggregate review flags (deduplicate by message)
  const flagMap = new Map<string, ReviewFlag>();
  periods.forEach(p => {
    p.reviewFlags?.forEach(flag => {
      if (!flagMap.has(flag.message)) {
        flagMap.set(flag.message, flag);
      }
    });
  });
  const aggregatedFlags = Array.from(flagMap.values());

  // Aggregate tasks across all weeks
  const taskMap = new Map<string, AllocatedTask>();
  periods.forEach(p => {
    p.allocatedTasks?.forEach(task => {
      const existing = taskMap.get(task.name);
      if (existing) {
        existing.allocatedHours += task.allocatedHours;
        existing.loggedHours += task.loggedHours;
        // Recalculate status
        const variance = existing.loggedHours - existing.allocatedHours;
        const variancePercent = Math.abs(variance / existing.allocatedHours);
        if (variancePercent > 0.15) {
          existing.status = variance > 0 ? 'over' : 'under';
        } else {
          existing.status = 'on_track';
        }
      } else {
        taskMap.set(task.name, { ...task });
      }
    });
  });
  const aggregatedTasks = Array.from(taskMap.values());

  // Aggregate budget
  let aggregatedBudget = null;
  if (periods[0]?.projectBudget) {
    const monthHours = totalHours;
    aggregatedBudget = {
      allocated: periods[0].projectBudget.allocated,
      spent: periods[0].projectBudget.spent - periods[0].projectBudget.thisPeriod + monthHours,
      monthPeriod: monthHours,
    };
  }

  // Determine overall monthly status
  const hasRejected = periods.some(p => p.status === 'rejected');
  const hasPending = periods.some(p => p.status === 'pending');
  const allApproved = periods.every(p => p.status === 'approved');
  
  let monthlyStatus: ApprovalStatus;
  if (hasRejected) monthlyStatus = 'rejected';
  else if (hasPending) monthlyStatus = 'pending';
  else if (allApproved) monthlyStatus = 'approved';
  else monthlyStatus = 'pending';

  // Collect all attachments
  const allAttachments = periods
    .flatMap(p => p.attachments || [])
    .map((att, idx) => ({
      ...att,
      name: att.name.replace('.pdf', `_Week${idx + 1}.pdf`), // Add week identifier
    }));

  // Collect all notes
  const combinedNotes = periods
    .map((p, idx) => p.contractorNotes ? `Week ${idx + 1}: ${p.contractorNotes}` : null)
    .filter(Boolean) as string[];

  return {
    contractId,
    monthStart: periods[0].weekStartDate,
    monthEnd: periods[periods.length - 1].weekEndDate,
    weeks: periods,
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
}

/**
 * Get current week's period for table display (most recent)
 */
export function getCurrentWeekPeriodByContract(contractId: string): TimesheetPeriod | null {
  const periods = getPeriodsByContract(contractId).sort((a, b) => 
    new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
  );
  
  return periods[0] || null;
}