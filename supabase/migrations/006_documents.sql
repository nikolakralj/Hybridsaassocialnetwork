-- ============================================================================
-- Migration 006: WorkGraph Document Exchange
-- ============================================================================
-- Tracks every document exchanged between parties on a project:
--   NDAs, Contracts/SOWs, Invoices, POs, Expense Reports,
--   Deliverable Sign-offs, Change Orders, Compliance Docs, Rate Cards
--
-- Design decisions:
--   - from_party / to_party are graph node IDs (e.g. "org-tia", "org-nas")
--     keeping the document model graph-aware without UUID coupling
--   - status follows a linear signing lifecycle
--   - file_url points to Supabase Storage (bucket: project-documents)
--   - data JSONB holds type-specific metadata (NDA parties, PO number, etc.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DOCUMENTS TABLE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wg_documents (
  id             TEXT PRIMARY KEY,                    -- doc_xxx format
  project_id     TEXT NOT NULL REFERENCES wg_projects(id) ON DELETE CASCADE,

  -- Classification
  type           TEXT NOT NULL CHECK (type IN (
    'nda',
    'contract',
    'sow',
    'invoice',
    'purchase_order',
    'expense_report',
    'deliverable_signoff',
    'change_order',
    'compliance',
    'rate_card',
    'other'
  )),
  title          TEXT NOT NULL,
  description    TEXT,

  -- Parties (graph node IDs — no UUID dependency)
  from_party     TEXT NOT NULL,   -- who issues/submits the document
  to_party       TEXT NOT NULL,   -- who must receive/countersign

  -- Lifecycle
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending_signature',
    'countersigning',  -- from_party signed, waiting for to_party
    'signed',
    'rejected',
    'expired',
    'superseded'
  )),

  -- Signatures (array of Supabase user UUIDs)
  signed_by      UUID[]          DEFAULT '{}',
  rejected_by    UUID,
  rejection_note TEXT,

  -- Dates
  signed_at      TIMESTAMPTZ,
  rejected_at    TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,    -- NULL = no expiry

  -- File storage
  file_url       TEXT,           -- Supabase Storage URL after upload
  file_name      TEXT,
  file_size_kb   INTEGER,

  -- Flexible metadata (NDA mutual flag, invoice number, PO reference, etc.)
  data           JSONB DEFAULT '{}',

  -- Audit
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- DOCUMENT SIGNATURE AUDIT LOG
-- Records every signature action (sign / reject / countersign / void)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wg_document_events (
  id           BIGSERIAL PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES wg_documents(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'created', 'sent', 'signed', 'countersigned', 'rejected', 'expired', 'superseded', 'uploaded'
  )),
  actor_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_node   TEXT,           -- graph node ID of the actor
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_wg_documents_project
  ON wg_documents(project_id);

CREATE INDEX IF NOT EXISTS idx_wg_documents_type_status
  ON wg_documents(project_id, type, status);

CREATE INDEX IF NOT EXISTS idx_wg_documents_from_party
  ON wg_documents(project_id, from_party);

CREATE INDEX IF NOT EXISTS idx_wg_documents_to_party
  ON wg_documents(project_id, to_party);

CREATE INDEX IF NOT EXISTS idx_wg_documents_expires
  ON wg_documents(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wg_document_events_document
  ON wg_document_events(document_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_wg_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wg_documents_updated_at ON wg_documents;
CREATE TRIGGER wg_documents_updated_at
  BEFORE UPDATE ON wg_documents
  FOR EACH ROW EXECUTE FUNCTION update_wg_documents_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE wg_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_document_events ENABLE ROW LEVEL SECURITY;

-- Project members can read documents for their project
CREATE POLICY "wg_documents_read" ON wg_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wg_project_members
      WHERE project_id = wg_documents.project_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Only document creator or service role can insert
CREATE POLICY "wg_documents_insert" ON wg_documents
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Creator or project owner can update
CREATE POLICY "wg_documents_update" ON wg_documents
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM wg_project_members
      WHERE project_id = wg_documents.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'editor')
    )
  );

-- Audit log readable by project members
CREATE POLICY "wg_document_events_read" ON wg_document_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wg_documents d
      JOIN wg_project_members m ON m.project_id = d.project_id
      WHERE d.id = wg_document_events.document_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "wg_document_events_insert" ON wg_document_events
  FOR INSERT WITH CHECK (actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- SUCCESS
-- ---------------------------------------------------------------------------

SELECT
  '✅ Migration 006 complete' AS message,
  'Tables created: wg_documents, wg_document_events' AS tables,
  'Document types: nda, contract, sow, invoice, purchase_order, expense_report, deliverable_signoff, change_order, compliance, rate_card' AS types;
