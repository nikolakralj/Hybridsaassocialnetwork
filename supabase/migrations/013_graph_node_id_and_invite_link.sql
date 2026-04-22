-- 013_graph_node_id_and_invite_link.sql
-- Cycle 1: project creation schema correctness

ALTER TABLE wg_project_members
  ADD COLUMN IF NOT EXISTS graph_node_id TEXT;

CREATE INDEX IF NOT EXISTS wg_members_graph_node_idx
  ON wg_project_members(graph_node_id);

ALTER TABLE wg_project_members
  ADD COLUMN IF NOT EXISTS can_approve BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_view_rates BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_edit_timesheets BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_to_chain BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN wg_project_members.role IS
  'Owner | Editor | Contributor | Commenter | Viewer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'wg_project_members'
      AND constraint_name = 'wg_project_members_invitation_id_fkey'
  ) THEN
    ALTER TABLE wg_project_members
      ADD CONSTRAINT wg_project_members_invitation_id_fkey
      FOREIGN KEY (invitation_id)
      REFERENCES wg_project_invitations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS wg_members_scope_contributor ON wg_project_members;

CREATE POLICY wg_members_scope_contributor ON wg_project_members
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT id
      FROM wg_projects
      WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM wg_project_members AS viewer_member
      WHERE viewer_member.project_id = wg_project_members.project_id
        AND viewer_member.user_id = auth.uid()
        AND viewer_member.accepted_at IS NOT NULL
        AND (
          viewer_member.role IN ('Owner', 'Editor')
          OR viewer_member.id = wg_project_members.id
          OR viewer_member.scope = 'all'
          OR (
            viewer_member.scope IS NOT NULL
            AND viewer_member.scope = wg_project_members.scope
          )
        )
    )
  );
