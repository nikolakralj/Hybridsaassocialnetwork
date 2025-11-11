/**
 * Database Setup Guide
 * 
 * Shows instructions for initializing the Supabase database with required tables.
 * This is a one-time setup needed before using the Project Graph stats feature.
 */

import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Database, Copy, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

export function DatabaseSetupGuide() {
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const migrationSQL = `-- WorkGraph Database Schema
-- Run this in your Supabase SQL Editor to create required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'freelancer')),
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);

-- Project contracts table
CREATE TABLE IF NOT EXISTS project_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('individual_contributor', 'company_employee', 'agency_contractor')),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('hourly', 'daily', 'fixed', 'custom')),
  rate DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),
  daily_rate DECIMAL(10,2),
  fixed_amount DECIMAL(10,2),
  hide_rate BOOLEAN DEFAULT FALSE,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_org ON project_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_user ON project_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON project_contracts(project_id);

-- Timesheet periods table (weekly)
CREATE TABLE IF NOT EXISTS timesheet_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(5,2) DEFAULT 0,
  total_days DECIMAL(5,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,
  contractor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_periods_contract ON timesheet_periods(contract_id);
CREATE INDEX IF NOT EXISTS idx_periods_dates ON timesheet_periods(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_periods_status ON timesheet_periods(status);

-- Timesheet entries table (daily)
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(5,2),
  days DECIMAL(5,2),
  task_category TEXT,
  task_description TEXT NOT NULL,
  work_type TEXT DEFAULT 'regular' CHECK (work_type IN ('regular', 'overtime', 'travel', 'oncall')),
  billable BOOLEAN DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON timesheet_entries(date);`;

  const seedDataSQL = `-- Sample Data for WorkGraph
-- Run this after creating the tables above

-- Insert organizations
INSERT INTO organizations (id, name, type, logo) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Acme Dev Studio', 'company', '🏢'),
  ('550e8400-e29b-41d4-a716-446655440002', 'BrightWorks Design', 'company', '🎨')
ON CONFLICT (id) DO NOTHING;

-- Insert project contracts
INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, hourly_rate, start_date) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'Sarah Johnson', 'company_employee', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'hourly', 85.00, '2024-12-01'),
  ('650e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', 'Mike Chen', 'company_employee', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'hourly', 90.00, '2024-12-01')
ON CONFLICT (id) DO NOTHING;

-- Insert timesheet periods
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at) VALUES
  ('950e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T09:00:00Z'),
  ('950e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T09:15:00Z')
ON CONFLICT (id) DO NOTHING;`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <Database className="w-12 h-12 mx-auto text-blue-500" />
        <h1 className="m-0">Database Setup Required</h1>
        <p className="text-muted-foreground m-0">
          The Project Graph needs database tables to show real stats. Follow these steps to set up your Supabase database.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-center gap-4">
        <Badge variant={step >= 1 ? "default" : "outline"}>1. Create Tables</Badge>
        <Badge variant={step >= 2 ? "default" : "outline"}>2. Add Sample Data</Badge>
        <Badge variant={step >= 3 ? "default" : "outline"}>3. Test Connection</Badge>
      </div>

      {/* Step 1: Create Tables */}
      {step === 1 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span>1</span>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="m-0 mb-1">Create Database Tables</h2>
                <p className="text-muted-foreground m-0">
                  Open your Supabase SQL Editor and run this migration to create the required tables.
                </p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This creates 4 tables: <code>organizations</code>, <code>project_contracts</code>, 
                  <code>timesheet_periods</code>, and <code>timesheet_entries</code>
                </AlertDescription>
              </Alert>

              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                  <code>{migrationSQL}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(migrationSQL)}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy SQL
                    </>
                  )}
                </Button>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => window.open('https://supabase.com/dashboard/project/_/sql/new', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open SQL Editor
                </Button>
                <Button onClick={() => setStep(2)}>
                  Next: Add Sample Data →
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Add Sample Data */}
      {step === 2 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span>2</span>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="m-0 mb-1">Add Sample Data (Optional)</h2>
                <p className="text-muted-foreground m-0">
                  Add sample organizations and contracts to test the Project Graph.
                </p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This adds 2 companies, 2 contractors, and sample timesheet data for testing.
                </AlertDescription>
              </Alert>

              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                  <code>{seedDataSQL}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(seedDataSQL)}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy SQL
                    </>
                  )}
                </Button>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button variant="outline" onClick={() => setStep(3)}>
                  Skip Sample Data
                </Button>
                <Button onClick={() => setStep(3)}>
                  Next: Test Connection →
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Test Connection */}
      {step === 3 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="m-0 mb-1">Setup Complete! 🎉</h2>
                <p className="text-muted-foreground m-0">
                  Your database is ready. The Project Graph will now show real stats when you click on nodes.
                </p>
              </div>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Navigate to <strong>Project Workspace → Project Graph</strong> and click on any node to see live stats!
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="m-0"><strong>What you can do now:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Click person nodes to see hours worked, pending timesheets</li>
                  <li>Click party nodes to see employee count, contracts</li>
                  <li>Click contract nodes to see budget utilization, billing</li>
                  <li>All stats are calculated from real database queries!</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ← Start Over
                </Button>
                <Button onClick={() => window.location.href = '/demo/workgraph'}>
                  Go to Project Graph →
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Help Section */}
      <Card className="p-4 bg-muted">
        <div className="space-y-2">
          <p className="m-0"><strong>Need help?</strong></p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Make sure you're logged into Supabase</li>
            <li>The SQL Editor is at: Dashboard → SQL Editor → New Query</li>
            <li>Tables are created with <code>CREATE TABLE IF NOT EXISTS</code> - safe to run multiple times</li>
            <li>Check browser console for error messages if queries fail</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
