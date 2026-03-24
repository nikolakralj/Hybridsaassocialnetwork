-- =============================================================================
-- WorkGraph Core Schema — Migration 005
-- Replaces KV store (kv_store_f8b491be) with proper relational tables.
-- TEXT primary keys preserve existing generated IDs (proj_xxx, ctr_xxx, etc.)
-- so old KV data can be migrated without breaking references.
-- JSONB columns used for schema-flexible data (graph, week days, contract data).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PROJECTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wg_projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  region       TEXT NOT NULL DEFAULT 'EU',
  currency     TEXT NOT NULL DEFAULT 'EUR',
  start_date   DATE,
  end_date     DATE,
  work_week    JSONB NOT NULL DEFAULT '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}',
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','draft')),
  supply_chain_status TEXT CHECK (supply_chain_status IN ('complete','incomplete')),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Graph stored as JSONB by design — topology is schema-flexible
  graph        JSONB,
  parties      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wg_projects_owner_idx ON wg_projects(owner_id);
CREATE INDEX IF NOT EXISTS wg_projects_status_idx ON wg_projects(status);

-- ---------------------------------------------------------------------------
-- PROJECT MEMBERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wg_project_members (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES wg_projects(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name     TEXT,
  user_email    TEXT,
  role          TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Owner','Editor','Contributor','Commenter','Viewer')),
  scope         TEXT,
  invited_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at   TIMESTAMPTZ,
  invitation_id TEXT
);

CREATE INDEX IF NOT EXISTS wg_members_project_idx ON wg_project_members(project_id);
CREATE INDEX IF NOT EXISTS wg_members_user_idx    ON wg_project_members(user_id);
CREATE INDEX IF NOT EXISTS wg_members_email_idx   ON wg_project_members(user_email);

-- ---------------------------------------------------------------------------
-- PROJECT INVITATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wg_project_invitations (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES wg_projects(id) ON DELETE CASCADE,
  project_name        TEXT,
  email               TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'Viewer',
  scope               TEXT,
  invited_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by_name     TEXT,
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ,
  declined_at         TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined'))
);

CREATE INDEX IF NOT EXISTS wg_invitations_project_idx ON wg_project_invitations(project_id);
CREATE INDEX IF NOT EXISTS wg_invitations_email_idx   ON wg_project_invitations(email);
CREATE INDEX IF NOT EXISTS wg_invitations_status_idx  ON wg_project_invitations(status);

-- ---------------------------------------------------------------------------
-- CONTRACTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wg_contracts (
  id          TEXT PRIMARY KEY,
  project_id  TEXT REFERENCES wg_projects(id) ON DELETE SET NULL,
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  rate        NUMERIC,
  rate_type   TEXT DEFAULT 'hourly',
  currency    TEXT DEFAULT 'EUR',
  start_date  DATE,
  end_date    DATE,
  description TEXT,
  -- Full contract data blob for fields not in dedicated columns
  data        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wg_contracts_owner_idx   ON wg_contracts(owner_id);
CREATE INDEX IF NOT EXISTS wg_contracts_project_idx ON wg_contracts(project_id);

-- ---------------------------------------------------------------------------
-- TIMESHEET WEEKS
-- Key insight: week data (days, TimeEntry[]) is stored as JSONB because the
-- data model evolves frequently (Phase 3.5 added TimeEntry categories).
-- Scalar fields (status, dates) are promoted to columns for query performance.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wg_timesheet_weeks (
  id           TEXT PRIMARY KEY,   -- "{userId}:{weekStart}" for easy lookup
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   TEXT REFERENCES wg_projects(id) ON DELETE SET NULL,
  week_start   DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  total_hours  NUMERIC GENERATED ALWAYS AS (
    COALESCE((data->>'totalHours')::numeric, 0)
  ) STORED,
  data         JSONB NOT NULL,      -- Full StoredWeek JSON (days, entries, tasks)
  submitted_at TIMESTAMPTZ,
  approved_at  TIMESTAMPTZ,
  approved_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start, project_id)
);

CREATE INDEX IF NOT EXISTS wg_weeks_user_idx    ON wg_timesheet_weeks(user_id);
CREATE INDEX IF NOT EXISTS wg_weeks_project_idx ON wg_timesheet_weeks(project_id);
CREATE INDEX IF NOT EXISTS wg_weeks_start_idx   ON wg_timesheet_weeks(week_start);
CREATE INDEX IF NOT EXISTS wg_weeks_status_idx  ON wg_timesheet_weeks(status);

-- ---------------------------------------------------------------------------
-- UPDATED_AT triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_projects_updated_at') THEN
    CREATE TRIGGER wg_projects_updated_at
      BEFORE UPDATE ON wg_projects FOR EACH ROW EXECUTE FUNCTION wg_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_contracts_updated_at') THEN
    CREATE TRIGGER wg_contracts_updated_at
      BEFORE UPDATE ON wg_contracts FOR EACH ROW EXECUTE FUNCTION wg_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_weeks_updated_at') THEN
    CREATE TRIGGER wg_weeks_updated_at
      BEFORE UPDATE ON wg_timesheet_weeks FOR EACH ROW EXECUTE FUNCTION wg_set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE wg_projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_project_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_contracts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_timesheet_weeks     ENABLE ROW LEVEL SECURITY;

-- Projects: owner sees all their projects; members see projects they belong to
CREATE POLICY wg_projects_owner ON wg_projects
  FOR ALL TO authenticated USING (owner_id = auth.uid());

CREATE POLICY wg_projects_member ON wg_projects
  FOR SELECT TO authenticated USING (
    id IN (SELECT project_id FROM wg_project_members
           WHERE user_id = auth.uid() AND accepted_at IS NOT NULL)
  );

-- Members: project owner + the member themselves
CREATE POLICY wg_members_owner ON wg_project_members
  FOR ALL TO authenticated USING (
    project_id IN (SELECT id FROM wg_projects WHERE owner_id = auth.uid())
  );

CREATE POLICY wg_members_self ON wg_project_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Invitations: project owner manages; invitee sees their own
CREATE POLICY wg_invitations_owner ON wg_project_invitations
  FOR ALL TO authenticated USING (
    project_id IN (SELECT id FROM wg_projects WHERE owner_id = auth.uid())
  );

CREATE POLICY wg_invitations_email ON wg_project_invitations
  FOR SELECT TO authenticated USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Contracts: owner only
CREATE POLICY wg_contracts_owner ON wg_contracts
  FOR ALL TO authenticated USING (owner_id = auth.uid());

-- Timesheets: own rows only (approval handled at app layer for now)
CREATE POLICY wg_weeks_owner ON wg_timesheet_weeks
  FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY wg_weeks_project_member ON wg_timesheet_weeks
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM wg_project_members
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- =============================================================================
-- Run this in Supabase Dashboard > SQL Editor, or via:
--   supabase db push  (if supabase CLI is configured)
-- =============================================================================
