-- Add graph_version_id column to existing timesheet_periods table
-- Run this in Supabase SQL Editor if you already created the table without this column

ALTER TABLE public.timesheet_periods 
ADD COLUMN IF NOT EXISTS graph_version_id UUID REFERENCES graph_versions(id);

ALTER TABLE public.timesheet_periods 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Create index for graph version lookups
CREATE INDEX IF NOT EXISTS idx_periods_graph_version 
ON public.timesheet_periods USING btree (graph_version_id);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'timesheet_periods'
ORDER BY ordinal_position;
