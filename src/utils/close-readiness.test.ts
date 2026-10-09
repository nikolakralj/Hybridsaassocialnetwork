import { describe, expect, it } from 'vitest';
import {
  buildCloseReadinessRows,
  usablePersonName,
  type CloseReadinessInput,
  type CloseReadinessWeek,
} from './close-readiness';

/**
 * Mondays whose Mon–Fri week overlaps September 2026.
 * 1 Sep 2026 is a Tuesday, so the grid starts on Mon 31 Aug.
 * The last Monday, 28 Sep, runs through Fri 2 Oct.
 */
const SEPTEMBER_2026_WEEKS = [
  '2026-08-31',
  '2026-09-07',
  '2026-09-14',
  '2026-09-21',
  '2026-09-28',
];

function approvedWeeks(hours = 8): CloseReadinessWeek[] {
  return SEPTEMBER_2026_WEEKS.map((weekStart) => ({
    personId: 'worker-a',
    weekStart,
    status: 'approved' as const,
    hours,
  }));
}

function input(overrides: Partial<CloseReadinessInput> = {}): CloseReadinessInput {
  return {
    monthKey: '2026-09',
    expectedWeekStarts: SEPTEMBER_2026_WEEKS,
    today: '2026-10-09',
    workers: [{ personId: 'worker-a', name: 'Ada', orgId: 'org-agency', orgName: 'Synthetic Agency' }],
    weeks: approvedWeeks(),
    approvals: [],
    rates: [{ personId: 'worker-a', rate: 50, masked: false }],
    purchaseOrders: [],
    ratesLoaded: true,
    viewerCanConfirmRates: true,
    purchaseOrdersLoaded: true,
    approvalsLoaded: true,
    ...overrides,
  };
}

function row(overrides: Partial<CloseReadinessInput> = {}) {
  const rows = buildCloseReadinessRows(input(overrides));
  expect(rows).toHaveLength(1);
  return rows[0];
}

describe('close readiness', () => {
  it('marks a fully approved month with a positive rate as invoice-ready', () => {
    const ready = row();
    expect(ready.invoiceReady).toBe(true);
    expect(ready.blockers).toEqual([]);
    expect(ready.rateState).toBe('set');
    expect(ready.loggedHours).toBe(40);
    expect(ready.poState).toBe('not_required');
  });

  it('blocks missing hours with the week label', () => {
    const weeks = approvedWeeks();
    weeks[1] = { ...weeks[1], hours: 0 };
    const blocked = row({ weeks });
    expect(blocked.invoiceReady).toBe(false);
    expect(blocked.blockers).toContain('Missing hours: Sep 7–11');
  });

  it('blocks a submitted week with the pending approver name', () => {
    const weeks = approvedWeeks();
    weeks[2] = { ...weeks[2], status: 'submitted' };
    const blocked = row({
      weeks,
      approvals: [{
        personIds: ['worker-a'],
        weekStart: '2026-09-14',
        approverName: 'Quinn',
        approvalLayer: 1,
      }],
    });
    expect(blocked.invoiceReady).toBe(false);
    expect(blocked.blockers).toContain('Pending approval: Quinn');
  });

  it('does not treat the viewer label Me as an approver name', () => {
    expect(usablePersonName('Me')).toBeNull();
    expect(usablePersonName(' me ')).toBeNull();
    const weeks = approvedWeeks();
    weeks[0] = { ...weeks[0], status: 'submitted' };
    const blocked = row({
      weeks,
      approvals: [{
        personIds: ['worker-a'],
        weekStart: '2026-08-31',
        approverName: null,
      }],
    });
    expect(blocked.blockers).toContain('Submitted, but the pending approver is not recorded.');
    expect(blocked.blockers.join(' ')).not.toContain('Me');
  });

  it('blocks a missing billing rate and does not treat zero as a rate', () => {
    const missing = row({ rates: [] });
    expect(missing.invoiceReady).toBe(false);
    expect(missing.rateState).toBe('missing');
    expect(missing.blockers).toContain('Missing billing rate.');

    const zero = row({ rates: [{ personId: 'worker-a', rate: 0, masked: false }] });
    expect(zero.invoiceReady).toBe(false);
    expect(zero.rateState).toBe('missing');
    expect(zero.blockers).toContain('Missing billing rate.');
  });

  it('ignores a missing PO and a failed document load when the PO gate is off', () => {
    const omitted = row({
      requirePurchaseOrder: undefined,
      purchaseOrders: [],
      purchaseOrdersLoaded: false,
    });
    expect(omitted.invoiceReady).toBe(true);
    expect(omitted.poState).toBe('not_required');
    expect(omitted.blockers).toEqual([]);

    const explicitOff = row({
      requirePurchaseOrder: false,
      purchaseOrders: [],
      purchaseOrdersLoaded: false,
    });
    expect(explicitOff.invoiceReady).toBe(true);
    expect(explicitOff.poState).toBe('not_required');
    expect(explicitOff.blockers).toEqual([]);
  });

  it('requires a usable linked PO when the project opts in', () => {
    const missing = row({ requirePurchaseOrder: true, purchaseOrders: [], purchaseOrdersLoaded: true });
    expect(missing.invoiceReady).toBe(false);
    expect(missing.poState).toBe('missing');
    expect(missing.blockers).toContain('Missing PO.');

    const unread = row({ requirePurchaseOrder: true, purchaseOrders: [], purchaseOrdersLoaded: false });
    expect(unread.invoiceReady).toBe(false);
    expect(unread.poState).toBe('unknown');
    expect(unread.blockers).toContain('Purchase orders could not be loaded.');

    const linked = row({
      requirePurchaseOrder: true,
      purchaseOrdersLoaded: true,
      purchaseOrders: [{
        poNumber: 'PO-SYN-1',
        status: 'active',
        linkedIds: ['worker-a'],
      }],
    });
    expect(linked.invoiceReady).toBe(true);
    expect(linked.poState).toBe('set');
    expect(linked.poDetail).toBe('PO-SYN-1');
    expect(linked.blockers).toEqual([]);
  });
});
