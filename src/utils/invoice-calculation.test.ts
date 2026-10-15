import { describe, expect, it } from 'vitest';
import {
  buildConsolidatedDraft,
  buildDraftFromWeek,
  collectInvoicedTimesheetKeys,
  excludeInvoicedWeeks,
  filterApprovedWeeks,
  makeTimesheetKey,
  weeksEligibleForInvoiceDrafts,
} from '../components/invoices/InvoicesWorkspace';
import { buildInvoiceRequestBody } from './api/invoices-api';
import { getMondaysForMonth, weekOverlapsMonth } from '../contexts/TimesheetDataContext';
import type { PersonRate } from './api/invoices-api';
import type { StoredWeek } from '../types/timesheets';

function rate(personId: string, amount: number, extras: Partial<PersonRate> = {}): PersonRate {
  return {
    personId,
    rate: amount,
    rateType: 'hourly',
    currency: 'EUR',
    masked: false,
    ...extras,
  };
}

function week(partial: Partial<StoredWeek> & Pick<StoredWeek, 'personId' | 'weekStart'>): StoredWeek {
  return {
    weekLabel: partial.weekStart,
    days: [{ day: 'Mon', hours: 8 }],
    tasks: [],
    status: 'approved',
    ...partial,
  };
}

function draftFor(stored: StoredWeek, personRate: PersonRate | undefined) {
  return buildDraftFromWeek(
    stored,
    'proj_synthetic',
    'Synthetic Project',
    'Synthetic Client',
    { [stored.graphNodeId || stored.personId]: { name: stored.personId } },
    personRate,
    '2026-10-09',
    0,
    null,
  );
}

describe('invoice maths', () => {
  it('sets the line amount to hours times the hourly rate', () => {
    const stored = week({
      personId: 'worker-a',
      weekStart: '2026-09-07',
      days: [
        { day: 'Mon', hours: 8 },
        { day: 'Tue', hours: 8 },
        { day: 'Wed', hours: 4 },
      ],
    });
    const draft = draftFor(stored, rate('worker-a', 12.5));
    expect(draft.hours).toBe(20);
    expect(draft.rate).toBe(12.5);
    expect(draft.amount).toBe(250);
    expect(draft.lineItems?.[0]).toMatchObject({ quantity: 20, unitPrice: 12.5, amount: 250 });
  });

  it('rounds VAT to the cent on the invoice subtotal', () => {
    const even = buildInvoiceRequestBody({
      projectId: 'proj_synthetic',
      invoiceNumber: 'INV-SYN-EVEN',
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      lineItems: [{ id: 'line-even', description: 'Hours', quantity: 8, unitPrice: 12.5, amount: 100 }],
      taxRate: 25,
    });
    expect(even.subtotal).toBe(100);
    expect(even.taxTotal).toBe(25);
    expect(even.total).toBe(125);

    const cents = buildInvoiceRequestBody({
      projectId: 'proj_synthetic',
      invoiceNumber: 'INV-SYN-CENTS',
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      lineItems: [{ id: 'line-cents', description: 'Hours', quantity: 1, unitPrice: 10.1, amount: 10.1 }],
      taxRate: 25,
    });
    // 10.10 * 25% = 2.525, rounded half up to 2.53. Total 12.63.
    expect(cents.subtotal).toBe(10.1);
    expect(cents.taxTotal).toBe(2.53);
    expect(cents.total).toBeCloseTo(12.63, 2);
  });

  it('makes a consolidated invoice total the sum of the per-worker totals', () => {
    const ada = week({
      personId: 'worker-a',
      weekStart: '2026-09-07',
      days: [{ day: 'Mon', hours: 8 }],
    });
    const bo = week({
      personId: 'worker-b',
      weekStart: '2026-09-07',
      days: [{ day: 'Mon', hours: 4 }],
    });
    const adaDraft = draftFor(ada, rate('worker-a', 100));
    const boDraft = draftFor(bo, rate('worker-b', 80));
    const consolidated = buildConsolidatedDraft(
      { sellerId: 'party-agency', sellerName: 'Synthetic Agency', buyerName: 'Synthetic Client', weeks: [ada, bo] },
      'proj_synthetic',
      'Synthetic Project',
      'Synthetic Client',
      { 'worker-a': { name: 'Ada' }, 'worker-b': { name: 'Bo' } },
      { 'worker-a': rate('worker-a', 100), 'worker-b': rate('worker-b', 80) },
      '2026-10-09',
      0,
      'September 2026',
      null,
    );

    expect(adaDraft.amount).toBe(800);
    expect(boDraft.amount).toBe(320);
    expect(consolidated.amount).toBe(adaDraft.amount + boDraft.amount);
    expect(consolidated.lineItems?.reduce((sum, line) => sum + line.amount, 0)).toBe(consolidated.amount);
    expect(consolidated.timesheetIds).toEqual([
      makeTimesheetKey('worker-a', '2026-09-07'),
      makeTimesheetKey('worker-b', '2026-09-07'),
    ]);

    const billed = buildInvoiceRequestBody({
      projectId: 'proj_synthetic',
      invoiceNumber: 'INV-SYN-CONS',
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      lineItems: consolidated.lineItems,
      taxRate: 25,
    });
    expect(billed.subtotal).toBe(1120);
    expect(billed.taxTotal).toBe(280);
    expect(billed.total).toBe(1400);
  });

  it('keeps rejected, draft, and pending weeks out of the invoice set', () => {
    const weeks = [
      week({ personId: 'worker-a', weekStart: '2026-09-07', status: 'approved' }),
      week({ personId: 'worker-a', weekStart: '2026-09-14', status: 'draft' }),
      week({ personId: 'worker-a', weekStart: '2026-09-21', status: 'submitted' }),
      week({ personId: 'worker-a', weekStart: '2026-09-28', status: 'rejected' }),
    ];
    const approved = filterApprovedWeeks(weeks);
    expect(approved.map((item) => item.weekStart)).toEqual(['2026-09-07']);
  });

  it('does not invoice the same timesheet twice, including weeks inside a consolidated invoice', () => {
    const first = week({ personId: 'worker-a', weekStart: '2026-09-07' });
    const second = week({ personId: 'worker-b', weekStart: '2026-09-14' });
    const keys = collectInvoicedTimesheetKeys([{
      invoiceKey: makeTimesheetKey(first.personId, first.weekStart),
      timesheetIds: [
        makeTimesheetKey(first.personId, first.weekStart),
        makeTimesheetKey(second.personId, second.weekStart),
      ],
    }]);
    expect(excludeInvoicedWeeks([first, second, week({ personId: 'worker-a', weekStart: '2026-09-21' })], keys))
      .toEqual([week({ personId: 'worker-a', weekStart: '2026-09-21' })]);
  });

  it('blocks every draft when a worker has no positive unmasked rate, and never emits amount 0', () => {
    const ada = week({ personId: 'worker-a', weekStart: '2026-09-07' });
    const bo = week({ personId: 'worker-b', weekStart: '2026-09-07' });
    const nameFor = (personId: string) => ({ 'worker-a': 'Ada', 'worker-b': 'Bo' }[personId] || personId);

    for (const rates of [
      {},
      { 'worker-a': rate('worker-a', 0) },
      { 'worker-a': rate('worker-a', 100, { masked: true }) },
      { 'worker-a': rate('worker-a', 100), 'worker-b': rate('worker-b', 0) },
    ]) {
      const gate = weeksEligibleForInvoiceDrafts([ada, bo], rates, nameFor);
      expect(gate.weeks).toEqual([]);
      expect(gate.missingRateNames.length).toBeGreaterThan(0);
      const drafts = gate.weeks.map((stored) => draftFor(stored, rates[stored.personId]));
      expect(drafts).toEqual([]);
      expect(drafts.some((draft) => draft.amount === 0)).toBe(false);
    }

    const ready = weeksEligibleForInvoiceDrafts(
      [ada],
      { 'worker-a': rate('worker-a', 100) },
      nameFor,
    );
    expect(ready.missingRateNames).toEqual([]);
    expect(ready.weeks).toEqual([ada]);
    expect(draftFor(ready.weeks[0], rate('worker-a', 100)).amount).toBe(800);
  });

  // Known failure: line amounts are the raw product. 1h * 10.005 is stored as
  // 10.005, not 10.01. VAT rounding above is separate and does round to the cent.
  it.fails('rounds a line amount to the cent', () => {
    const stored = week({
      personId: 'worker-a',
      weekStart: '2026-09-07',
      days: [{ day: 'Mon', hours: 1 }],
    });
    const draft = draftFor(stored, rate('worker-a', 10.005));
    expect(draft.amount).toBe(10.01);
    expect(draft.lineItems?.[0].amount).toBe(10.01);
  });
});

describe('week and month splitting', () => {
  it('lists the week of 29 Sep 2026 in both months and the next Monday only in October', () => {
    // Mon 28 Sep–Fri 2 Oct contains Tue 29 Sep. Mon 5 Oct is the following week.
    expect(getMondaysForMonth('2026-09')).toEqual([
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
    expect(getMondaysForMonth('2026-10')).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
    expect(getMondaysForMonth('2026-13')).toEqual([]);
    expect(weekOverlapsMonth('2026-09-28', '2026-09')).toBe(true);
    expect(weekOverlapsMonth('2026-09-28', '2026-10')).toBe(true);
    expect(weekOverlapsMonth('2026-10-05', '2026-09')).toBe(false);
    expect(weekOverlapsMonth('2026-10-05', '2026-10')).toBe(true);
  });

  it('bills a month-spanning week once, whichever month generates second', () => {
    const spanning = week({ personId: 'worker-a', weekStart: '2026-09-28' });
    expect(getMondaysForMonth('2026-09')).toContain(spanning.weekStart);
    expect(getMondaysForMonth('2026-10')).toContain(spanning.weekStart);

    const septemberKeys = collectInvoicedTimesheetKeys([{
      invoiceKey: makeTimesheetKey(spanning.personId, spanning.weekStart),
      timesheetIds: [makeTimesheetKey(spanning.personId, spanning.weekStart)],
    }]);
    expect(excludeInvoicedWeeks([spanning], septemberKeys)).toEqual([]);
  });

  // Known failure: there is no day-level split. The Mon 28 Sep–Fri 2 Oct week
  // is one timesheet. September hours (29–30) and October hours (1–2) stay on
  // a single line, so the month that invoices it bills the other month's days.
  it.fails('splits the 29 Sep–5 Oct 2026 week by calendar day', () => {
    const spanning = week({
      personId: 'worker-a',
      weekStart: '2026-09-28',
      days: [
        { day: 'Mon', hours: 0 },
        { day: 'Tue', hours: 8 },
        { day: 'Wed', hours: 8 },
        { day: 'Thu', hours: 8 },
        { day: 'Fri', hours: 8 },
      ],
    });
    const draft = draftFor(spanning, rate('worker-a', 10));
    const quantities = (draft.lineItems ?? []).map((line) => line.quantity).sort((left, right) => left - right);
    expect(quantities).toEqual([16, 16]);
  });
});
