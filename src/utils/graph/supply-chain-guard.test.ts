import { describe, expect, it } from 'vitest';
import {
  assertScopedSupplyChainUpdate,
  partyRemovalBlockers,
  supplyChainStructureDiff,
} from '../../../supabase/functions/server/supply-chain-guard';

const party = (id: string, name: string, partyType: string, billsTo: string[] = []) => ({ id, name, partyType, billsTo });
const pnode = (id: string, name: string) => ({ id, type: 'party', data: { name } });
const person = (id: string, partyId: string) => ({ id, type: 'person', data: { name: id, partyId } });
const bills = (s: string, t: string) => ({ id: `e-${s}-${t}`, type: 'billsTo', source: s, target: t, data: { edgeType: 'billsTo' } });
const employs = (p: string, org: string) => ({ id: `emp-${p}`, type: 'employs', source: org, target: p, data: { edgeType: 'employs' } });

function base() {
  return {
    parties: [party('agency', 'Agency', 'agency', ['client']), party('sub', 'Sub', 'company', ['agency']), party('client', 'Client', 'client')],
    graph: {
      nodes: [pnode('agency', 'Agency'), pnode('sub', 'Sub'), pnode('client', 'Client'), person('ana', 'agency'), person('will', 'sub')],
      edges: [bills('agency', 'client'), bills('sub', 'agency'), employs('ana', 'agency'), employs('will', 'sub')],
    },
  };
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function withNewClient2() {
  const next = clone(base());
  next.parties.push(party('client2', 'Client Two', 'client'));
  next.parties[0].billsTo.push('client2');
  next.graph.nodes.push(pnode('client2', 'Client Two'), person('cleo', 'client2'));
  next.graph.edges.push(bills('agency', 'client2'), employs('cleo', 'client2'));
  return next;
}

function withoutSub() {
  const next = clone(base());
  next.parties = next.parties.filter((p) => p.id !== 'sub');
  next.graph.nodes = next.graph.nodes.filter((n) => n.id !== 'sub' && n.id !== 'will');
  next.graph.edges = next.graph.edges.filter((e) => e.source !== 'sub' && e.target !== 'sub' && e.target !== 'will');
  return next;
}

describe('supply-chain guard: structure changes', () => {
  it('diffs added and removed parties', () => {
    expect(supplyChainStructureDiff(base(), withNewClient2())).toEqual({ added: ['client2'], removed: [] });
    expect(supplyChainStructureDiff(base(), withoutSub())).toEqual({ added: [], removed: ['sub'] });
  });

  it('a structure manager can add a company with people and a connection', () => {
    expect(() => assertScopedSupplyChainUpdate(base(), withNewClient2(), 'agency', { allowStructure: true })).not.toThrow();
  });

  it('a non-structure manager cannot add or remove companies', () => {
    expect(() => assertScopedSupplyChainUpdate(base(), withNewClient2(), 'agency')).toThrow(/governed project-structure/);
    expect(() => assertScopedSupplyChainUpdate(base(), withoutSub(), 'agency')).toThrow(/governed project workflow/);
  });

  it('a structure manager can remove another company with its people and links', () => {
    expect(() => assertScopedSupplyChainUpdate(base(), withoutSub(), 'agency', { allowStructure: true })).not.toThrow();
  });

  it('removal must take the removed company\'s people with it', () => {
    const next = withoutSub();
    next.graph.nodes.push(person('will', 'sub'));
    expect(() => assertScopedSupplyChainUpdate(base(), next, 'agency', { allowStructure: true })).toThrow(/removed with it/);
  });

  it('nobody can remove their own organization', () => {
    const next = clone(base());
    next.parties = next.parties.filter((p) => p.id !== 'agency').map((p) => ({ ...p, billsTo: p.billsTo.filter((id) => id !== 'agency') }));
    next.graph.nodes = next.graph.nodes.filter((n) => n.id !== 'agency' && n.id !== 'ana');
    next.graph.edges = next.graph.edges.filter((e) => e.source !== 'agency' && e.target !== 'agency');
    expect(() => assertScopedSupplyChainUpdate(base(), next, 'agency', { allowStructure: true })).toThrow(/your own organization/);
  });

  it('adding a company does not unlock edits to other existing companies', () => {
    const next = withNewClient2();
    next.parties[1].name = 'Sub (renamed)';
    expect(() => assertScopedSupplyChainUpdate(base(), next, 'agency', { allowStructure: true })).toThrow(/only change your own organization/);
    const next2 = withNewClient2();
    next2.graph.nodes = next2.graph.nodes.map((n) => (n.id === 'will' ? { ...n, data: { ...n.data, name: 'X' } } : n));
    expect(() => assertScopedSupplyChainUpdate(base(), next2, 'agency', { allowStructure: true })).toThrow(/owned by another organization/);
  });

  it('other parties may only lose connections to the removed party', () => {
    const next = withoutSub();
    next.parties[1].billsTo = ['agency']; // client suddenly bills agency
    expect(() => assertScopedSupplyChainUpdate(base(), next, 'agency', { allowStructure: true })).toThrow(/only change your own organization/);
  });

  it('existing own-party behaviour is unchanged without structure rights', () => {
    const next = clone(base());
    next.graph.nodes.push(person('ivo', 'agency'));
    next.graph.edges.push(employs('ivo', 'agency'));
    expect(() => assertScopedSupplyChainUpdate(base(), next, 'agency')).not.toThrow();
    expect(() => assertScopedSupplyChainUpdate(base(), next, 'sub')).toThrow(/owned by your organization/);
  });
});

describe('party removal blockers', () => {
  it('blocks removal when the party has history', () => {
    expect(partyRemovalBlockers({ acceptedMembers: 0, timesheetWeeks: 0, invoices: 0 })).toEqual([]);
    expect(partyRemovalBlockers({ acceptedMembers: 1, timesheetWeeks: 2, invoices: 1 })).toEqual([
      '2 timesheet week(s)', '1 invoice(s)', '1 member(s) who already joined',
    ]);
  });
});
