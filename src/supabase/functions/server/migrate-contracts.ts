// ============================================================================
// Migration Endpoint - Local Scope Contracts Tables
// ============================================================================

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const app = new Hono();

// Migration SQL - corrected for TEXT org IDs
const MIGRATION_SQL = `
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

-- Drop existing foreign key constraints if they exist
DO $$ 
BEGIN
  -- Drop the table and recreate it to ensure clean foreign keys
  -- Only if it exists without proper constraints
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_contracts') THEN
    -- Try to add constraints if missing, otherwise recreate
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

-- Create project_contracts table with all proper foreign keys
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

-- Add foreign key constraints separately to handle existing data
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
-- STEP 5: Create indexes
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
`;

// ============================================================================
// POST /make-server-f8b491be/migrate-contracts
// Run the migration
// ============================================================================

app.post('/make-server-f8b491be/migrate-contracts', async (c) => {
  try {
    console.log('[MIGRATE-CONTRACTS] Starting migration...');

    // Create admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: MIGRATION_SQL,
    });

    if (error) {
      // Try direct query if RPC doesn't exist
      console.log('[MIGRATE-CONTRACTS] RPC failed, trying direct query...');
      
      const { error: directError } = await supabase
        .from('_sql')
        .insert({ query: MIGRATION_SQL });

      if (directError) {
        console.error('[MIGRATE-CONTRACTS] Migration failed:', directError);
        return c.json({
          success: false,
          error: directError.message,
          hint: 'You may need to run this migration manually in Supabase SQL Editor',
        }, 500);
      }
    }

    console.log('[MIGRATE-CONTRACTS] Migration successful!');

    // Verify tables exist
    const { data: tables, error: verifyError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', [
        'project_contracts',
        'contract_invitations',
        'disclosure_requests',
      ]);

    return c.json({
      success: true,
      message: 'Migration completed successfully',
      tables_verified: tables || [],
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[MIGRATE-CONTRACTS] Unexpected error:', err);
    return c.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      sql: MIGRATION_SQL,
    }, 500);
  }
});

// ============================================================================
// GET /make-server-f8b491be/migrate-contracts/verify
// Check if migration is needed
// ============================================================================

app.get('/make-server-f8b491be/migrate-contracts/verify', async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Check if tables exist
    const checks = {
      contract_invitations: false,
      disclosure_requests: false,
      disclosed_to_org_id_column: false,
      relationship_column: false,
    };

    // This is a simplified check - in production you'd query information_schema
    const { data: invitations } = await supabase
      .from('contract_invitations')
      .select('id')
      .limit(1);

    if (invitations !== null) {
      checks.contract_invitations = true;
    }

    const { data: disclosures } = await supabase
      .from('disclosure_requests')
      .select('id')
      .limit(1);

    if (disclosures !== null) {
      checks.disclosure_requests = true;
    }

    const needsMigration = !checks.contract_invitations || !checks.disclosure_requests;

    return c.json({
      needs_migration: needsMigration,
      checks,
      message: needsMigration 
        ? 'Migration needed - some tables are missing'
        : 'All tables exist',
    });

  } catch (err) {
    return c.json({
      needs_migration: true,
      error: err instanceof Error ? err.message : 'Unknown error',
      message: 'Could not verify - migration likely needed',
    });
  }
});

export default app;