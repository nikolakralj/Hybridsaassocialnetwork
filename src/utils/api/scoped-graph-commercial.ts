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
  data?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export function stripCommercialEdgeFields<T extends {
  edges?: CommercialEdge[] | null;
  meta?: { viewerPartyIds?: string[] | null } | null;
}>(graph: T): T {
  const parties = new Set(graph.meta?.viewerPartyIds ?? []);
  const edges = (graph.edges ?? []).map((edge) => {
    if (edge.source && parties.has(edge.source)) return edge;
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
