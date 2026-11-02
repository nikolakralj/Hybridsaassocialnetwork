import { describe, expect, it } from 'vitest';
import { stripCommercialEdgeFields } from './scoped-graph-commercial';

describe('stripCommercialEdgeFields', () => {
  const edges = [
    {
      id: 'sold',
      source: 'party_agency',
      target: 'party_client',
      type: 'billsTo',
      markup: 22,
      data: { edgeType: 'billsTo', markup: 22, label: 'Agency bills client' },
    },
    {
      id: 'bought',
      source: 'party_contractor',
      target: 'party_agency',
      type: 'billsTo',
      markup: 17.25,
      data: { edgeType: 'billsTo', markup: 17.25, margin: 4, label: 'Contractor bills agency' },
    },
    {
      id: 'funded',
      source: 'party_client',
      target: 'party_agency',
      type: 'funds',
      data: { edgeType: 'funds', amount: 500, label: 'Client funds agency' },
    },
  ];

  it('keeps billing markup only for finance of the selling party', () => {
    const stripped = stripCommercialEdgeFields({
      meta: {
        viewerPartyIds: ['party_agency', 'party_contractor'],
        viewerOrgRole: 'org_finance',
        viewerFinancePartyIds: ['party_agency'],
      },
      edges,
    });
    expect(stripped.edges[0].data).toMatchObject({ markup: 22, label: 'Agency bills client' });
    expect(stripped.edges[1].data).toEqual({
      edgeType: 'billsTo',
      label: 'Contractor bills agency',
    });
    expect(stripped.edges[2].data).toMatchObject({ amount: 500 });
  });

  it('does not reuse a finance role from another party, and leaves funding amounts', () => {
    const stripped = stripCommercialEdgeFields({
      meta: {
        viewerPartyIds: ['party_agency', 'party_contractor'],
        viewerOrgRole: 'org_finance',
        viewerFinancePartyIds: [],
      },
      edges,
    });
    expect(stripped.edges[0].data?.markup).toBeUndefined();
    expect(stripped.edges[0].data?.edgeType).toBe('billsTo');
    expect(stripped.edges[2].data).toMatchObject({ amount: 500, label: 'Client funds agency' });
  });
});
