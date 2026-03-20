-- Phase 5 Day 1-2: Policy Versioning + Storage
-- Creates tables for storing compiled approval policies with versioning

-- ============================================================================
-- APPROVAL POLICIES TABLE
-- ============================================================================
-- Stores compiled approval policies as immutable versions
-- Each project can have multiple policy versions, but only one active at a time

CREATE TABLE IF NOT EXISTS approval_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Project reference
  project_id UUID NOT NULL,
  
  -- Version tracking
  version INTEGER NOT NULL,
  version_name VARCHAR(255), -- e.g., "Initial Setup", "Added PO Controls"
  
  -- Compiled policy data
  compiled_json JSONB NOT NULL, -- The compiled policy from WorkGraph builder
  graph_snapshot JSONB, -- Visual graph structure for reconstruction
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false, -- Published = available for use
  
  -- Metadata
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  published_by UUID,
  
  -- Audit
  description TEXT,
  change_notes TEXT,
  
  -- Constraints
  CONSTRAINT unique_project_version UNIQUE(project_id, version),
  CONSTRAINT unique_active_per_project UNIQUE(project_id, is_active) WHERE is_active = true
);

-- Indexes for performance
CREATE INDEX idx_approval_policies_project ON approval_policies(project_id);
CREATE INDEX idx_approval_policies_active ON approval_policies(project_id, is_active) WHERE is_active = true;
CREATE INDEX idx_approval_policies_version ON approval_policies(project_id, version DESC);
CREATE INDEX idx_approval_policies_published ON approval_policies(is_published) WHERE is_published = true;

-- Comments
COMMENT ON TABLE approval_policies IS 'Stores versioned approval policies with compiled JSON from WorkGraph builder';
COMMENT ON COLUMN approval_policies.compiled_json IS 'Compiled policy ready for execution by approval engine';
COMMENT ON COLUMN approval_policies.graph_snapshot IS 'Visual graph structure for rebuilding in WorkGraph builder';
COMMENT ON COLUMN approval_policies.is_active IS 'Only one version can be active per project';
COMMENT ON COLUMN approval_policies.is_published IS 'Published policies are available for use';

-- ============================================================================
-- ALTER TIMESHEET_ENTRIES TABLE
-- ============================================================================
-- Add policy version reference to track which version was used

DO $$ 
BEGIN
  -- Check if column exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'timesheet_entries' 
    AND column_name = 'policy_version_id'
  ) THEN
    ALTER TABLE timesheet_entries 
    ADD COLUMN policy_version_id UUID REFERENCES approval_policies(id);
    
    CREATE INDEX idx_timesheet_entries_policy_version 
    ON timesheet_entries(policy_version_id);
  END IF;
END $$;

COMMENT ON COLUMN timesheet_entries.policy_version_id IS 'Policy version pinned when timesheet was submitted (immutable)';

-- ============================================================================
-- POLICY VERSION HISTORY TABLE
-- ============================================================================
-- Tracks policy version changes and assignments

CREATE TABLE IF NOT EXISTS policy_version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  policy_id UUID NOT NULL REFERENCES approval_policies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  
  -- Event tracking
  event_type VARCHAR(50) NOT NULL, -- 'created', 'published', 'activated', 'deactivated', 'archived'
  
  -- Actor
  performed_by UUID NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Context
  reason TEXT,
  metadata JSONB,
  
  -- Affected items
  affected_timesheets_count INTEGER DEFAULT 0,
  affected_approvals_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_policy_version_history_policy ON policy_version_history(policy_id);
CREATE INDEX idx_policy_version_history_project ON policy_version_history(project_id);
CREATE INDEX idx_policy_version_history_event ON policy_version_history(event_type);
CREATE INDEX idx_policy_version_history_time ON policy_version_history(performed_at DESC);

COMMENT ON TABLE policy_version_history IS 'Audit trail of policy version changes';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get active policy for a project
CREATE OR REPLACE FUNCTION get_active_policy(p_project_id UUID)
RETURNS TABLE (
  policy_id UUID,
  version INTEGER,
  compiled_json JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT id, version, compiled_json
  FROM approval_policies
  WHERE project_id = p_project_id
    AND is_active = true
    AND is_published = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to create new policy version
CREATE OR REPLACE FUNCTION create_policy_version(
  p_project_id UUID,
  p_compiled_json JSONB,
  p_graph_snapshot JSONB,
  p_created_by UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_new_version INTEGER;
  v_policy_id UUID;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
  FROM approval_policies
  WHERE project_id = p_project_id;
  
  -- Create new policy version
  INSERT INTO approval_policies (
    project_id,
    version,
    compiled_json,
    graph_snapshot,
    created_by,
    description,
    is_published
  ) VALUES (
    p_project_id,
    v_new_version,
    p_compiled_json,
    p_graph_snapshot,
    p_created_by,
    p_description,
    false -- Draft by default
  ) RETURNING id INTO v_policy_id;
  
  -- Log the creation
  INSERT INTO policy_version_history (
    policy_id,
    project_id,
    event_type,
    performed_by,
    reason
  ) VALUES (
    v_policy_id,
    p_project_id,
    'created',
    p_created_by,
    p_description
  );
  
  RETURN v_policy_id;
END;
$$ LANGUAGE plpgsql;

-- Function to publish a policy version
CREATE OR REPLACE FUNCTION publish_policy_version(
  p_policy_id UUID,
  p_published_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id UUID;
BEGIN
  -- Get project_id and update policy
  UPDATE approval_policies
  SET is_published = true,
      published_at = NOW(),
      published_by = p_published_by
  WHERE id = p_policy_id
  RETURNING project_id INTO v_project_id;
  
  -- Log the publication
  INSERT INTO policy_version_history (
    policy_id,
    project_id,
    event_type,
    performed_by
  ) VALUES (
    p_policy_id,
    v_project_id,
    'published',
    p_published_by
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to activate a policy version (make it current)
CREATE OR REPLACE FUNCTION activate_policy_version(
  p_policy_id UUID,
  p_activated_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id UUID;
  v_old_policy_id UUID;
BEGIN
  -- Get project_id
  SELECT project_id INTO v_project_id
  FROM approval_policies
  WHERE id = p_policy_id;
  
  -- Get currently active policy
  SELECT id INTO v_old_policy_id
  FROM approval_policies
  WHERE project_id = v_project_id
    AND is_active = true;
  
  -- Deactivate old policy
  IF v_old_policy_id IS NOT NULL THEN
    UPDATE approval_policies
    SET is_active = false
    WHERE id = v_old_policy_id;
    
    INSERT INTO policy_version_history (
      policy_id,
      project_id,
      event_type,
      performed_by
    ) VALUES (
      v_old_policy_id,
      v_project_id,
      'deactivated',
      p_activated_by
    );
  END IF;
  
  -- Activate new policy
  UPDATE approval_policies
  SET is_active = true,
      is_published = true -- Must be published to activate
  WHERE id = p_policy_id;
  
  -- Log the activation
  INSERT INTO policy_version_history (
    policy_id,
    project_id,
    event_type,
    performed_by
  ) VALUES (
    p_policy_id,
    v_project_id,
    'activated',
    p_activated_by
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to count items using a policy version
CREATE OR REPLACE FUNCTION count_items_using_policy(p_policy_id UUID)
RETURNS TABLE (
  total_timesheets INTEGER,
  pending_approvals INTEGER,
  approved_timesheets INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_timesheets,
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER AS pending_approvals,
    COUNT(*) FILTER (WHERE status = 'approved')::INTEGER AS approved_timesheets
  FROM timesheet_entries
  WHERE policy_version_id = p_policy_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SEED DATA (Demo)
-- ============================================================================

-- Insert a demo policy for testing
-- This will be replaced when WorkGraph builder saves real policies
DO $$
DECLARE
  v_policy_id UUID;
  v_demo_project_id UUID := '00000000-0000-0000-0000-000000000001';
  v_demo_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Create demo policy v1
  SELECT create_policy_version(
    v_demo_project_id,
    '{
      "steps": [
        {
          "stepNumber": 1,
          "approverRole": "manager",
          "autoApprove": false,
          "conditions": []
        },
        {
          "stepNumber": 2,
          "approverRole": "finance",
          "autoApprove": false,
          "conditions": []
        }
      ],
      "rateVisibility": {
        "client": false,
        "agency": false,
        "contractor": true
      }
    }'::JSONB,
    '{}'::JSONB,
    v_demo_user_id,
    'Initial two-step approval policy'
  ) INTO v_policy_id;
  
  -- Publish and activate it
  PERFORM publish_policy_version(v_policy_id, v_demo_user_id);
  PERFORM activate_policy_version(v_policy_id, v_demo_user_id);
  
END $$;

-- ============================================================================
-- GRANTS (adjust based on your auth setup)
-- ============================================================================

-- Grant permissions (adjust role names as needed)
-- GRANT SELECT, INSERT, UPDATE ON approval_policies TO authenticated;
-- GRANT SELECT, INSERT ON policy_version_history TO authenticated;

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- This migration creates:
-- ✅ approval_policies table (stores versioned policies)
-- ✅ policy_version_id column on timesheet_entries (pins version)
-- ✅ policy_version_history table (audit trail)
-- ✅ Helper functions (get_active, create, publish, activate)
-- ✅ Indexes for performance
-- ✅ Demo seed data

-- Ready for Phase 5 Day 1-2 implementation!
