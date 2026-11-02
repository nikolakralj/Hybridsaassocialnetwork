/** Commercial fields stored on a graph edge. The seller is the source party. */

export const COMMERCIAL_EDGE_KEYS = [
  'markup',
  'margin',
  'marginPercent',
  'markupPercent',
  'sellRate',
  'buyRate',
  'hourlyRate',
  'dailyRate',
  'fixedAmount',
  'rate',
  'amount',
  'cost',
  'fee',
] as const;

export interface CommercialEdge {
  source?: string;
  type?: string;
  data?: Record<string, unknown> | null;
  [key: string]: unknown;
}

const BILLING_EDGE_TYPES = new Set(['billsTo', 'subcontracts', 'bills_to']);

function edgeKind(edge: CommercialEdge): string {
  const dataType = edge.data && typeof edge.data.edgeType === 'string' ? edge.data.edgeType : '';
  return dataType || edge.type || '';
}

export function stripCommercialEdgeFields<T extends {
  edges?: CommercialEdge[] | null;
  meta?: { viewerPartyIds?: string[] | null; viewerOrgRole?: string | null } | null;
}>(graph: T): T {
  const parties = new Set(graph.meta?.viewerPartyIds ?? []);
  const role = graph.meta?.viewerOrgRole || '';
  const finance = role === 'org_admin' || role === 'org_finance';
  const edges = (graph.edges ?? []).map((edge) => {
    if (!BILLING_EDGE_TYPES.has(edgeKind(edge))) return edge;
    if (finance && edge.source && parties.has(edge.source)) return edge;
    const data = { ...(edge.data ?? {}) };
    const next: CommercialEdge = { ...edge, data };
    for (const key of COMMERCIAL_EDGE_KEYS) {
      delete data[key];
      delete next[key];
    }
    return next;
  });
  return { ...graph, edges };
}
