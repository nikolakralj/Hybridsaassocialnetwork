-- ============================================================================
-- Add Missing Columns to project_contracts
-- ============================================================================
-- Run this in Supabase SQL Editor to add the missing columns
-- ============================================================================

-- First, let's see what columns currently exist
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'project_contracts'
ORDER BY ordinal_position;

-- ============================================================================
-- Add missing columns if they don't exist
-- ============================================================================

DO $$ 
BEGIN
  -- Add from_org_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'from_org_id'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN from_org_id TEXT;
  END IF;

  -- Add to_org_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'to_org_id'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN to_org_id TEXT;
  END IF;

  -- Add project_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN project_id UUID;
  END IF;

  -- Add relationship
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'relationship'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN relationship TEXT;
  END IF;

  -- Add disclosed_to_org_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'disclosed_to_org_id'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN disclosed_to_org_id TEXT;
  END IF;

  -- Add contract_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'contract_type'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN contract_type TEXT;
  END IF;

  -- Add rate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'rate'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN rate DECIMAL;
  END IF;

  -- Add currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'currency'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN currency TEXT DEFAULT 'USD';
  END IF;

  -- Add status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'status'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN status TEXT DEFAULT 'active';
  END IF;

  -- Add updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- Ensure organizations table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE: organizations table has a CHECK constraint on type column
-- Allowed values: 'company', 'agency', 'client', 'freelancer_virtual'
-- (The constraint likely already exists from previous migrations)

-- ============================================================================
-- Ensure projects table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Add foreign key constraints (if columns are populated)
-- ============================================================================

DO $$
BEGIN
  -- Add project_id foreign key (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_project_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE project_contracts 
        ADD CONSTRAINT project_contracts_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add project_id FK - data may need cleanup first';
    END;
  END IF;

  -- Add from_org_id foreign key (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_from_org_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE project_contracts 
        ADD CONSTRAINT project_contracts_from_org_id_fkey 
        FOREIGN KEY (from_org_id) REFERENCES organizations(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add from_org_id FK - data may need cleanup first';
    END;
  END IF;

  -- Add to_org_id foreign key (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_to_org_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE project_contracts 
        ADD CONSTRAINT project_contracts_to_org_id_fkey 
        FOREIGN KEY (to_org_id) REFERENCES organizations(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add to_org_id FK - data may need cleanup first';
    END;
  END IF;

  -- Add disclosed_to_org_id foreign key (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_disclosed_to_org_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE project_contracts 
        ADD CONSTRAINT project_contracts_disclosed_to_org_id_fkey 
        FOREIGN KEY (disclosed_to_org_id) REFERENCES organizations(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add disclosed_to_org_id FK - data may need cleanup first';
    END;
  END IF;
END $$;

-- ============================================================================
-- Insert sample data
-- ============================================================================

-- Insert demo organizations
-- NOTE: The organizations table has a CHECK constraint on type column:
-- Allowed values: 'company', 'agency', 'client', 'freelancer_virtual'
INSERT INTO organizations (id, name, type) VALUES 
  ('acme-inc', 'Acme Inc', 'client'),
  ('techcorp-agency', 'TechCorp Agency', 'agency'),
  ('devshop-sub', 'DevShop Subcontractor', 'freelancer_virtual')
ON CONFLICT (id) DO NOTHING;

-- Insert demo project
INSERT INTO projects (id, name) VALUES 
  ('11111111-1111-1111-1111-111111111111', 
   'E-Commerce Platform Redesign')
ON CONFLICT (id) DO NOTHING;

-- Get a user_id to use for demo contracts (use first available user)
DO $$
DECLARE
  demo_user_id TEXT;
BEGIN
  -- Try to get the first user_id from auth.users (Supabase auth schema)
  BEGIN
    SELECT id::TEXT INTO demo_user_id FROM auth.users LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- If auth.users is not accessible, skip demo data
    RAISE NOTICE 'Could not access auth.users table - skipping demo contract insertion';
    RETURN;
  END;
  
  -- Only insert demo contracts if we have a user_id
  IF demo_user_id IS NOT NULL THEN
    -- Insert demo contracts
    INSERT INTO project_contracts (
      id, 
      project_id, 
      from_org_id, 
      to_org_id, 
      contract_type, 
      rate, 
      relationship, 
      status,
      user_id
    ) VALUES 
      (
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        'acme-inc',
        'techcorp-agency',
        'vendor',
        150.00,
        'client_to_agency',
        'active',
        demo_user_id
      ),
      (
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        'techcorp-agency',
        'devshop-sub',
        'subcontractor',
        85.00,
        'agency_to_sub',
        'active',
        demo_user_id
      )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Demo contracts inserted with user_id: %', demo_user_id;
  ELSE
    RAISE NOTICE 'No users found in auth.users - please create a user first, then run this script again or create contracts manually.';
  END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================

-- Check columns
SELECT 'Columns added:' as status, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_contracts'
  AND column_name IN ('from_org_id', 'to_org_id', 'project_id', 'relationship', 'disclosed_to_org_id')
ORDER BY column_name;

-- Check data
SELECT 'Sample data:' as status, COUNT(*) as contract_count
FROM project_contracts;

SELECT 'Organizations:' as status, COUNT(*) as org_count
FROM organizations;

SELECT 'Projects:' as status, COUNT(*) as project_count
FROM projects;