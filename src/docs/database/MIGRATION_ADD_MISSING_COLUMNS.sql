-- ============================================================================
-- MIGRATION: Add missing columns to existing tables
-- Run this FIRST if you already have tables created
-- ============================================================================

-- Step 1: Create graph_versions table if it doesn't exist
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

-- Step 2: Add missing columns to timesheet_periods
ALTER TABLE timesheet_periods 
ADD COLUMN IF NOT EXISTS graph_version_id UUID;

ALTER TABLE timesheet_periods 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE timesheet_periods 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 3: Add foreign key constraint (if column was just added)
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

-- Step 4: Create timesheet_entries table for task-level tracking
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

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_graph_versions_project ON graph_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_versions_active ON graph_versions(project_id, effective_to_date) WHERE effective_to_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_periods_graph_version ON timesheet_periods(graph_version_id);
CREATE INDEX IF NOT EXISTS idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON timesheet_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_work_type ON timesheet_entries(work_type);

-- Step 6: Create triggers for auto-updating timestamps
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

-- Step 7: Create trigger for auto-calculating period total_hours
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

-- Step 8: Verify the changes
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('timesheet_periods', 'graph_versions', 'timesheet_entries')
ORDER BY table_name, ordinal_position;

-- Success message
SELECT '✅ Migration complete! All missing columns and tables added.' as message;
