// ============================================================================
// Graph Auto-Generation from Project Wizard Data
//
// CONNECTION-BASED model: each party explicitly declares who it bills/reports to.
// This supports ANY DAG structure:
//   - Linear:   A → B → C
//   - Parallel:  A → C, B → C
//   - Skip:     A → C (bypass B)
//   - Diamond:  A → B, A → C, B → D, C → D
//   - N-tier:   A → B → C → D → E → ...
// ============================================================================

import type {
  BaseNode,
  BaseEdge,
  PartyType,
  EdgeType,
} from '../../types/workgraph';
import { getApprovalStepsForParty } from './approval-fallback';

// ============================================================================
// Input Types (from wizard)
// ============================================================================

export interface PartyEntry {
  id: string;
  name: string;
  partyType: PartyType;
  /** IDs of parties this party bills/reports to (upstream connections) */
  billsTo: string[];
  organizationId?: string;
  logo?: string;
  people: PersonEntry[];
  invitedEmail?: string;
  isCreator?: boolean;
  /** Controls which people are visible to connected parties. Defaults to 'all'. */
  chainVisibility?: 'all' | 'selected' | 'none';
}

export interface PersonEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  canApprove?: boolean;
  canViewRates?: boolean;
  canEditTimesheets?: boolean;
  /** Whether this person is visible to connected parties in the chain. Defaults to true. */
  visibleToChain?: boolean;
}

export interface GeneratedGraph {
  nodes: BaseNode[];
  edges: BaseEdge[];
}

// ============================================================================
// Topology helpers
// ============================================================================

/**
 * Compute depth of each party from the "bottom" of the DAG (parties with no
 * inbound connections are depth 0, i.e. leaf workers). This is used to assign
 * graph layers for the layout engine.
 */
export function computeDepths(parties: PartyEntry[]): Map<string, number> {
  const depths = new Map<string, number>();
  const partyMap = new Map(parties.map(p => [p.id, p]));

  // Build reverse adjacency: for each party, who bills TO it?
  const inbound = new Map<string, string[]>();
  parties.forEach(p => {
    p.billsTo.forEach(targetId => {
      if (!inbound.has(targetId)) inbound.set(targetId, []);
      inbound.get(targetId)!.push(p.id);
    });
  });

  function getDepth(id: string, visited: Set<string>): number {
    if (depths.has(id)) return depths.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);

    const children = inbound.get(id) || [];
    if (children.length === 0) {
      // This party has no one billing to it — but it might bill to someone else
      // Check if it bills to anyone
      const party = partyMap.get(id);
      if (!party || party.billsTo.length === 0) {
        depths.set(id, 0);
        return 0;
      }
    }

    // Depth = 1 + max depth of parties that bill to this one
    // But actually we want: parties with no billsTo = bottom (depth 0)
    // Parties they bill to = depth 1, etc.
    depths.set(id, 0); // temporary
    return 0;
  }

  // Better approach: topological sort from leaves
  // Leaves = parties with no billsTo (bottom of chain)
  // Then walk upward
  const computed = new Set<string>();

  function computeDepth(id: string): number {
    if (computed.has(id)) return depths.get(id) || 0;
    computed.add(id);

    // Find all parties that bill TO this party
    const children = inbound.get(id) || [];
    if (children.length === 0) {
      // Check: does this party bill to anyone?
      const party = partyMap.get(id);
      if (!party || party.billsTo.length === 0) {
        // Isolated or leaf
        depths.set(id, 0);
        return 0;
      }
      // Has outgoing but no incoming — this is a bottom party
      depths.set(id, 0);
      return 0;
    }

    const maxChildDepth = Math.max(...children.map(cid => computeDepth(cid)));
    const depth = maxChildDepth + 1;
    depths.set(id, depth);
    return depth;
  }

  parties.forEach(p => computeDepth(p.id));

  // Fix: parties with no billsTo AND no inbound should be depth 0
  // Parties that ONLY have billsTo (outgoing) but no inbound are leaves (depth 0)
  // Already handled above

  return depths;
}

// ============================================================================
// Edge type inference
// ============================================================================

function inferEdgeType(sourceType: PartyType, targetType: PartyType): EdgeType {
  if (targetType === 'client') return 'billsTo';
  if (sourceType === 'freelancer' || sourceType === 'contractor') {
    return targetType === 'client' ? 'billsTo' : 'subcontracts';
  }
  if (sourceType === 'company' && (targetType === 'agency' || targetType === 'client')) {
    return targetType === 'client' ? 'billsTo' : 'subcontracts';
  }
  if (sourceType === 'agency') return 'billsTo';
  return 'billsTo';
}

// ============================================================================
// Colors & Logos
// ============================================================================

const PARTY_COLORS: Record<PartyType, string> = {
  freelancer: '#8b5cf6',
  contractor: '#6366f1',
  company: '#3b82f6',
  agency: '#f59e0b',
  client: '#10b981',
};

const PARTY_LOGOS: Record<PartyType, string> = {
  freelancer: '👤',
  contractor: '🔧',
  company: '🏢',
  agency: '🚀',
  client: '🌐',
};

// ============================================================================
// Main Generator
// ============================================================================

export function generateGraphFromWizard(
  parties: PartyEntry[],
  projectName: string,
): GeneratedGraph {
  if (parties.length === 0) return { nodes: [], edges: [] };

  const nodes: BaseNode[] = [];
  const edges: BaseEdge[] = [];
  const depths = computeDepths(parties);

  // 1. Party nodes
  parties.forEach(party => {
    nodes.push({
      id: party.id,
      type: 'party',
      position: { x: 0, y: 0 },
      data: {
        name: party.name,
        partyType: party.partyType,
        organizationId: party.organizationId,
        logo: party.logo || PARTY_LOGOS[party.partyType],
        color: PARTY_COLORS[party.partyType],
        chainPosition: depths.get(party.id) ?? 0,
        isCreator: party.isCreator,
        invitedEmail: party.invitedEmail,
      },
    });

    // 2. Person nodes
    party.people.forEach(person => {
      // Resolve visibleToChain: party-level policy overrides individual setting
      let visible = person.visibleToChain ?? true;
      if (party.chainVisibility === 'none') visible = false;
      else if (party.chainVisibility === 'all') visible = true;
      // 'selected' (default) uses the individual person's setting

      nodes.push({
        id: person.id,
        type: 'person',
        position: { x: 0, y: 0 },
        data: {
          name: person.name,
          email: person.email,
          role: person.role,
          company: party.name,
          partyId: party.id,
          userId: person.id,
          canApprove: person.canApprove ?? false,
          canViewRates: person.canViewRates ?? true,
          canEditTimesheets: person.canEditTimesheets ?? true,
          visibleToChain: visible,
        },
      });
    });
  });

  // 3. Explicit connection edges (from billsTo)
  const partyMap = new Map(parties.map(p => [p.id, p]));
  parties.forEach(source => {
    source.billsTo.forEach(targetId => {
      const target = partyMap.get(targetId);
      if (!target) return;

      const edgeType = inferEdgeType(source.partyType, target.partyType);
      edges.push({
        id: `edge-${edgeType}-${source.id}-${targetId}`,
        type: edgeType,
        source: source.id,
        target: targetId,
        data: { edgeType, label: formatEdgeLabel(edgeType) },
      });
    });
  });

  // 4. Approval edges with fallback policy:
  // same-company approver -> nearest upstream approver -> client approver
  parties.forEach((submitterParty) => {
    const steps = getApprovalStepsForParty(submitterParty.id, parties);

    steps.forEach((step) => {
      step.approverIds.forEach((approverId) => {
        edges.push({
          id: `edge-approves-${approverId}-${submitterParty.id}-step${step.step}`,
          type: 'approves',
          source: approverId,
          target: submitterParty.id,
          data: {
            edgeType: 'approves',
            order: step.step,
            required: true,
            mode: step.mode,
            approverPartyId: step.partyId,
            label: 'approves',
          },
        });
      });
    });
  });

  return { nodes, edges };
}

// ============================================================================
// Helpers
// ============================================================================

function formatEdgeLabel(edgeType: EdgeType): string {
  const labels: Record<string, string> = {
    approves: 'approves', owns: 'owns', funds: 'funds',
    assigns: 'assigns', worksOn: 'works on', billsTo: 'bills to',
    invoices: 'invoices', subcontracts: 'subcontracts to',
  };
  return labels[edgeType] || edgeType;
}

export function validatePartyChain(parties: PartyEntry[]): string[] {
  const errors: string[] = [];
  if (parties.length === 0) {
    errors.push('At least one party is required');
    return errors;
  }
  if (parties.length < 2) {
    errors.push('This project will start as a draft until you add another party');
  } else if (!parties.some((party) => party.billsTo.length > 0)) {
    errors.push('No billing relationship has been defined yet, so this project will remain a draft');
  }

  // Check for parties with no connections
  parties.forEach(p => {
    const hasOutgoing = p.billsTo.length > 0;
    const hasIncoming = parties.some(other => other.billsTo.includes(p.id));
    if (!hasOutgoing && !hasIncoming && parties.length > 1) {
      errors.push(`"${p.name || p.partyType}" is not connected yet`);
    }
  });

  // Check for parties with no people (warning)
  parties.forEach(p => {
    if (p.people.length === 0) {
      errors.push(`"${p.name || p.partyType}" has no people assigned`);
    }
  });

  // Check fallback approval coverage for each party with people.
  parties.forEach((party) => {
    if (party.people.length === 0) return;
    const steps = getApprovalStepsForParty(party.id, parties);
    if (steps.length === 0) {
      errors.push(`"${party.name || party.partyType}" has no approver path (same-company, upstream, or client)`);
    }
  });

  return errors;
}
