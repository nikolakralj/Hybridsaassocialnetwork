/**
 * Edge Type Rules & Suggestions
 * 
 * Defines which edge types are valid/recommended for different node type combinations.
 * Helps users understand the semantic meaning of edges and prevents invalid connections.
 */

export interface EdgeTypeDefinition {
  id: string;
  label: string;
  color: string;
  description: string;
  icon?: string;
  
  // Semantic meaning
  sourceLabel: string; // e.g., "Approver"
  targetLabel: string; // e.g., "Submitter"
  
  // Visual styling
  animated?: boolean;
  dashed?: boolean;
  strokeWidth?: number;
}

export const EDGE_TYPES: Record<string, EdgeTypeDefinition> = {
  approves: {
    id: 'approves',
    label: 'Approves',
    color: '#3b82f6', // Blue
    description: 'Creates an approval flow - approver reviews and approves work',
    sourceLabel: 'Submitter',
    targetLabel: 'Approver',
    animated: true,
    strokeWidth: 2,
  },
  
  funds: {
    id: 'funds',
    label: 'Funds',
    color: '#10b981', // Green
    description: 'Money flows from funder to recipient',
    sourceLabel: 'Funder',
    targetLabel: 'Recipient',
    strokeWidth: 2,
  },
  
  subcontracts: {
    id: 'subcontracts',
    label: 'Subcontracts',
    color: '#8b5cf6', // Purple
    description: 'Company A hires Company B as a subcontractor',
    sourceLabel: 'Prime Contractor',
    targetLabel: 'Subcontractor',
    dashed: true,
    strokeWidth: 2,
  },
  
  billsTo: {
    id: 'billsTo',
    label: 'Bills To',
    color: '#f59e0b', // Orange
    description: 'Invoice flow - who sends invoices to whom',
    sourceLabel: 'Service Provider',
    targetLabel: 'Client',
    strokeWidth: 2,
  },
  
  assigns: {
    id: 'assigns',
    label: 'Assigns',
    color: '#6366f1', // Indigo
    description: 'Company assigns a person to work on a project',
    sourceLabel: 'Employer',
    targetLabel: 'Worker',
    dashed: true,
    strokeWidth: 1.5,
  },
  
  worksOn: {
    id: 'worksOn',
    label: 'Works On',
    color: '#64748b', // Slate
    description: 'Person is assigned to work on a project/task',
    sourceLabel: 'Worker',
    targetLabel: 'Work Item',
    strokeWidth: 1,
  },
  
  reportsTo: {
    id: 'reportsTo',
    label: 'Reports To',
    color: '#ec4899', // Pink
    description: 'Organizational hierarchy - who reports to whom',
    sourceLabel: 'Subordinate',
    targetLabel: 'Manager',
    strokeWidth: 1.5,
  },
  
  submitsExpensesTo: {
    id: 'submitsExpensesTo',
    label: 'Submits Expenses To',
    color: '#f97316', // Orange-red
    description: 'Who reviews and approves expense reports',
    sourceLabel: 'Spender',
    targetLabel: 'Expense Approver',
    strokeWidth: 2,
  },
};

/**
 * Node type combinations and their recommended edge types
 * Format: [sourceType, targetType] -> recommended edge types (ordered by preference)
 */
export interface EdgeTypeSuggestion {
  edgeTypes: string[]; // Ordered by recommendation strength
  reasoning: string;
  examples?: string[];
}

export const EDGE_TYPE_SUGGESTIONS: Record<string, EdgeTypeSuggestion> = {
  // Person → Company
  'person-party': {
    edgeTypes: ['worksOn', 'reportsTo', 'submitsExpensesTo'],
    reasoning: 'People typically work for companies or report to managers',
    examples: ['Alex works at Acme Dev', 'Sarah reports to CTO'],
  },
  
  // Company → Person
  'party-person': {
    edgeTypes: ['assigns', 'approves'],
    reasoning: 'Companies assign people to projects or approve their work',
    examples: ['Acme Dev assigns Mike to Project Alpha', 'Manager approves Sarah\'s timesheet'],
  },
  
  // Company → Company
  'party-party': {
    edgeTypes: ['subcontracts', 'funds', 'billsTo'],
    reasoning: 'Companies subcontract, fund, or bill each other',
    examples: ['Acme Dev subcontracts to Freelance Agency', 'Client funds Prime Contractor'],
  },
  
  // Contract → Company
  'contract-party': {
    edgeTypes: ['billsTo', 'funds'],
    reasoning: 'Contracts define billing and funding relationships',
    examples: ['Hourly Contract bills to Client', 'Budget funds Contractor'],
  },
  
  // Company → Contract
  'party-contract': {
    edgeTypes: ['funds', 'approves'],
    reasoning: 'Companies fund contracts or approve contract changes',
    examples: ['Client funds Master Contract', 'Manager approves rate increase'],
  },
  
  // Person → Contract
  'person-contract': {
    edgeTypes: ['worksOn', 'submitsExpensesTo'],
    reasoning: 'People work under contracts',
    examples: ['Alex works under Hourly Contract', 'Freelancer submits expenses to SOW'],
  },
  
  // Contract → Person
  'contract-person': {
    edgeTypes: ['assigns'],
    reasoning: 'Contracts assign people to specific work',
    examples: ['SOW assigns Mike as Tech Lead'],
  },
  
  // Expense → Person
  'expense-person': {
    edgeTypes: ['submitsExpensesTo'],
    reasoning: 'Expenses are submitted by people',
    examples: ['Travel expense submitted by Sarah'],
  },
  
  // Person → Expense
  'person-expense': {
    edgeTypes: ['approves'],
    reasoning: 'People approve expense reports',
    examples: ['Manager approves travel expenses'],
  },
  
  // Timesheet → Company
  'timesheet-party': {
    edgeTypes: ['approves', 'billsTo'],
    reasoning: 'Timesheets are approved by companies or billed to clients',
    examples: ['Weekly timesheet approved by Acme Dev', 'Contractor bills timesheet to Client'],
  },
};

/**
 * Get recommended edge types for a source → target connection
 */
export function getRecommendedEdgeTypes(
  sourceType: string,
  targetType: string,
  sourceData?: any,
  targetData?: any
): EdgeTypeSuggestion {
  // Build lookup key
  const key = `${sourceType}-${targetType}`;
  
  // Check if we have suggestions for this combination
  if (EDGE_TYPE_SUGGESTIONS[key]) {
    return EDGE_TYPE_SUGGESTIONS[key];
  }
  
  // Handle party subtypes (company, agency, contractor)
  if (sourceType === 'party' && targetType === 'party') {
    const sourcePartyType = sourceData?.partyType || 'company';
    const targetPartyType = targetData?.partyType || 'company';
    
    // Company/Agency → Contractor
    if (['company', 'agency'].includes(sourcePartyType) && targetPartyType === 'contractor') {
      return {
        edgeTypes: ['subcontracts', 'assigns', 'funds'],
        reasoning: 'Companies/agencies hire contractors',
        examples: ['Acme hires Freelancer Corp', 'Agency assigns contractor to project'],
      };
    }
    
    // Contractor → Company/Agency
    if (sourcePartyType === 'contractor' && ['company', 'agency'].includes(targetPartyType)) {
      return {
        edgeTypes: ['billsTo', 'worksOn'],
        reasoning: 'Contractors bill clients or work for companies',
        examples: ['Freelancer bills to Client', 'Contractor works on company project'],
      };
    }
  }
  
  // Default fallback
  return {
    edgeTypes: ['approves', 'funds', 'subcontracts', 'billsTo', 'assigns', 'worksOn'],
    reasoning: 'Multiple edge types are possible for this combination',
    examples: [],
  };
}

/**
 * Get the default (most recommended) edge type for a connection
 */
export function getDefaultEdgeType(
  sourceType: string,
  targetType: string,
  sourceData?: any,
  targetData?: any
): string {
  const suggestions = getRecommendedEdgeTypes(sourceType, targetType, sourceData, targetData);
  return suggestions.edgeTypes[0] || 'approves';
}

/**
 * Validate if an edge type makes sense for a given connection
 */
export function validateEdgeType(
  sourceType: string,
  targetType: string,
  edgeType: string,
  sourceData?: any,
  targetData?: any
): { valid: boolean; warning?: string } {
  const suggestions = getRecommendedEdgeTypes(sourceType, targetType, sourceData, targetData);
  
  if (suggestions.edgeTypes.includes(edgeType)) {
    return { valid: true };
  }
  
  // Not recommended but not necessarily invalid
  return {
    valid: true,
    warning: `"${EDGE_TYPES[edgeType]?.label}" is unusual for ${sourceType} → ${targetType}. Consider: ${suggestions.edgeTypes.map(t => EDGE_TYPES[t]?.label).join(', ')}`,
  };
}

/**
 * Real-world examples for common scenarios
 */
export const EDGE_TYPE_EXAMPLES = {
  'Contractor submits expenses': {
    source: 'Person (Contractor)',
    target: 'Company (Client)',
    edgeType: 'submitsExpensesTo',
    description: 'Contractor submits expense reports to client for reimbursement',
  },
  
  'Agency approves contractor timesheet': {
    source: 'Person (Contractor)',
    target: 'Company (Agency)',
    edgeType: 'approves',
    description: 'Contractor submits timesheet to agency for approval (approval flows backward)',
  },
  
  'Client funds project': {
    source: 'Company (Client)',
    target: 'Contract (SOW)',
    edgeType: 'funds',
    description: 'Client provides funding for statement of work',
  },
  
  'Contractor bills client': {
    source: 'Person (Contractor)',
    target: 'Company (Client)',
    edgeType: 'billsTo',
    description: 'Contractor sends invoices to client',
  },
  
  'Agency subcontracts to freelancer': {
    source: 'Company (Agency)',
    target: 'Company (Freelancer Corp)',
    edgeType: 'subcontracts',
    description: 'Agency hires freelancer company as subcontractor',
  },
};

/**
 * Get human-readable description for an edge
 */
export function getEdgeDescription(
  edgeType: string,
  sourceName: string,
  targetName: string
): string {
  const def = EDGE_TYPES[edgeType];
  if (!def) return `${sourceName} → ${targetName}`;
  
  switch (edgeType) {
    case 'approves':
      return `${sourceName} submits work to ${targetName} for approval`;
    case 'funds':
      return `${sourceName} provides funding to ${targetName}`;
    case 'subcontracts':
      return `${sourceName} hires ${targetName} as subcontractor`;
    case 'billsTo':
      return `${sourceName} sends invoices to ${targetName}`;
    case 'assigns':
      return `${sourceName} assigns ${targetName} to work`;
    case 'worksOn':
      return `${sourceName} works on ${targetName}`;
    case 'reportsTo':
      return `${sourceName} reports to ${targetName}`;
    case 'submitsExpensesTo':
      return `${sourceName} submits expenses to ${targetName} for approval`;
    default:
      return `${sourceName} → ${targetName}`;
  }
}
