-- ============================================================================
-- Migration 010: Phase 4 invoice schema foundation
-- Purpose:
--   1) Create invoice template storage (wg_invoice_templates).
--   2) Create invoice records table (wg_invoices).
--   3) Add indexes, updated_at triggers, and RLS policies.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Guardrail: phase 4 invoice tables depend on core project/member tables.
DO $$
BEGIN
  IF to_regclass('public.wg_projects') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_projects must exist before migration 010.';
  END IF;

  IF to_regclass('public.wg_project_members') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_project_members must exist before migration 010.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Invoice templates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wg_invoice_templates (
  id          TEXT PRIMARY KEY DEFAULT ('tpl_' || gen_random_uuid()::text),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  locale      TEXT NOT NULL DEFAULT 'hr-HR',
  layout      JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_map   JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance  JSONB NOT NULL DEFAULT '{
    "standard": "urn:cen.eu:en16931:2017",
    "taxScheme": "VAT",
    "idScheme": "9934",
    "paymentRefFormat": "HR99"
  }'::jsonb,
  branding    JSONB,
  source_file TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wg_invoice_templates_owner_idx
  ON wg_invoice_templates(owner_id);

CREATE UNIQUE INDEX IF NOT EXISTS wg_invoice_templates_owner_default_idx
  ON wg_invoice_templates(owner_id)
  WHERE is_default = true;

-- ----------------------------------------------------------------------------
-- Invoices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wg_invoices (
  id              TEXT PRIMARY KEY DEFAULT ('inv_' || gen_random_uuid()::text),
  project_id      TEXT NOT NULL REFERENCES wg_projects(id) ON DELETE CASCADE,
  template_id     TEXT REFERENCES wg_invoice_templates(id) ON DELETE SET NULL,
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
  line_items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal        NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total           NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled')),
  timesheet_ids   TEXT[] NOT NULL DEFAULT '{}',
  en16931_xml     TEXT,
  pdf_url         TEXT,
  payment_ref     TEXT,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wg_invoices_due_date_after_issue
    CHECK (due_date >= issue_date),
  CONSTRAINT wg_invoices_project_invoice_number_uniq
    UNIQUE (project_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS wg_invoices_project_status_idx
  ON wg_invoices(project_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS wg_invoices_created_by_idx
  ON wg_invoices(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS wg_invoices_template_idx
  ON wg_invoices(template_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger helper and triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_invoice_templates_updated_at') THEN
    CREATE TRIGGER wg_invoice_templates_updated_at
      BEFORE UPDATE ON wg_invoice_templates
      FOR EACH ROW
      EXECUTE FUNCTION wg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_invoices_updated_at') THEN
    CREATE TRIGGER wg_invoices_updated_at
      BEFORE UPDATE ON wg_invoices
      FOR EACH ROW
      EXECUTE FUNCTION wg_set_updated_at();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------
ALTER TABLE wg_invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wg_invoice_templates_owner_all ON wg_invoice_templates;
CREATE POLICY wg_invoice_templates_owner_all
  ON wg_invoice_templates
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS wg_invoices_select_access ON wg_invoices;
CREATE POLICY wg_invoices_select_access
  ON wg_invoices
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM wg_projects p
      WHERE p.id = wg_invoices.project_id
        AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM wg_project_members m
      WHERE m.project_id = wg_invoices.project_id
        AND m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS wg_invoices_insert_access ON wg_invoices;
CREATE POLICY wg_invoices_insert_access
  ON wg_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM wg_projects p
        WHERE p.id = wg_invoices.project_id
          AND p.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM wg_project_members m
        WHERE m.project_id = wg_invoices.project_id
          AND m.user_id = auth.uid()
          AND m.accepted_at IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS wg_invoices_update_access ON wg_invoices;
CREATE POLICY wg_invoices_update_access
  ON wg_invoices
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM wg_projects p
      WHERE p.id = wg_invoices.project_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM wg_projects p
      WHERE p.id = wg_invoices.project_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS wg_invoices_delete_access ON wg_invoices;
CREATE POLICY wg_invoices_delete_access
  ON wg_invoices
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM wg_projects p
      WHERE p.id = wg_invoices.project_id
        AND p.owner_id = auth.uid()
    )
  );
