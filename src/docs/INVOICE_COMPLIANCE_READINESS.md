# Invoice Compliance Readiness

Last updated: 2026-08-21

## Safe current claim

WorkGraph creates structured invoice records from approved work and preserves a
controlled draft-to-issued-to-paid lifecycle.

Current controls include:

- project-scoped invoice access
- private project billing rates
- seller, buyer, tax ID, IBAN, dates, currency, line items, tax, and totals
- consolidated monthly invoices with linked timesheet identifiers
- draft editing with content frozen after issue
- forward-only invoice status transitions
- printable invoice detail
- EN 16931-oriented template metadata and a database field for generated XML

## Not yet a safe claim

WorkGraph is not yet a certified Croatian e-invoice or fiscalization solution.
The following remain open:

- schema-valid UBL/CII XML generation and validation
- the applicable Croatian semantic and business-rule profile
- fiscalization identifiers and reporting workflow
- certificate/signature requirements
- delivery through an approved intermediary or access point
- rejection, correction, credit-note, and cancellation exchange
- legally required archive and audit retention
- payment reconciliation with accounting/banking systems

Do not use “e-invoice compliant,” “fiscalization ready,” or equivalent language
until an implementation is validated with the selected intermediary and a real
customer's accountant.

## Pilot path

1. Produce a non-zero WorkGraph invoice from real approved weeks.
2. Confirm required fields and numbering with the pilot customer's accountant.
3. Select the customer's actual accounting/e-invoice destination.
4. Build one validated export adapter and test accepted/rejected responses.
5. Add correction, archive, and reconciliation behavior before broader rollout.

The first integration should follow the first paying customer's existing system,
not a speculative provider matrix.
