-- Phase 5 M5.1: Project Collaboration (Minimal)
-- Creates tables for multi-user project collaboration

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
-- Stores project metadata (minimal for M5.1)

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Configuration
  region VARCHAR(10) NOT NULL, -- 'US', 'EU', 'UK'
  currency VARCHAR(3) NOT NULL, -- 'USD', 'EUR', 'GBP'
  
  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Work week configuration
  work_week JSONB NOT NULL DEFAULT '{
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": false,
    "sunday": false
  }'::jsonb,
  
  -- Ownership
  owner_id UUID NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'archived', 'closed'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created ON projects(created_at DESC);

-- Comments
COMMENT ON TABLE projects IS 'Multi-party collaborative projects';
COMMENT ON COLUMN projects.region IS 'For compliance and data residency (US/EU/UK)';
COMMENT ON COLUMN projects.work_week IS 'Default work days for timesheet entry';

-- ============================================================================
-- PROJECT MEMBERS TABLE
-- ============================================================================
-- Tracks who has access to each project and their role

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- User info (cached for display)
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  
  -- Role & permissions
  role VARCHAR(20) NOT NULL, -- 'Owner', 'Editor', 'Contributor', 'Commenter', 'Viewer'
  scope VARCHAR(255), -- For 'Contributor': which org they represent (org_id)
  
  -- Invitation tracking
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'pending', 'removed'
  
  -- Constraints
  UNIQUE(project_id, user_id)
);

-- Indexes
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_status ON project_members(status);
CREATE INDEX idx_project_members_role ON project_members(project_id, role);

-- Comments
COMMENT ON TABLE project_members IS 'Project access control with roles';
COMMENT ON COLUMN project_members.role IS 'Owner/Editor/Contributor/Commenter/Viewer';
COMMENT ON COLUMN project_members.scope IS 'For Contributor role: limits edits to their org';

-- ============================================================================
-- PROJECT INVITATIONS TABLE (Optional for M5.1, but useful)
-- ============================================================================
-- Tracks pending invitations before users accept

CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Project reference
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Invitee
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  scope VARCHAR(255),
  
  -- Invitation metadata
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Token for email link
  token VARCHAR(255) UNIQUE NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled'
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(project_id, email)
);

-- Indexes
CREATE INDEX idx_project_invitations_project ON project_invitations(project_id);
CREATE INDEX idx_project_invitations_email ON project_invitations(email);
CREATE INDEX idx_project_invitations_token ON project_invitations(token);
CREATE INDEX idx_project_invitations_status ON project_invitations(status);

-- Comments
COMMENT ON TABLE project_invitations IS 'Pending project invitations sent by email';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's role in a project
CREATE OR REPLACE FUNCTION get_user_project_role(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_role VARCHAR(20);
BEGIN
  SELECT role INTO v_role
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND status = 'active';
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user can access project
CREATE OR REPLACE FUNCTION can_user_access_project(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all projects for a user
CREATE OR REPLACE FUNCTION get_user_projects(
  p_user_id UUID
)
RETURNS TABLE (
  project_id UUID,
  project_name VARCHAR(255),
  role VARCHAR(20),
  member_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS project_id,
    p.name AS project_name,
    pm.role,
    (SELECT COUNT(*) FROM project_members WHERE project_id = p.id AND status = 'active') AS member_count,
    p.created_at
  FROM projects p
  JOIN project_members pm ON p.id = pm.project_id
  WHERE pm.user_id = p_user_id
    AND pm.status = 'active'
    AND p.status = 'active'
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to add member to project
CREATE OR REPLACE FUNCTION add_project_member(
  p_project_id UUID,
  p_user_id UUID,
  p_role VARCHAR(20),
  p_invited_by UUID,
  p_user_name VARCHAR(255) DEFAULT NULL,
  p_user_email VARCHAR(255) DEFAULT NULL,
  p_scope VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_member_id UUID;
BEGIN
  -- Insert or update member
  INSERT INTO project_members (
    project_id,
    user_id,
    role,
    invited_by,
    user_name,
    user_email,
    scope,
    status,
    accepted_at
  ) VALUES (
    p_project_id,
    p_user_id,
    p_role,
    p_invited_by,
    p_user_name,
    p_user_email,
    p_scope,
    'active',
    NOW()
  )
  ON CONFLICT (project_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    scope = EXCLUDED.scope,
    status = 'active',
    accepted_at = NOW()
  RETURNING id INTO v_member_id;
  
  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-add owner as member when project created
CREATE OR REPLACE FUNCTION add_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_members (
    project_id,
    user_id,
    role,
    invited_by,
    status,
    accepted_at
  ) VALUES (
    NEW.id,
    NEW.owner_id,
    'Owner',
    NEW.owner_id,
    'active',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_add_owner_member
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_owner_as_member();

-- ============================================================================
-- SEED DATA (Demo Projects)
-- ============================================================================

DO $$
DECLARE
  v_demo_user_id UUID := '00000000-0000-0000-0000-000000000001';
  v_project_id UUID;
BEGIN
  -- Create demo project
  INSERT INTO projects (
    name,
    description,
    region,
    currency,
    start_date,
    end_date,
    owner_id,
    status
  ) VALUES (
    'Website Redesign Q1 2025',
    'Complete redesign of company website with new branding',
    'US',
    'USD',
    '2025-01-01',
    '2025-03-31',
    v_demo_user_id,
    'active'
  ) RETURNING id INTO v_project_id;
  
  -- Add additional members (will be auto-added to project_members via trigger)
  -- Owner was already added via trigger
  
  -- Add an Editor
  PERFORM add_project_member(
    v_project_id,
    '00000000-0000-0000-0000-000000000002',
    'Editor',
    v_demo_user_id,
    'Sarah Chen',
    'sarah@example.com'
  );
  
  -- Add a Viewer
  PERFORM add_project_member(
    v_project_id,
    '00000000-0000-0000-0000-000000000003',
    'Viewer',
    v_demo_user_id,
    'John Smith',
    'john@example.com'
  );
  
END $$;

-- ============================================================================
-- GRANTS (Adjust based on your auth setup)
-- ============================================================================

-- Grant permissions (adjust role names as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON project_members TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON project_invitations TO authenticated;

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- This migration creates:
-- ✅ projects table (project metadata)
-- ✅ project_members table (access control with roles)
-- ✅ project_invitations table (email invites)
-- ✅ Helper functions (get_user_role, can_access, add_member)
-- ✅ Triggers (auto-update timestamp, auto-add owner)
-- ✅ Demo seed data (1 project with 3 members)

-- Ready for M5.1 implementation!

-- Next: Wire ProjectCreateWizard to these tables
-- Then: Add "Publish" button to create policy_versions
