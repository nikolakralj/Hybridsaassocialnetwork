-- 044_link_rates.sql
-- Per-link rates: one rate on each company->company billing link (supply) and
-- on each company->worker employment link. A company sees only the rates on
-- links it is party to. See qa-shots design-per-link-rates.md.
--
-- NOT APPLIED. Written as a file for review (Nikola's OK needed).
--
-- Vis example: supply Agency->Client 80, supply Sub->Agency 60,
-- employment Sub->Will 45. Client reads 80; Agency reads 80 and 60 (not 45);
-- Sub reads 60 and 45; Will reads 45 only.

BEGIN;

CREATE TABLE IF NOT EXISTS public.wg_link_rates (
  id                     TEXT PRIMARY KEY DEFAULT ('lrate_' || replace(gen_random_uuid()::text, '-', '')),
  project_id             TEXT NOT NULL REFERENCES public.wg_projects(id) ON DELETE CASCADE,
  link_kind              TEXT NOT NULL CHECK (link_kind IN ('supply', 'employment')),
  seller_party_id        TEXT NOT NULL,
  buyer_party_id         TEXT,
  subject_graph_node_id  TEXT,
  subject_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rate_type              TEXT NOT NULL DEFAULT 'hourly' CHECK (rate_type IN ('hourly', 'daily', 'fixed')),
  amount                 NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency               TEXT NOT NULL DEFAULT 'EUR',
  effective_from         DATE,
  effective_to           DATE,
  created_by             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wg_link_rates_shape CHECK (
    (link_kind = 'supply' AND buyer_party_id IS NOT NULL AND buyer_party_id <> seller_party_id)
    OR (link_kind = 'employment' AND buyer_party_id IS NULL AND subject_graph_node_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS wg_link_rates_active_uniq
  ON public.wg_link_rates (project_id, link_kind, seller_party_id,
                           COALESCE(buyer_party_id, ''), COALESCE(subject_graph_node_id, ''))
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS wg_link_rates_project_idx ON public.wg_link_rates (project_id);

DROP TRIGGER IF EXISTS wg_link_rates_updated_at ON public.wg_link_rates;
CREATE TRIGGER wg_link_rates_updated_at
  BEFORE UPDATE ON public.wg_link_rates
  FOR EACH ROW EXECUTE FUNCTION wg_set_updated_at();

-- The caller is a decision-maker for this party on this project: an accepted
-- project member scoped to the party with Owner/Editor role or approval
-- rights, or a verified org admin/finance/manager/approver of the org mapped
-- to the party. can_view_rates is deliberately NOT used: the wizard defaulted
-- it to true for every worker.
CREATE OR REPLACE FUNCTION public.wg_user_is_party_commercial(p_project_id TEXT, p_party_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND p_party_id IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM wg_project_members m
      WHERE m.project_id = p_project_id
        AND m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND m.scope = p_party_id
        AND (m.role IN ('Owner', 'Editor') OR COALESCE(m.can_approve, false))
    )
    OR wg_user_can_access_project_party(
      p_project_id, p_party_id,
      ARRAY['org_admin', 'org_finance', 'org_manager', 'org_approver']
    )
  );
$$;

REVOKE ALL ON FUNCTION public.wg_user_is_party_commercial(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_user_is_party_commercial(TEXT, TEXT) TO authenticated;

-- The worker named on an employment link.
CREATE OR REPLACE FUNCTION public.wg_user_is_link_subject(p_project_id TEXT, p_subject_node TEXT, p_subject_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_subject_user = auth.uid()
    OR EXISTS (
      SELECT 1 FROM wg_project_members m
      WHERE m.project_id = p_project_id
        AND m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND p_subject_node IS NOT NULL
        AND m.graph_node_id = p_subject_node
    )
  );
$$;

REVOKE ALL ON FUNCTION public.wg_user_is_link_subject(TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_user_is_link_subject(TEXT, TEXT, UUID) TO authenticated;

ALTER TABLE public.wg_link_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wg_link_rates FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.wg_link_rates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wg_link_rates TO authenticated;

DROP POLICY IF EXISTS wg_link_rates_select ON public.wg_link_rates;
CREATE POLICY wg_link_rates_select ON public.wg_link_rates
  FOR SELECT TO authenticated
  USING (
    wg_user_is_party_commercial(project_id, seller_party_id)
    OR (link_kind = 'supply' AND wg_user_is_party_commercial(project_id, buyer_party_id))
    OR (link_kind = 'employment' AND wg_user_is_link_subject(project_id, subject_graph_node_id, subject_user_id))
  );

-- Writes: only the seller sets the price on its link (the employer sets the
-- worker's pay). The buyer reads it but cannot change it, so a client cannot
-- rewrite what the agency charges it (review finding on PR #20).
DROP POLICY IF EXISTS wg_link_rates_insert ON public.wg_link_rates;
CREATE POLICY wg_link_rates_insert ON public.wg_link_rates
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND wg_user_is_party_commercial(project_id, seller_party_id)
  );

DROP POLICY IF EXISTS wg_link_rates_update ON public.wg_link_rates;
CREATE POLICY wg_link_rates_update ON public.wg_link_rates
  FOR UPDATE TO authenticated
  USING (wg_user_is_party_commercial(project_id, seller_party_id))
  WITH CHECK (wg_user_is_party_commercial(project_id, seller_party_id));

DROP POLICY IF EXISTS wg_link_rates_delete ON public.wg_link_rates;
CREATE POLICY wg_link_rates_delete ON public.wg_link_rates
  FOR DELETE TO authenticated
  USING (wg_user_is_party_commercial(project_id, seller_party_id));

COMMENT ON TABLE public.wg_link_rates IS
  'Per-link rates. supply = seller party bills buyer party; employment = employer pays its worker. Readable only by decision-makers of a party on the link (and the worker for their own employment rate). Margins are never stored.';

COMMIT;
