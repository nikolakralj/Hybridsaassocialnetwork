-- 018_c2_organization_membership_and_roster.sql
-- Trust Core / C2 foundation.
--
-- Adds the missing layer between public profiles, project collaboration, and
-- graph nodes:
--   - private organization directory
--   - verified organization membership
--   - project organization participation
--   - project roster visibility
--   - signatory scaffolding for documents/contracts/rates
--
-- This migration is intentionally additive. Tightening legacy invoice/document
-- policies should happen after real project_organization mappings exist.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.wg_projects') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_projects must exist before migration 018.';
  END IF;

  IF to_regclass('public.wg_project_members') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_project_members must exist before migration 018.';
  END IF;

  IF to_regclass('public.wg_contracts') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_contracts must exist before migration 018.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION wg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Organizations / company profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wg_organizations (
  id                 TEXT PRIMARY KEY DEFAULT ('org_' || replace(gen_random_uuid()::text, '-', '')),
  name               TEXT NOT NULL,
  slug               TEXT,
  profile_visibility TEXT NOT NULL DEFAULT 'private'
                     CHECK (profile_visibility IN ('public', 'unlisted', 'private')),
  owner_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS wg_organizations_slug_uniq
  ON wg_organizations(slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS wg_organizations_created_by_idx
  ON wg_organizations(created_by);

CREATE TABLE IF NOT EXISTS wg_organization_members (
  id                 TEXT PRIMARY KEY DEFAULT ('orgmem_' || replace(gen_random_uuid()::text, '-', '')),
  organization_id    TEXT NOT NULL REFERENCES wg_organizations(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email              TEXT,
  display_name       TEXT,
  org_role           TEXT NOT NULL DEFAULT 'org_worker'
                     CHECK (org_role IN ('org_admin', 'org_finance', 'org_manager', 'org_worker', 'org_viewer')),
  membership_state   TEXT NOT NULL DEFAULT 'claimed'
                     CHECK (membership_state IN ('claimed', 'invited', 'verified', 'rejected', 'removed')),
  default_visibility TEXT NOT NULL DEFAULT 'hidden'
                     CHECK (default_visibility IN ('hidden', 'contact', 'worker', 'approver', 'finance')),
  claimed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at         TIMESTAMPTZ,
  claimed_at         TIMESTAMPTZ,
  verified_at        TIMESTAMPTZ,
  removed_at         TIMESTAMPTZ,
  data               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wg_org_members_user_or_email
    CHECK (user_id IS NOT NULL OR NULLIF(trim(COALESCE(email, '')), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS wg_org_members_org_idx
  ON wg_organization_members(organization_id);

CREATE INDEX IF NOT EXISTS wg_org_members_user_idx
  ON wg_organization_members(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wg_org_members_state_idx
  ON wg_organization_members(organization_id, membership_state);

CREATE UNIQUE INDEX IF NOT EXISTS wg_org_members_active_user_uniq
  ON wg_organization_members(organization_id, user_id)
  WHERE user_id IS NOT NULL
    AND membership_state IN ('claimed', 'invited', 'verified');

CREATE UNIQUE INDEX IF NOT EXISTS wg_org_members_active_email_uniq
  ON wg_organization_members(organization_id, lower(email))
  WHERE email IS NOT NULL
    AND membership_state IN ('claimed', 'invited', 'verified');

-- ---------------------------------------------------------------------------
-- Project organization participation + project roster
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wg_project_organizations (
  id              TEXT PRIMARY KEY DEFAULT ('porg_' || replace(gen_random_uuid()::text, '-', '')),
  project_id      TEXT NOT NULL REFERENCES wg_projects(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES wg_organizations(id) ON DELETE CASCADE,
  graph_node_id   TEXT,
  party_role      TEXT NOT NULL DEFAULT 'company'
                  CHECK (party_role IN ('agency', 'client', 'company', 'supplier', 'subcontractor', 'freelancer', 'other')),
  status          TEXT NOT NULL DEFAULT 'invited'
                  CHECK (status IN ('invited', 'active', 'declined', 'removed')),
  invited_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS wg_project_orgs_project_org_uniq
  ON wg_project_organizations(project_id, organization_id)
  WHERE status <> 'removed';

CREATE UNIQUE INDEX IF NOT EXISTS wg_project_orgs_graph_node_uniq
  ON wg_project_organizations(project_id, graph_node_id)
  WHERE graph_node_id IS NOT NULL
    AND status <> 'removed';

CREATE INDEX IF NOT EXISTS wg_project_orgs_project_idx
  ON wg_project_organizations(project_id);

CREATE INDEX IF NOT EXISTS wg_project_orgs_org_idx
  ON wg_project_organizations(organization_id);

CREATE TABLE IF NOT EXISTS wg_project_roster (
  id                     TEXT PRIMARY KEY DEFAULT ('rost_' || replace(gen_random_uuid()::text, '-', '')),
  project_id             TEXT NOT NULL REFERENCES wg_projects(id) ON DELETE CASCADE,
  organization_id        TEXT NOT NULL REFERENCES wg_organizations(id) ON DELETE CASCADE,
  organization_member_id TEXT REFERENCES wg_organization_members(id) ON DELETE SET NULL,
  user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  graph_node_id          TEXT,
  display_name           TEXT,
  visibility_mode        TEXT NOT NULL DEFAULT 'hidden'
                         CHECK (visibility_mode IN ('hidden', 'contact', 'worker', 'approver', 'finance', 'anonymized')),
  roster_role            TEXT NOT NULL DEFAULT 'worker'
                         CHECK (roster_role IN ('worker', 'contact', 'approver', 'finance', 'manager', 'observer')),
  assignment_status      TEXT NOT NULL DEFAULT 'pending'
                         CHECK (assignment_status IN ('pending', 'active', 'paused', 'removed')),
  placement_title        TEXT,
  payroll_cadence        TEXT,
  starts_on              DATE,
  ends_on                DATE,
  added_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wg_project_roster_project_idx
  ON wg_project_roster(project_id);

CREATE INDEX IF NOT EXISTS wg_project_roster_org_idx
  ON wg_project_roster(organization_id);

CREATE INDEX IF NOT EXISTS wg_project_roster_member_idx
  ON wg_project_roster(organization_member_id)
  WHERE organization_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wg_project_roster_user_idx
  ON wg_project_roster(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wg_project_roster_graph_node_uniq
  ON wg_project_roster(project_id, graph_node_id)
  WHERE graph_node_id IS NOT NULL
    AND assignment_status <> 'removed';

-- ---------------------------------------------------------------------------
-- Signatory scaffolding for documents/contracts/rates
-- ---------------------------------------------------------------------------
-- Document signatory/ACL scaffolding is intentionally skipped in this checkout
-- because wg_documents is not present in the linked database yet. Contract and
-- rate scaffolding below is still fully applied.

CREATE TABLE IF NOT EXISTS wg_contract_signatories (
  id                  TEXT PRIMARY KEY DEFAULT ('ctrsig_' || replace(gen_random_uuid()::text, '-', '')),
  contract_id          TEXT NOT NULL REFERENCES wg_contracts(id) ON DELETE CASCADE,
  organization_id      TEXT REFERENCES wg_organizations(id) ON DELETE CASCADE,
  party_graph_node_id  TEXT,
  signatory_role       TEXT NOT NULL DEFAULT 'signatory'
                       CHECK (signatory_role IN ('buyer', 'seller', 'worker_company', 'agency', 'client', 'signatory')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wg_contract_signatory_target
    CHECK (organization_id IS NOT NULL OR NULLIF(trim(COALESCE(party_graph_node_id, '')), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS wg_contract_signatories_contract_idx
  ON wg_contract_signatories(contract_id);

CREATE INDEX IF NOT EXISTS wg_contract_signatories_org_idx
  ON wg_contract_signatories(organization_id)
  WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS wg_contract_rates (
  id                     TEXT PRIMARY KEY DEFAULT ('ctrate_' || replace(gen_random_uuid()::text, '-', '')),
  contract_id             TEXT NOT NULL REFERENCES wg_contracts(id) ON DELETE CASCADE,
  organization_id         TEXT REFERENCES wg_organizations(id) ON DELETE CASCADE,
  organization_member_id  TEXT REFERENCES wg_organization_members(id) ON DELETE SET NULL,
  subject_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rate_scope              TEXT NOT NULL CHECK (rate_scope IN ('bill', 'pay', 'cost', 'markup')),
  rate_type               TEXT NOT NULL DEFAULT 'hourly'
                          CHECK (rate_type IN ('hourly', 'daily', 'fixed')),
  amount                  NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  currency                TEXT NOT NULL DEFAULT 'EUR',
  visibility_policy       TEXT NOT NULL DEFAULT 'signatories_only'
                          CHECK (visibility_policy IN ('signatories_only', 'org_private', 'explicit_acl')),
  effective_from          DATE,
  effective_to            DATE,
  created_by              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wg_contract_rates_contract_idx
  ON wg_contract_rates(contract_id);

CREATE INDEX IF NOT EXISTS wg_contract_rates_org_idx
  ON wg_contract_rates(organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wg_contract_rates_subject_user_idx
  ON wg_contract_rates(subject_user_id)
  WHERE subject_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Helper functions for non-recursive RLS checks
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION wg_user_is_verified_org_member(
  p_organization_id TEXT,
  p_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM wg_organization_members m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = auth.uid()
      AND m.membership_state = 'verified'
      AND (p_roles IS NULL OR m.org_role = ANY(p_roles))
  );
$$;

CREATE OR REPLACE FUNCTION wg_user_can_manage_project(p_project_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM wg_projects p
    WHERE p.id = p_project_id
      AND p.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM wg_project_members m
    WHERE m.project_id = p_project_id
      AND m.user_id = auth.uid()
      AND m.accepted_at IS NOT NULL
      AND m.role IN ('Owner', 'Editor')
  );
$$;

CREATE OR REPLACE FUNCTION wg_user_can_see_project(p_project_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wg_user_can_manage_project(p_project_id)
  OR EXISTS (
    SELECT 1
    FROM wg_project_members m
    WHERE m.project_id = p_project_id
      AND m.user_id = auth.uid()
      AND m.accepted_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION wg_user_can_access_project_party(
  p_project_id TEXT,
  p_party_graph_node_id TEXT,
  p_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM wg_project_organizations po
    JOIN wg_organization_members om
      ON om.organization_id = po.organization_id
    WHERE po.project_id = p_project_id
      AND po.graph_node_id = p_party_graph_node_id
      AND po.status = 'active'
      AND om.user_id = auth.uid()
      AND om.membership_state = 'verified'
      AND (p_roles IS NULL OR om.org_role = ANY(p_roles))
  );
$$;

COMMENT ON FUNCTION wg_user_is_verified_org_member(TEXT, TEXT[]) IS
  'RLS helper: true when auth.uid() is a verified member of an organization, optionally constrained by org roles.';

COMMENT ON FUNCTION wg_user_can_access_project_party(TEXT, TEXT, TEXT[]) IS
  'RLS helper: true when auth.uid() belongs to the organization mapped to a graph party on a project.';

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_organizations_updated_at') THEN
    CREATE TRIGGER wg_organizations_updated_at
      BEFORE UPDATE ON wg_organizations
      FOR EACH ROW EXECUTE FUNCTION wg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_organization_members_updated_at') THEN
    CREATE TRIGGER wg_organization_members_updated_at
      BEFORE UPDATE ON wg_organization_members
      FOR EACH ROW EXECUTE FUNCTION wg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_project_organizations_updated_at') THEN
    CREATE TRIGGER wg_project_organizations_updated_at
      BEFORE UPDATE ON wg_project_organizations
      FOR EACH ROW EXECUTE FUNCTION wg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_project_roster_updated_at') THEN
    CREATE TRIGGER wg_project_roster_updated_at
      BEFORE UPDATE ON wg_project_roster
      FOR EACH ROW EXECUTE FUNCTION wg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wg_contract_rates_updated_at') THEN
    CREATE TRIGGER wg_contract_rates_updated_at
      BEFORE UPDATE ON wg_contract_rates
      FOR EACH ROW EXECUTE FUNCTION wg_set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE wg_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_project_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_project_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_contract_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_contract_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wg_organizations_select ON wg_organizations;
CREATE POLICY wg_organizations_select
  ON wg_organizations
  FOR SELECT TO authenticated
  USING (
    profile_visibility = 'public'
    OR created_by = auth.uid()
    OR owner_user_id = auth.uid()
    OR wg_user_is_verified_org_member(id)
    OR EXISTS (
      SELECT 1
      FROM wg_project_organizations po
      WHERE po.organization_id = wg_organizations.id
        AND po.status = 'active'
        AND wg_user_can_see_project(po.project_id)
    )
  );

DROP POLICY IF EXISTS wg_organizations_insert ON wg_organizations;
CREATE POLICY wg_organizations_insert
  ON wg_organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS wg_organizations_update ON wg_organizations;
CREATE POLICY wg_organizations_update
  ON wg_organizations
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR owner_user_id = auth.uid()
    OR wg_user_is_verified_org_member(id, ARRAY['org_admin'])
  )
  WITH CHECK (
    created_by = auth.uid()
    OR owner_user_id = auth.uid()
    OR wg_user_is_verified_org_member(id, ARRAY['org_admin'])
  );

DROP POLICY IF EXISTS wg_org_members_select ON wg_organization_members;
CREATE POLICY wg_org_members_select
  ON wg_organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance', 'org_manager'])
  );

DROP POLICY IF EXISTS wg_org_members_insert ON wg_organization_members;
CREATE POLICY wg_org_members_insert
  ON wg_organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND claimed_by = auth.uid()
      AND membership_state = 'claimed'
    )
    OR EXISTS (
      SELECT 1
      FROM wg_organizations o
      WHERE o.id = organization_id
        AND o.created_by = auth.uid()
    )
    OR wg_user_is_verified_org_member(organization_id, ARRAY['org_admin'])
  );

DROP POLICY IF EXISTS wg_org_members_update ON wg_organization_members;
CREATE POLICY wg_org_members_update
  ON wg_organization_members
  FOR UPDATE TO authenticated
  USING (wg_user_is_verified_org_member(organization_id, ARRAY['org_admin']))
  WITH CHECK (wg_user_is_verified_org_member(organization_id, ARRAY['org_admin']));

DROP POLICY IF EXISTS wg_project_orgs_select ON wg_project_organizations;
CREATE POLICY wg_project_orgs_select
  ON wg_project_organizations
  FOR SELECT TO authenticated
  USING (
    wg_user_can_see_project(project_id)
    OR wg_user_is_verified_org_member(organization_id)
  );

DROP POLICY IF EXISTS wg_project_orgs_insert ON wg_project_organizations;
CREATE POLICY wg_project_orgs_insert
  ON wg_project_organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    wg_user_can_manage_project(project_id)
    OR wg_user_is_verified_org_member(organization_id, ARRAY['org_admin'])
  );

DROP POLICY IF EXISTS wg_project_orgs_update ON wg_project_organizations;
CREATE POLICY wg_project_orgs_update
  ON wg_project_organizations
  FOR UPDATE TO authenticated
  USING (
    wg_user_can_manage_project(project_id)
    OR wg_user_is_verified_org_member(organization_id, ARRAY['org_admin'])
  )
  WITH CHECK (
    wg_user_can_manage_project(project_id)
    OR wg_user_is_verified_org_member(organization_id, ARRAY['org_admin'])
  );

DROP POLICY IF EXISTS wg_project_roster_select ON wg_project_roster;
CREATE POLICY wg_project_roster_select
  ON wg_project_roster
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance', 'org_manager'])
    OR (
      visibility_mode <> 'hidden'
      AND assignment_status <> 'removed'
      AND wg_user_can_see_project(project_id)
    )
  );

DROP POLICY IF EXISTS wg_project_roster_insert ON wg_project_roster;
CREATE POLICY wg_project_roster_insert
  ON wg_project_roster
  FOR INSERT TO authenticated
  WITH CHECK (wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_manager']));

DROP POLICY IF EXISTS wg_project_roster_update ON wg_project_roster;
CREATE POLICY wg_project_roster_update
  ON wg_project_roster
  FOR UPDATE TO authenticated
  USING (wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_manager']))
  WITH CHECK (wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_manager']));

DROP POLICY IF EXISTS wg_contract_signatories_select ON wg_contract_signatories;
CREATE POLICY wg_contract_signatories_select
  ON wg_contract_signatories
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance', 'org_manager'])
  );

DROP POLICY IF EXISTS wg_contract_signatories_insert ON wg_contract_signatories;
CREATE POLICY wg_contract_signatories_insert
  ON wg_contract_signatories
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance'])
  );

DROP POLICY IF EXISTS wg_contract_rates_select ON wg_contract_rates;
CREATE POLICY wg_contract_rates_select
  ON wg_contract_rates
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR subject_user_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND wg_user_is_verified_org_member(
        organization_id,
        CASE
          WHEN rate_scope = 'pay' THEN ARRAY['org_admin', 'org_finance']
          ELSE ARRAY['org_admin', 'org_finance', 'org_manager']
        END
      )
    )
  );

DROP POLICY IF EXISTS wg_contract_rates_insert ON wg_contract_rates;
CREATE POLICY wg_contract_rates_insert
  ON wg_contract_rates
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      organization_id IS NULL
      OR wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance'])
    )
  );

DROP POLICY IF EXISTS wg_contract_rates_update ON wg_contract_rates;
CREATE POLICY wg_contract_rates_update
  ON wg_contract_rates
  FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance'])
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance'])
  );

COMMENT ON TABLE wg_organization_members IS
  'Private company directory. A claimed affiliation grants no access until verified by an org admin.';

COMMENT ON TABLE wg_project_roster IS
  'Project-specific visible roster. Hidden internal people stay invisible to agency/client project members.';

COMMENT ON TABLE wg_contract_rates IS
  'Private contract/pay/bill rates. This is the target replacement for rate fields stored in wg_projects.graph JSON.';
