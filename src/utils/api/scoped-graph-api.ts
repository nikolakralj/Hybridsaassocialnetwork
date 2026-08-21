/**
 * scoped-graph-api.ts — M2: the Privity Rule as server truth.
 *
 * Wraps the `wg_get_scoped_graph` RPC (migration 025). The server computes
 * exactly which nodes/edges the caller may see and STRIPS commercial fields
 * (pay rates, hour limits, cross-org emails) before serialization — an
 * unauthorized party name or rate never reaches the browser, regardless of
 * what the client renders. DevTools inspection shows nothing to hide.
 *
 * Projection rules (GRAPH_CONFIDENTIALITY_SPEC → "The Privity Rule"):
 *  - org sight = own org + direct counterparties; beyond = meta.externalStages
 *  - worker sight = per-assignment roster.visibility_scope
 *    (company_only default | counterparty | named_chain)
 *  - project owners/editors get full TOPOLOGY, but pay fields only for their
 *    own org — ownership is not commercial omniscience
 *  - pay fields survive only for: self, and org_admin/org_finance of the
 *    person's own organization
 *
 * Adoption (M2-WIRE, after current UI work settles):
 *  1. WorkGraphContext / WorkGraphBuilder load via fetchScopedGraph() instead
 *     of reading project.graph directly for non-editing viewers.
 *  2. Keep computeScopedView() as client-side defense-in-depth; it becomes
 *     presentation-only.
 *  3. Graph EDITING (owner) keeps the full-graph path until an editing RPC
 *     exists — editors already see full topology by rule.
 *
 * Adversarially verified live (2026-07-15): see TRUST_CORE_REVIEW_2026-07-15.md.
 */

import { createClient } from '../supabase/client';

export type VisibilityScope = 'company_only' | 'counterparty' | 'named_chain';

export interface ScopedGraphMeta {
  projection: 'privity_v1';
  viewerPersonNodeId: string | null;
  viewerPartyIds: string[];
  viewerOrgRole: 'org_admin' | 'org_finance' | 'org_manager' | 'org_approver' | 'org_worker' | null;
  isProjectManager: boolean;
  visibilityScope: VisibilityScope;
  /** Parties beyond the caller's sight — render as "External approval · N stages". */
  externalStages: number;
  hiddenNodeCount: number;
  empty?: boolean;
}

export interface ScopedGraph {
  nodes: Array<Record<string, any>>;
  edges: Array<Record<string, any>>;
  meta: ScopedGraphMeta;
}

export async function fetchScopedGraph(projectId: string): Promise<ScopedGraph> {
  const trimmed = projectId?.trim();
  if (!trimmed) throw new Error('Project id is required');

  const supabase = createClient();
  const { data, error } = await supabase.rpc('wg_get_scoped_graph', {
    p_project_id: trimmed,
  });

  if (error) {
    if (error.code === '42501') {
      throw new Error('You do not have access to this project graph.');
    }
    throw new Error(error.message || 'Failed to load the project graph.');
  }

  const result = (data ?? {}) as Partial<ScopedGraph>;
  return {
    nodes: Array.isArray(result.nodes) ? result.nodes : [],
    edges: Array.isArray(result.edges) ? result.edges : [],
    meta: {
      projection: 'privity_v1',
      viewerPersonNodeId: null,
      viewerPartyIds: [],
      viewerOrgRole: null,
      isProjectManager: false,
      visibilityScope: 'company_only',
      externalStages: 0,
      hiddenNodeCount: 0,
      ...(result.meta ?? {}),
    },
  };
}
