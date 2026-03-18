/**
 * Graph Visibility Engine
 * 
 * Implements Relationship-Based Access Control (ReBAC):
 * Each party sees the graph from their node outward (1-2 hops),
 * with edges they don't have permission to see simply not rendered.
 * 
 * Visibility rules:
 * - You always see yourself
 * - You see nodes you're directly connected to (1 hop)
 * - You see nodes 2 hops away but with masked data
 * - Rates are only visible to contract signatories
 * - Internal org details are hidden from external parties
 */

import type { BaseNode, BaseEdge } from '../../types/workgraph';

// ============================================================================
// Types
// ============================================================================

export type ViewerType = 'admin' | 'company' | 'agency' | 'client' | 'freelancer';

export interface ViewerIdentity {
  nodeId: string;          // Which node in the graph this viewer IS
  type: ViewerType;
  name: string;
  orgId?: string;          // If person, which org they belong to
}

export interface VisibleNode extends BaseNode {
  visibility: 'full' | 'partial' | 'masked';
  maskedFields?: string[]; // Which data fields are hidden
  hopDistance: number;      // How far from the viewer
}

export interface VisibleEdge extends BaseEdge {
  visibility: 'full' | 'partial' | 'hidden';
  maskedData?: string[];   // Which edge data fields are hidden
}

export interface ScopedGraphView {
  viewer: ViewerIdentity;
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  hiddenNodeCount: number;  // "X more nodes you can't see"
  hiddenEdgeCount: number;
}

// ============================================================================
// Helper functions
// ============================================================================

// Helper: check if an edge represents a billing/business relationship
function isBillingEdge(edgeType: string | undefined): boolean {
  return edgeType === 'bills_to' || edgeType === 'billsTo' || edgeType === 'subcontracts' || edgeType === 'funds';
}

// Helper: check if an edge represents a structural relationship (billing or approval)
function isStructuralEdge(edgeType: string | undefined): boolean {
  return edgeType === 'approves' || isBillingEdge(edgeType);
}

// ============================================================================
// Hop distance calculator (BFS from viewer node)
// ============================================================================

function computeHopDistances(
  viewerNodeId: string,
  viewerOrgId: string | undefined,
  nodes: BaseNode[],
  edges: BaseEdge[]
): Map<string, number> {
  const distances = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();

  // Build adjacency list (undirected)
  nodes.forEach(n => adjacency.set(n.id, new Set()));
  edges.forEach(e => {
    adjacency.get(e.source)?.add(e.target);
    adjacency.get(e.target)?.add(e.source);
  });

  // Add virtual adjacency for person→org based on partyId (auto-generated graphs
  // don't always create explicit employs/assigns edges)
  nodes.forEach(n => {
    if (n.type === 'person' && n.data?.partyId) {
      const orgId = n.data.partyId;
      if (adjacency.has(orgId)) {
        adjacency.get(n.id)?.add(orgId);
        adjacency.get(orgId)?.add(n.id);
      }
    }
  });

  // BFS from viewer
  const startNodes = [viewerNodeId];
  // If viewer is a person in an org, also start from the org
  if (viewerOrgId) startNodes.push(viewerOrgId);

  startNodes.forEach(start => {
    if (!distances.has(start)) distances.set(start, 0);
  });

  const queue = [...startNodes];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distances.get(current)!;
    const neighbors = adjacency.get(current) || new Set();

    for (const neighbor of neighbors) {
      if (!distances.has(neighbor) || distances.get(neighbor)! > currentDist + 1) {
        distances.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    }
  }

  return distances;
}

// ============================================================================
// Determine what fields to mask based on viewer type and target node
// ============================================================================

function getMaskedFields(
  viewer: ViewerIdentity,
  targetNode: BaseNode,
  hopDistance: number,
  edges: BaseEdge[]
): string[] {
  const masked: string[] = [];

  if (viewer.type === 'admin') return []; // Admin sees everything

  // Client can't see internal rates
  if (viewer.type === 'client') {
    if (targetNode.type === 'contract') {
      // Client can only see rate if they're a party to the contract
      const isParty =
        targetNode.data?.parties?.partyA === viewer.nodeId ||
        targetNode.data?.parties?.partyB === viewer.nodeId;
      if (!isParty) {
        masked.push('hourlyRate', 'dailyRate', 'fixedAmount', 'weeklyHourLimit', 'monthlyHourLimit');
      }
    }
    if (targetNode.type === 'person' && hopDistance > 1) {
      masked.push('role', 'canViewRates', 'canEditTimesheets');
    }
  }

  // Agency can't see company's internal employee details
  if (viewer.type === 'agency') {
    if (targetNode.type === 'person') {
      const personOrg = getPersonOrg(targetNode, edges);
      if (personOrg && personOrg !== viewer.nodeId && personOrg !== viewer.orgId) {
        masked.push('canViewRates', 'canEditTimesheets', 'role');
      }
    }
    if (targetNode.type === 'contract') {
      const isParty =
        targetNode.data?.parties?.partyA === viewer.nodeId ||
        targetNode.data?.parties?.partyB === viewer.nodeId ||
        targetNode.data?.parties?.partyA === viewer.orgId ||
        targetNode.data?.parties?.partyB === viewer.orgId;
      if (!isParty) {
        masked.push('hourlyRate', 'dailyRate', 'fixedAmount');
      }
    }
  }

  // Company can't see agency's rates to client
  if (viewer.type === 'company') {
    if (targetNode.type === 'contract') {
      const isParty =
        targetNode.data?.parties?.partyA === viewer.nodeId ||
        targetNode.data?.parties?.partyB === viewer.nodeId ||
        targetNode.data?.parties?.partyA === viewer.orgId ||
        targetNode.data?.parties?.partyB === viewer.orgId;
      if (!isParty) {
        masked.push('hourlyRate', 'dailyRate', 'fixedAmount');
      }
    }
  }

  // Freelancer sees very limited data beyond their own chain
  if (viewer.type === 'freelancer') {
    if (hopDistance > 1) {
      masked.push('hourlyRate', 'dailyRate', 'fixedAmount', 'weeklyHourLimit', 'monthlyHourLimit');
    }
    if (targetNode.type === 'person' && targetNode.id !== viewer.nodeId) {
      masked.push('canViewRates', 'canEditTimesheets');
    }
  }

  return masked;
}

function getPersonOrg(person: BaseNode, edges: BaseEdge[]): string | null {
  const employEdge = edges.find(
    e => (e.data?.edgeType === 'employs' || e.data?.edgeType === 'assigns') && e.target === person.id
  );
  return employEdge?.source || null;
}

// ============================================================================
// Main visibility computation
// ============================================================================

export function computeScopedView(
  viewer: ViewerIdentity,
  allNodes: BaseNode[],
  allEdges: BaseEdge[],
  maxHops: number = 3
): ScopedGraphView {
  // Admin sees everything
  if (viewer.type === 'admin') {
    return {
      viewer,
      nodes: allNodes.map(n => ({
        ...n,
        visibility: 'full' as const,
        maskedFields: [],
        hopDistance: 0,
      })),
      edges: allEdges.map(e => ({
        ...e,
        visibility: 'full' as const,
        maskedData: [],
      })),
      hiddenNodeCount: 0,
      hiddenEdgeCount: 0,
    };
  }

  // For employees (person with orgId), use tighter scoping:
  // They should see ONLY their own chain upward (self → org → client),
  // NOT coworkers or other org's people.
  const effectiveMaxHops = viewer.orgId ? 2 : maxHops;

  const distances = computeHopDistances(viewer.nodeId, viewer.orgId, allNodes, allEdges);

  // Build org membership lookup for scoping
  const nodeToOrg = new Map<string, string>();
  allEdges.forEach(e => {
    if (e.data?.edgeType === 'employs' || e.data?.edgeType === 'assigns') {
      nodeToOrg.set(e.target, e.source);
    }
  });
  // Also pick up partyId from person node data (auto-generated graphs)
  allNodes.forEach(n => {
    if (n.type === 'person' && n.data?.partyId && !nodeToOrg.has(n.id)) {
      nodeToOrg.set(n.id, n.data.partyId);
    }
  });

  // Helper: check if a person node is directly connected to a given org
  const personConnectsToOrg = (personId: string, orgId: string) => {
    return allEdges.some(e =>
      (e.source === personId && e.target === orgId) ||
      (e.target === personId && e.source === orgId)
    );
  };

  // Filter nodes by hop distance + viewer-specific scope
  const visibleNodes: VisibleNode[] = [];
  let hiddenNodeCount = 0;

  allNodes.forEach(node => {
    const dist = distances.get(node.id);
    if (dist === undefined || dist > effectiveMaxHops) {
      hiddenNodeCount++;
      return;
    }

    // ── Employee scoping for person nodes ──
    // An employee sees:
    //   - Themselves (always)
    //   - Colleagues in their own org
    //   - If approver: people from directly connected parties (if visibleToChain)
    // They do NOT see people from unrelated orgs.
    if (viewer.orgId && node.type === 'person' && node.id !== viewer.nodeId) {
      const personOrg = nodeToOrg.get(node.id);
      const isSameOrg = personOrg === viewer.orgId;
      if (isSameOrg) {
        // Colleague in same org — always visible
      } else {
        // Person from another org — only visible if:
        // 1. Viewer is an approver
        // 2. The other org is directly connected to viewer's org
        // 3. The person is visibleToChain
        const viewerNode = allNodes.find(n => n.id === viewer.nodeId);
        const isApprover = viewerNode?.data?.canApprove === true;
        const isConnectedOrg = personOrg && allEdges.some(e =>
          ((e.source === viewer.orgId && e.target === personOrg) ||
           (e.target === viewer.orgId && e.source === personOrg)) &&
          isStructuralEdge(e.data?.edgeType)
        );
        if (!isApprover || !isConnectedOrg || node.data?.visibleToChain === false) {
          hiddenNodeCount++;
          return;
        }
      }
    }

    // ── Employee scoping: org/party nodes ──
    if (viewer.orgId && node.type === 'party' && node.id !== viewer.orgId) {
      const isDirectClient = allEdges.some(e =>
        ((e.source === viewer.orgId && e.target === node.id) ||
         (e.target === viewer.orgId && e.source === node.id)) &&
        isStructuralEdge(e.data?.edgeType)
      );
      const sharesContract = allNodes.some(n =>
        n.type === 'contract' &&
        ((n.data?.parties?.partyA === viewer.orgId && n.data?.parties?.partyB === node.id) ||
         (n.data?.parties?.partyB === viewer.orgId && n.data?.parties?.partyA === node.id))
      );
      if (!isDirectClient && !sharesContract) {
        hiddenNodeCount++;
        return;
      }
    }

    // ── Employee scoping: contracts ──
    // Only show contracts that involve the employee's org
    if (viewer.orgId && node.type === 'contract') {
      const involvesOrg =
        node.data?.parties?.partyA === viewer.orgId ||
        node.data?.parties?.partyB === viewer.orgId;
      if (!involvesOrg) {
        hiddenNodeCount++;
        return;
      }
    }

    // ── Org viewer scoping (company/agency without orgId) ──
    // An org sees: its own employees, its contracts, the client.
    // It does NOT see other orgs' employees or unrelated freelancers.
    if (!viewer.orgId && (viewer.type === 'company' || viewer.type === 'agency') && node.type === 'person') {
      const personOrg = nodeToOrg.get(node.id);

      // If the person belongs to the viewer's org, always show them
      if (personOrg === viewer.nodeId) {
        // own employee — visible
      } else if (personOrg && personOrg !== viewer.nodeId) {
        // Person belongs to another org — only show if visibleToChain is true
        if (node.data?.visibleToChain === false) {
          hiddenNodeCount++;
          return;
        }
        // visibleToChain is true (or undefined, defaults to true) — allow through
      } else if (!personOrg) {
        // Freelancer (no org) — only show if directly connected to viewer's org
        if (!personConnectsToOrg(node.id, viewer.nodeId)) {
          hiddenNodeCount++;
          return;
        }
      }
    }

    // ── Org viewer: hide other org parties that aren't the client ──
    // e.g., Acme shouldn't see BrightWorks (a peer agency), but should see the client
    if (!viewer.orgId && (viewer.type === 'company' || viewer.type === 'agency') && node.type === 'party') {
      if (node.id !== viewer.nodeId) {
        // Only allow if this org is directly connected to the viewer via contract or approval
        const isDirectlyConnected = allEdges.some(e =>
          ((e.source === viewer.nodeId && e.target === node.id) ||
           (e.target === viewer.nodeId && e.source === node.id)) &&
          isStructuralEdge(e.data?.edgeType)
        );
        // Also allow if connected via a shared contract
        const sharesContract = allNodes.some(n =>
          n.type === 'contract' &&
          ((n.data?.parties?.partyA === viewer.nodeId && n.data?.parties?.partyB === node.id) ||
           (n.data?.parties?.partyB === viewer.nodeId && n.data?.parties?.partyA === node.id))
        );
        if (!isDirectlyConnected && !sharesContract) {
          hiddenNodeCount++;
          return;
        }
      }
    }

    // ── Org viewer: hide contracts that don't involve this org ──
    if (!viewer.orgId && (viewer.type === 'company' || viewer.type === 'agency') && node.type === 'contract') {
      const involvesOrg =
        node.data?.parties?.partyA === viewer.nodeId ||
        node.data?.parties?.partyB === viewer.nodeId;
      if (!involvesOrg) {
        hiddenNodeCount++;
        return;
      }
    }

    const maskedFields = getMaskedFields(viewer, node, dist, allEdges);
    const visibility: 'full' | 'partial' | 'masked' =
      dist === 0 ? 'full' :
      dist === 1 ? (maskedFields.length > 0 ? 'partial' : 'full') :
      'partial';

    // Apply masking to data
    const maskedData = { ...node.data };
    maskedFields.forEach(field => {
      if (maskedData[field] !== undefined) {
        maskedData[field] = '••••';
      }
    });

    visibleNodes.push({
      ...node,
      data: maskedData,
      visibility,
      maskedFields,
      hopDistance: dist,
    });
  });

  // Filter edges - only show if both endpoints are visible
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges: VisibleEdge[] = [];
  let hiddenEdgeCount = 0;

  allEdges.forEach(edge => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
      hiddenEdgeCount++;
      return;
    }

    const srcDist = distances.get(edge.source) || 0;
    const tgtDist = distances.get(edge.target) || 0;
    const maxDist = Math.max(srcDist, tgtDist);

    visibleEdges.push({
      ...edge,
      visibility: maxDist <= 1 ? 'full' : 'partial',
      maskedData: [],
    });
  });

  return {
    viewer,
    nodes: visibleNodes,
    edges: visibleEdges,
    hiddenNodeCount,
    hiddenEdgeCount,
  };
}

// ============================================================================
// Build viewer options from graph data
// ============================================================================

export function buildViewerOptions(
  nodes: BaseNode[],
  edges: BaseEdge[]
): ViewerIdentity[] {
  const viewers: ViewerIdentity[] = [];

  // Admin (god mode)
  viewers.push({
    nodeId: '__admin__',
    type: 'admin',
    name: 'Admin (Full View)',
  });

  // Organizations
  nodes
    .filter(n => n.type === 'party')
    .forEach(n => {
      const ptype = n.data?.partyType;
      const viewerType: ViewerType =
        ptype === 'client' ? 'client' :
        ptype === 'agency' ? 'agency' :
        'company';

      viewers.push({
        nodeId: n.id,
        type: viewerType,
        name: n.data?.name || n.id,
      });
    });

  // Build org lookup from edges (employs/assigns → person belongs to org)
  const personToOrg = new Map<string, string>();
  edges.forEach(e => {
    if (e.data?.edgeType === 'employs' || e.data?.edgeType === 'assigns') {
      personToOrg.set(e.target, e.source);
    }
  });
  // Also use partyId from person node data (auto-generated graphs)
  nodes.forEach(n => {
    if (n.type === 'person' && n.data?.partyId && !personToOrg.has(n.id)) {
      personToOrg.set(n.id, n.data.partyId);
    }
  });

  // All people — employees, freelancers, contractors
  nodes
    .filter(n => n.type === 'person')
    .forEach(n => {
      const role = n.data?.role || '';
      const isFreelancer = role === 'individual_contributor' || role === 'freelancer';
      const orgId = personToOrg.get(n.id);

      viewers.push({
        nodeId: n.id,
        type: isFreelancer ? 'freelancer' : 'company',
        name: n.data?.name || n.id,
        orgId,
      });
    });

  return viewers;
}