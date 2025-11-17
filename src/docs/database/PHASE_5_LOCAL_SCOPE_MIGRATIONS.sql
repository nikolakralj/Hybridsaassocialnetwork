-- ============================================================================
-- LOCAL SCOPE VISIBILITY - Database Migrations
-- ============================================================================
-- Date: 2024-11-14
-- Purpose: Implement "local scope only" project visibility model
-- Impact: Replaces complex projection with simple contract-based filtering
-- ============================================================================

-- ============================================================================
-- PART 1: Core Tables
-- ============================================================================

-- Projects table (enhance existing or create new)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  project_code TEXT UNIQUE,
  description TEXT,
  
  -- Basics
  currency VARCHAR(3) DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  
  -- Multi-tenant: No single "owner"
  created_by_org_id UUID REFERENCES organizations(id),
  created_by_user_id UUID, -- Will reference users table
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'cancelled'))
);

-- Organizations table (should already exist, but ensure it has these fields)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type VARCHAR(50), -- client, agency, vendor, freelancer, internal
  logo TEXT,
  email_domain TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 2: Project Contracts (THE KEY TABLE)
-- ============================================================================

-- This table defines WHO can see WHAT in the project graph
CREATE TABLE project_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Directed edge: from_org provides services TO to_org
  from_org_id UUID NOT NULL REFERENCES organizations(id),
  to_org_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Contract details
  contract_type VARCHAR(50) DEFAULT 'tm', -- tm, fixed, milestone, capped_tm, retainer
  rate DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Status (controls visibility)
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'terminated')),
  
  -- Invitation tracking
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID, -- user_id who sent invitation
  accepted_at TIMESTAMPTZ,
  accepted_by UUID, -- user_id who accepted
  terminated_at TIMESTAMPTZ,
  terminated_by UUID,
  termination_reason TEXT,
  
  -- OPTIONAL: Disclosure to 3rd party (advanced feature)
  -- Allows Client to see Sub org (with Sub's consent)
  disclosed_to_org_id UUID REFERENCES organizations(id),
  disclosure_requested_at TIMESTAMPTZ,
  disclosure_requested_by UUID,
  disclosure_approved_at TIMESTAMPTZ,
  disclosure_approved_by UUID,
  disclosure_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT different_orgs CHECK (from_org_id != to_org_id),
  CONSTRAINT unique_contract UNIQUE (project_id, from_org_id, to_org_id)
);

-- Indexes for fast "show my contracts" queries
CREATE INDEX idx_contracts_project ON project_contracts(project_id);
CREATE INDEX idx_contracts_from_org ON project_contracts(from_org_id);
CREATE INDEX idx_contracts_to_org ON project_contracts(to_org_id);
CREATE INDEX idx_contracts_status ON project_contracts(status);
CREATE INDEX idx_contracts_disclosed ON project_contracts(disclosed_to_org_id) 
  WHERE disclosed_to_org_id IS NOT NULL;

-- Composite index for viewer queries (CRITICAL for performance)
CREATE INDEX idx_contracts_viewer_scope ON project_contracts(project_id, status) 
  WHERE status = 'active';

-- ============================================================================
-- PART 3: Project Participants (Lightweight membership)
-- ============================================================================

-- Tracks which orgs are involved in a project (denormalized for quick access)
CREATE TABLE project_participants (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  role VARCHAR(50), -- creator, client, vendor, subcontractor, partner
  
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  
  PRIMARY KEY (project_id, org_id)
);

CREATE INDEX idx_participants_project ON project_participants(project_id);
CREATE INDEX idx_participants_org ON project_participants(org_id);

-- ============================================================================
-- PART 4: Role Assignments (Who works on what)
-- ============================================================================

-- Assigns people to projects with specific roles
CREATE TABLE project_role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL, -- Will reference users table
  
  role VARCHAR(50), -- contractor, approver, manager, observer, admin
  
  -- Optional: Link to specific contract
  contract_id UUID REFERENCES project_contracts(id),
  
  -- Validity period (for temporary assignments)
  valid_from DATE,
  valid_to DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate role assignments
  UNIQUE(project_id, user_id, role)
);

CREATE INDEX idx_role_assignments_project ON project_role_assignments(project_id);
CREATE INDEX idx_role_assignments_user ON project_role_assignments(user_id);
CREATE INDEX idx_role_assignments_org ON project_role_assignments(org_id);
CREATE INDEX idx_role_assignments_contract ON project_role_assignments(contract_id) 
  WHERE contract_id IS NOT NULL;

-- ============================================================================
-- PART 5: Helper Views
-- ============================================================================

-- View: My Active Contracts (scoped to current user's org)
-- This is what each org sees in their "My Contracts" panel
CREATE OR REPLACE VIEW my_project_contracts AS
  SELECT 
    c.*,
    from_org.name as vendor_name,
    from_org.logo as vendor_logo,
    to_org.name as client_name,
    to_org.logo as client_logo,
    
    -- Compute direction relative to current user's org
    CASE 
      WHEN c.from_org_id = current_setting('app.current_org_id', true)::uuid 
        THEN 'selling' -- I'm the vendor
      WHEN c.to_org_id = current_setting('app.current_org_id', true)::uuid 
        THEN 'buying' -- I'm the client
      ELSE 'disclosed' -- I'm seeing this via disclosure
    END as relationship,
    
    -- Count workers assigned
    (
      SELECT COUNT(*) 
      FROM project_role_assignments 
      WHERE contract_id = c.id 
        AND role = 'contractor'
    ) as worker_count
    
  FROM project_contracts c
  JOIN organizations from_org ON c.from_org_id = from_org.id
  JOIN organizations to_org ON c.to_org_id = to_org.id
  WHERE 
    c.status = 'active'
    AND (
      c.from_org_id = current_setting('app.current_org_id', true)::uuid
      OR c.to_org_id = current_setting('app.current_org_id', true)::uuid
      OR c.disclosed_to_org_id = current_setting('app.current_org_id', true)::uuid
    );

-- View: Pending Invitations (contracts waiting for acceptance)
CREATE OR REPLACE VIEW pending_contract_invitations AS
  SELECT 
    c.*,
    from_org.name as vendor_name,
    to_org.name as client_name,
    p.name as project_name
  FROM project_contracts c
  JOIN organizations from_org ON c.from_org_id = from_org.id
  JOIN organizations to_org ON c.to_org_id = to_org.id
  JOIN projects p ON c.project_id = p.id
  WHERE 
    c.status = 'pending'
    AND (
      -- Invitations TO my org
      c.to_org_id = current_setting('app.current_org_id', true)::uuid
      -- Or invitations FROM my org (to track what I sent)
      OR c.from_org_id = current_setting('app.current_org_id', true)::uuid
    );

-- ============================================================================
-- PART 6: Functions
-- ============================================================================

-- Function: Get project graph for a specific viewer
-- Returns only nodes/edges visible to viewer's organization
CREATE OR REPLACE FUNCTION get_project_graph(
  p_project_id UUID,
  p_viewer_org_id UUID
)
RETURNS TABLE (
  node_id UUID,
  node_type VARCHAR(20),
  node_data JSONB,
  edge_id UUID,
  edge_from UUID,
  edge_to UUID,
  edge_type VARCHAR(20),
  edge_data JSONB
) AS $$
BEGIN
  -- Return contracts where viewer is involved
  RETURN QUERY
  SELECT 
    NULL::UUID as node_id,
    NULL::VARCHAR(20) as node_type,
    NULL::JSONB as node_data,
    c.id as edge_id,
    c.from_org_id as edge_from,
    c.to_org_id as edge_to,
    'contract'::VARCHAR(20) as edge_type,
    jsonb_build_object(
      'rate', c.rate,
      'currency', c.currency,
      'contract_type', c.contract_type,
      'status', c.status,
      'is_disclosed', (c.disclosed_to_org_id = p_viewer_org_id)
    ) as edge_data
  FROM project_contracts c
  WHERE c.project_id = p_project_id
    AND c.status = 'active'
    AND (
      c.from_org_id = p_viewer_org_id
      OR c.to_org_id = p_viewer_org_id
      OR c.disclosed_to_org_id = p_viewer_org_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Check if org can see another org in project
CREATE OR REPLACE FUNCTION can_see_org_in_project(
  p_viewer_org_id UUID,
  p_target_org_id UUID,
  p_project_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Can see if there's an active contract between them
  -- or if target is disclosed to viewer
  RETURN EXISTS (
    SELECT 1 FROM project_contracts
    WHERE project_id = p_project_id
      AND status = 'active'
      AND (
        (from_org_id = p_viewer_org_id AND to_org_id = p_target_org_id)
        OR (from_org_id = p_target_org_id AND to_org_id = p_viewer_org_id)
        OR (disclosed_to_org_id = p_viewer_org_id AND (from_org_id = p_target_org_id OR to_org_id = p_target_org_id))
      )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 7: Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at 
  BEFORE UPDATE ON project_contracts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-add to project_participants when contract becomes active
CREATE OR REPLACE FUNCTION auto_add_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    -- Add both orgs as participants
    INSERT INTO project_participants (project_id, org_id, role)
    VALUES (NEW.project_id, NEW.from_org_id, 'vendor')
    ON CONFLICT (project_id, org_id) DO NOTHING;
    
    INSERT INTO project_participants (project_id, org_id, role)
    VALUES (NEW.project_id, NEW.to_org_id, 'client')
    ON CONFLICT (project_id, org_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER add_participants_on_contract_activation
  AFTER UPDATE ON project_contracts
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_participants();

-- ============================================================================
-- PART 8: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_role_assignments ENABLE ROW LEVEL SECURITY;

-- Projects: Can see if you're a participant
CREATE POLICY projects_select_policy ON projects
  FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM project_participants
      WHERE org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

-- Contracts: Can see your own contracts (or disclosed ones)
CREATE POLICY contracts_select_policy ON project_contracts
  FOR SELECT
  USING (
    status = 'active'
    AND (
      from_org_id = current_setting('app.current_org_id', true)::uuid
      OR to_org_id = current_setting('app.current_org_id', true)::uuid
      OR disclosed_to_org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

-- Contracts: Can insert if you're one of the parties
CREATE POLICY contracts_insert_policy ON project_contracts
  FOR INSERT
  WITH CHECK (
    from_org_id = current_setting('app.current_org_id', true)::uuid
    OR to_org_id = current_setting('app.current_org_id', true)::uuid
  );

-- Contracts: Can update your own contracts
CREATE POLICY contracts_update_policy ON project_contracts
  FOR UPDATE
  USING (
    from_org_id = current_setting('app.current_org_id', true)::uuid
    OR to_org_id = current_setting('app.current_org_id', true)::uuid
  );

-- Participants: Can see if you're in the project
CREATE POLICY participants_select_policy ON project_participants
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_participants
      WHERE org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

-- ============================================================================
-- PART 9: Sample Data (for testing)
-- ============================================================================

-- Create sample orgs
INSERT INTO organizations (id, name, type, logo, email_domain) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Acme Inc', 'client', '🏢', 'acme.com'),
  ('22222222-2222-2222-2222-222222222222', 'TechCorp Agency', 'agency', '🚀', 'techcorp.io'),
  ('33333333-3333-3333-3333-333333333333', 'DevShop Sub', 'vendor', '💻', 'devshop.dev')
ON CONFLICT (id) DO NOTHING;

-- Create sample project
INSERT INTO projects (id, name, project_code, currency, created_by_org_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Website Redesign', 'ACME-WEB-001', 'USD', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- Create sample contracts
INSERT INTO project_contracts (project_id, from_org_id, to_org_id, rate, contract_type, status, accepted_at) VALUES
  -- Agency → Client (active)
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 150.00, 'tm', 'active', NOW()),
  -- Sub → Agency (active)
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 85.00, 'tm', 'active', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 10: Verification Queries
-- ============================================================================

-- Test: What does each org see?

-- Set context as Acme (Client)
SET app.current_org_id = '11111111-1111-1111-1111-111111111111';
-- Should see: 1 contract (Agency → Client)
SELECT * FROM my_project_contracts; 

-- Set context as Agency
SET app.current_org_id = '22222222-2222-2222-2222-222222222222';
-- Should see: 2 contracts (Agency → Client, Sub → Agency)
SELECT * FROM my_project_contracts;

-- Set context as Sub
SET app.current_org_id = '33333333-3333-3333-3333-333333333333';
-- Should see: 1 contract (Sub → Agency)
SELECT * FROM my_project_contracts;

-- ============================================================================
-- MIGRATION COMPLETE ✅
-- ============================================================================
-- Next steps:
-- 1. Build API endpoints for contract management
-- 2. Build invitation flow UI
-- 3. Build project graph viewer (scoped)
-- 4. Build disclosure request mechanism
-- ============================================================================
