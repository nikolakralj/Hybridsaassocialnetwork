import React, { useState } from 'react';
import { Database, Copy, CheckCircle, ExternalLink, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

export function DatabaseSetup() {
  const [copied, setCopied] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSeedingSupabase, setIsSeedingSupabase] = useState(false);
  const [seedSupabaseStatus, setSeedSupabaseStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const migrationSQL = `-- MIGRATION: Add missing columns (run this FIRST if tables already exist)

CREATE TABLE IF NOT EXISTS graph_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  effective_from_date DATE NOT NULL,
  effective_to_date DATE,
  graph_data JSONB NOT NULL,
  change_summary TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

ALTER TABLE timesheet_periods 
ADD COLUMN IF NOT EXISTS graph_version_id UUID;

ALTER TABLE timesheet_periods 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE timesheet_periods 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'timesheet_periods_graph_version_id_fkey'
  ) THEN
    ALTER TABLE timesheet_periods 
    ADD CONSTRAINT timesheet_periods_graph_version_id_fkey 
    FOREIGN KEY (graph_version_id) REFERENCES graph_versions(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  hours DECIMAL(4,2) NOT NULL,
  work_type TEXT NOT NULL DEFAULT 'regular' CHECK (work_type IN ('regular', 'overtime', 'travel', 'oncall')),
  task_name TEXT NOT NULL,
  task_description TEXT,
  notes TEXT,
  location TEXT CHECK (location IN ('office', 'remote', 'client_site', 'travel')),
  billable BOOLEAN DEFAULT true,
  hourly_rate DECIMAL(10,2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_versions_project ON graph_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_versions_active ON graph_versions(project_id, effective_to_date) WHERE effective_to_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_periods_graph_version ON timesheet_periods(graph_version_id);
CREATE INDEX IF NOT EXISTS idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON timesheet_entries(user_id, date);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_timesheet_periods_updated_at ON timesheet_periods;
CREATE TRIGGER update_timesheet_periods_updated_at
  BEFORE UPDATE ON timesheet_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_timesheet_entries_updated_at ON timesheet_entries;
CREATE TRIGGER update_timesheet_entries_updated_at
  BEFORE UPDATE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_period_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE timesheet_periods
  SET total_hours = (
    SELECT COALESCE(SUM(hours), 0)
    FROM timesheet_entries
    WHERE period_id = COALESCE(NEW.period_id, OLD.period_id)
  )
  WHERE id = COALESCE(NEW.period_id, OLD.period_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_period_hours_on_entry_change ON timesheet_entries;
CREATE TRIGGER update_period_hours_on_entry_change
  AFTER INSERT OR UPDATE OR DELETE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_period_total_hours();

SELECT '✅ Migration complete!' as message;`;

  const setupSQL = `-- WorkGraph Database Setup (Complete Schema)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table (companies, agencies, freelancers)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'freelancer')),
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project contracts
CREATE TABLE IF NOT EXISTS project_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  project_id UUID NOT NULL,
  contract_type TEXT NOT NULL,
  hourly_rate DECIMAL(10,2),
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Graph versions table (temporal versioning)
CREATE TABLE IF NOT EXISTS graph_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  effective_from_date DATE NOT NULL,
  effective_to_date DATE,
  graph_data JSONB NOT NULL,
  change_summary TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

-- Timesheet periods (weekly summaries)
CREATE TABLE IF NOT EXISTS timesheet_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  graph_version_id UUID REFERENCES graph_versions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timesheet entries (daily task details)
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  hours DECIMAL(4,2) NOT NULL,
  work_type TEXT NOT NULL DEFAULT 'regular' CHECK (work_type IN ('regular', 'overtime', 'travel', 'oncall')),
  task_name TEXT NOT NULL,
  task_description TEXT,
  notes TEXT,
  location TEXT CHECK (location IN ('office', 'remote', 'client_site', 'travel')),
  billable BOOLEAN DEFAULT true,
  hourly_rate DECIMAL(10,2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contracts_user ON project_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON project_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_periods_contract ON timesheet_periods(contract_id);
CREATE INDEX IF NOT EXISTS idx_periods_status ON timesheet_periods(status);
CREATE INDEX IF NOT EXISTS idx_graph_versions_project ON graph_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_versions_active ON graph_versions(project_id, effective_to_date) WHERE effective_to_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_periods_graph_version ON timesheet_periods(graph_version_id);
CREATE INDEX IF NOT EXISTS idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON timesheet_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_work_type ON timesheet_entries(work_type);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_timesheet_periods_updated_at ON timesheet_periods;
CREATE TRIGGER update_timesheet_periods_updated_at
  BEFORE UPDATE ON timesheet_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_timesheet_entries_updated_at ON timesheet_entries;
CREATE TRIGGER update_timesheet_entries_updated_at
  BEFORE UPDATE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate period total_hours
CREATE OR REPLACE FUNCTION update_period_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE timesheet_periods
  SET total_hours = (
    SELECT COALESCE(SUM(hours), 0)
    FROM timesheet_entries
    WHERE period_id = COALESCE(NEW.period_id, OLD.period_id)
  )
  WHERE id = COALESCE(NEW.period_id, OLD.period_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_period_hours_on_entry_change ON timesheet_entries;
CREATE TRIGGER update_period_hours_on_entry_change
  AFTER INSERT OR UPDATE OR DELETE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_period_total_hours();

-- Success message
SELECT 'Database setup complete with temporal graph versioning and task tracking! ✅' as message;`;

  const copySQL = () => {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(setupSQL)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.warn('Clipboard API failed, using fallback:', err);
          fallbackCopyTextToClipboard(setupSQL);
        });
    } else {
      // Fallback for older browsers or non-secure contexts
      fallbackCopyTextToClipboard(setupSQL);
    }
  };

  const copyMigrationSQL = () => {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(migrationSQL)
        .then(() => {
          setCopiedMigration(true);
          setTimeout(() => setCopiedMigration(false), 2000);
        })
        .catch((err) => {
          console.warn('Clipboard API failed, using fallback:', err);
          fallbackCopyTextToClipboard(migrationSQL);
        });
    } else {
      // Fallback for older browsers or non-secure contexts
      fallbackCopyTextToClipboard(migrationSQL);
    }
  };

  // Fallback copy method for browsers that don't support clipboard API
  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.error('Fallback copy failed');
        alert('Copy failed. Please manually select and copy the SQL script.');
      }
    } catch (err) {
      console.error('Fallback copy error:', err);
      alert('Copy failed. Please manually select and copy the SQL script.');
    }
    
    document.body.removeChild(textArea);
  };

  const openSupabase = () => {
    window.open('https://supabase.com/dashboard/project/_/sql/new', '_blank');
  };

  const seedDatabase = async () => {
    setIsSeeding(true);
    setSeedStatus('idle');
    
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setSeedStatus('success');
        toast.success('Database seeded successfully!', {
          description: `${data.details?.users || 0} users, ${data.details?.entries || 0} timesheet entries created`,
        });
        console.log('✅ Seed response:', data);
      } else {
        setSeedStatus('error');
        toast.error('Failed to seed database', {
          description: data.error || 'Please try again.',
        });
        console.error('❌ Seed error:', data);
      }
    } catch (error) {
      setSeedStatus('error');
      toast.error('Failed to seed database', {
        description: 'Network error. Please try again.',
      });
      console.error('❌ Seed error:', error);
    } finally {
      setIsSeeding(false);
    }
  };

  const seedDatabaseSupabase = async () => {
    setIsSeedingSupabase(true);
    setSeedSupabaseStatus('idle');
    
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/seed-supabase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text);
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }

      const data = await response.json();

      if (response.ok && data.success) {
        setSeedSupabaseStatus('success');
        toast.success('✅ Database cleared and seeded successfully!', {
          description: `Fresh data: ${data.summary.organizations} orgs, ${data.summary.contracts} contracts, ${data.summary.periods} periods`,
          duration: 5000,
        });
        console.log('✅ Seed response:', data);
        console.log('🎉 All old data cleared, new UUIDs created!');
      } else {
        setSeedSupabaseStatus('error');
        
        // ✅ Check if it's a missing table error
        const errorMessage = data.error || data.details?.message || 'Unknown error';
        const isMissingTable = errorMessage.includes('graph_versions') || 
                               errorMessage.includes('PGRST') ||
                               errorMessage.includes('schema cache');
        
        if (isMissingTable) {
          toast.error('Database tables not created yet!', {
            description: 'Please run the SQL script in Step 1-3 first to create the tables.',
            duration: 6000,
          });
        } else {
          toast.error('Failed to seed database', {
            description: errorMessage,
          });
        }
        console.error('❌ Seed error:', data);
      }
    } catch (error) {
      setSeedSupabaseStatus('error');
      toast.error('Failed to seed database', {
        description: error instanceof Error ? error.message : 'Network error. Please try again.',
      });
      console.error('❌ Seed error:', error);
    } finally {
      setIsSeedingSupabase(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Database Setup</h1>
          </div>
          <p className="text-gray-600">
            Set up your WorkGraph database tables in 30 seconds
          </p>
        </div>

        {/* Error Alert */}
        <Card className="mb-6 p-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Database Tables Missing or Incomplete</h3>
              <p className="text-sm text-red-700 mb-2">
                The application is trying to query database tables that don't exist yet or are missing columns.
              </p>
              <p className="text-sm text-red-700">
                <strong>If you're getting "column graph_version_id does not exist":</strong> Your tables already exist but are missing new columns. Use the <strong>MIGRATION SCRIPT</strong> below instead of the full setup.
              </p>
            </div>
          </div>
        </Card>

        {/* Migration Script for Existing Tables */}
        <Card className="mb-6 p-6 border-orange-200 bg-orange-50">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-orange-900">
            <span className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">⚠️</span>
            Already Have Tables? Use Migration Script
          </h2>
          
          <p className="text-orange-700 mb-4">
            If you already created tables and are getting errors about missing columns like <code className="bg-orange-100 px-2 py-0.5 rounded">graph_version_id</code>, 
            use this migration script instead of the full setup below.
          </p>
          
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-64">
              {migrationSQL}
            </pre>
            
            <Button
              onClick={copyMigrationSQL}
              className="absolute top-4 right-4"
              variant={copiedMigration ? "default" : "outline"}
            >
              {copiedMigration ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Migration
                </>
              )}
            </Button>
          </div>
          
          <div className="mt-4 p-4 bg-orange-100 rounded border border-orange-300">
            <p className="text-sm text-orange-900">
              <strong>How to use:</strong> Copy this script, paste it in Supabase SQL Editor, and run it. 
              It will add missing columns to your existing tables without deleting any data.
            </p>
          </div>
        </Card>

        {/* Instructions */}
        <Card className="mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
            Copy the SQL Script
          </h2>
          
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-96">
              {setupSQL}
            </pre>
            
            <Button
              onClick={copySQL}
              className="absolute top-4 right-4"
              variant={copied ? "default" : "outline"}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy SQL
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
            Open Supabase SQL Editor
          </h2>
          
          <p className="text-gray-600 mb-4">
            Click the button below to open the Supabase SQL Editor in a new tab.
          </p>
          
          <Button onClick={openSupabase} variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Supabase SQL Editor
          </Button>
        </Card>

        <Card className="mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
            Paste & Run
          </h2>
          
          <ol className="space-y-3 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm">1.</span>
              <span>Paste the copied SQL into the SQL Editor</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm">2.</span>
              <span>Click the <strong>"RUN"</strong> button (or press Ctrl+Enter)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm">3.</span>
              <span>Wait for the success message: <strong>"Database setup complete with temporal graph versioning and task tracking! ✅"</strong></span>
            </li>
          </ol>
        </Card>

        <Card className="mb-6 p-6 border-green-200 bg-green-50">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-green-900">
            <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
            Reload the App
          </h2>
          
          <p className="text-green-700 mb-4">
            After running the SQL script successfully, reload this page to verify the setup.
          </p>
          
          <Button 
            onClick={() => window.location.reload()}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Reload & Verify
          </Button>
        </Card>

        {/* Seed Database with Supabase */}
        <Card className="mb-6 p-6 border-blue-200 bg-blue-50">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-blue-900">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">5</span>
            Seed Database
          </h2>
          
          <p className="text-blue-700 mb-4">
            Populate the database with sample data to get started quickly.
          </p>
          
          <Button 
            onClick={seedDatabaseSupabase}
            className="bg-blue-600 hover:bg-blue-700 w-full"
            disabled={isSeedingSupabase}
          >
            {isSeedingSupabase ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Seeding...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Seed Database
              </>
            )}
          </Button>
          
          {seedSupabaseStatus === 'success' && (
            <p className="text-sm text-green-600 mt-2">
              Database seeded successfully!
            </p>
          )}
          
          {seedSupabaseStatus === 'error' && (
            <p className="text-sm text-red-600 mt-2">
              Failed to seed database. Please try again.
            </p>
          )}
        </Card>

        {/* What Gets Created */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">What gets created?</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">📁 organizations</h3>
              <p className="text-sm text-gray-600">
                Stores companies, agencies, and freelancers
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">📄 project_contracts</h3>
              <p className="text-sm text-gray-600">
                Tracks who is working on which projects and their rates
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">⏱️ timesheet_periods</h3>
              <p className="text-sm text-gray-600">
                Weekly timesheet submissions with hours, status, and approval data
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">📅 timesheet_entries</h3>
              <p className="text-sm text-gray-600">
                Daily task details for each timesheet period
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">🚀 Performance Indexes</h3>
              <p className="text-sm text-gray-600">
                Database indexes for fast queries on users, projects, and status
              </p>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Need help? Check the{' '}
            <a href="/docs/DATABASE_SETUP.md" className="text-blue-600 hover:underline">
              full documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}