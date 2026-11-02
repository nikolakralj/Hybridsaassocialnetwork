import { describe, expect, it } from 'vitest';
import { billingPathFor, linkMargin, planChainInvoices, resolveHopRate, type ChainParty, type LinkRate } from './chain-billing';

const parties: ChainParty[] = [
  { id: 'agency', name: 'Vis Agency', billsTo: ['client'], people: [{ id: 'ola' }, { id: 'ana' }] },
  { id: 'sub', name: 'Vis Sub', billsTo: ['agency'], people: [{ id: 'sam' }, { id: 'will' }] },
  { id: 'client', name: 'Vis Client', billsTo: [], people: [{ id: 'cara' }] },
];
const rate = (kind: 'supply' | 'employment', seller: string, buyer: string | null, amount: number, subject: string | null = null): LinkRate => ({
  kind, sellerPartyId: seller, buyerPartyId: buyer, subjectNodeId: subject, amount, rateType: 'hourly', currency: 'EUR',
});
const chain = [rate('supply', 'agency', 'client', 80), rate('supply', 'sub', 'agency', 60), rate('employment', 'sub', null, 45, 'will')];
type W = { personId: string; weekStart: string; hours: number };
const weeks: W[] = [{ personId: 'ana', weekStart: '2026-11-02', hours: 8 }, { personId: 'will', weekStart: '2026-11-02', hours: 8 }];
const base = {
  weeks,
  parties,
  legacyRates: {},
  workerIdOf: (w: W) => w.personId,
  weekKeysOf: (w: W) => [`${w.personId}:${w.weekStart}`],
  canBillSeller: () => true,
  invoicedKeysBySeller: new Map<string, Set<string>>(),
};

describe('chain billing', () => {
  it('walks employer -> billsTo chain', () => {
    expect(billingPathFor('will', parties)).toEqual([{ sellerId: 'sub', buyerId: 'agency' }, { sellerId: 'agency', buyerId: 'client' }]);
    expect(billingPathFor('ana', parties)).toEqual([{ sellerId: 'agency', buyerId: 'client' }]);
    expect(billingPathFor('cara', parties)).toEqual([]);
  });

  it('agency->client includes subcontracted hours at the client rate; sub->agency at the sub rate', () => {
    const plan = planChainInvoices({ ...base, linkRates: chain });
    const toClient = plan.groups.find((g) => g.sellerId === 'agency')!;
    const toAgency = plan.groups.find((g) => g.sellerId === 'sub')!;
    expect(toClient.weeks.map((w) => w.personId).sort()).toEqual(['ana', 'will']);
    expect(toClient.rates.will.rate).toBe(80);
    expect(toClient.rates.ana.rate).toBe(80);
    expect(toAgency.weeks.map((w) => w.personId)).toEqual(['will']);
    expect(toAgency.rates.will.rate).toBe(60);
    expect(plan.missing).toEqual([]);
  });

  it('never prices an invoice with the worker pay rate (45)', () => {
    const plan = planChainInvoices({ ...base, linkRates: chain });
    const prices = plan.groups.flatMap((g) => Object.values(g.rates).map((r) => r.rate));
    expect(prices).not.toContain(45);
  });

  it('dedupes per seller: the sub invoice does not stop the agency billing the same week onward', () => {
    const plan = planChainInvoices({ ...base, linkRates: chain, invoicedKeysBySeller: new Map([['sub', new Set(['will:2026-11-02'])]]) });
    expect(plan.groups.map((g) => g.sellerId)).toEqual(['agency']);
    expect(plan.groups[0].weeks.map((w) => w.personId).sort()).toEqual(['ana', 'will']);
  });

  it('old invoices without a seller still block every hop', () => {
    const plan = planChainInvoices({ ...base, linkRates: chain, unattributedInvoicedKeys: new Set(['will:2026-11-02']) });
    expect(plan.groups.flatMap((g) => g.weeks.map((w) => w.personId))).toEqual(['ana']);
  });

  it('legacy per-person rate prices only the final hop; a missing link rate blocks that seller invoice only', () => {
    const plan = planChainInvoices({ ...base, linkRates: [], legacyRates: { ana: { rate: 80 }, will: { rate: 80 } } });
    expect(plan.groups.map((g) => `${g.sellerId}>${g.buyerId}`)).toEqual(['agency>client']);
    expect(plan.groups[0].weeks).toHaveLength(2);
    expect(plan.missing.map((m) => `${m.sellerId}>${m.buyerId}:${m.workerId}`)).toEqual(['sub>agency:will']);
  });

  it('per-worker supply override wins over the general link rate', () => {
    const hop = resolveHopRate({ sellerId: 'agency', buyerId: 'client' }, 'will', [...chain, rate('supply', 'agency', 'client', 95, 'will')], {}, true);
    expect(hop?.rate).toBe(95);
    expect(hop?.source).toBe('link-worker');
  });

  it('only bills sellers the caller may bill for', () => {
    const plan = planChainInvoices({ ...base, linkRates: chain, canBillSeller: (id) => id === 'sub' });
    expect(plan.groups.map((g) => g.sellerId)).toEqual(['sub']);
  });

  it('margin needs both sides: agency 80-60 on Will, sub 60-45, none for the client', () => {
    expect(linkMargin('agency', 'will', parties, chain)?.margin).toBe(20);
    expect(linkMargin('sub', 'will', parties, chain)?.margin).toBe(15);
    expect(linkMargin('client', 'will', parties, chain)).toBeNull();
    // What the agency can actually read (no 45) still gives its own margin, and the sub's is unknown to it.
    const agencyView = chain.filter((r) => r.kind === 'supply');
    expect(linkMargin('agency', 'will', parties, agencyView)?.margin).toBe(20);
    expect(linkMargin('sub', 'will', parties, agencyView)).toBeNull();
  });

  it('chainBillingRates: ready only when every hop has a readable rate', async () => {
    const { chainBillingRates } = await import('./chain-billing');
    const parties = [
      { id: 'ag', billsTo: ['cl'], people: [{ id: 'ana' }] },
      { id: 'sub', billsTo: ['ag'], people: [{ id: 'will' }] },
      { id: 'cl', billsTo: [], people: [] },
    ];
    const rates = [
      { kind: 'supply' as const, sellerPartyId: 'ag', buyerPartyId: 'cl', subjectNodeId: null, amount: 80, rateType: 'hourly' as const, currency: 'EUR' },
    ];
    expect(Object.keys(chainBillingRates(['ana', 'will'], parties, rates, {}))).toEqual(['ana']);
    const both = chainBillingRates(['ana', 'will'], parties, [...rates, { ...rates[0], sellerPartyId: 'sub', buyerPartyId: 'ag', amount: 60 }], {});
    expect(both.will.rate).toBe(80);
  });
});
