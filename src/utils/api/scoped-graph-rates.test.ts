import { describe, expect, it } from 'vitest';
import { rateFromScopedNode, ratesFromScopedGraph } from './scoped-graph-rates';

describe('ratesFromScopedGraph', () => {
  it('reads a rate the scoped graph actually contains', () => {
    const rates = ratesFromScopedGraph({
      nodes: [
        {
          id: 'person_rodman',
          type: 'person',
          data: { name: 'Rodman', contractType: 'hourly', hourlyRate: 80.55, currency: 'eur' },
        },
      ],
    });
    expect(rates.person_rodman).toMatchObject({
      personId: 'person_rodman',
      personName: 'Rodman',
      rate: 80.55,
      rateType: 'hourly',
      currency: 'EUR',
      masked: false,
    });
  });

  it('omits a person who has no rate instead of inventing one', () => {
    const rates = ratesFromScopedGraph({
      nodes: [
        { id: 'person_james', type: 'person', data: { name: 'James' } },
        { id: 'party_client', type: 'party', data: { name: 'Client', hourlyRate: 999 } },
      ],
    });
    expect(rates).toEqual({});
    expect(rateFromScopedNode({ id: 'person_james', type: 'person', data: { hourlyRate: '••••' } })?.masked).toBe(true);
    expect(ratesFromScopedGraph({
      nodes: [{ id: 'person_james', type: 'person', data: { hourlyRate: '••••' } }],
    })).toEqual({});
  });

  it('keeps only the rates on the payload it was given', () => {
    const rates = ratesFromScopedGraph({
      nodes: [
        { id: 'person_rodman', type: 'person', data: { hourlyRate: 80.55 } },
        { id: 'person_nikola', type: 'person', data: { contractType: 'daily', dailyRate: 400 } },
      ],
    });
    expect(Object.keys(rates).sort()).toEqual(['person_nikola', 'person_rodman']);
    expect(rates.person_nikola.rateType).toBe('daily');
    expect(rates.person_nikola.rate).toBe(400);
  });
});
