/**
 * Graph Node Management for Timesheets & Expenses
 * Creates and manages TimesheetPeriod and ExpenseReport nodes in ProjectGraph
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TimesheetPeriodNode {
  nodeType: 'TimesheetPeriod';
  nodeId: string;
  properties: {
    // Temporal
    weekStart: string;
    weekEnd: string;
    submittedAt?: string;
    approvedAt?: string;
    lastModifiedAt: string;
    
    // Workflow
    status: 'draft' | 'submitted' | 'in_review' | 'rejected' | 'approved' | 'locked';
    currentStep: number;
    totalSteps: number;
    version: number;
    
    // Aggregated Data
    totalHours: number;
    billableHours: number;
    overtimeHours: number;
    daysWorked: number;
    
    // Financial
    totalAmount?: number;
    currency?: string;
    hourlyRate?: number;
    
    // References
    postgresEntriesRef: string;
    postgresPeriodId: string;
    
    // Metadata
    contractorNotes?: string;
    trackingMode: 'hours' | 'time';
    hasBreaks: boolean;
    
    // Flags
    hasOvertimeFlag: boolean;
    hasWeekendWorkFlag: boolean;
    requiresClientApproval: boolean;
    
    // Archive
    archivedAt?: string;
    archiveReason?: string;
  };
}

export interface ExpenseReportNode {
  nodeType: 'ExpenseReport';
  nodeId: string;
  properties: {
    // Temporal
    reportMonth: string;
    reportStartDate: string;
    reportEndDate: string;
    submittedAt?: string;
    approvedAt?: string;
    lastModifiedAt: string;
    
    // Workflow
    status: 'draft' | 'submitted' | 'in_review' | 'rejected' | 'approved' | 'reimbursed';
    currentStep: number;
    totalSteps: number;
    version: number;
    
    // Financial
    totalAmount: number;
    reimbursableAmount: number;
    nonReimbursableAmount: number;
    currency: string;
    
    // Breakdown
    categoryBreakdown: Record<string, number>;
    lineItemCount: number;
    
    // Compliance
    hasAllReceipts: boolean;
    missingReceiptsCount: number;
    requiresJustification: boolean;
    
    // References
    postgresLineItemsRef: string;
    postgresReportId: string;
    
    // Metadata
    contractorNotes?: string;
    reimbursementMethod?: 'bank_transfer' | 'payroll' | 'check';
    reimbursedAt?: string;
    
    // Flags
    hasHighValueItemsFlag: boolean;
    hasForeignCurrencyFlag: boolean;
    requiresClientApproval: boolean;
    
    // Archive
    archivedAt?: string;
    archiveReason?: string;
  };
}

export interface ApprovalEdgeMetadata {
  step: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  approvalComment?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  reviewedFrom?: 'web' | 'mobile' | 'email';
  notifiedAt: string;
  remindersSent: number;
}

export interface CompanyStats {
  totalContractors: number;
  activeContractors: number;
  pendingTimesheets: number;
  awaitingMyApproval: number;
  pendingExpenses: number;
  pendingExpenseAmount: number;
  totalMonthlyBillable: number;
  averageHourlyRate: number;
  lastUpdated: string;
}

// ============================================================================
// GRAPH NODE STORAGE (using KV store as simplified graph)
// ============================================================================

const GRAPH_PREFIX = 'graph:node:';
const EDGE_PREFIX = 'graph:edge:';

async function storeNode(node: TimesheetPeriodNode | ExpenseReportNode): Promise<void> {
  const key = `${GRAPH_PREFIX}${node.nodeId}`;
  
  // Store in KV (eventually move to dedicated graph DB)
  const { error } = await supabase
    .from('kv_store_f8b491be')
    .upsert({
      key,
      value: node,
      metadata: {
        nodeType: node.nodeType,
        status: node.properties.status,
        createdAt: new Date().toISOString()
      }
    });
  
  if (error) {
    console.error('Failed to store graph node:', error);
    throw new Error(`Failed to store graph node: ${error.message}`);
  }
}

async function getNode(nodeId: string): Promise<TimesheetPeriodNode | ExpenseReportNode | null> {
  const key = `${GRAPH_PREFIX}${nodeId}`;
  
  const { data, error } = await supabase
    .from('kv_store_f8b491be')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error || !data) return null;
  return data.value as TimesheetPeriodNode | ExpenseReportNode;
}

async function storeEdge(edgeId: string, edge: {
  type: string;
  from: string;
  to: string;
  metadata?: any;
}): Promise<void> {
  const key = `${EDGE_PREFIX}${edgeId}`;
  
  const { error } = await supabase
    .from('kv_store_f8b491be')
    .upsert({
      key,
      value: edge,
      metadata: {
        edgeType: edge.type,
        createdAt: new Date().toISOString()
      }
    });
  
  if (error) {
    console.error('Failed to store graph edge:', error);
    throw new Error(`Failed to store graph edge: ${error.message}`);
  }
}

// ============================================================================
// TIMESHEET NODE CREATION
// ============================================================================

export async function createTimesheetPeriodNode(params: {
  periodId: string;
  userId: string;
  projectId: string;
  contractId: string;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  billableHours: number;
  overtimeHours: number;
  daysWorked: number;
  totalAmount?: number;
  currency?: string;
  hourlyRate?: number;
  contractorNotes?: string;
  trackingMode?: 'hours' | 'time';
  hasBreaks?: boolean;
}): Promise<TimesheetPeriodNode> {
  
  // Generate node ID
  const nodeId = `ts-${params.weekStart}-${params.userId.replace('user-', '')}`;
  
  // Fetch contract to get approval chain
  const { data: contract } = await supabase
    .from('project_contracts')
    .select('*, projects(*)')
    .eq('id', params.contractId)
    .single();
  
  if (!contract) {
    throw new Error('Contract not found');
  }
  
  // Determine approval steps from contract
  const approvalChain = await buildApprovalChain(params.contractId);
  
  // Create node
  const node: TimesheetPeriodNode = {
    nodeType: 'TimesheetPeriod',
    nodeId,
    properties: {
      weekStart: params.weekStart,
      weekEnd: params.weekEnd,
      submittedAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      
      status: 'submitted',
      currentStep: 1,
      totalSteps: approvalChain.length,
      version: 1,
      
      totalHours: params.totalHours,
      billableHours: params.billableHours,
      overtimeHours: params.overtimeHours,
      daysWorked: params.daysWorked,
      
      totalAmount: params.totalAmount,
      currency: params.currency || 'USD',
      hourlyRate: params.hourlyRate,
      
      postgresEntriesRef: `period_id = '${params.periodId}'`,
      postgresPeriodId: params.periodId,
      
      contractorNotes: params.contractorNotes,
      trackingMode: params.trackingMode || 'hours',
      hasBreaks: params.hasBreaks || false,
      
      hasOvertimeFlag: params.overtimeHours > 0,
      hasWeekendWorkFlag: false, // TODO: Calculate from entries
      requiresClientApproval: approvalChain.some(a => a.role === 'client'),
    }
  };
  
  // Store node
  await storeNode(node);
  
  // Create edges
  await createTimesheetEdges({
    nodeId,
    userId: params.userId,
    projectId: params.projectId,
    contractId: params.contractId,
    approvalChain,
  });
  
  // Update Postgres with node reference
  await supabase
    .from('timesheet_periods')
    .update({ graph_node_id: nodeId })
    .eq('id', params.periodId);
  
  // Update company stats
  const { data: user } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', params.userId)
    .single();
  
  if (user?.company_id) {
    await updateCompanyStats(user.company_id);
  }
  
  console.log('✅ Created TimesheetPeriod node:', nodeId);
  
  return node;
}

// ============================================================================
// APPROVAL CHAIN BUILDING
// ============================================================================

interface ApprovalStep {
  step: number;
  approverId: string;
  approverName: string;
  role: 'manager' | 'client' | 'finance';
  companyId: string;
}

async function buildApprovalChain(contractId: string): Promise<ApprovalStep[]> {
  // Fetch contract and related companies
  const { data: contract } = await supabase
    .from('project_contracts')
    .select(`
      *,
      projects(
        id,
        name,
        company_id
      )
    `)
    .eq('id', contractId)
    .single();
  
  if (!contract) {
    throw new Error('Contract not found');
  }
  
  const chain: ApprovalStep[] = [];
  
  // Step 1: Internal Manager (from contractor's company)
  const { data: managerUser } = await supabase
    .from('users')
    .select('id, name, company_id')
    .eq('company_id', contract.company_id)
    .eq('user_type', 'manager')
    .limit(1)
    .single();
  
  if (managerUser) {
    chain.push({
      step: 1,
      approverId: managerUser.id,
      approverName: managerUser.name,
      role: 'manager',
      companyId: managerUser.company_id,
    });
  }
  
  // Step 2: Client Approver (if required)
  if (contract.requires_client_approval) {
    const { data: clientUser } = await supabase
      .from('users')
      .select('id, name, company_id')
      .eq('company_id', contract.projects.company_id)
      .eq('user_type', 'client')
      .limit(1)
      .single();
    
    if (clientUser) {
      chain.push({
        step: 2,
        approverId: clientUser.id,
        approverName: clientUser.name,
        role: 'client',
        companyId: clientUser.company_id,
      });
    }
  }
  
  return chain;
}

// ============================================================================
// EDGE CREATION
// ============================================================================

async function createTimesheetEdges(params: {
  nodeId: string;
  userId: string;
  projectId: string;
  contractId: string;
  approvalChain: ApprovalStep[];
}): Promise<void> {
  
  // SUBMITTED_BY edge
  await storeEdge(`${params.nodeId}:submitted_by:${params.userId}`, {
    type: 'SUBMITTED_BY',
    from: params.nodeId,
    to: params.userId,
    metadata: {
      submittedAt: new Date().toISOString(),
      submittedFrom: 'web',
    }
  });
  
  // FOR_PROJECT edge
  await storeEdge(`${params.nodeId}:for_project:${params.projectId}`, {
    type: 'FOR_PROJECT',
    from: params.nodeId,
    to: params.projectId,
    metadata: {
      percentage: 100,
      primaryProject: true,
    }
  });
  
  // UNDER_CONTRACT edge
  await storeEdge(`${params.nodeId}:under_contract:${params.contractId}`, {
    type: 'UNDER_CONTRACT',
    from: params.nodeId,
    to: params.contractId,
    metadata: {
      appliedRate: 75, // TODO: Get from contract
      appliedCurrency: 'USD',
    }
  });
  
  // REQUIRES_APPROVAL edges (one per approver)
  for (const approver of params.approvalChain) {
    const edgeMetadata: ApprovalEdgeMetadata = {
      step: approver.step,
      status: approver.step === 1 ? 'pending' : 'pending',
      notifiedAt: approver.step === 1 ? new Date().toISOString() : '',
      remindersSent: 0,
    };
    
    await storeEdge(`${params.nodeId}:requires_approval:${approver.approverId}:step${approver.step}`, {
      type: 'REQUIRES_APPROVAL',
      from: params.nodeId,
      to: approver.approverId,
      metadata: edgeMetadata,
    });
  }
  
  // CAN_VIEW edges (for companies in approval chain)
  const companyIds = new Set(params.approvalChain.map(a => a.companyId));
  for (const companyId of companyIds) {
    await storeEdge(`${companyId}:can_view:${params.nodeId}`, {
      type: 'CAN_VIEW',
      from: companyId,
      to: params.nodeId,
      metadata: {
        grantedAt: new Date().toISOString(),
        grantedBy: 'approval_chain',
        accessLevel: 'read_only',
      }
    });
  }
}

// ============================================================================
// APPROVAL ACTIONS
// ============================================================================

export async function approveTimesheet(params: {
  timesheetNodeId: string;
  approverId: string;
  approverName: string;
  comment?: string;
}): Promise<{ success: boolean; nextStep?: number; fullyApproved: boolean }> {
  
  // Get timesheet node
  const node = await getNode(params.timesheetNodeId) as TimesheetPeriodNode;
  if (!node) {
    throw new Error('Timesheet node not found');
  }
  
  // Update approval edge
  const edgeKey = `${EDGE_PREFIX}${params.timesheetNodeId}:requires_approval:${params.approverId}:step${node.properties.currentStep}`;
  
  const { data: edgeData } = await supabase
    .from('kv_store_f8b491be')
    .select('value')
    .eq('key', edgeKey)
    .single();
  
  if (!edgeData) {
    throw new Error('Approval edge not found');
  }
  
  const edge = edgeData.value;
  edge.metadata.status = 'approved';
  edge.metadata.approvedAt = new Date().toISOString();
  edge.metadata.approvalComment = params.comment;
  
  await supabase
    .from('kv_store_f8b491be')
    .update({ value: edge })
    .eq('key', edgeKey);
  
  // Check if there are more steps
  const nextStep = node.properties.currentStep + 1;
  const fullyApproved = nextStep > node.properties.totalSteps;
  
  if (fullyApproved) {
    // Update node to approved
    node.properties.status = 'approved';
    node.properties.approvedAt = new Date().toISOString();
    await storeNode(node);
    
    // Update Postgres
    await supabase
      .from('timesheet_periods')
      .update({ 
        status: 'manager_approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: params.approverId,
      })
      .eq('graph_node_id', params.timesheetNodeId);
    
  } else {
    // Move to next step
    node.properties.currentStep = nextStep;
    node.properties.status = 'in_review';
    await storeNode(node);
    
    // Notify next approver (TODO: implement email)
  }
  
  console.log(`✅ Timesheet ${params.timesheetNodeId} approved by ${params.approverName}`);
  
  return {
    success: true,
    nextStep: fullyApproved ? undefined : nextStep,
    fullyApproved,
  };
}

export async function rejectTimesheet(params: {
  timesheetNodeId: string;
  approverId: string;
  approverName: string;
  reason: string;
}): Promise<{ success: boolean }> {
  
  // Get timesheet node
  const node = await getNode(params.timesheetNodeId) as TimesheetPeriodNode;
  if (!node) {
    throw new Error('Timesheet node not found');
  }
  
  // Update approval edge
  const edgeKey = `${EDGE_PREFIX}${params.timesheetNodeId}:requires_approval:${params.approverId}:step${node.properties.currentStep}`;
  
  const { data: edgeData } = await supabase
    .from('kv_store_f8b491be')
    .select('value')
    .eq('key', edgeKey)
    .single();
  
  if (!edgeData) {
    throw new Error('Approval edge not found');
  }
  
  const edge = edgeData.value;
  edge.metadata.status = 'rejected';
  edge.metadata.rejectedAt = new Date().toISOString();
  edge.metadata.rejectionReason = params.reason;
  
  await supabase
    .from('kv_store_f8b491be')
    .update({ value: edge })
    .eq('key', edgeKey);
  
  // Update node to rejected
  node.properties.status = 'rejected';
  node.properties.currentStep = 1; // Reset to step 1 for resubmission
  await storeNode(node);
  
  // Update Postgres
  await supabase
    .from('timesheet_periods')
    .update({ 
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: params.approverId,
      review_notes: params.reason,
    })
    .eq('graph_node_id', params.timesheetNodeId);
  
  console.log(`❌ Timesheet ${params.timesheetNodeId} rejected by ${params.approverName}`);
  
  return { success: true };
}

// ============================================================================
// COMPANY STATS UPDATE
// ============================================================================

export async function updateCompanyStats(companyId: string): Promise<CompanyStats> {
  
  // Count active contractors
  const { data: contractors } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_type', 'contractor');
  
  const totalContractors = contractors?.length || 0;
  
  // Count pending timesheets (from graph nodes)
  const { data: pendingTimesheets } = await supabase
    .from('kv_store_f8b491be')
    .select('value')
    .like('key', `${GRAPH_PREFIX}ts-%`)
    .contains('metadata', { nodeType: 'TimesheetPeriod' });
  
  const pendingCount = pendingTimesheets?.filter(
    (item: any) => item.value?.properties?.status === 'submitted' || 
                   item.value?.properties?.status === 'in_review'
  ).length || 0;
  
  const stats: CompanyStats = {
    totalContractors,
    activeContractors: totalContractors,
    pendingTimesheets: pendingCount,
    awaitingMyApproval: 0, // TODO: Calculate from approval edges
    pendingExpenses: 0,
    pendingExpenseAmount: 0,
    totalMonthlyBillable: 0,
    averageHourlyRate: 75,
    lastUpdated: new Date().toISOString(),
  };
  
  // Store stats in company node
  const companyNodeKey = `${GRAPH_PREFIX}company-${companyId}`;
  const { data: existingNode } = await supabase
    .from('kv_store_f8b491be')
    .select('value')
    .eq('key', companyNodeKey)
    .single();
  
  const companyNode = existingNode?.value || {
    nodeType: 'Company',
    nodeId: `company-${companyId}`,
    properties: {
      name: 'Company Name', // TODO: Fetch from companies table
      companyType: 'agency',
    }
  };
  
  companyNode.properties.stats = stats;
  
  await supabase
    .from('kv_store_f8b491be')
    .upsert({
      key: companyNodeKey,
      value: companyNode,
      metadata: {
        nodeType: 'Company',
        lastUpdated: new Date().toISOString(),
      }
    });
  
  console.log(`📊 Updated stats for company ${companyId}:`, stats);
  
  return stats;
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

export async function getMyPendingApprovals(userId: string): Promise<TimesheetPeriodNode[]> {
  
  // Find all approval edges where I'm the approver and status is pending
  const { data: edges } = await supabase
    .from('kv_store_f8b491be')
    .select('key, value')
    .like('key', `${EDGE_PREFIX}%:requires_approval:${userId}:%`);
  
  if (!edges || edges.length === 0) return [];
  
  const pendingTimesheetIds: string[] = [];
  
  for (const edge of edges) {
    const edgeValue = edge.value;
    if (edgeValue.metadata.status === 'pending') {
      // Extract timesheet node ID from edge
      const timesheetId = edgeValue.from;
      
      // Check if this is the current step
      const node = await getNode(timesheetId) as TimesheetPeriodNode;
      if (node && node.properties.currentStep === edgeValue.metadata.step) {
        pendingTimesheetIds.push(timesheetId);
      }
    }
  }
  
  // Fetch all pending timesheet nodes
  const timesheets: TimesheetPeriodNode[] = [];
  for (const nodeId of pendingTimesheetIds) {
    const node = await getNode(nodeId) as TimesheetPeriodNode;
    if (node) timesheets.push(node);
  }
  
  return timesheets;
}

export async function getContractorTimesheets(
  userId: string,
  filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<TimesheetPeriodNode[]> {
  
  // Find all SUBMITTED_BY edges for this user
  const { data: edges } = await supabase
    .from('kv_store_f8b491be')
    .select('key, value')
    .like('key', `${EDGE_PREFIX}%:submitted_by:${userId}`);
  
  if (!edges || edges.length === 0) return [];
  
  const timesheets: TimesheetPeriodNode[] = [];
  
  for (const edge of edges) {
    const timesheetId = edge.value.from;
    const node = await getNode(timesheetId) as TimesheetPeriodNode;
    
    if (!node) continue;
    
    // Apply filters
    if (filters?.status && node.properties.status !== filters.status) continue;
    if (filters?.startDate && node.properties.weekStart < filters.startDate) continue;
    if (filters?.endDate && node.properties.weekEnd > filters.endDate) continue;
    
    timesheets.push(node);
  }
  
  // Sort by weekStart descending
  timesheets.sort((a, b) => b.properties.weekStart.localeCompare(a.properties.weekStart));
  
  return timesheets;
}
