-- 017_invoice_party_details.sql
-- Industry-standard invoice fields: party display names + addresses and a
-- persisted VAT percentage. All additive/nullable — safe on existing rows.
--
-- Why: wg_invoices stored only party *ids* (graph node ids). The print view
-- had nothing real to render ("From: NAS / Bill To: NAS") and the VAT % was
-- not persisted (only the computed tax_total), so drafts could not be edited
-- meaningfully.

ALTER TABLE wg_invoices
  ADD COLUMN IF NOT EXISTS from_party_name TEXT,
  ADD COLUMN IF NOT EXISTS to_party_name   TEXT,
  ADD COLUMN IF NOT EXISTS from_address    TEXT,
  ADD COLUMN IF NOT EXISTS to_address      TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (tax_rate >= 0 AND tax_rate <= 100);
