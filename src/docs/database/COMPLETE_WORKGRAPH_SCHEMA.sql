-- ============================================================================
-- COMPLETE WORKGRAPH SCHEMA - Projects, Contracts, Graph, and Approvals
-- ============================================================================
-- This schema supports the full end-to-end workflow:
-- 1. Project creation
-- 2. Multi-party contracts (Companies → Agencies → Freelancers)
-- 3. Visual WorkGraph structure (nodes & edges)
-- 4. Approval flows
-- 5. Integration with timesheet schema
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Project settings
  region TEXT DEFAULT 'US',
  currency TEXT DEFAULT 'USD',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  
  -- Work week configuration
  work_week JSONB DEFAULT '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}',
  
  -- Ownership
  owner_id TEXT NOT NULL, -- User ID who created the project
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft', 'completed')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROJECT MEMBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- User info
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  
  -- Role
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Admin', 'Editor', 'Viewer', 'Contractor')),
  
  -- Invitation tracking
  invited_by TEXT NOT NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, user_id)
);

-- ============================================================================
-- WORKGRAPH NODES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workgraph_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Node type and identity
  node_type TEXT NOT NULL CHECK (node_type IN ('company', 'agency', 'freelancer', 'approver', 'router', 'ai_agent', 'n8n', 'data_check', 'delay')),
  
  -- Node data
  label TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- Stores node-specific data (rates, contact info, etc.)
  
  -- Visual position (for graph builder UI)
  position_x DECIMAL(10,2) DEFAULT 0,
  position_y DECIMAL(10,2) DEFAULT 0,
  
  -- Graph version (for temporal versioning)
  graph_version_id UUID, -- NULL = current draft, UUID = published version
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WORKGRAPH EDGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workgraph_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Source and target nodes
  source_node_id UUID NOT NULL REFERENCES workgraph_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES workgraph_nodes(id) ON DELETE CASCADE,
  
  -- Edge type
  edge_type TEXT NOT NULL CHECK (edge_type IN ('contract', 'approval', 'data_flow', 'conditional')),
  
  -- Edge data (stores contract details, approval rules, etc.)
  data JSONB DEFAULT '{}',
  
  -- Graph version
  graph_version_id UUID,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WORKGRAPH VERSIONS TABLE (for publishing/versioning)
-- ============================================================================
-- Note: This table already exists in COMPLETE_TIMESHEET_SCHEMA.sql as graph_versions
-- We'll add any missing columns here

-- Check if we need to add project_name column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'graph_versions' AND column_name = 'project_name'
  ) THEN
    ALTER TABLE graph_versions ADD COLUMN project_name TEXT;
  END IF;
END $$;

-- ============================================================================
-- CONTRACTS TABLE (enhanced version)
-- ============================================================================
-- Note: project_contracts already exists in COMPLETE_TIMESHEET_SCHEMA.sql
-- We'll extend it with additional fields

DO $$ 
BEGIN
  -- Add node_id reference (links contract to WorkGraph node)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'node_id'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN node_id UUID REFERENCES workgraph_nodes(id) ON DELETE SET NULL;
  END IF;
  
  -- Add end_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN end_date DATE;
  END IF;
  
  -- Add status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'status'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'completed'));
  END IF;
  
  -- Add rate visibility settings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'hide_rate_from'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN hide_rate_from JSONB DEFAULT '[]'; -- Array of party IDs who can't see rate
  END IF;
  
  -- Add approval layers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'approval_chain'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN approval_chain JSONB DEFAULT '[]'; -- Array of approver node IDs
  END IF;
END $$;

-- ============================================================================
-- APPROVAL RECORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS approval_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- What's being approved
  subject_type TEXT NOT NULL CHECK (subject_type IN ('timesheet', 'expense', 'invoice', 'contract', 'deliverable')),
  subject_id UUID NOT NULL, -- References the specific item (timesheet_period_id, etc.)
  
  -- Approval details
  approver_user_id TEXT NOT NULL,
  approver_name TEXT NOT NULL,
  approver_node_id UUID REFERENCES workgraph_nodes(id), -- Which node in graph is approving
  approval_layer INTEGER NOT NULL, -- 1, 2, 3 (Layer 1 = first approver)
  
  -- Decision
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  notes TEXT,
  
  -- Timing
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  
  -- Context
  graph_version_id UUID REFERENCES graph_versions(id), -- Which version of graph was used
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- APPROVAL QUEUE VIEW
-- ============================================================================
-- This creates a convenient view for querying pending approvals

CREATE OR REPLACE VIEW approval_queue AS
SELECT 
  ar.id,
  ar.project_id,
  p.name as project_name,
  ar.subject_type,
  ar.subject_id,
  ar.approver_user_id,
  ar.approver_name,
  ar.approval_layer,
  ar.status,
  ar.notes,
  ar.submitted_at,
  ar.decided_at,
  
  -- Add timesheet details if applicable
  CASE 
    WHEN ar.subject_type = 'timesheet' THEN (
      SELECT jsonb_build_object(
        'week_start', tp.week_start_date,
        'week_end', tp.week_end_date,
        'total_hours', tp.total_hours,
        'contractor_name', pc.user_name,
        'hourly_rate', pc.hourly_rate
      )
      FROM timesheet_periods tp
      JOIN project_contracts pc ON tp.contract_id = pc.id
      WHERE tp.id = ar.subject_id
    )
    ELSE NULL
  END as timesheet_data,
  
  ar.created_at,
  ar.updated_at
FROM approval_records ar
JOIN projects p ON ar.project_id = p.id
WHERE ar.status = 'pending'
ORDER BY ar.submitted_at DESC;

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);

-- Project Members
CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_role ON project_members(role);

-- WorkGraph Nodes
CREATE INDEX IF NOT EXISTS idx_nodes_project ON workgraph_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON workgraph_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_version ON workgraph_nodes(graph_version_id);

-- WorkGraph Edges
CREATE INDEX IF NOT EXISTS idx_edges_project ON workgraph_edges(project_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON workgraph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON workgraph_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON workgraph_edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_version ON workgraph_edges(graph_version_id);

-- Approval Records
CREATE INDEX IF NOT EXISTS idx_approvals_project ON approval_records(project_id);
CREATE INDEX IF NOT EXISTS idx_approvals_subject ON approval_records(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON approval_records(approver_user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_records(status);
CREATE INDEX IF NOT EXISTS idx_approvals_submitted ON approval_records(submitted_at);

-- ============================================================================
-- TRIGGERS for auto-updating timestamps
-- ============================================================================

-- Update projects.updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update workgraph_nodes.updated_at
DROP TRIGGER IF EXISTS update_nodes_updated_at ON workgraph_nodes;
CREATE TRIGGER update_nodes_updated_at
  BEFORE UPDATE ON workgraph_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update workgraph_edges.updated_at
DROP TRIGGER IF EXISTS update_edges_updated_at ON workgraph_edges;
CREATE TRIGGER update_edges_updated_at
  BEFORE UPDATE ON workgraph_edges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update approval_records.updated_at
DROP TRIGGER IF EXISTS update_approvals_updated_at ON approval_records;
CREATE TRIGGER update_approvals_updated_at
  BEFORE UPDATE ON approval_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA for Testing
-- ============================================================================

-- Insert a sample project
INSERT INTO projects (id, name, description, start_date, owner_id, status)
VALUES (
  'proj-demo-001',
  'Mobile App Redesign',
  'Complete redesign of the mobile application with new features',
  NOW(),
  'user-demo-001',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Add project owner as member
INSERT INTO project_members (project_id, user_id, user_name, user_email, role, invited_by, accepted_at)
VALUES (
  'proj-demo-001',
  'user-demo-001',
  'Alex Johnson',
  'alex@techventures.com',
  'Owner',
  'user-demo-001',
  NOW()
) ON CONFLICT (project_id, user_id) DO NOTHING;

-- Insert sample WorkGraph nodes
INSERT INTO workgraph_nodes (id, project_id, node_type, label, data, position_x, position_y)
VALUES 
  -- Company (Client)
  ('node-company-001', 'proj-demo-001', 'company', 'TechVentures', 
   '{"type":"company","contact":"alex@techventures.com"}'::jsonb, 100, 100),
  
  -- Agency
  ('node-agency-001', 'proj-demo-001', 'agency', 'StaffingPro', 
   '{"type":"agency","contact":"manager@staffingpro.com"}'::jsonb, 300, 100),
  
  -- Freelancer
  ('node-freelancer-001', 'proj-demo-001', 'freelancer', 'Sarah Chen', 
   '{"type":"freelancer","email":"sarah@example.com","title":"Senior Developer"}'::jsonb, 500, 100),
  
  -- Approvers
  ('node-approver-001', 'proj-demo-001', 'approver', 'Agency Lead',
   '{"layer":1,"role":"Agency Lead"}'::jsonb, 300, 250),
  ('node-approver-002', 'proj-demo-001', 'approver', 'Client PM',
   '{"layer":2,"role":"Project Manager"}'::jsonb, 200, 250),
  ('node-approver-003', 'proj-demo-001', 'approver', 'Client Finance',
   '{"layer":3,"role":"Finance Director"}'::jsonb, 100, 250)
ON CONFLICT (id) DO NOTHING;

-- Insert sample edges (contracts and approval flows)
INSERT INTO workgraph_edges (id, project_id, source_node_id, target_node_id, edge_type, data)
VALUES 
  -- Contract: Company → Agency
  ('edge-001', 'proj-demo-001', 'node-company-001', 'node-agency-001', 'contract',
   '{"hourly_rate":150,"hide_rate_from":["node-freelancer-001"]}'::jsonb),
  
  -- Contract: Agency → Freelancer
  ('edge-002', 'proj-demo-001', 'node-agency-001', 'node-freelancer-001', 'contract',
   '{"hourly_rate":95}'::jsonb),
  
  -- Approval flow: Freelancer → Agency Lead
  ('edge-003', 'proj-demo-001', 'node-freelancer-001', 'node-approver-001', 'approval',
   '{"layer":1}'::jsonb),
  
  -- Approval flow: Agency Lead → Client PM
  ('edge-004', 'proj-demo-001', 'node-approver-001', 'node-approver-002', 'approval',
   '{"layer":2}'::jsonb),
  
  -- Approval flow: Client PM → Client Finance
  ('edge-005', 'proj-demo-001', 'node-approver-002', 'node-approver-003', 'approval',
   '{"layer":3}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Insert sample organization
INSERT INTO organizations (id, name, type)
VALUES 
  ('org-techventures', 'TechVentures', 'company'),
  ('org-staffingpro', 'StaffingPro', 'agency'),
  ('org-sarah', 'Sarah Chen', 'freelancer')
ON CONFLICT (id) DO NOTHING;

-- Insert sample contracts
INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, hourly_rate, start_date, node_id, status, approval_chain)
VALUES 
  -- Agency contract
  ('contract-agency-001', 'user-agency-001', 'StaffingPro Manager', 'Agency', 'org-staffingpro', 'proj-demo-001', 'vendor', 150.00, CURRENT_DATE, 'node-agency-001', 'active',
   '["node-approver-002","node-approver-003"]'::jsonb),
  
  -- Freelancer contract
  ('contract-freelancer-001', 'user-freelancer-001', 'Sarah Chen', 'Contractor', 'org-sarah', 'proj-demo-001', 'contractor', 95.00, CURRENT_DATE, 'node-freelancer-001', 'active',
   '["node-approver-001","node-approver-002","node-approver-003"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Success message
SELECT 'Complete WorkGraph schema with sample data created! ✅' as message;
