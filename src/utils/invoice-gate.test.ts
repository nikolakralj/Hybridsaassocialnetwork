import { describe, expect, it } from 'vitest';
import { buildInvoiceRequestBody } from './api/invoices-api';
import { invoiceGateStatus } from './invoice-gate';

describe('invoice gate', () => {
  it('maps database refusals to 403 and 422', () => {
    expect(invoiceGateStatus('42501')).toBe(403);
    expect(invoiceGateStatus('23514')).toBe(422);
    expect(invoiceGateStatus('23505')).toBe(422);
    expect(invoiceGateStatus('08000')).toBeNull();
  });

  it('computes VAT from the tax rate and ignores a client total', () => {
    const body = buildInvoiceRequestBody({
      projectId: 'proj_synthetic',
      invoiceNumber: 'INV-SYN-TAX',
      fromPartyId: 'party_agency',
      toPartyId: 'party_client',
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      lineItems: [{ id: 'line', description: 'Hours', quantity: 8, unitPrice: 12.5, amount: 1 }],
      taxRate: 25,
      taxTotal: 999,
      subtotal: 1,
      total: 1,
    });
    expect(body.fromPartyId).toBe('party_agency');
    expect(body.toPartyId).toBe('party_client');
    expect(body.subtotal).toBe(100);
    expect(body.taxTotal).toBe(25);
    expect(body.total).toBe(125);
  });
});