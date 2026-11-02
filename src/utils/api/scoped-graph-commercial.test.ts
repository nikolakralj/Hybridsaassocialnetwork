import { describe, expect, it } from 'vitest';
import { stripCommercialEdgeFields } from './scoped-graph-commercial';

describe('stripCommercialEdgeFields', () => {
  const graph = {
    meta: { viewerPartyIds: ['party_agency'] },
    edges: [
      {
        id: 'sold',
        source: 'party_agency',
        target: 'party_client',
        markup: 22,
        data: { edgeType: 'billsTo', markup: 22, label: 'Agency bills client' },
      },
      {
        id: 'bought',
        source: 'party_contractor',
        target: 'party_agency',
        markup: 17.25,
        data: { edgeType: 'billsTo', markup: 17.25, margin: 4, label: 'Contractor bills agency' },
      },
    ],
  };

  it('keeps markup on an edge the caller sells and removes it from one they buy', () => {
    const stripped = stripCommercialEdgeFields(graph);
    expect(stripped.edges[0].data).toMatchObject({ markup: 22, label: 'Agency bills client' });
    expect(stripped.edges[1].data).toEqual({
      edgeType: 'billsTo',
      label: 'Contractor bills agency',
    });
    expect(stripped.edges[1].markup).toBeUndefined();
    expect(graph.edges[1].data?.markup).toBe(17.25);
  });

  it('strips every edge when the caller has no party', () => {
    const stripped = stripCommercialEdgeFields({ ...graph, meta: { viewerPartyIds: [] } });
    expect(stripped.edges.every((edge) => edge.data?.markup == null && edge.markup == null)).toBe(true);
    expect(stripped.edges[0].data?.edgeType).toBe('billsTo');
  });
});
