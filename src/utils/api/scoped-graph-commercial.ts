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
const SELLER_PRIVATE_KEYS = ['markup', 'margin', 'marginPercent', 'markupPercent', 'cost'] as const;
const SHARED_TERM_KEYS = ['sellRate', 'buyRate', 'hourlyRate', 'dailyRate', 'fixedAmount', 'rate', 'amount', 'fee'] as const;

function edgeKind(edge: CommercialEdge): string {
  const dataType = edge.data && typeof edge.data.edgeType === 'string' ? edge.data.edgeType : '';
  return dataType || edge.type || '';
}

export function stripCommercialEdgeFields<T extends {
  edges?: CommercialEdge[] | null;
  meta?: {
    viewerPartyIds?: string[] | null;
    viewerOrgRole?: string | null;
    viewerFinancePartyIds?: string[] | null;
  } | null;
}>(graph: T): T {
  const financeParties = new Set(graph.meta?.viewerFinancePartyIds ?? []);
  const edges = (graph.edges ?? []).map((edge) => {
    if (!BILLING_EDGE_TYPES.has(edgeKind(edge))) return edge;
    const sourceFinance = Boolean(edge.source && financeParties.has(edge.source));
    const targetFinance = Boolean(edge.target && financeParties.has(edge.target));
    if (sourceFinance) return edge;
    const keys = targetFinance
      ? SELLER_PRIVATE_KEYS
      : [...SELLER_PRIVATE_KEYS, ...SHARED_TERM_KEYS];
    const data = { ...(edge.data ?? {}) };
    const next: CommercialEdge = { ...edge, data };
    for (const key of keys) {
      delete data[key];
      delete next[key];
    }
    return next;
  });
  return { ...graph, edges };
}
