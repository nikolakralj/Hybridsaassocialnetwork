/**
 * Overlay Transform Engine
 * Applies visual transformations to nodes and edges based on active overlay mode
 */

import type { OverlayMode } from './OverlayController';
import type { BaseNode, BaseEdge, EdgeType } from '../../types/workgraph';

// Local type aliases (we use our own SVG layout engine, not reactflow)
type Node = any;
type Edge = any;

export interface NodeTransform {
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  badge?: string;
  badgeColor?: string;
  icon?: string;
}

export interface EdgeTransform {
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  animated?: boolean;
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface OverlayStats {
  approvalSteps: number;
  moneyFlows: number;
  peopleCount: number;
  maskedFields: number;
}

/**
 * Apply overlay transformations to nodes and edges
 */
export function applyOverlay(
  nodes: Node[],
  edges: Edge[],
  mode: OverlayMode
): { nodes: Node[]; edges: Edge[]; stats: OverlayStats } {
  const startTime = performance.now();
  
  let transformedNodes: Node[];
  let transformedEdges: Edge[];
  let stats: OverlayStats;

  switch (mode) {
    case 'approvals':
      ({ nodes: transformedNodes, edges: transformedEdges, stats } = applyApprovalsOverlay(nodes, edges));
      break;
    case 'money':
      ({ nodes: transformedNodes, edges: transformedEdges, stats } = applyMoneyOverlay(nodes, edges));
      break;
    case 'people':
      ({ nodes: transformedNodes, edges: transformedEdges, stats } = applyPeopleOverlay(nodes, edges));
      break;
    case 'access':
      ({ nodes: transformedNodes, edges: transformedEdges, stats } = applyAccessOverlay(nodes, edges));
      break;
    default:
      ({ nodes: transformedNodes, edges: transformedEdges, stats } = applyFullOverlay(nodes, edges));
  }

  const endTime = performance.now();
  console.log(`[Overlay] Applied ${mode} overlay in ${(endTime - startTime).toFixed(2)}ms`);

  return { nodes: transformedNodes, edges: transformedEdges, stats };
}

/**
 * Full View - No filtering, reset all styles
 */
function applyFullOverlay(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[]; stats: OverlayStats } {
  return {
    nodes: nodes.map(node => ({
      ...node,
      style: {
        ...node.style,
        opacity: 1,
      },
    })),
    edges: edges.map(edge => ({
      ...edge,
      style: {
        ...edge.style,
        opacity: 1,
      },
      animated: edge.data?.edgeType === 'approves',
    })),
    stats: {
      approvalSteps: edges.filter(e => e.data?.edgeType === 'approves').length,
      moneyFlows: edges.filter(e => ['billsTo', 'invoices', 'funds'].includes(e.data?.edgeType)).length,
      peopleCount: nodes.filter(n => n.type === 'person' || n.type === 'party').length,
      maskedFields: countMaskedFields(nodes),
    },
  };
}

/**
 * Approvals Overlay - Highlight approval chain
 */
function applyApprovalsOverlay(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[]; stats: OverlayStats } {
  const approvalEdges = edges.filter(e => e.data?.edgeType === 'approves');
  const approvalNodeIds = new Set<string>();
  
  // Collect nodes involved in approval chain
  approvalEdges.forEach(edge => {
    approvalNodeIds.add(edge.source);
    approvalNodeIds.add(edge.target);
  });

  const transformedNodes = nodes.map(node => {
    const isApprover = approvalNodeIds.has(node.id) && node.data?.canApprove;
    
    return {
      ...node,
      style: {
        ...node.style,
        opacity: isApprover ? 1 : 0.2,
        borderWidth: isApprover ? 3 : 1,
        borderColor: isApprover ? '#3b82f6' : undefined,
      },
      data: {
        ...node.data,
        overlayBadge: isApprover ? '✓' : undefined,
        overlayBadgeColor: 'blue',
      },
    };
  });

  const transformedEdges = edges.map(edge => {
    const isApprovalEdge = edge.data?.edgeType === 'approves';
    
    return {
      ...edge,
      style: {
        ...edge.style,
        opacity: isApprovalEdge ? 1 : 0.1,
        stroke: isApprovalEdge ? '#3b82f6' : '#94a3b8',
        strokeWidth: isApprovalEdge ? 3 : 1,
      },
      animated: isApprovalEdge,
      label: isApprovalEdge && edge.data?.order ? `Step ${edge.data.order}` : undefined,
      labelStyle: {
        fill: '#3b82f6',
        fontWeight: 600,
        fontSize: 12,
      },
      labelBgStyle: {
        fill: '#dbeafe',
        fillOpacity: 0.9,
      },
    };
  });

  return {
    nodes: transformedNodes,
    edges: transformedEdges,
    stats: {
      approvalSteps: approvalEdges.length,
      moneyFlows: 0,
      peopleCount: 0,
      maskedFields: 0,
    },
  };
}

/**
 * Money Flow Overlay - Highlight financial edges
 */
function applyMoneyOverlay(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[]; stats: OverlayStats } {
  const moneyEdgeTypes: EdgeType[] = ['billsTo', 'invoices', 'funds'];
  const moneyEdges = edges.filter(e => moneyEdgeTypes.includes(e.data?.edgeType));
  const moneyNodeIds = new Set<string>();
  
  // Collect nodes involved in money flow
  moneyEdges.forEach(edge => {
    moneyNodeIds.add(edge.source);
    moneyNodeIds.add(edge.target);
  });

  const transformedNodes = nodes.map(node => {
    const isInMoneyFlow = moneyNodeIds.has(node.id);
    
    return {
      ...node,
      style: {
        ...node.style,
        opacity: isInMoneyFlow ? 1 : 0.2,
        borderWidth: isInMoneyFlow ? 3 : 1,
        borderColor: isInMoneyFlow ? '#10b981' : undefined,
      },
      data: {
        ...node.data,
        overlayBadge: isInMoneyFlow ? '$' : undefined,
        overlayBadgeColor: 'green',
      },
    };
  });

  const transformedEdges = edges.map(edge => {
    const isMoneyEdge = moneyEdgeTypes.includes(edge.data?.edgeType);
    
    // Calculate total if amount is specified
    const amount = edge.data?.amount;
    const label = isMoneyEdge && amount ? `$${amount.toLocaleString()}` : undefined;
    
    return {
      ...edge,
      style: {
        ...edge.style,
        opacity: isMoneyEdge ? 1 : 0.1,
        stroke: isMoneyEdge ? '#10b981' : '#94a3b8',
        strokeWidth: isMoneyEdge ? 3 : 1,
      },
      animated: isMoneyEdge,
      label,
      labelStyle: {
        fill: '#10b981',
        fontWeight: 600,
        fontSize: 12,
      },
      labelBgStyle: {
        fill: '#d1fae5',
        fillOpacity: 0.9,
      },
    };
  });

  return {
    nodes: transformedNodes,
    edges: transformedEdges,
    stats: {
      approvalSteps: 0,
      moneyFlows: moneyEdges.length,
      peopleCount: 0,
      maskedFields: 0,
    },
  };
}

/**
 * People Overlay - Capacity heatmap
 */
function applyPeopleOverlay(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[]; stats: OverlayStats } {
  const peopleNodes = nodes.filter(n => n.type === 'person' || n.type === 'party');

  const transformedNodes = nodes.map(node => {
    const isPeopleNode = node.type === 'person' || node.type === 'party';
    
    // Calculate utilization (mock for now - would come from real data)
    const utilization = node.data?.utilization || Math.random() * 120;
    const getUtilizationColor = (util: number) => {
      if (util < 80) return { bg: '#d1fae5', border: '#10b981' }; // Green - under-utilized
      if (util < 100) return { bg: '#fef3c7', border: '#f59e0b' }; // Yellow - optimal
      return { bg: '#fee2e2', border: '#ef4444' }; // Red - over-utilized
    };
    
    const colors = isPeopleNode ? getUtilizationColor(utilization) : { bg: undefined, border: undefined };
    
    return {
      ...node,
      style: {
        ...node.style,
        opacity: isPeopleNode ? 1 : 0.2,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: isPeopleNode ? 3 : 1,
      },
      data: {
        ...node.data,
        overlayBadge: isPeopleNode ? `${Math.round(utilization)}%` : undefined,
        overlayBadgeColor: utilization < 80 ? 'green' : utilization < 100 ? 'yellow' : 'red',
        utilization, // Store for tooltip
      },
    };
  });

  const transformedEdges = edges.map(edge => {
    const isAssignmentEdge = edge.data?.edgeType === 'assigns' || edge.data?.edgeType === 'worksOn';
    
    return {
      ...edge,
      style: {
        ...edge.style,
        opacity: isAssignmentEdge ? 1 : 0.1,
        stroke: isAssignmentEdge ? '#8b5cf6' : '#94a3b8',
        strokeWidth: isAssignmentEdge ? 2 : 1,
      },
      animated: isAssignmentEdge,
    };
  });

  return {
    nodes: transformedNodes,
    edges: transformedEdges,
    stats: {
      approvalSteps: 0,
      moneyFlows: 0,
      peopleCount: peopleNodes.length,
      maskedFields: 0,
    },
  };
}

/**
 * Access Overlay - Visibility rules
 */
function applyAccessOverlay(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[]; stats: OverlayStats } {
  const maskedFieldCount = countMaskedFields(nodes);

  const transformedNodes = nodes.map(node => {
    const hasMaskedFields = node.data?.visibility?.hideRateFrom?.length > 0 || 
                            node.data?.visibility?.hideTermsFrom?.length > 0;
    
    return {
      ...node,
      style: {
        ...node.style,
        opacity: hasMaskedFields ? 1 : 0.3,
        borderWidth: hasMaskedFields ? 3 : 1,
        borderColor: hasMaskedFields ? '#ef4444' : undefined,
      },
      data: {
        ...node.data,
        overlayBadge: hasMaskedFields ? '🔒' : undefined,
        overlayBadgeColor: 'red',
      },
    };
  });

  const transformedEdges = edges.map(edge => ({
    ...edge,
    style: {
      ...edge.style,
      opacity: 0.2,
    },
  }));

  return {
    nodes: transformedNodes,
    edges: transformedEdges,
    stats: {
      approvalSteps: 0,
      moneyFlows: 0,
      peopleCount: 0,
      maskedFields: maskedFieldCount,
    },
  };
}

/**
 * Count nodes with masked fields
 */
function countMaskedFields(nodes: Node[]): number {
  return nodes.filter(node => {
    const hideRateFrom = node.data?.visibility?.hideRateFrom || [];
    const hideTermsFrom = node.data?.visibility?.hideTermsFrom || [];
    return hideRateFrom.length > 0 || hideTermsFrom.length > 0;
  }).length;
}