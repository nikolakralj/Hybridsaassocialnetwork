// Contract Grouping Logic for Approval Queue
// Groups timesheet entries by contract for visual separation

import type { TimesheetEntry } from './timesheets';
import type { Contract } from '../../types/contracts';
import type { Person } from '../../types/people';

export interface ContractGroup {
  contract: Contract;
  contractType: 'individual' | 'company' | 'agency';
  entries: TimesheetEntry[];
  people: Person[];
  
  // Aggregated metrics
  totalHours: number;
  totalAmount: number;
  weekRange: { start: Date; end: Date };
  
  // Display info
  displayName: string;        // "Sarah Chen" or "Acme Corp (3 contractors)"
  contractNumber: string;     // "IND-2025-001"
  rate: number;               // $60/hr
  rateLabel: string;          // "$60/hr" or "$65/hr blended"
}

/**
 * Find which contract an entry belongs to
 */
function findContractForEntry(
  entry: TimesheetEntry,
  contracts: Contract[]
): Contract | undefined {
  // First try to match by userId
  let contract = contracts.find(c => c.providerId === entry.userId);
  
  // If not found, try by organizationId (for company contracts)
  if (!contract && entry.organizationId) {
    contract = contracts.find(c => c.providerId === entry.organizationId);
  }
  
  return contract;
}

/**
 * Get display name for a contract
 */
function getContractDisplayName(contract: Contract, people: Person[]): string {
  if (contract.providerType === 'individual') {
    // "Sarah Chen"
    return contract.providerName;
  }
  
  // "Acme Corp (3 contractors)"
  const count = people.filter(p => p.organizationId === contract.providerId).length;
  if (count === 0) {
    return contract.providerName;
  }
  return `${contract.providerName} (${count} ${count === 1 ? 'contractor' : 'contractors'})`;
}

/**
 * Get rate label for display
 */
function getRateLabel(contract: Contract): string {
  if (contract.providerType === 'individual') {
    return `$${contract.baseHourlyRate}/hr`;
  }
  // For companies, show "blended" rate
  return `$${contract.baseHourlyRate}/hr blended`;
}

/**
 * Calculate amount for an entry based on contract
 */
function calculateAmount(entry: TimesheetEntry, contract: Contract): number {
  const rate = contract.workTypeRates[entry.workType as keyof typeof contract.workTypeRates];
  return entry.hours * (rate || contract.baseHourlyRate);
}

/**
 * Group timesheet entries by contract
 * Returns grouped and sorted contract groups
 */
export function groupEntriesByContract(
  entries: TimesheetEntry[],
  contracts: Contract[],
  people: Person[]
): ContractGroup[] {
  const groups = new Map<string, ContractGroup>();
  
  entries.forEach(entry => {
    // Find which contract this entry belongs to
    const contract = findContractForEntry(entry, contracts);
    if (!contract) {
      console.warn(`No contract found for entry ${entry.id}, user ${entry.userId}`);
      return;
    }
    
    // Initialize group if it doesn't exist
    if (!groups.has(contract.id)) {
      groups.set(contract.id, {
        contract,
        contractType: contract.providerType,
        entries: [],
        people: [],
        totalHours: 0,
        totalAmount: 0,
        weekRange: { start: entry.date, end: entry.date },
        displayName: getContractDisplayName(contract, people),
        contractNumber: contract.contractNumber || contract.id.slice(0, 12),
        rate: contract.baseHourlyRate,
        rateLabel: getRateLabel(contract),
      });
    }
    
    const group = groups.get(contract.id)!;
    
    // Add entry to group
    group.entries.push(entry);
    group.totalHours += entry.hours;
    group.totalAmount += calculateAmount(entry, contract);
    
    // Update date range
    if (entry.date < group.weekRange.start) {
      group.weekRange.start = entry.date;
    }
    if (entry.date > group.weekRange.end) {
      group.weekRange.end = entry.date;
    }
    
    // Track unique people
    const person = people.find(p => p.id === entry.userId);
    if (person && !group.people.find(p => p.id === person.id)) {
      group.people.push(person);
    }
  });
  
  // Sort: Individual contracts first, then companies, then agencies
  return Array.from(groups.values()).sort((a, b) => {
    // Sort by type first
    if (a.contractType === 'individual' && b.contractType !== 'individual') return -1;
    if (a.contractType !== 'individual' && b.contractType === 'individual') return 1;
    if (a.contractType === 'company' && b.contractType === 'agency') return -1;
    if (a.contractType === 'agency' && b.contractType === 'company') return 1;
    
    // Within same type, sort alphabetically by name
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Get totals across all contract groups
 */
export function getContractGroupTotals(groups: ContractGroup[]): {
  totalHours: number;
  totalAmount: number;
  contractCount: number;
  individualCount: number;
  companyCount: number;
} {
  return {
    totalHours: groups.reduce((sum, g) => sum + g.totalHours, 0),
    totalAmount: groups.reduce((sum, g) => sum + g.totalAmount, 0),
    contractCount: groups.length,
    individualCount: groups.filter(g => g.contractType === 'individual').length,
    companyCount: groups.filter(g => g.contractType === 'company').length,
  };
}