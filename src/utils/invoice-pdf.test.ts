import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lineAmount, sumMoney, taxOn } from './money';
import {
  buildInvoicePdf,
  extractPdfText,
  formatPdfMoney,
  invoicePdfFilename,
  prepareInvoicePdf,
  type InvoicePdfInput,
} from './invoice-pdf';

const font = readFileSync(fileURLToPath(new URL('../assets/fonts/DejaVuSans.ttf', import.meta.url)));

function issued(overrides: Partial<InvoicePdfInput> = {}): InvoicePdfInput {
  return {
    status: 'issued',
    number: 'INV-1042',
    issueDate: '2026-09-07',
    dueDate: '2026-10-07',
    currency: 'EUR',
    sellerName: 'Čišćenje d.o.o.',
    sellerAddress: 'Ilica 1\n10000 Zagreb',
    sellerTaxId: 'HR12345678901',
    sellerIban: 'HR7323400091111004614',
    buyerName: 'Andritz AG',
    buyerAddress: 'Stattegger Strasse 18',
    buyerTaxId: 'ATU12345678',
    paymentRef: 'HR99 1042',
    notes: 'Please pay this invoice.',
    taxRate: 25,
    lines: [
      {
        description: 'Week of 2026-09-07 (Nikola, 32 hours)',
        quantity: 32,
        unitPrice: 85,
        amount: 2720,
      },
    ],
    ...overrides,
  };
}

describe('prepareInvoicePdf', () => {
  it('rounds each stored line, then VAT, and keeps a stored amount that is not qty times rate', () => {
    const prepared = prepareInvoicePdf({
      status: 'issued',
      currency: 'EUR',
      taxRate: 25,
      lines: [
        { description: 'A', quantity: 1, unitPrice: 10.005, amount: lineAmount(1, 10.005) },
        { description: 'B', quantity: 3, unitPrice: 33.333 },
        { description: 'Adjusted', quantity: 3, unitPrice: 10, amount: 30.5 },
      ],
    });
    expect(prepared.lines.map((line) => line.amount)).toEqual([10.01, 100, 30.5]);
    expect(prepared.subtotal).toBe(140.51);
    expect(prepared.subtotal).toBe(sumMoney([10.01, 100, 30.5]));
    expect(prepared.tax).toBe(35.13);
    expect(prepared.tax).toBe(taxOn(prepared.subtotal, 25));
    expect(prepared.total).toBe(175.64);
  });

  it('does not invent VAT or a currency when those fields are absent', () => {
    const prepared = prepareInvoicePdf({
      status: 'paid',
      currency: '',
      taxRate: null,
      lines: [{ description: 'Hours', quantity: 2, unitPrice: 50, amount: 100 }],
    });
    expect(prepared.currency).toBe('');
    expect(prepared.tax).toBeNull();
    expect(prepared.total).toBe(100);
    expect(formatPdfMoney(prepared.total, prepared.currency)).toBe('100.00');
  });

  it('refuses a draft and a line with no amount', () => {
    expect(() => prepareInvoicePdf({ status: 'draft', lines: [{ amount: 10 }] })).toThrow(/issued/i);
    expect(() => prepareInvoicePdf({ status: 'cancelled', lines: [{ amount: 10 }] })).toThrow(/issued/i);
    expect(() => prepareInvoicePdf({ status: 'issued', lines: [] })).toThrow(/no line items/i);
    expect(() => prepareInvoicePdf({
      status: 'issued',
      lines: [{ description: 'Missing', quantity: 1 }],
    })).toThrow(/missing an amount/i);
  });
});

describe('buildInvoicePdf', () => {
  it('writes the stored seller, buyer, tax, and 32h × 85 invoice numbers into the PDF', () => {
    const pdf = buildInvoicePdf(issued(), font);
    expect(Buffer.from(pdf.subarray(0, 8)).toString('ascii')).toBe('%PDF-1.4');
    const text = extractPdfText(pdf);
    expect(text).toContain('INV-1042');
    expect(text).toContain('Čišćenje d.o.o.');
    expect(text).toContain('Ilica 1');
    expect(text).toContain('Andritz AG');
    expect(text).toContain('HR12345678901');
    expect(text).toContain('ATU12345678');
    expect(text).toContain('HR7323400091111004614');
    expect(text).toContain('HR99 1042');
    expect(text).toContain('2026-09-07');
    expect(text).toContain('2026-10-07');
    expect(text).toContain('32.00');
    expect(text).toContain('85.00 EUR');
    expect(text).toContain('2720.00 EUR');
    expect(text).toContain('VAT (25%)');
    expect(text).toContain('680.00 EUR');
    expect(text).toContain('3400.00 EUR');
    expect(text).toContain('Please pay this invoice.');
    expect(text).not.toContain('Net 30');
    expect(text).not.toContain('WorkGraph');
    expect(text).not.toContain('Thank you');
  });

  it('leaves out currency, VAT, tax id, and IBAN when the invoice does not store them', () => {
    const text = extractPdfText(buildInvoicePdf(issued({
      number: 'INV-9',
      currency: '  ',
      taxRate: null,
      sellerTaxId: '',
      sellerIban: null,
      buyerTaxId: '   ',
      paymentRef: '',
      notes: '',
      lines: [{ description: 'Consulting', quantity: 2, unitPrice: 50, amount: 100 }],
    }), font));
    expect(text).toContain('100.00');
    expect(text).toContain('Consulting');
    expect(text).not.toMatch(/\bEUR\b|\bUSD\b|€/);
    expect(text).not.toContain('VAT');
    expect(text).not.toContain('Tax ID');
    expect(text).not.toContain('IBAN');
    expect(text).not.toContain('Payment reference');
    expect(text).not.toContain('Net 30');
  });

  it('keeps an adjusted line amount instead of recomputing qty times rate', () => {
    const text = extractPdfText(buildInvoicePdf(issued({
      currency: 'USD',
      taxRate: 0,
      lines: [{ description: 'Adjustment', quantity: 3, unitPrice: 10, amount: 30.5 }],
    }), font));
    expect(text).toContain('30.50 USD');
    expect(text).not.toContain('30.00 USD');
    expect(text).toContain('VAT (0%)');
    expect(text).toContain('0.00 USD');
  });

  it('still includes a line that lands on a later page', () => {
    const lines = Array.from({ length: 48 }, (_, index) => ({
      description: `Week ${index + 1}`,
      quantity: 1,
      unitPrice: index + 1,
      amount: index + 1,
    }));
    const text = extractPdfText(buildInvoicePdf(issued({
      currency: 'EUR',
      taxRate: null,
      lines,
    }), font));
    expect(text).toContain('Week 1');
    expect(text).toContain('Week 48');
    expect(text).toContain('1.00 EUR');
    expect(text).toContain('48.00 EUR');
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    expect(text).toContain(`${total.toFixed(2)} EUR`);
  });

  it('refuses a character the font cannot draw instead of substituting one', () => {
    expect(() => buildInvoicePdf(issued({ sellerName: 'Agency \u0378' }), font)).toThrow(/U\+0378/);
  });

  it('names the download from the invoice number', () => {
    expect(invoicePdfFilename('INV-1042')).toBe('invoice-INV-1042.pdf');
    expect(invoicePdfFilename('  ')).toBe('invoice.pdf');
    expect(invoicePdfFilename('A/B 1042')).toBe('invoice-A-B-1042.pdf');
  });
});
