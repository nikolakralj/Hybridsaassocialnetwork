/**
 * 🔧 UNIFIED DATABASE SETUP PAGE
 * 
 * This is the ONLY setup page you need.
 * Combines:
 * - Postgres table creation (production schema)
 * - Demo data seeding (Alice, Bob, Charlie)
 * - Test approval workflow creation
 * - Health check and verification
 */

import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Database, Users, CheckCircle2, AlertCircle, Loader2, Trash2, Copy, Check } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { TEST_PERSONAS } from '../contexts/PersonaContext';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function DatabaseSetupPage() {
  const [sqlStatus, setSqlStatus] = useState<Status>('idle');
  const [seedStatus, setSeedStatus] = useState<Status>('idle');
  const [approvalStatus, setApprovalStatus] = useState<Status>('idle');
  const [clearStatus, setClearStatus] = useState<Status>('idle');
  
  const [sqlMessage, setSqlMessage] = useState('');
  const [seedMessage, setSeedMessage] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [clearMessage, setClearMessage] = useState('');
  
  const [copied, setCopied] = useState(false);

  const supabase = createClient();

  // ============================================================================
  // STEP 1: Create Postgres Tables (Production Schema)
  // ============================================================================
  
  const SQL_SCHEMA = `
-- ============================================================================
-- WORKGRAPH PRODUCTION SCHEMA
-- Phase 5: Timesheet & Approval System
-- ============================================================================

-- Organizations (companies, agencies, freelancer virtual orgs)
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'client', 'freelancer_virtual')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add icon column if it doesn't exist (for backward compatibility)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'icon'
  ) THEN
    ALTER TABLE organizations ADD COLUMN icon TEXT DEFAULT '🏢';
  END IF;
END $$;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_org_id TEXT REFERENCES organizations(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Project Contracts (links users to projects with rates)
CREATE TABLE IF NOT EXISTS project_contracts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('company_employee', 'agency_contractor', 'indie_freelancer')),
  organization_id TEXT REFERENCES organizations(id),
  project_id TEXT REFERENCES projects(id),
  contract_type TEXT DEFAULT 'hourly',
  hourly_rate DECIMAL(10,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Timesheet Periods (weekly/monthly summaries)
CREATE TABLE IF NOT EXISTS timesheet_periods (
  id TEXT PRIMARY KEY,
  contract_id TEXT REFERENCES project_contracts(id),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'manager_approved', 'client_approved', 'fully_approved', 'rejected')),
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Timesheet Entries (daily time logs)
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id TEXT PRIMARY KEY,
  period_id TEXT REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL,
  description TEXT,
  billable BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contracts_user ON project_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON project_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_periods_contract ON timesheet_periods(contract_id);
CREATE INDEX IF NOT EXISTS idx_periods_status ON timesheet_periods(status);
CREATE INDEX IF NOT EXISTS idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON timesheet_entries(entry_date);
`;

  const runSqlMigrations = async () => {
    setSqlStatus('loading');
    setSqlMessage('Creating Postgres tables...');

    try {
      // Execute schema creation
      // NOTE: This is a simplified approach. In production, use proper migrations.
      const tables = ['organizations', 'projects', 'project_contracts', 'timesheet_periods', 'timesheet_entries'];
      
      // Check if tables exist by trying to query them
      let tablesCreated = 0;
      const missingTables: string[] = [];
      
      for (const table of tables) {
        try {
          await supabase.from(table).select('id').limit(1);
          tablesCreated++;
        } catch (err) {
          // Table doesn't exist yet
          missingTables.push(table);
        }
      }

      if (tablesCreated === tables.length) {
        setSqlStatus('success');
        setSqlMessage(`✅ All ${tables.length} tables already exist!\n\nTables: ${tables.join(', ')}\n\n🎯 Click "Seed Demo Data" to continue!`);
      } else {
        setSqlStatus('error');
        setSqlMessage(`⚠️ Missing ${missingTables.length} tables: ${missingTables.join(', ')}\n\n📋 REQUIRED: Copy SQL below and run it in Supabase:\n\n1. Click "Copy SQL" button below\n2. Go to Supabase Dashboard → SQL Editor\n3. Paste the SQL\n4. Click "Run"\n5. Come back and click "Check Tables" again\n\nThen you can seed demo data.`);
      }
    } catch (error) {
      setSqlStatus('error');
      setSqlMessage('Error checking tables: ' + String(error));
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ============================================================================
  // STEP 2: Seed Demo Data (Alice, Bob, Charlie + Timesheets)
  // ============================================================================

  const seedDemoData = async () => {
    setSeedStatus('loading');
    setSeedMessage('Seeding demo data...');

    try {
      const alice = TEST_PERSONAS.find(p => p.role === 'contractor')!;
      const bob = TEST_PERSONAS.find(p => p.role === 'manager')!;
      const charlie = TEST_PERSONAS.find(p => p.role === 'client')!;

      // 1. Create organizations
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .upsert([
          { id: 'company-1', name: 'Acme Dev Studio', type: 'company' }, // ✅ Changed to company-1
          { id: 'org-brightworks', name: 'BrightWorks Design', type: 'company' },
        ], { onConflict: 'id' })
        .select();

      if (orgError) throw orgError;

      // 2. Create project
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .upsert([
          { id: 'proj-workgraph-mvp', name: 'WorkGraph MVP - Phase 5', client_org_id: 'company-1', status: 'active' }, // ✅ Changed to company-1
        ], { onConflict: 'id' })
        .select();

      if (projectError) throw projectError;

      // 3. Create contracts for Alice, Bob, Charlie
      const { data: contracts, error: contractError } = await supabase
        .from('project_contracts')
        .upsert([
          {
            id: 'contract-alice',
            user_id: alice.id,
            user_name: alice.name,
            user_role: 'indie_freelancer',
            organization_id: 'company-1', // ✅ Changed to company-1
            project_id: 'proj-workgraph-mvp',
            contract_type: 'hourly',
            hourly_rate: 150.00,
            start_date: '2025-11-01',
          },
        ], { onConflict: 'id' })
        .select();

      if (contractError) throw contractError;

      // 4. Create timesheet period for Alice (current week)
      const { data: periods, error: periodError } = await supabase
        .from('timesheet_periods')
        .upsert([
          {
            id: 'period-2025-11-04',
            contract_id: 'contract-alice',
            week_start_date: '2025-11-04',
            week_end_date: '2025-11-10',
            total_hours: 40,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          },
        ], { onConflict: 'id' })
        .select();

      if (periodError) throw periodError;

      // 5. Create daily time entries for Alice
      const entries = [
        { entry_date: '2025-11-04', hours: 8, description: 'Phase 5 - Approval system backend' },
        { entry_date: '2025-11-05', hours: 8, description: 'Phase 5 - Email integration' },
        { entry_date: '2025-11-06', hours: 8, description: 'Phase 5 - Persona test mode' },
        { entry_date: '2025-11-07', hours: 8, description: 'Phase 5 - Database setup' },
        { entry_date: '2025-11-08', hours: 8, description: 'Phase 5 - End-to-end testing' },
      ];

      const { data: entryData, error: entryError } = await supabase
        .from('timesheet_entries')
        .upsert(
          entries.map((e, i) => ({
            id: `entry-alice-${i + 1}`,
            period_id: 'period-2025-11-04',
            ...e,
            billable: true,
          })),
          { onConflict: 'id' }
        )
        .select();

      if (entryError) throw entryError;

      setSeedStatus('success');
      setSeedMessage(`✅ Demo data created!\n\n👥 Users: Alice, Bob, Charlie\n📋 Timesheet: 40h @ $150/hr = $6,000\n📅 Period: Nov 4-10, 2025\n\n🎯 Now switch to Alice to see her timesheet!`);
    } catch (error: any) {
      setSeedStatus('error');
      setSeedMessage('Error seeding data: ' + (error.message || String(error)));
    }
  };

  // ============================================================================
  // STEP 3: Create Approval Workflow (KV Tokens)
  // ============================================================================

  const createApprovalWorkflow = async () => {
    setApprovalStatus('loading');
    setApprovalMessage('Creating approval workflow...');

    try {
      const alice = TEST_PERSONAS.find(p => p.role === 'contractor')!;
      const bob = TEST_PERSONAS.find(p => p.role === 'manager')!;
      const charlie = TEST_PERSONAS.find(p => p.role === 'client')!;

      const testApprovalItem = {
        id: 'approval-alice-2025-11-04',
        project_id: 'proj-workgraph-mvp',
        project_name: 'WorkGraph MVP - Phase 5',
        period_start: '2025-11-04',
        period_end: '2025-11-10',
        status: 'pending',
        submitter_id: alice.id,
        submitter_name: alice.name,
        submitter_email: alice.email,
        current_approver_id: bob.id,
        current_approver_name: bob.name,
        current_approver_email: bob.email,
        next_approver_id: charlie.id,
        next_approver_name: charlie.name,
        next_approver_email: charlie.email,
        approval_chain: [
          { id: bob.id, name: bob.name, type: 'manager' },
          { id: charlie.id, name: charlie.name, type: 'client' },
        ],
        hours_total: 40,
        amount: 6000,
        timesheet_period_id: 'period-2025-11-04',
      };

      const approveToken = `token-${Date.now()}-approve`;
      const rejectToken = `token-${Date.now()}-reject`;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/seed-approval-test-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            approvalItem: testApprovalItem,
            approveToken: {
              id: approveToken,
              approval_item_id: 'approval-alice-2025-11-04',
              approver_id: bob.id,
              approver_name: bob.name,
              approver_email: bob.email,
              action: 'approve',
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
            rejectToken: {
              id: rejectToken,
              approval_item_id: 'approval-alice-2025-11-04',
              approver_id: bob.id,
              approver_name: bob.name,
              approver_email: bob.email,
              action: 'reject',
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setApprovalStatus('success');
        setApprovalMessage(`✅ Approval workflow created!\n\n🔑 Tokens stored in KV\n📧 Bob will receive email to approve\n\n🎯 Switch to Bob to see pending approval!`);
      } else {
        setApprovalStatus('error');
        setApprovalMessage(data.error || 'Failed to create approval workflow');
      }
    } catch (error) {
      setApprovalStatus('error');
      setApprovalMessage('Network error: ' + String(error));
    }
  };

  // ============================================================================
  // STEP 4: Clear All Test Data
  // ============================================================================

  const clearAllData = async () => {
    if (!confirm('⚠️ This will delete ALL test data from KV store. Continue?')) {
      return;
    }

    setClearStatus('loading');
    setClearMessage('Clearing test data...');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/clear-all-test-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setClearStatus('success');
        setClearMessage(`✅ Cleared KV data!\n\n${JSON.stringify(data.deleted, null, 2)}\n\n⚠️ Postgres data NOT deleted (use Supabase UI to clear tables)`);
      } else {
        setClearStatus('error');
        setClearMessage(data.error || 'Failed to clear data');
      }
    } catch (error) {
      setClearStatus('error');
      setClearMessage('Network error: ' + String(error));
    }
  };

  // ============================================================================
  // STEP 5: Reset Timesheet to Draft (for testing)
  // ============================================================================

  const [resetStatus, setResetStatus] = useState<Status>('idle');
  const [resetMessage, setResetMessage] = useState('');

  const resetTimesheetToDraft = async () => {
    setResetStatus('loading');
    setResetMessage('Resetting timesheet to draft...');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/timesheet-approvals/reset-to-draft`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            periodId: 'period-test-001', // The period created by seed data
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setResetStatus('success');
        setResetMessage(`✅ Timesheet reset to draft!\n\n${data.message}\n\n📝 You can now test the submit/approve workflow again.`);
      } else {
        setResetStatus('error');
        setResetMessage(data.error || 'Failed to reset timesheet');
      }
    } catch (error) {
      setResetStatus('error');
      setResetMessage('Network error: ' + String(error));
    }
  };

  // ============================================================================
  // UI
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">🔧 Database Setup</h1>
          <p className="text-muted-foreground">
            Set up Postgres tables and seed test data for WorkGraph
          </p>
        </div>

        {/* Step 1: SQL Schema */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold">Step 1: Create Postgres Tables</h2>
              <p className="text-sm text-muted-foreground">Production schema for organizations, contracts, timesheets</p>
            </div>
          </div>

          <Button 
            onClick={runSqlMigrations}
            disabled={sqlStatus === 'loading'}
            className="w-full"
          >
            {sqlStatus === 'loading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Check Tables
          </Button>

          {sqlMessage && (
            <div className={`p-4 rounded-lg ${
              sqlStatus === 'success' ? 'bg-green-50 text-green-900' :
              sqlStatus === 'error' ? 'bg-orange-50 text-orange-900' :
              'bg-gray-50'
            }`}>
              <pre className="text-sm whitespace-pre-wrap">{sqlMessage}</pre>
            </div>
          )}

          {sqlStatus === 'error' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">📋 SQL Schema (Copy & Paste)</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copySqlToClipboard}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy SQL'}
                </Button>
              </div>
              <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                {SQL_SCHEMA}
              </pre>
            </div>
          )}
        </Card>

        {/* Step 2: Seed Data */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold">Step 2: Seed Demo Data</h2>
              <p className="text-sm text-muted-foreground">Create Alice, Bob, Charlie + test timesheet (40h @ $150/hr)</p>
            </div>
          </div>

          <Button 
            onClick={seedDemoData}
            disabled={seedStatus === 'loading' || sqlStatus !== 'success'}
            className="w-full"
            variant="default"
          >
            {seedStatus === 'loading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Seed Demo Data
          </Button>

          {seedMessage && (
            <div className={`p-4 rounded-lg ${
              seedStatus === 'success' ? 'bg-green-50 text-green-900' :
              seedStatus === 'error' ? 'bg-red-50 text-red-900' :
              'bg-gray-50'
            }`}>
              <pre className="text-sm whitespace-pre-wrap">{seedMessage}</pre>
            </div>
          )}
        </Card>

        {/* Step 3: Approval Workflow */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold">Step 3: Create Approval Workflow (Optional)</h2>
              <p className="text-sm text-muted-foreground">Generate KV tokens for email-based approvals</p>
            </div>
          </div>

          <Button 
            onClick={createApprovalWorkflow}
            disabled={approvalStatus === 'loading' || seedStatus !== 'success'}
            className="w-full"
            variant="outline"
          >
            {approvalStatus === 'loading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Approval Tokens
          </Button>

          {approvalMessage && (
            <div className={`p-4 rounded-lg ${
              approvalStatus === 'success' ? 'bg-green-50 text-green-900' :
              approvalStatus === 'error' ? 'bg-red-50 text-red-900' :
              'bg-gray-50'
            }`}>
              <pre className="text-sm whitespace-pre-wrap">{approvalMessage}</pre>
            </div>
          )}
        </Card>

        {/* Clear Data */}
        <Card className="p-6 space-y-4 border-red-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h2 className="font-semibold text-red-900">Danger Zone: Clear All Test Data</h2>
              <p className="text-sm text-red-700">Deletes approval tokens from KV (Postgres data remains)</p>
            </div>
          </div>

          <Button 
            onClick={clearAllData}
            disabled={clearStatus === 'loading'}
            className="w-full"
            variant="destructive"
          >
            {clearStatus === 'loading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Clear KV Data
          </Button>

          {clearMessage && (
            <div className={`p-4 rounded-lg ${
              clearStatus === 'success' ? 'bg-green-50 text-green-900' :
              clearStatus === 'error' ? 'bg-red-50 text-red-900' :
              'bg-gray-50'
            }`}>
              <pre className="text-sm whitespace-pre-wrap">{clearMessage}</pre>
            </div>
          )}
        </Card>

        {/* Reset Timesheet */}
        <Card className="p-6 space-y-4 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold">Step 5: Reset Timesheet to Draft (for testing)</h2>
              <p className="text-sm text-muted-foreground">Reset Alice's timesheet to draft status</p>
            </div>
          </div>

          <Button 
            onClick={resetTimesheetToDraft}
            disabled={resetStatus === 'loading'}
            className="w-full"
            variant="outline"
          >
            {resetStatus === 'loading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Reset Timesheet to Draft
          </Button>

          {resetMessage && (
            <div className={`p-4 rounded-lg ${
              resetStatus === 'success' ? 'bg-green-50 text-green-900' :
              resetStatus === 'error' ? 'bg-red-50 text-red-900' :
              'bg-gray-50'
            }`}>
              <pre className="text-sm whitespace-pre-wrap">{resetMessage}</pre>
            </div>
          )}
        </Card>

        {/* Next Steps */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold mb-2 text-blue-900">✅ Next Steps After Setup:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Switch to <strong>Alice Chen</strong> (Contractor) using the persona switcher</li>
            <li>Go to <strong>Projects</strong> → <strong>Timesheets</strong></li>
            <li>You should see ONLY Alice's timesheet (40h, $6,000)</li>
            <li>Switch to <strong>Bob Martinez</strong> (Manager)</li>
            <li>Go to <strong>My Approvals</strong> to approve Alice's timesheet</li>
            <li>Switch to <strong>Charlie Davis</strong> (Client) for final approval</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}