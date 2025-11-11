-- ============================================================================
-- Verification Script - Run this to confirm database setup
-- ============================================================================
-- This should show you all the data that was created

-- Check organizations
SELECT 'Organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'Contracts', COUNT(*) FROM project_contracts
UNION ALL
SELECT 'Periods', COUNT(*) FROM timesheet_periods
UNION ALL
SELECT 'Entries', COUNT(*) FROM timesheet_entries;

-- Show sample contracts
SELECT 
  '=== Sample Contracts ===' as info,
  user_id,
  user_name,
  contract_type,
  COALESCE(hourly_rate, daily_rate) as rate
FROM project_contracts
LIMIT 5;

-- Show October periods
SELECT 
  '=== October 2024 Periods ===' as info,
  tp.id,
  pc.user_name,
  tp.week_start_date,
  tp.total_hours,
  tp.total_days,
  tp.status
FROM timesheet_periods tp
JOIN project_contracts pc ON tp.contract_id = pc.id
WHERE tp.week_start_date >= '2024-10-01' AND tp.week_start_date < '2024-11-01'
LIMIT 10;
