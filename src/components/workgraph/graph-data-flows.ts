/**
 * Graph Data Flows
 * 
 * Defines what data circulates through each edge in the graph,
 * with monthly snapshots showing personnel changes and activity.
 * 
 * Types of data that flow:
 * - Timesheets (hours submitted → approved → invoiced)
 * - NDAs (bilateral between connected parties)
 * - Contracts (between signatories)
 * - Invoices (org → client)
 * - Compliance docs (certifications, background checks)
 */

// ============================================================================
// Types
// ============================================================================

export type FlowItemType = 
  | 'timesheet'
  | 'nda'
  | 'contract'
  | 'invoice'
  | 'compliance'
  | 'approval'
  | 'payment';

export type FlowStatus = 
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'signed'
  | 'expired'
  | 'paid';

export interface DataFlowItem {
  id: string;
  type: FlowItemType;
  label: string;
  status: FlowStatus;
  amount?: number;
  hours?: number;
  date: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface MonthlySnapshot {
  month: string; // YYYY-MM
  label: string; // "Nov 2025"
  // Which people are active on the project this month
  activePeople: {
    personId: string;
    orgId: string;
    hoursSubmitted: number;
    hoursApproved: number;
    status: 'active' | 'onboarding' | 'offboarding' | 'inactive';
  }[];
  // Data items flowing through the graph this month
  flows: DataFlowItem[];
  // Summary stats
  stats: {
    totalHoursSubmitted: number;
    totalHoursApproved: number;
    totalAmountInvoiced: number;
    pendingApprovals: number;
    activeContracts: number;
    activeNDAs: number;
  };
}

export interface EdgeFlowSummary {
  edgeId: string;
  flows: {
    type: FlowItemType;
    count: number;
    pendingCount: number;
    label: string;
  }[];
  totalItems: number;
  hasAlerts: boolean;
}

// ============================================================================
// Mock monthly snapshots (realistic demo data)
// ============================================================================

export const MONTHLY_SNAPSHOTS: MonthlySnapshot[] = [
  {
    month: '2025-09',
    label: 'Sep 2025',
    activePeople: [
      { personId: 'user-sarah', orgId: 'org-acme', hoursSubmitted: 160, hoursApproved: 160, status: 'active' },
      { personId: 'user-mike', orgId: 'org-acme', hoursSubmitted: 152, hoursApproved: 152, status: 'active' },
      { personId: 'user-emily', orgId: 'org-acme', hoursSubmitted: 168, hoursApproved: 168, status: 'active' },
      { personId: 'user-sophia', orgId: 'org-brightworks', hoursSubmitted: 120, hoursApproved: 120, status: 'active' },
      { personId: 'user-oliver', orgId: 'org-brightworks', hoursSubmitted: 88, hoursApproved: 88, status: 'active' },
      { personId: 'user-alex', orgId: '_freelancer', hoursSubmitted: 80, hoursApproved: 80, status: 'active' },
    ],
    flows: [
      { id: 'f-sep-1', type: 'timesheet', label: 'Sep timesheets (Acme)', status: 'approved', hours: 480, fromNodeId: 'org-acme', toNodeId: 'client-company', date: '2025-09-30' },
      { id: 'f-sep-2', type: 'timesheet', label: 'Sep timesheets (BW)', status: 'approved', hours: 208, fromNodeId: 'org-brightworks', toNodeId: 'client-company', date: '2025-09-30' },
      { id: 'f-sep-3', type: 'invoice', label: 'Acme Sep invoice', status: 'paid', amount: 72000, fromNodeId: 'org-acme', toNodeId: 'client-company', date: '2025-10-05' },
      { id: 'f-sep-4', type: 'invoice', label: 'BW Sep invoice', status: 'paid', amount: 41600, fromNodeId: 'org-brightworks', toNodeId: 'client-company', date: '2025-10-05' },
    ],
    stats: {
      totalHoursSubmitted: 768,
      totalHoursApproved: 768,
      totalAmountInvoiced: 113600,
      pendingApprovals: 0,
      activeContracts: 2,
      activeNDAs: 4,
    },
  },
  {
    month: '2025-10',
    label: 'Oct 2025',
    activePeople: [
      { personId: 'user-sarah', orgId: 'org-acme', hoursSubmitted: 168, hoursApproved: 168, status: 'active' },
      { personId: 'user-mike', orgId: 'org-acme', hoursSubmitted: 160, hoursApproved: 160, status: 'active' },
      { personId: 'user-emily', orgId: 'org-acme', hoursSubmitted: 160, hoursApproved: 160, status: 'active' },
      { personId: 'user-robert', orgId: 'org-acme', hoursSubmitted: 80, hoursApproved: 80, status: 'onboarding' },
      { personId: 'user-sophia', orgId: 'org-brightworks', hoursSubmitted: 120, hoursApproved: 120, status: 'active' },
      { personId: 'user-oliver', orgId: 'org-brightworks', hoursSubmitted: 96, hoursApproved: 96, status: 'active' },
      { personId: 'user-emma', orgId: 'org-brightworks', hoursSubmitted: 40, hoursApproved: 40, status: 'onboarding' },
      { personId: 'user-alex', orgId: '_freelancer', hoursSubmitted: 88, hoursApproved: 88, status: 'active' },
      { personId: 'user-jordan', orgId: '_freelancer', hoursSubmitted: 60, hoursApproved: 40, status: 'onboarding' },
    ],
    flows: [
      { id: 'f-oct-1', type: 'timesheet', label: 'Oct timesheets (Acme)', status: 'approved', hours: 568, fromNodeId: 'org-acme', toNodeId: 'client-company', date: '2025-10-31' },
      { id: 'f-oct-2', type: 'timesheet', label: 'Oct timesheets (BW)', status: 'approved', hours: 256, fromNodeId: 'org-brightworks', toNodeId: 'client-company', date: '2025-10-31' },
      { id: 'f-oct-3', type: 'nda', label: 'NDA: Robert → Client', status: 'signed', fromNodeId: 'user-robert', toNodeId: 'client-company', date: '2025-10-01' },
      { id: 'f-oct-4', type: 'nda', label: 'NDA: Emma → Client', status: 'signed', fromNodeId: 'user-emma', toNodeId: 'client-company', date: '2025-10-10' },
      { id: 'f-oct-5', type: 'compliance', label: 'Background check: Robert', status: 'approved', fromNodeId: 'user-robert', toNodeId: 'org-acme', date: '2025-10-03' },
      { id: 'f-oct-6', type: 'invoice', label: 'Acme Oct invoice', status: 'paid', amount: 85200, fromNodeId: 'org-acme', toNodeId: 'client-company', date: '2025-11-05' },
      { id: 'f-oct-7', type: 'invoice', label: 'BW Oct invoice', status: 'paid', amount: 51200, fromNodeId: 'org-brightworks', toNodeId: 'client-company', date: '2025-11-05' },
    ],
    stats: {
      totalHoursSubmitted: 972,
      totalHoursApproved: 952,
      totalAmountInvoiced: 136400,
      pendingApprovals: 0,
      activeContracts: 2,
      activeNDAs: 6,
    },
  },
  {
    month: '2025-11',
    label: 'Nov 2025',
    activePeople: [
      { personId: 'user-sarah', orgId: 'org-acme', hoursSubmitted: 140, hoursApproved: 120, status: 'active' },
      { personId: 'user-mike', orgId: 'org-acme', hoursSubmitted: 152, hoursApproved: 140, status: 'active' },
      { personId: 'user-emily', orgId: 'org-acme', hoursSubmitted: 160, hoursApproved: 160, status: 'active' },
      { personId: 'user-robert', orgId: 'org-acme', hoursSubmitted: 160, hoursApproved: 148, status: 'active' },
      { personId: 'user-lisa', orgId: 'org-acme', hoursSubmitted: 40, hoursApproved: 0, status: 'onboarding' },
      { personId: 'user-sophia', orgId: 'org-brightworks', hoursSubmitted: 120, hoursApproved: 120, status: 'active' },
      { personId: 'user-oliver', orgId: 'org-brightworks', hoursSubmitted: 100, hoursApproved: 80, status: 'active' },
      { personId: 'user-emma', orgId: 'org-brightworks', hoursSubmitted: 80, hoursApproved: 60, status: 'active' },
      { personId: 'user-alex', orgId: '_freelancer', hoursSubmitted: 92, hoursApproved: 80, status: 'active' },
      { personId: 'user-jordan', orgId: '_freelancer', hoursSubmitted: 80, hoursApproved: 60, status: 'active' },
    ],
    flows: [
      { id: 'f-nov-1', type: 'timesheet', label: 'Nov timesheets (Acme)', status: 'submitted', hours: 652, fromNodeId: 'org-acme', toNodeId: 'client-company', date: '2025-11-30' },
      { id: 'f-nov-2', type: 'timesheet', label: 'Nov timesheets (BW)', status: 'submitted', hours: 300, fromNodeId: 'org-brightworks', toNodeId: 'client-company', date: '2025-11-30' },
      { id: 'f-nov-3', type: 'approval', label: 'Lisa onboarding approval', status: 'pending', fromNodeId: 'user-lisa', toNodeId: 'org-acme', date: '2025-11-01' },
      { id: 'f-nov-4', type: 'nda', label: 'NDA: Lisa → Client', status: 'pending', fromNodeId: 'user-lisa', toNodeId: 'client-company', date: '2025-11-01' },
      { id: 'f-nov-5', type: 'compliance', label: 'Background check: Lisa', status: 'pending', fromNodeId: 'user-lisa', toNodeId: 'org-acme', date: '2025-11-01' },
    ],
    stats: {
      totalHoursSubmitted: 1124,
      totalHoursApproved: 968,
      totalAmountInvoiced: 0,
      pendingApprovals: 5,
      activeContracts: 2,
      activeNDAs: 7,
    },
  },
];

// ============================================================================
// Compute edge flow summaries for a given month
// ============================================================================

export function computeEdgeFlows(
  edges: { id: string; source: string; target: string }[],
  snapshot: MonthlySnapshot
): Map<string, EdgeFlowSummary> {
  const summaries = new Map<string, EdgeFlowSummary>();

  // Group flows by the edge they correspond to
  edges.forEach(edge => {
    const relevantFlows = snapshot.flows.filter(
      f =>
        (f.fromNodeId === edge.source && f.toNodeId === edge.target) ||
        (f.fromNodeId === edge.target && f.toNodeId === edge.source)
    );

    if (relevantFlows.length === 0) return;

    const byType = new Map<FlowItemType, { count: number; pendingCount: number }>();
    relevantFlows.forEach(f => {
      const existing = byType.get(f.type) || { count: 0, pendingCount: 0 };
      existing.count++;
      if (f.status === 'pending' || f.status === 'submitted') existing.pendingCount++;
      byType.set(f.type, existing);
    });

    const flowLabels: Record<FlowItemType, string> = {
      timesheet: 'Timesheets',
      nda: 'NDAs',
      contract: 'Contracts',
      invoice: 'Invoices',
      compliance: 'Compliance',
      approval: 'Approvals',
      payment: 'Payments',
    };

    const flows = Array.from(byType.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      pendingCount: data.pendingCount,
      label: flowLabels[type],
    }));

    const hasAlerts = flows.some(f => f.pendingCount > 0);

    summaries.set(edge.id, {
      edgeId: edge.id,
      flows,
      totalItems: relevantFlows.length,
      hasAlerts,
    });
  });

  return summaries;
}

// ============================================================================
// Get snapshot for a given month
// ============================================================================

export function getSnapshotForMonth(month: string): MonthlySnapshot | null {
  return MONTHLY_SNAPSHOTS.find(s => s.month === month) || null;
}

// ============================================================================
// Get active people for a month (returns node IDs)
// ============================================================================

export function getActivePeopleIds(month: string): Set<string> {
  const snapshot = getSnapshotForMonth(month);
  if (!snapshot) return new Set();
  return new Set(
    snapshot.activePeople
      .filter(p => p.status !== 'inactive')
      .map(p => p.personId)
  );
}

// ============================================================================
// Get person activity for a month
// ============================================================================

export function getPersonMonthlyActivity(
  personId: string,
  month: string
): { hoursSubmitted: number; hoursApproved: number; status: string } | null {
  const snapshot = getSnapshotForMonth(month);
  if (!snapshot) return null;
  const person = snapshot.activePeople.find(p => p.personId === personId);
  return person || null;
}