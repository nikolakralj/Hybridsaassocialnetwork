import { describe, expect, it } from 'vitest';
import {
  billableWeeksForMonth,
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

  // Fixed: line amounts are rounded to the cent (half away from zero).
  it('rounds a line amount to the cent', () => {
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

  // Fixed: billing is by calendar day. The week of Mon 28 Sep - Fri 2 Oct 2026
  // is billed in two parts: Sep 28-30 on September's invoice, Oct 1-2 on
  // October's, each with its own key so neither part is billed twice.
  it('splits the 28 Sep - 2 Oct 2026 week by calendar day', () => {
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
    const [september] = billableWeeksForMonth([spanning], '2026-09');
    const [october] = billableWeeksForMonth([spanning], '2026-10');
    expect(september.totalHours).toBe(16);
    expect(october.totalHours).toBe(16);
    expect(september.billingKey).toBe('worker-a:2026-09-28@2026-09');
    expect(october.billingKey).toBe('worker-a:2026-09-28@2026-10');

    const septemberDraft = draftFor(september, rate('worker-a', 10));
    const octoberDraft = draftFor(october, rate('worker-a', 10));
    expect(septemberDraft.amount).toBe(160);
    expect(octoberDraft.amount).toBe(160);
    expect(septemberDraft.id).not.toBe(octoberDraft.id);
    expect(septemberDraft.lineItems?.[0].description).toContain('28–30 Sep only');
    expect(octoberDraft.lineItems?.[0].description).toContain('1–2 Oct only');

    // September's invoice does not block October's part, and vice versa.
    const septemberKeys = collectInvoicedTimesheetKeys([{ invoiceKey: septemberDraft.timesheetKey!, timesheetIds: [septemberDraft.timesheetKey!] }]);
    expect(excludeInvoicedWeeks([october], septemberKeys)).toEqual([october]);
    expect(excludeInvoicedWeeks([september], septemberKeys)).toEqual([]);
  });

  it('never re-bills a week that an older invoice covered whole', () => {
    const spanning = week({
      personId: 'worker-a',
      weekStart: '2026-09-28',
      days: [{ day: 'Tue', hours: 8 }, { day: 'Thu', hours: 8 }],
    });
    const legacyKeys = collectInvoicedTimesheetKeys([{ invoiceKey: makeTimesheetKey('worker-a', '2026-09-28') }]);
    expect(excludeInvoicedWeeks(billableWeeksForMonth([spanning], '2026-09'), legacyKeys)).toEqual([]);
    expect(excludeInvoicedWeeks(billableWeeksForMonth([spanning], '2026-10'), legacyKeys)).toEqual([]);
  });

  it('keeps the whole-week key for a week inside one month', () => {
    const inside = week({ personId: 'worker-a', weekStart: '2026-09-14', days: [{ day: 'Mon', hours: 8 }, { day: 'Fri', hours: 8 }] });
    const [part] = billableWeeksForMonth([inside], '2026-09');
    expect(part.billingKey).toBe(makeTimesheetKey('worker-a', '2026-09-14'));
    expect(part.isPartialWeek).toBe(false);
    expect(billableWeeksForMonth([inside], '2026-10')).toEqual([]);
  });

  it('bills weekend days that spill into the next month in that month', () => {
    const lastWeek = week({
      personId: 'worker-a',
      weekStart: '2026-10-26',
      days: [
        { day: 'Mon', hours: 8 },
        { day: 'Sat', hours: 4 },
        { day: 'Sun', hours: 2 },
      ],
    });
    // Sat 31 Oct stays in October; Sun 1 Nov goes to November.
    expect(billableWeeksForMonth([lastWeek], '2026-10')[0].totalHours).toBe(12);
    expect(billableWeeksForMonth([lastWeek], '2026-11')[0].totalHours).toBe(2);
  });

  it('only bills approved weeks and skips month parts with no hours', () => {
    const draftWeek = week({ personId: 'worker-a', weekStart: '2026-09-28', status: 'draft' });
    const emptyOctoberPart = week({ personId: 'worker-b', weekStart: '2026-09-28', days: [{ day: 'Mon', hours: 8 }] });
    expect(billableWeeksForMonth([draftWeek], '2026-09')).toEqual([]);
    expect(billableWeeksForMonth([emptyOctoberPart], '2026-10')).toEqual([]);
  });

  it('totals a consolidated invoice as the sum of its rounded lines', () => {
    const a = week({ personId: 'worker-a', weekStart: '2026-09-07', days: [{ day: 'Mon', hours: 1 }] });
    const b = week({ personId: 'worker-b', weekStart: '2026-09-07', days: [{ day: 'Mon', hours: 1 }] });
    const draft = buildConsolidatedDraft(
      { weeks: [a, b] },
      'proj_synthetic', 'Synthetic Project', 'Synthetic Client',
      { 'worker-a': { name: 'A' }, 'worker-b': { name: 'B' } },
      { 'worker-a': rate('worker-a', 10.005), 'worker-b': rate('worker-b', 10.005) },
      '2026-10-09', 0, 'September 2026', null,
    );
    expect(draft.lineItems?.map((line) => line.amount)).toEqual([10.01, 10.01]);
    expect(draft.amount).toBe(20.02);
  });
});
