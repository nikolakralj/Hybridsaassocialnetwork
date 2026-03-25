# Phase 4 Spec: Invoice Template Engine

**Status: READY TO BUILD (start when Phase 3 gate = GO)**
**Author: Claude (Lead Architect)**
**Date: 2026-03-25**

---

## The Problem

Every agency has their own invoice format. Croatian law mandates EN16931-compliant
eRačun XML. No existing tool connects approved timesheet data → user's own invoice
template → legally valid e-invoice in one step.

WorkGraph can do all three simultaneously because the graph already knows:
- Who bills whom (contract edges)
- At what rates (wg_contracts)
- How many approved hours (wg_timesheet_weeks with status='approved')
- Both parties' OIB/tax IDs (party nodes)

---

## Reference Invoice

File: `src/docs/samples/invoice-3-1-1_triangle_services.pdf`

Extracted structure from PROTIA7 j.d.o.o. → Triangle Services d.o.o.:

```
Seller:   PROTIA7 j.d.o.o., OIB: HR49441260776, ID scheme: 9934
Buyer:    Triangle Services d.o.o., OIB: HR69149763426, ID scheme: 9934
Standard: urn:cen.eu:en16931:2017 (PEPPOL BIS 3.0)
Currency: EUR
VAT rate: 25% (Croatian standard / standardna stopa)
Payment:  HR99 reference format, 30-day terms
IBAN:     HR7323400091111004614

Line items:
  1. Service delivery (automation system)  - 1.500,00 EUR
  2. Travel: Accommodation                 - 918,21 EUR
  3. Travel: Car rental                    - 2.429,33 EUR
  4. Travel: KLM flight                    - 1.034,85 EUR
  Subtotal: 5.882,39 EUR | VAT: 1.470,60 EUR | Total: 7.352,99 EUR
```

---

## Architecture

```
User uploads PDF/image invoice
         │
         ▼
┌─────────────────────────┐
│  Template Extractor     │  Claude AI API (claude-sonnet-4-6)
│  - Layout zones         │  Prompt: "Extract invoice structure as JSON"
│  - Field mapping        │  Input: PDF text + image
│  - Compliance metadata  │  Output: InvoiceTemplate JSON
│  - Locale/language      │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  wg_invoice_templates   │  Stored in Supabase
│  (JSON schema per user) │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Invoice Generator      │
│  Input:                 │
│   - Approved timesheet  │
│     weeks               │
│   - Contract rates      │
│   - Party OIB/tax data  │
│   - User's template     │
│  Output:                │
│   1. PDF (visual)       │
│   2. EN16931 XML        │
│   3. JSON state         │
└─────────────────────────┘
```

---

## Database Schema

```sql
-- Run as migration 008 or 009 (after 007_approval_records.sql)

CREATE TABLE IF NOT EXISTS wg_invoice_templates (
  id          TEXT PRIMARY KEY DEFAULT 'tpl_' || gen_random_uuid()::text,
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  locale      TEXT NOT NULL DEFAULT 'hr-HR',
  layout      JSONB NOT NULL DEFAULT '{}',
  field_map   JSONB NOT NULL DEFAULT '{}',
  compliance  JSONB NOT NULL DEFAULT '{
    "standard": "urn:cen.eu:en16931:2017",
    "taxScheme": "VAT",
    "idScheme": "9934",
    "paymentRefFormat": "HR99"
  }',
  branding    JSONB,
  source_file TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wg_invoices (
  id              TEXT PRIMARY KEY DEFAULT 'inv_' || gen_random_uuid()::text,
  project_id      TEXT NOT NULL REFERENCES wg_projects(id) ON DELETE CASCADE,
  template_id     TEXT REFERENCES wg_invoice_templates(id),
  invoice_number  TEXT NOT NULL,
  from_party_id   TEXT NOT NULL,
  to_party_id     TEXT NOT NULL,
  from_tax_id     TEXT,
  to_tax_id       TEXT,
  from_iban       TEXT,
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  delivery_date   DATE,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  line_items      JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','issued','paid','partially_paid','overdue','cancelled')),
  timesheet_ids   TEXT[] DEFAULT '{}',
  en16931_xml     TEXT,
  pdf_url         TEXT,
  payment_ref     TEXT,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## AI Template Extraction Prompt

Use Claude API (`claude-sonnet-4-6`) with this system prompt when user uploads PDF:

```
You are an invoice template extractor.
Analyze the provided invoice and return a JSON object with this exact structure:

{
  "locale": "hr-HR",  // detected language/locale
  "layout": {
    "header": {
      "invoiceNumberLabel": "Račun:",  // label used for invoice number
      "position": "top-left"
    },
    "parties": {
      "sellerLabel": "PRODAVATELJ:",
      "buyerLabel": "KUPAC:",
      "layout": "two-column-right"
    },
    "lineItems": {
      "columns": ["#", "Naziv artikla/usluge", "JM", "Količina", "Cijena", "Popust", "Stopa poreza", "Iznos"],
      "hasStandardIdentifier": true
    },
    "totals": {
      "position": "bottom-right",
      "showSubtotal": true,
      "showTaxBreakdown": true
    }
  },
  "compliance": {
    "standard": "urn:cen.eu:en16931:2017",
    "taxScheme": "VAT",
    "idScheme": "9934",
    "paymentRefFormat": "HR99",
    "taxRate": 25
  },
  "fieldMap": {
    "invoiceNumber": "Račun",
    "issueDate": "Datum izdavanja",
    "dueDate": "Datum dospijeća",
    "taxDate": "Datum PDV-a",
    "currency": "Šifra valute",
    "paymentRef": "Poziv na broj",
    "buyerIBAN": "Broj računa Primatelja"
  }
}

Return only the JSON object, no explanation.
```

---

## User Flow

```
1. User goes to project → Invoices tab
2. Clicks "Import Template" → uploads their invoice PDF
3. AI extracts template schema (5-10 seconds)
4. User sees preview: "We detected your template (Croatian eRačun format)"
5. User can edit: invoice number format, payment terms, VAT rate, IBAN
6. User saves template as "My Company Template"

Then for each invoice generation:
1. User clicks "Generate Invoice" on approved timesheet
2. System auto-populates: party data from graph, hours from approved weeks,
   rates from contracts, tax from template compliance settings
3. User reviews line items, adjusts if needed
4. Click "Export PDF" → matches their original layout
5. Click "Export eRačun XML" → EN16931 compliant, ready for Moj-eRačun submission
```

---

## Files to Create

```
src/components/invoices/
  InvoiceTemplateExtractor.tsx   # Upload + AI extraction UI
  InvoiceGenerator.tsx           # Approved timesheet → invoice form
  InvoicePreview.tsx             # Visual preview matching template
  InvoiceExporter.tsx            # PDF + EN16931 XML export

supabase/functions/server/
  invoice-templates-api.tsx      # CRUD for wg_invoice_templates
  invoices-api.tsx               # CRUD + generate for wg_invoices
  invoice-extract-api.tsx        # Claude API call for template extraction

src/utils/
  invoice-en16931.ts             # Generate EN16931 XML from invoice data
  invoice-pdf.ts                 # Generate PDF from template + data
```

---

## EN16931 XML Output Sample

For reference — what the XML export should look like for the reference invoice:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ID>3-1-1</cbc:ID>
  <cbc:IssueDate>2025-12-21</cbc:IssueDate>
  <cbc:DueDate>2026-01-21</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="9934">49441260776</cbc:EndpointID>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>PROTIA7 j.d.o.o.</cbc:RegistrationName>
        <cbc:CompanyID>HR49441260776</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <!-- ... buyer, line items, tax totals -->
</Invoice>
```

---

## Competitive Advantage

No other tool in the HR/EU SME market does this combination:
- **Graph-aware**: rates and parties come from the contract graph, not manual entry
- **Template-learning**: AI clones your existing invoice, you don't start from scratch
- **eRačun compliant**: EN16931 XML export ready for Moj-eRačun/FINA submission
- **Approval-connected**: only approved timesheets can generate invoices

This is the "approved work becomes billable work without friction" moment the roadmap defines.
