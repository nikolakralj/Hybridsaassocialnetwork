-- ============================================================================
-- Local Scope Contracts Migration - FIXED VERSION
-- ============================================================================
-- This migration sets up the database schema for the Local Scope Visibility
-- architecture with proper foreign key relationships.
--
-- Run this in Supabase SQL Editor if the automated migration fails.
-- ============================================================================

-- ============================================================================
-- STEP 0: Ensure organizations table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 1: Ensure projects table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Drop and recreate project_contracts with proper foreign keys
-- ============================================================================

-- Drop existing constraints if they exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_contracts') THEN
    BEGIN
      ALTER TABLE project_contracts DROP CONSTRAINT IF EXISTS project_contracts_from_org_id_fkey;
      ALTER TABLE project_contracts DROP CONSTRAINT IF EXISTS project_contracts_to_org_id_fkey;
      ALTER TABLE project_contracts DROP CONSTRAINT IF EXISTS project_contracts_project_id_fkey;
      ALTER TABLE project_contracts DROP CONSTRAINT IF EXISTS project_contracts_disclosed_to_org_id_fkey;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore errors
    END;
  END IF;
END $$;

-- Create project_contracts table
CREATE TABLE IF NOT EXISTS project_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  from_org_id TEXT NOT NULL,
  to_org_id TEXT NOT NULL,
  contract_type TEXT,
  rate DECIMAL,
  currency TEXT DEFAULT 'USD',
  relationship TEXT,
  disclosed_to_org_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints
DO $$
BEGIN
  -- Add project foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_project_id_fkey'
  ) THEN
    ALTER TABLE project_contracts 
      ADD CONSTRAINT project_contracts_project_id_fkey 
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  -- Add from_org foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_from_org_id_fkey'
  ) THEN
    ALTER TABLE project_contracts 
      ADD CONSTRAINT project_contracts_from_org_id_fkey 
      FOREIGN KEY (from_org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- Add to_org foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_to_org_id_fkey'
  ) THEN
    ALTER TABLE project_contracts 
      ADD CONSTRAINT project_contracts_to_org_id_fkey 
      FOREIGN KEY (to_org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- Add disclosed_to_org foreign key (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_disclosed_to_org_id_fkey'
  ) THEN
    ALTER TABLE project_contracts 
      ADD CONSTRAINT project_contracts_disclosed_to_org_id_fkey 
      FOREIGN KEY (disclosed_to_org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create contract_invitations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS contract_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  from_org_id TEXT NOT NULL REFERENCES organizations(id),
  to_org_id TEXT NOT NULL REFERENCES organizations(id),
  invited_by_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: Create disclosure_requests table
-- ============================================================================

CREATE TABLE IF NOT EXISTS disclosure_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  requester_org_id TEXT NOT NULL REFERENCES organizations(id),
  vendor_org_id TEXT NOT NULL REFERENCES organizations(id),
  subcontractor_org_id TEXT NOT NULL REFERENCES organizations(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'vendor_approved', 'approved', 'denied')),
  requester_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vendor_approved_at TIMESTAMPTZ,
  final_resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 5: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_project_contracts_project 
  ON project_contracts(project_id);

CREATE INDEX IF NOT EXISTS idx_project_contracts_from_org 
  ON project_contracts(from_org_id);

CREATE INDEX IF NOT EXISTS idx_project_contracts_to_org 
  ON project_contracts(to_org_id);

CREATE INDEX IF NOT EXISTS idx_project_contracts_disclosed 
  ON project_contracts(disclosed_to_org_id);

CREATE INDEX IF NOT EXISTS idx_contract_invitations_to_org 
  ON contract_invitations(to_org_id);

CREATE INDEX IF NOT EXISTS idx_contract_invitations_status 
  ON contract_invitations(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_disclosure_requests_requester 
  ON disclosure_requests(requester_org_id);

CREATE INDEX IF NOT EXISTS idx_disclosure_requests_status 
  ON disclosure_requests(status) WHERE status IN ('pending', 'vendor_approved');

-- ============================================================================
-- STEP 6: Insert sample data for demo (OPTIONAL)
-- ============================================================================

-- Insert demo organizations
INSERT INTO organizations (id, name, type) VALUES 
  ('acme-inc', 'Acme Inc', 'client'),
  ('techcorp-agency', 'TechCorp Agency', 'agency'),
  ('devshop-sub', 'DevShop Subcontractor', 'freelancer_virtual')
ON CONFLICT (id) DO NOTHING;

-- Insert demo project
INSERT INTO projects (id, name, description) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'E-Commerce Platform Redesign', 'Complete redesign of customer-facing platform')
ON CONFLICT (id) DO NOTHING;

-- Insert demo contracts
-- Contract 1: Client → Agency @ $150/hr
INSERT INTO project_contracts (
  id, 
  project_id, 
  from_org_id, 
  to_org_id, 
  contract_type, 
  rate, 
  relationship, 
  status
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'acme-inc',
  'techcorp-agency',
  'vendor',
  150.00,
  'client_to_agency',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Contract 2: Agency → Sub @ $85/hr
INSERT INTO project_contracts (
  id, 
  project_id, 
  from_org_id, 
  to_org_id, 
  contract_type, 
  rate, 
  relationship, 
  status
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'techcorp-agency',
  'devshop-sub',
  'subcontractor',
  85.00,
  'agency_to_sub',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify the migration succeeded:

SELECT 
  'Tables Created' as check_type,
  table_name,
  'exists' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'organizations',
    'projects', 
    'project_contracts', 
    'contract_invitations', 
    'disclosure_requests'
  )
ORDER BY table_name;

-- Check foreign keys
SELECT 
  'Foreign Keys' as check_type,
  constraint_name,
  table_name,
  'exists' as status
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_name IN ('project_contracts', 'contract_invitations', 'disclosure_requests')
ORDER BY table_name, constraint_name;

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- If you see tables and foreign keys listed above, the migration succeeded.
-- You can now use the Local Scope Contracts UI at #/contracts
-- ============================================================================